import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Roullete } from "../target/types/roullete";
import { expect } from "chai";
import chai from "chai";
import { Wallet } from "@coral-xyz/anchor/dist/cjs/provider";

async function activateAccount(
  provider: anchor.Provider,
  address: anchor.web3.PublicKey
) {
  let tx = await provider.connection.requestAirdrop(
    address,
    anchor.web3.LAMPORTS_PER_SOL * 1
  );
  let blockhash = await provider.connection.getLatestBlockhash();

  return await provider.connection.confirmTransaction({
    blockhash: blockhash.blockhash,
    lastValidBlockHeight: blockhash.lastValidBlockHeight,
    signature: tx,
  });
}

async function shoot_s(
  program: anchor.Program,
  shooter: anchor.web3.PublicKey,
  game: anchor.web3.PublicKey,
  target: anchor.web3.PublicKey,
  signer?: [anchor.web3.Keypair] | []
) {
  await program.methods
    .shoot(target)
    .accounts({
      session: game,
      shooter: shooter,
    })
    .signers(signer)
    .rpc()
    .catch((err) => {
      expect(err).to.be.instanceOf(anchor.AnchorError);
      expect(err.error.errorCode.code).to.equal("NotPlayersTurn");
      expect(err.error.errorCode.number).to.equal(6002);
      expect(err.program.equals(program.programId)).is.true;
      // console.log(err.error.comparedValues);
    });
}

async function pass_s(
  program: anchor.Program,
  passer: anchor.web3.PublicKey,
  game: anchor.web3.PublicKey,
  signer: [anchor.web3.Keypair] | []
) {
  await program.methods
    .pass()
    .accounts({
      session: game,
      shooter: passer,
    })
    .signers(signer)
    .rpc()
    .catch((err) => {
      expect(err).to.be.instanceOf(anchor.AnchorError);
      expect(err.error.errorCode.code).to.equal("NotPlayersTurn");
      expect(err.error.errorCode.number).to.equal(6002);
      expect(err.program.equals(program.programId)).is.true;
      // console.log(err.error.comparedValues);
    });
}

describe("roullete", async () => {
  //TODO: check if event is triggered
  let program: Program<Roullete>;
  let gameKeypair: anchor.web3.Keypair;
  let playerOne: Wallet;
  let uncheckedAccPubkey: anchor.web3.PublicKey;
  let playerTwo: anchor.web3.Keypair;
  anchor.setProvider(anchor.AnchorProvider.env());

  beforeEach(async () => {
    //setting accounts
    program = anchor.workspace.Roullete as Program<Roullete>;
    gameKeypair = anchor.web3.Keypair.generate();
    playerOne = (program.provider as anchor.AnchorProvider).wallet;
    uncheckedAccPubkey = anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY;
    playerTwo = anchor.web3.Keypair.generate();

    // activating accounts
    await activateAccount(program.provider, gameKeypair.publicKey);
    await activateAccount(program.provider, playerTwo.publicKey);

    // console.log(
    //   gameKeypair.publicKey,
    //   playerOne.publicKey,
    //   playerTwo.publicKey,
    //   uncheckedAccPubkey
    // );
    console.log(`
    initial balances : 
    gamekeypair  : ${await program.provider.connection.getBalance(
      gameKeypair.publicKey
    )}
    playerone  : ${await program.provider.connection.getBalance(
      playerOne.publicKey
    )}
    playertwo  : ${await program.provider.connection.getBalance(
      playerTwo.publicKey
    )}
    unchecked account  : ${await program.provider.connection.getBalance(
      uncheckedAccPubkey
    )}
    `);

    await program.methods
      .startSession(playerTwo.publicKey)
      .accounts({
        playerOne: playerOne.publicKey,
        session: gameKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        recentSlothashes: uncheckedAccPubkey,
      })
      .signers([gameKeypair])
      .rpc()
      .catch((err) => console.log(err));
  });

  describe("initiation tests", () => {
    it("accounts initiated (requesting airdrops)", async () => {
      expect(
        await program.provider.connection.getBalance(gameKeypair.publicKey)
      )
        .is.equal(
          await program.provider.connection.getBalance(playerTwo.publicKey)
        )

        .is.equal(1_000_000_000); // 1 sol = 1000000000 lamports
    });

    it("session started", async () => {
      const session = await program.account.session.fetch(
        gameKeypair.publicKey
      );
      expect(session.turn).is.equal(1, "turn is correct");
      expect(session.players).is.eql(
        [playerOne.publicKey, playerTwo.publicKey],
        "players are correct"
      );

      expect(session.state).is.eql({ active: {} }, "game is not active");
      console.log(session.load);
      console.log(session.state);
      expect(session.trigger).is.equals(0, "trigger is not set");
      // console.log(
      //   await program.provider.connection.getBalance(gameKeypair.publicKey),
      //   await program.provider.connection.getBalance(playerOne.publicKey),
      //   await program.provider.connection.getBalance(playerTwo.publicKey),
      //   await program.provider.connection.getBalance(uncheckedAccPubkey)
      // );
    });
  });

  describe("game tests", () => {
    it("turn increases", async () => {
      await shoot_s(
        program,
        playerOne.publicKey,
        gameKeypair.publicKey,
        playerTwo.publicKey,
        []
      );

      // await program.methods
      //   .shoot(playerOne.publicKey)
      //   .accounts({
      //     session: gameKeypair.publicKey,
      //     shooter: playerTwo.publicKey,
      //   })
      //   .signers([playerTwo])
      //   .rpc()
      //   .catch((err) => {
      //     expect(err).to.be.instanceOf(anchor.AnchorError);
      //     expect(err.error.errorCode.code).to.equal("NotPlayersTurn");
      //     expect(err.error.errorCode.number).to.equal(6002);
      //     expect(err.program.equals(program.programId)).is.true;
      //     // console.log(err.error.comparedValues);
      //   });

      console.log(
        (await program.account.session.fetch(gameKeypair.publicKey)).load
      );

      // TODO: check if gameover
      if (
        (await program.account.session.fetch(gameKeypair.publicKey)).state
          .active
      ) {
        expect(
          (await program.account.session.fetch(gameKeypair.publicKey)).turn
        ).is.equal(2, "turn not updated");
      } else {
        console.log("session over here");
        expect(
          (await program.account.session.fetch(gameKeypair.publicKey)).turn
        ).is.equal(1, "turn not updated");
      }
    });

    it("playerOne wins", async () => {
      // TODO: check sometimes throws "SessionAlreadyOver"
      const load = (await program.account.session.fetch(gameKeypair.publicKey))
        .load;
      console.log("current load: ", load);
      let player_turn: boolean = true; // for playerone
      for (let i = 0; i < load.length; i++) {
        if (!load[i]) {
          if (player_turn) {
            await shoot_s(
              program,
              playerOne.publicKey,
              gameKeypair.publicKey,
              playerTwo.publicKey,
              []
            );
          } else {
            await shoot_s(
              program,
              playerTwo.publicKey,
              gameKeypair.publicKey,
              playerTwo.publicKey,
              [playerTwo]
            );
          }
        } else {
          if (player_turn) {
            await shoot_s(
              program,
              playerOne.publicKey,
              gameKeypair.publicKey,
              playerTwo.publicKey,
              []
            );
          } else {
            await shoot_s(
              program,
              playerTwo.publicKey,
              gameKeypair.publicKey,
              playerTwo.publicKey,
              [playerTwo]
            );
          }
        }
        player_turn = !player_turn;
      }

      console.log(
        (await program.account.session.fetch(gameKeypair.publicKey)).state
      );
      expect(
        (await program.account.session.fetch(gameKeypair.publicKey)).state
      ).is.eqls(
        { won: { winner: playerOne.publicKey } }, // IMPORTANT :  small w in Won
        "Player one didn't win"
      );
    });
  });
});
