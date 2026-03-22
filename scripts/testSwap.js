const { swapETHForUSDC } = require("./uniswap");
const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  // Test with tiny amount — 0.001 ETH
  const amount = ethers.parseEther("0.001");
  const result = await swapETHForUSDC(amount);
  console.log("Test swap complete:", result);
}

main().catch(console.error);