import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
  clusterApiUrl
} from "@solana/web3.js";
import * as PhoenixSdk from "./phoenix";
import fs from "fs";
import base58 from "bs58";


// This script runs a simple market maker example, which provides limit order bids and asks, on a devnet phoenix market.
// To run: ts-node examples/simpleMarketMaker.ts $PATH-TO-KEYPAIR.
export async function simpleMarketMaker(privateKeyPath: string) {
  // Devnet test market - SOL/USDC
  const marketPubkey = new PublicKey(
    "4DoNfFBfF7UokCC2FQzriy7yHK6DY6NVdYpuekQ5pRgg"
  );
  // Use custom RPC for better performance. Here we use the default devnet RPC.
    // const connection = new Connection(clusterApiUrl('devnet'), 'confirmed'); //devnet 测试网  
    const connection = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');  //mainnet-beta 主网  生成环境换成主网


  // Frequency in milliseconds to update quotes
  const QUOTE_REFRESH_FREQUENCY = 10000;
  // Edge in cents on quote. Places bid/ask at fair price -/+ edge
  const QUOTE_EDGE = 0.01;
  // Expected life time of order in seconds
  const ORDER_LIFETIME_IN_SECONDS = 7;

    // 换成自己的私钥
    const trader = Keypair.fromSecretKey(
      base58.decode(
        "你自己的私钥" //私钥
      )
    );
  // Create a Phoenix Client
  const client = await PhoenixSdk.Client.create(connection);
  // Get the market metadata for the market you wish to trade on
  const marketState = client.marketStates.get(marketPubkey.toString());
  const marketData = marketState?.data;
  if (!marketData) {
    throw new Error("Market data not found");
  }

  // Request a SOL airdrop to send the transaction in this example. Only needed, and will only work, on devnet.
  // await client.connection.requestAirdrop(trader.publicKey, 1_000_000_000);
  console.log("Trader: ", trader.publicKey.toBase58());

  // If the trader is a new maker (has not placed limit orders previously), you will need to create associated token accounts for the base and quote tokens, and claim a maker seat on the market.
  // This function creates a bundle of new instructions that includes:
  // - Create associated token accounts for base and quote tokens, if needed
  // - Claim a maker seat on the market, if needed
  const setupNewMakerIxs = await PhoenixSdk.getMakerSetupInstructionsForMarket(
    connection,
    marketState,
    trader.publicKey
  );
  if (setupNewMakerIxs.length !== 0) {
    const setupTx = new Transaction().add(...setupNewMakerIxs);
    const setupTxId = await sendAndConfirmTransaction(
      connection,
      setupTx,
      [trader],
      {
        skipPreflight: true,
        commitment: "confirmed",
      }
    );
    console.log(
      `Setup Tx Link: https://solscan.io/tx/${setupTxId}`
    );
  } else {
    console.log("No setup required. Continuing...");
  }



  // Track place transaction iterations
  let count = 0;

  /* eslint-disable no-constant-condition */
  while (true) {
    // Before quoting, we cancel all outstanding orders
    const cancelAll = client.createCancelAllOrdersInstruction(
      marketPubkey.toString(),
      trader.publicKey
    );

    // Note we could bundle this with the place order transaction below, but we choose to cancel
    // seperately since getting the price could take an non-deterministic amount of time
    try {
      const cancelTransaction = new Transaction().add(cancelAll);
      const txid = await sendAndConfirmTransaction(
        connection,
        cancelTransaction,
        [trader],
        {
          skipPreflight: true,
          commitment: "confirmed",
        }
      );

      console.log(
        `Cancel tx link: https://solscan.io/tx/${txid}`
      );
    } catch (err) {
      console.log("Error: ", err);
      continue;
    }

    // Get the price from a price source, here from Coinbase
    const price = await fetch("https://api.coinbase.com/v2/prices/SOL-USD/spot")
      .then((response) => response.json())
      .then((data) => {
        return data.data.amount;
      })
      .catch((error) => console.error(error));
    console.log("price", price);
    const bidPrice = parseFloat(price) - QUOTE_EDGE;
    const askPrice = parseFloat(price) + QUOTE_EDGE;

    // Get current time in seconds
    const currentTime = Math.floor(Date.now() / 1000);

    // Create a LimitOrderTemplate for the bid and ask orders.
    // the LimitOrderTemplate allows you to specify the price and size in commonly understood units:
    // price is the floating point price (units of USDC per unit of SOL for the SOL/USDC market), and size is in whole base units (units of SOL for the SOL/USDC market).
    const bidOrderTemplate: PhoenixSdk.LimitOrderTemplate = {
      side: PhoenixSdk.Side.Bid,
      priceAsFloat: bidPrice,
      sizeInBaseUnits: 0.1,
      selfTradeBehavior: PhoenixSdk.SelfTradeBehavior.CancelProvide,
      clientOrderId: 1,
      useOnlyDepositedFunds: false,
      lastValidSlot: undefined,
      lastValidUnixTimestampInSeconds: currentTime + ORDER_LIFETIME_IN_SECONDS,
    };
    // Get the limit order instruction from the created template
    const bidLimitOrderIx = client.getLimitOrderInstructionfromTemplate(
      marketPubkey.toBase58(),
      trader.publicKey,
      bidOrderTemplate
    );

    const askOrderTemplate: PhoenixSdk.LimitOrderTemplate = {
      side: PhoenixSdk.Side.Ask,
      priceAsFloat: askPrice,
      sizeInBaseUnits: 1,
      selfTradeBehavior: PhoenixSdk.SelfTradeBehavior.CancelProvide,
      clientOrderId: 1,
      useOnlyDepositedFunds: false,
      lastValidSlot: undefined,
      lastValidUnixTimestampInSeconds: currentTime + ORDER_LIFETIME_IN_SECONDS,
    };
    const askLimitOrderIx = client.getLimitOrderInstructionfromTemplate(
      marketPubkey.toBase58(),
      trader.publicKey,
      askOrderTemplate
    );
    const instructions = [bidLimitOrderIx, askLimitOrderIx];

    // Every 5th iteration, add a withdraw funds instruction
    count++;
    if (count % 5 == 0) {
      // Create WithdrawParams. Setting params to null will withdraw all funds
      const withdrawParams: PhoenixSdk.WithdrawParams = {
        quoteLotsToWithdraw: null,
        baseLotsToWithdraw: null,
      };

      const placeWithdraw = client.createWithdrawFundsInstruction(
        {
          withdrawFundsParams: withdrawParams,
        },
        marketPubkey.toString(),
        trader.publicKey
      );
      instructions.push(placeWithdraw);
    }

    // Send place orders/withdraw transaction
    try {
      const placeQuotesTx = new Transaction().add(...instructions);

      const placeQuotesTxId = await sendAndConfirmTransaction(
        connection,
        placeQuotesTx,
        [trader],
        {
          skipPreflight: true,
          commitment: "confirmed",
        }
      );

      console.log(
        "Place quotes",
        bidPrice.toFixed(marketState.getPriceDecimalPlaces()),
        "@",
        askPrice.toFixed(marketState.getPriceDecimalPlaces())
      );
      console.log(
        `Tx link: https://solscan.io/tx/${placeQuotesTxId}`
      );
    } catch (err) {
      console.log("Error: ", err);
      continue;
    }
    await new Promise((r) => setTimeout(r, QUOTE_REFRESH_FREQUENCY));
  }
}

(async function () {
  try {
    await simpleMarketMaker(process.argv[2]);
  } catch (err) {
    console.log("Error: ", err);
    process.exit(1);
  }

  process.exit(0);
})();
