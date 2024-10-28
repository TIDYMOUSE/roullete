import * as anchor from "@coral-xyz/anchor";
import { Roullete } from "../target/types/roullete";
import { assert, expect } from "chai";
import { AnchorError } from "@coral-xyz/anchor";

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
  player_one: anchor.web3.PublicKey,
  player_two: anchor.web3.PublicKey,
  target: anchor.web3.PublicKey,
  signer: [anchor.web3.Keypair]
) {
  await program.methods
    .shoot(target)
    .accounts({
      shooter: shooter,
      playerOne: player_one,
      playerTwo: player_two,
    })
    .signers(signer)
    .rpc()
    .catch((err) => {
      console.log(err);
      expect(err).to.be.instanceOf(anchor.AnchorError);
      expect(err.error.errorCode.code).to.equal("InternalGameError");
      expect(err.error.errorMessage).to.equal("Some logic error!");
      expect(err.error.errorCode.number).to.equal(6002);
      expect(err.program.equals(program.programId)).is.true;
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

type Event = anchor.IdlEvents<Roullete>;
const getEvent = async <E extends keyof Event>(
  program: anchor.Program<Roullete>,
  eventName: E,
  method: () => Promise<any>
) => {
  let listenerId: number;
  const event = await new Promise<Event[E]>(async (resolve) => {
    listenerId = program.addEventListener(eventName, (event) => {
      resolve(event);
    });
    await method();
  });
  await program.removeEventListener(listenerId);
  return event;
};

export { getBalances, convertLamportToSol, shoot_s, activateAccount, getEvent };
