import {
    Connection,
    PublicKey,
    Keypair,
    Transaction,
    clusterApiUrl,
    sendAndConfirmTransaction,
  } from "@solana/web3.js";
  
  import base58 from "bs58";
  
  import * as Phoenix from "./phoenix";
  import { isPhoenixMarketEventFillSummary } from "./phoenix";

  export async function swap() {
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed'); //devnet 测试网  
    // const connection = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');  //mainnet-beta 主网  生成环境换成主网

    // 换成自己的私钥
    const trader = Keypair.fromSecretKey(
      base58.decode(
        "2PKwbVQ1YMFEexCmUDyxy8cuwb69VWcvoeodZCLegqof84DJSTiEd89Ak3so9CiHycZwynesTt1JUDFAPFWEzvVs" //私钥
      )
    );
    //市场账户地址 当处于主网mainnet-beta时，我查到的以下市场账户地址 其他账户地址需要问项目方
    // "4DoNfFBfF7UokCC2FQzriy7yHK6DY6NVdYpuekQ5pRgg",// sol/usdc
    // "GBMoNx84HsFdVK63t8BZuDgyZhSBaeKWB4pHHpoeRM9z",// bonk/usdc
    // "FZRgpfpvicJ3p23DfmZuvUgcQZBHJsWScTf2N2jK8dy6",// msol/sol
    // "FicF181nDsEcasznMTPp9aLa5Rbpdtd11GtSEa1UUWzx",// Bonk/sol
    // "2t9TBYyUyovhHQq434uAiBxW6DmJCg7w4xdDoSK6LRjP"// JitoSOL/msol
    const marketAddress = new PublicKey(
      "CS2H8nbAVVEUHWPF5extCSymqheQdkd4d7thik6eet9N" //这个是测试网的sol/usdc的市场账户地址 更换成主网的市场账户地址
    );
    const marketAccount = await connection.getAccountInfo(
      marketAddress,
      "confirmed"
    );
    if (!marketAccount) {
      throw Error(
        "未找到地址的市场帐户: " + marketAddress.toBase58()
      );
    }
  
    const client = await Phoenix.Client.createWithMarketAddresses(connection, [
      marketAddress,
    ]);
  
    const marketState = client.marketStates.get(marketAddress.toBase58());
    if (marketState === undefined) {
      throw Error("未找到市场");
    }
    //Phoenix.Side.Ask 表示卖出，   Phoenix.Side.Bid 表示买入
    const side = Math.random() > 0.5 ? Phoenix.Side.Ask : Phoenix.Side.Bid;
    const inAmount =
      side === Phoenix.Side.Ask
        ? Math.floor(Math.random() * 4) + 1
        : Math.floor(Math.random() * 100) + 50;
    const slippage = 0.008;
    console.log(
      side === Phoenix.Side.Ask ? "市价卖出数量" : "市价买入数量",
      inAmount,
      side === Phoenix.Side.Ask ? "SOL" : "USDC",
      "产生的滑点是: ",
      slippage * 100, //产生的滑点
      "% 滑点"
    );
  
    // Generate an IOC order packet 生成IOC订单包
    const orderPacket = marketState.getSwapOrderPacket({
      side,
      inAmount,
      slippage,
    });
    // 从订单数据包生成调用合约的指令
    const swapIx = marketState.createSwapInstruction(orderPacket, trader.publicKey);
    // 把指令添加进交易事务对象中
    const swapTx = new Transaction().add(swapIx);
    // 本次交易预计收到的币
    const expectedOutAmount = client.getMarketExpectedOutAmount({
      marketAddress: marketAddress.toBase58(),
      side,
      inAmount,
    });
    console.log(
      "本次交易预计收到的币  :",
      expectedOutAmount,
      side === Phoenix.Side.Ask ? "USDC" : "SOL"
    );
  
    const txId = await sendAndConfirmTransaction(connection, swapTx, [trader], {
      commitment: "confirmed",
    });
    console.log("返回的交易哈希: ", txId);
    const txResult = await Phoenix.getPhoenixEventsFromTransactionSignature(
      connection,
      txId
    );
  
    if (txResult.txFailed) {
      console.log("交易失败");
      return;
    }
  
    const fillEvents = txResult.instructions[0];
  
    const summaryEvent = fillEvents.events[fillEvents.events.length - 1];
    if (!isPhoenixMarketEventFillSummary(summaryEvent)) {
      throw Error(`意外报错: ${summaryEvent}`);
    }
  
    // This is pretty sketch
    const summary: Phoenix.FillSummaryEvent = summaryEvent.fields[0];
  
    if (side == Phoenix.Side.Bid) {//买入
      console.log(
        "Filled 买入",
        marketState.baseLotsToRawBaseUnits(Phoenix.toNum(summary.totalBaseLotsFilled)),
        "SOL"
      );
    } else {//卖出
      console.log(
        "Sold 卖出",
        inAmount,
        "SOL for",
        marketState.quoteLotsToQuoteUnits(Phoenix.toNum(summary.totalQuoteLotsFilled)),
        "USDC"
      );
    }
  
    const fees = marketState.quoteLotsToQuoteUnits(
      Phoenix.toNum(summary.totalFeeInQuoteLots)
    );
    console.log(`交易费用 ${fees} in fees`);
  }
  
  
  (async function () {
    for (let i = 0; i < 10; i++) {
      console.log("循环测试的次数: ", i + 1, "  总次数", 10);
      try {
        await swap();
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log();
      } catch (err) {
        console.log("Error: ", err);
        process.exit(1);
      }
    }
  
    process.exit(0);
  })();
  
