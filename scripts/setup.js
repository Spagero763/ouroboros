const { ethers } = require("ethers");
require("dotenv").config();

const MockStETH_ABI = [
  "function simulateYield(address to, uint256 amount)",
  "function balanceOf(address account) view returns (uint256)",
];

const Treasury_ABI = [
  "function getState() view returns (uint256, uint256, uint256, address, uint256, uint256)",
];

async function main() {
  const provider = new ethers.JsonRpcProvider("https://sepolia.base.org");
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  console.log("Wallet:  ", wallet.address);
  console.log("Treasury:", process.env.TREASURY_ADDRESS);

  const mockStETH = new ethers.Contract(process.env.MOCK_STETH_ADDRESS, MockStETH_ABI, wallet);
  const treasury = new ethers.Contract(process.env.TREASURY_ADDRESS, Treasury_ABI, wallet);

  let currentNonce = await provider.getTransactionCount(wallet.address);

  // Simulate 1 stETH yield directly to treasury
  console.log("Simulating 1 stETH yield to treasury...");
  const yieldTx = await mockStETH.simulateYield(
    process.env.TREASURY_ADDRESS,
    ethers.parseEther("1"),
    { nonce: currentNonce }
  );
  await yieldTx.wait();
  currentNonce++;
  console.log("Yield simulated. Tx:", yieldTx.hash);

  // Check state
  const state = await treasury.getState();
  console.log("------------------------------------------");
  console.log("Principal locked:  ", ethers.formatEther(state[0]), "stETH");
  console.log("Current balance:   ", ethers.formatEther(state[1]), "stETH");
  console.log("Available yield:   ", ethers.formatEther(state[2]), "stETH");
  console.log("Agent address:     ", state[3]);
  console.log("------------------------------------------");
  console.log("Treasury ready. Agent can spend", ethers.formatEther(state[2]), "stETH");
}

main().catch(console.error);