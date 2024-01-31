import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
  SystemProgram
} from "@solana/web3.js";
import * as PhoenixSdk from "./phoenix";
import fs from "fs";
import base58 from "bs58";
import {airdropSplTokensForMarketIxs} from "./phoenix/utils/genericTokenMint";
import {NATIVE_MINT, createAssociatedTokenAccountInstruction, createSyncNativeInstruction, getAccount, getAssociatedTokenAddress} from "@solana/spl-token";


export async function placeLimitOrderExample() {
  const connection = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');  //mainnet-beta 主网  生成环境换成主网
    const traderKeypair = Keypair.fromSecretKey(
      base58.decode(
        "你打私钥" //私钥
      ));


const associatedTokenAccount = await getAssociatedTokenAddress(
  NATIVE_MINT,
  traderKeypair.publicKey
)
const ataTransaction = new Transaction()
  .add(
    createAssociatedTokenAccountInstruction(
      traderKeypair.publicKey,
      associatedTokenAccount,
      traderKeypair.publicKey,
      NATIVE_MINT
    )
  );
  console.log('报错前');

  // 检查账户是否存在
  const isAccountInfo = await connection.getAccountInfo(associatedTokenAccount);
  if (isAccountInfo === null) {
    const ataTransaction = new Transaction()
      .add(
        createAssociatedTokenAccountInstruction(
          traderKeypair.publicKey,
          associatedTokenAccount,
          traderKeypair.publicKey,
          NATIVE_MINT
        )
      );
    await sendAndConfirmTransaction(connection, ataTransaction, [traderKeypair]);
  } else {
    console.log('关联代币账户已存在');
  }

  const lamports = 0.5*1000000000;//0.5个sol
const solTransferTransaction = new Transaction()
  .add(
    SystemProgram.transfer({
        fromPubkey: traderKeypair.publicKey,
        toPubkey: associatedTokenAccount,
        lamports: lamports,
      }),
      createSyncNativeInstruction(
        associatedTokenAccount
    )
  )
await sendAndConfirmTransaction(connection, solTransferTransaction, [traderKeypair]);
const accountInfo = await getAccount(connection, associatedTokenAccount);
console.log(`Native: ${accountInfo.isNative}, Lamports: ${accountInfo.amount}`);
  const phoenixClient = await PhoenixSdk.Client.create(connection);
  const marketAddress = new PublicKey("4DoNfFBfF7UokCC2FQzriy7yHK6DY6NVdYpuekQ5pRgg");//sol/usdc的市场地址,其他市场地址需要问官方团队
  const marketState = phoenixClient.marketStates.get(marketAddress.toBase58());
  if (marketState === undefined) {
    throw Error("Market not found");
  }
  const marketData = marketState.data;
  /*如果下买单把这段注释打开*/ 
  // const limitOrderPacket = PhoenixSdk.getLimitOrderPacket({
  //     side: PhoenixSdk.Side.Bid,
  //     priceInTicks: 1000, // 价格1000表示1 usdc
  //     numBaseLots: 3,//交易数量  1表述0.001个sol
  //   });

  /*如果下卖单把这段注释打开*/ 
    const limitOrderPacket = PhoenixSdk.getLimitOrderPacket({
      side: PhoenixSdk.Side.Ask,
      priceInTicks: 108000, // 价格1000表示1 usdc
      numBaseLots: 3,//交易数量  1表述0.001个sol
    });

  const limitOrderIx = phoenixClient.createPlaceLimitOrderInstruction(
    limitOrderPacket,
    marketAddress.toBase58(),
    traderKeypair.publicKey
  );
  // console.log("打印指令 limitOrderIx: ", limitOrderIx);
  const tx = new Transaction().add(limitOrderIx);
  const txId = await sendAndConfirmTransaction(
    connection,
    tx,
    [traderKeypair],
    {
      skipPreflight: true,
      commitment: "confirmed",
    }
  );
  console.log(`Order Tx Link: https://solscan.io/${txId}`);
}

(async function () {
  try {
    await placeLimitOrderExample();
  } catch (err) {
    console.log("Error: ", err);
    process.exit(1);
  }

  process.exit(0);
})();

