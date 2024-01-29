import {
    Connection,
    PublicKey,
    Keypair,
    Transaction,
    sendAndConfirmTransaction,
  } from "@solana/web3.js";
  import base58 from "bs58";
  
  import * as Phoenix from "./phoenix";
  import { isPhoenixMarketEventFillSummary } from "./phoenix";


console.log(Phoenix);
console.log(isPhoenixMarketEventFillSummary);
