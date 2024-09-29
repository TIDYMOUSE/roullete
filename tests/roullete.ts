import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Roullete } from "../target/types/roullete";
import { assert, expect } from "chai";
import chai from "chai";
import { Wallet } from "@coral-xyz/anchor/dist/cjs/provider";
import { utf8 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";

//!IMPORTANT: equal, equals and eq is same which are strict equality (===)
// whereas eql and eqls are same meaning deep equality ( for objects and arrays )

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
  program: anchor.Program<Roullete>,
  shooter: anchor.web3.PublicKey,
  game: anchor.web3.PublicKey,
  target: anchor.web3.PublicKey,
  signer?: [anchor.web3.Keypair] | []
) {
  await program.methods
    .shoot(target)
    .accounts({
      shooter: shooter,
    })
    .signers(signer)
    .rpc()
    .catch((err) => {
      console.log(err);
      expect(err).to.be.instanceOf(anchor.AnchorError);
      expect(err.error.errorCode.code).to.equal("NotPlayersTurn");
      expect(err.error.errorCode.number).to.equal(6002);
      expect(err.program.equals(program.programId)).is.true;
      // console.log(err.error.comparedValues);
    });
}
function convertLamportToSol(val: number) {
  return val / anchor.web3.LAMPORTS_PER_SOL;
}
async function getBalances(
  status: string,
  conn: anchor.web3.Connection,
  gameKeypair: anchor.web3.PublicKey,
  playerOne: anchor.web3.PublicKey,
  playerTwo: anchor.web3.PublicKey,
  uncheckedAccPubkey: anchor.web3.PublicKey
) {
  console.log(`
  ------------------------------------------------------------------------------------------------------------
    ${status} balances :
    gamekeypair (${gameKeypair}): ${convertLamportToSol(
    await conn.getBalance(gameKeypair)
  )} sol
    playerone (${playerOne}) : ${convertLamportToSol(
    await conn.getBalance(playerOne)
  )} sol
    playertwo (${playerTwo}) : ${convertLamportToSol(
    await conn.getBalance(playerTwo)
  )} sol
    unchecked account (${uncheckedAccPubkey}) : ${convertLamportToSol(
    await conn.getBalance(uncheckedAccPubkey)
  )} sol
  ------------------------------------------------------------------------------------------------------------
  `);
}

describe("roullete", async () => {
  //TODO: check if event is triggered
  let program: Program<Roullete>;
  // let gameKeypair: anchor.web3.Keypair;
  let gameKeypair: anchor.web3.PublicKey;
  let playerOne: Wallet;
  let playerTwo: anchor.web3.Keypair;
  let uncheckedAccPubkey: anchor.web3.PublicKey;
  anchor.setProvider(anchor.AnchorProvider.local());

  before(async () => {
    //setting accounts
    program = anchor.workspace.Roullete as Program<Roullete>;
    // gameKeypair = anchor.web3.Keypair.generate();
    [gameKeypair] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("session")],
      program.programId
    );
    playerOne = (program.provider as anchor.AnchorProvider).wallet;
    // playerOne = anchor.web3.Keypair.generate();
    uncheckedAccPubkey = anchor.web3.SYSVAR_SLOT_HASHES_PUBKEY;
    playerTwo = anchor.web3.Keypair.generate();

    // activating accounts
    // await activateAccount(program.provider, gameKeypair);
    await activateAccount(program.provider, playerTwo.publicKey);
    // await activateAccount(program.provider, playerOne.publicKey);
    // console.log(await program.provider.connection.getAccountInfo(gameKeypair));
    // {
    //   data: <Buffer >,
    //   executable: false,
    //   lamports: 1000000000,
    //   owner: PublicKey [PublicKey(11111111111111111111111111111111)] {
    //     _bn: <BN: 0>
    //   },
    //   rentEpoch: 18446744073709552000,
    //   space: 0
    // }
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
    it("Player one added", async () => {
      await program.methods
        .joinSession()
        .accounts({
          player: playerOne.publicKey,
        })
        .signers([])
        .rpc()
        .catch((err) => console.log(err));

      let session = await program.account.session.fetch(gameKeypair);

      expect(session.playerOne).is.eql(
        playerOne.publicKey,
        "Player One mismatch"
      );
    });

    it("Player two added", async () => {
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

      // !IMPORTANT above code works and player2 pays but this doesnt
      await program.methods
        .joinSession()
        .accounts({
          player: playerTwo.publicKey, // PlayerTwo joins the session
        })
        .signers([playerTwo]) // PlayerTwo signs the transaction, which makes them pay for the transaction fees
        .rpc(); // Sends the transaction and waits for confirmation

      let session = await program.account.session.fetch(gameKeypair);
      expect(session.playerTwo).is.eql(
        playerTwo.publicKey,
        "Player two mismatch"
      );
      console.log(
        "PDA BALANCE: ",
        await program.provider.connection.getBalance(gameKeypair)
      );
    });

    it("session started", async () => {
      const session = await program.account.session.fetch(gameKeypair);
      expect(session.turn).is.equal(false, "turn is correct");

      expect(session.state).is.eql({ active: {} }, "game is not active");
      console.log("Session Load : ", session.load);
      console.log("Sesssion state : ", session.state);
      expect(session.trigger).is.equals(0, "trigger is not set");
    });
  });

  describe("game tests", () => {
    let load: boolean[];
    let over: boolean;
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
      await shoot_s(
        program,
        playerOne.publicKey,
        gameKeypair,
        playerOne.publicKey,
        []
      );

      if (load[0]) {
        over = true;
        expect((await program.account.session.fetch(gameKeypair)).turn).is.eq(
          false,
          "Turn not updated "
        );
        expect((await program.account.session.fetch(gameKeypair)).state).is.eql(
          { won: { name: playerTwo.publicKey } },
          "Player two didnt win"
        );
      } else {
        expect(
          (await program.account.session.fetch(gameKeypair)).turn
        ).is.equal(true, "turn not updated");
        expect(
          (await program.account.session.fetch(gameKeypair)).trigger
        ).is.equals(1, "trigger not updated");
      }
    });

    it("player two wins", async () => {
      // TODO : All error checks
      if (!over) {
        let player_one_turn = !(
          await program.account.session.fetch(gameKeypair)
        ).turn;
        for (let i = 1; i < load.length; i++) {
          if (load[i]) {
            if (player_one_turn) {
              await shoot_s(
                program,
                playerOne.publicKey,
                gameKeypair,
                playerOne.publicKey,
                []
              );
              break;
            } else {
              await shoot_s(
                program,
                playerTwo.publicKey,
                gameKeypair,
                playerOne.publicKey,
                [playerTwo]
              );
              break;
            }
          } else {
            if (player_one_turn) {
              await shoot_s(
                program,
                playerOne.publicKey,
                gameKeypair,
                playerTwo.publicKey,
                []
              );
            } else {
              await shoot_s(
                program,
                playerTwo.publicKey,
                gameKeypair,
                playerTwo.publicKey,
                [playerTwo]
              );
            }
          }
          player_one_turn = !player_one_turn;
        }

        console.log(
          "Final state: ",
          (await program.account.session.fetch(gameKeypair)).state
        );
        expect(
          (await program.account.session.fetch(gameKeypair)).state
        ).is.eqls(
          { won: { winner: playerTwo.publicKey } }, // IMPORTANT :  small w in Won
          "Player two didn't win"
        );
      }
    });
  });
});
