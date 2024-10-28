import * as anchor from "@coral-xyz/anchor";
import { AnchorError, Program } from "@coral-xyz/anchor";
import { Roullete } from "../target/types/roullete";
import { assert, expect } from "chai";
import { Wallet } from "@coral-xyz/anchor/dist/cjs/provider";

import {
  getBalances,
  activateAccount,
  convertLamportToSol,
  shoot_s,
  getEvent,
} from "./utils";

//!IMPORTANT: equal, equals and eq is same which are strict equality (===)
// whereas eql and eqls are same meaning deep equality ( for objects and arrays )

describe("roullete", async () => {
  let program: Program<Roullete>;
  let gameKeypair: anchor.web3.PublicKey;
  // let playerOne: Wallet;
  let playerOne: anchor.web3.Keypair;
  let playerTwo: anchor.web3.Keypair;
  let uncheckedAccPubkey: anchor.web3.PublicKey;
  anchor.setProvider(anchor.AnchorProvider.env());

  before(async () => {
    //setting accounts
    program = anchor.workspace.Roullete as Program<Roullete>;
    // playerOne = (program.provider as anchor.AnchorProvider).wallet;
    playerOne = anchor.web3.Keypair.generate();
    uncheckedAccPubkey = anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY;
    playerTwo = anchor.web3.Keypair.generate();
    [gameKeypair] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        playerOne.publicKey.toBuffer(),
        playerTwo.publicKey.toBuffer(),
        Buffer.from("session"),
      ],
      program.programId
    );

    // activating accounts
    await activateAccount(anchor.AnchorProvider.env(), playerTwo.publicKey);
    await activateAccount(anchor.AnchorProvider.env(), playerOne.publicKey);
  });

  describe("initiation tests", () => {
    beforeEach(
      async () =>
        await getBalances(
          "initial",
          program.provider.connection,
          gameKeypair,
          playerOne.publicKey,
          playerTwo.publicKey,
          uncheckedAccPubkey
        )
    );

    afterEach(
      async () =>
        await getBalances(
          "final",
          program.provider.connection,
          gameKeypair,
          playerOne.publicKey,
          playerTwo.publicKey,
          uncheckedAccPubkey
        )
    );
    it("Players added", async () => {
      await program.methods
        .joinSession(playerOne.publicKey, playerTwo.publicKey)
        .accounts({
          playerOne: playerOne.publicKey,
          playerTwo: playerTwo.publicKey,
        })
        .signers([playerOne, playerTwo])
        .rpc()
        .catch((err) => console.log(err));

      let session = await program.account.session.fetch(gameKeypair);

      expect(session.playerOne).is.eql(
        playerOne.publicKey,
        "Player One mismatch"
      );

      expect(session.playerTwo).is.eql(
        playerTwo.publicKey,
        "Player One mismatch"
      );
    });

    it("session started", async () => {
      const session = await program.account.session.fetch(gameKeypair);
      expect(session.turn).is.equal(false, "turn is not correct");

      expect(session.state).is.eql({ active: {} }, "game is not active");
      console.log("Session Load : ", session.load);
      expect(session.trigger).is.equals(0, "trigger is not set");
    });
  });

  describe("game tests", () => {
    let load: boolean[];
    let over: boolean;
    let player_one_turn: boolean;

    before("setting load and all", async () => {
      load = (await program.account.session.fetch(gameKeypair)).load;
      over =
        JSON.stringify(
          (await program.account.session.fetch(gameKeypair)).state
        ) !== JSON.stringify({ active: {} });
    });
    beforeEach(
      async () =>
        await getBalances(
          "initial",
          program.provider.connection,
          gameKeypair,
          playerOne.publicKey,
          playerTwo.publicKey,
          uncheckedAccPubkey
        )
    );

    afterEach(
      async () =>
        await getBalances(
          "final",
          program.provider.connection,
          gameKeypair,
          playerOne.publicKey,
          playerTwo.publicKey,
          uncheckedAccPubkey
        )
    );
    it("turn increases ", async () => {
      if (load[0]) {
        let old_balance = convertLamportToSol(
          await program.provider.connection.getBalance(playerOne.publicKey)
        );
        let event = await getEvent(program, "mementoMori", async () => {
          await shoot_s(
            program,
            playerOne.publicKey,
            gameKeypair,
            playerOne.publicKey,
            playerTwo.publicKey,
            playerTwo.publicKey,
            [playerOne]
          );
        });

        let new_balance = convertLamportToSol(
          await program.provider.connection.getBalance(playerOne.publicKey)
        );

        over = true;
        expect((await program.account.session.fetch(gameKeypair)).turn).is.eq(
          false,
          "Turn not updated "
        );
        expect((await program.account.session.fetch(gameKeypair)).state).is.eql(
          { won: { winner: playerOne.publicKey } },
          "Player 1 didnt win"
        );

        assert(
          new_balance - old_balance == 0.020000000000000018 ||
            new_balance - old_balance == 0.019999999999999907,
          "Prize didn't get transferred"
        );
      } else {
        await shoot_s(
          program,
          playerOne.publicKey,
          gameKeypair,
          playerOne.publicKey,
          playerTwo.publicKey,
          playerTwo.publicKey,
          [playerOne]
        );
        expect(
          (await program.account.session.fetch(gameKeypair)).turn
        ).is.equal(true, "turn not updated");
        expect(
          (await program.account.session.fetch(gameKeypair)).trigger
        ).is.equals(1, "trigger not updated");
      }
    });

    it(`player ${over ? "one" : "two"} wins ${
      over ? "" : "and event is emitted and money deposited testing"
    }`, async () => {
      if (!over) {
        player_one_turn = !(await program.account.session.fetch(gameKeypair))
          .turn;
        for (let i = 1; i < load.length; i++) {
          if (load[i]) {
            let old_balance = convertLamportToSol(
              await program.provider.connection.getBalance(playerTwo.publicKey)
            );
            if (player_one_turn) {
              let event = await getEvent(program, "mementoMori", async () => {
                await shoot_s(
                  program,
                  playerOne.publicKey,
                  gameKeypair,
                  playerOne.publicKey,
                  playerTwo.publicKey,
                  playerOne.publicKey,
                  [playerOne]
                );
              });

              expect(event.shooter).is.eql(
                playerOne.publicKey,
                "Wrong shooter"
              );
              expect(event.target).is.eql(playerOne.publicKey, "Wrong target");
              expect(event.winner).is.eql(playerTwo.publicKey, "Wrong winner");
            } else {
              let event = await getEvent(program, "mementoMori", async () => {
                await shoot_s(
                  program,
                  playerTwo.publicKey,
                  gameKeypair,
                  playerOne.publicKey,
                  playerTwo.publicKey,
                  playerOne.publicKey,
                  [playerTwo]
                );
              });
              expect(event.shooter).is.eql(
                playerTwo.publicKey,
                "Wrong shooter"
              );
              expect(event.target).is.eql(playerOne.publicKey, "Wrong target");
              expect(event.winner).is.eql(playerTwo.publicKey, "Wrong winner");
            }
            let new_balance = convertLamportToSol(
              await program.provider.connection.getBalance(playerTwo.publicKey)
            );
            assert(
              new_balance - old_balance == 0.020000000000000018 ||
                new_balance - old_balance == 0.019999999999999907,
              "Prize didn't get transferred"
            );
            break;
          } else {
            if (player_one_turn) {
              await shoot_s(
                program,
                playerOne.publicKey,
                gameKeypair,
                playerOne.publicKey,
                playerTwo.publicKey,
                playerTwo.publicKey,
                [playerOne]
              );
            } else {
              await shoot_s(
                program,
                playerTwo.publicKey,
                gameKeypair,
                playerOne.publicKey,
                playerTwo.publicKey,
                playerOne.publicKey,
                [playerTwo]
              );
            }
          }
          player_one_turn = !player_one_turn;
        }

        expect(
          (await program.account.session.fetch(gameKeypair)).state
        ).is.eqls(
          { won: { winner: playerTwo.publicKey } }, // IMPORTANT :  small w in Won
          "Player two didn't win"
        );
      } else {
        expect(
          (await program.account.session.fetch(gameKeypair)).state
        ).is.eqls(
          { won: { winner: playerOne.publicKey } }, // IMPORTANT :  small w in Won
          "Player one didn't win"
        );
      }
    });

    it("join session already started", async () => {
      try {
        await program.methods
          .joinSession(playerOne.publicKey, playerTwo.publicKey)
          .accounts({
            playerOne: playerOne.publicKey,
            playerTwo: playerTwo.publicKey,
          })
          .signers([playerOne, playerTwo])
          .rpc();
      } catch (err) {
        expect(err).to.be.instanceOf(anchor.AnchorError);
        expect(err.error.errorCode.code).to.equal("SessionAlreadyStarted");
        expect(err.error.errorCode.number).to.equal(6001);
        expect(err.error.errorMessage).to.equal("Session has started");
        expect(err.program.equals(program.programId)).is.true;
      }
    });

    it("testing session over", async () => {
      try {
        await program.methods
          .shoot(playerTwo.publicKey)
          .accounts({
            shooter: player_one_turn
              ? playerOne.publicKey
              : playerTwo.publicKey,
            playerOne: playerOne.publicKey,
            playerTwo: playerTwo.publicKey,
          })
          .signers(player_one_turn ? [playerOne] : [playerTwo])
          .rpc();
      } catch (err) {
        expect(err).to.be.instanceOf(anchor.AnchorError);
        expect(err.error.errorCode.code).to.equal("SessionAlreadyOver");
        expect(err.error.errorCode.number).to.equal(6000);
        expect(err.error.errorMessage).to.equal("Session is over");
        expect(err.program.equals(program.programId)).is.true;
      }
    });

    it("New session!?", async () => {
      let p1 = anchor.web3.Keypair.generate();
      let p2 = anchor.web3.Keypair.generate();
      await activateAccount(anchor.AnchorProvider.env(), p1.publicKey);
      await activateAccount(anchor.AnchorProvider.env(), p2.publicKey);
      let [ng] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          p1.publicKey.toBuffer(),
          p2.publicKey.toBuffer(),
          Buffer.from("session"),
        ],
        program.programId
      );
      await program.methods
        .joinSession(p1.publicKey, p2.publicKey)
        .accounts({ playerOne: p1.publicKey, playerTwo: p2.publicKey })
        .signers([p1, p2])
        .rpc()
        .catch((err) => {
          console.log(err);
        });
      expect((await program.account.session.fetch(ng)).playerOne).is.eql(
        p1.publicKey
      );

      await shoot_s(
        program,
        p1.publicKey,
        ng,
        p1.publicKey,
        p2.publicKey,
        p2.publicKey,
        [p1]
      );
      expect((await program.account.session.fetch(ng)).turn).is.equal(
        !(await program.account.session.fetch(ng)).load[0],
        "turn not updated"
      );
      expect((await program.account.session.fetch(ng)).trigger).is.equals(
        1,
        "trigger not updated"
      );
    });
  });
});

// OTHER WAY TO SEND TRANSACTIONS
// const tx = await program.methods
//   .joinSession()
//   .accounts({
//     player: playerTwo.publicKey,
//   })
//   .transaction();

// const latestBlockhash =
//   await program.provider.connection.getLatestBlockhash();
// tx.recentBlockhash = latestBlockhash.blockhash;
// tx.feePayer = playerTwo.publicKey;

// tx.sign(playerTwo);

// const rawTransaction = tx.serialize();
// const txId = await program.provider.connection.sendRawTransaction(
//   rawTransaction,
//   {
//     skipPreflight: false,
//     preflightCommitment: "confirmed",
//   }
// );
// await program.provider.connection.confirmTransaction(txId);
