const { ethers } = require("ethers");
require("dotenv").config();

const SWAP_ROUTER = "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4";
const WETH = "0x4200000000000000000000000000000000000006";
const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

const WETH_ABI = [
  "function deposit() payable",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
];
const SWAP_ROUTER_ABI = [
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)",
];
const USDC_ABI = [
  "function balanceOf(address account) view returns (uint256)",
];

async function swapETHForUSDC(amountInWei) {
  const provider = new ethers.JsonRpcProvider("https://sepolia.base.org");
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const weth = new ethers.Contract(WETH, WETH_ABI, wallet);
  const swapRouter = new ethers.Contract(SWAP_ROUTER, SWAP_ROUTER_ABI, wallet);
  const usdc = new ethers.Contract(USDC, USDC_ABI, wallet);

  console.log("Starting Uniswap swap...");
  console.log("Amount:", ethers.formatEther(amountInWei), "ETH");

  const ethBalance = await provider.getBalance(wallet.address);
  console.log("ETH balance:", ethers.formatEther(ethBalance), "ETH");

  const gasReserve = ethers.parseEther("0.005");
  const maxSwappable = ethBalance > gasReserve ? ethBalance - gasReserve : 0n;

  if (maxSwappable === 0n) {
    throw new Error("Insufficient ETH for swap after gas reserve");
  }

  const actualAmount = amountInWei > maxSwappable ? maxSwappable : amountInWei;
  console.log("Actual swap amount:", ethers.formatEther(actualAmount), "ETH");

  const wethBalance = await weth.balanceOf(wallet.address);
  let currentNonce = await provider.getTransactionCount(wallet.address, "pending");

  if (wethBalance < actualAmount) {
    const needed = actualAmount - wethBalance;
    console.log("Wrapping", ethers.formatEther(needed), "ETH to WETH...");
    const wrapTx = await weth.deposit({ value: needed, nonce: currentNonce });
    await wrapTx.wait();
    currentNonce++;
    console.log("Wrapped. Tx:", wrapTx.hash);
  } else {
    console.log("Sufficient WETH available — skipping wrap.");
  }

  console.log("Approving SwapRouter...");
  const approveTx = await weth.approve(SWAP_ROUTER, actualAmount, { nonce: currentNonce });
  await approveTx.wait();
  currentNonce++;
  console.log("Approved.");

  const usdcBefore = await usdc.balanceOf(wallet.address);

  console.log("Swapping WETH → USDC...");
  const params = {
    tokenIn: WETH,
    tokenOut: USDC,
    fee: 500,
    recipient: wallet.address,
    amountIn: actualAmount,
    amountOutMinimum: 0,
    sqrtPriceLimitX96: 0,
  };

  const swapTx = await swapRouter.exactInputSingle(params, { nonce: currentNonce });
  await swapTx.wait();
  console.log("Swap complete. Tx:", swapTx.hash);

  const usdcAfter = await usdc.balanceOf(wallet.address);
  const usdcReceived = usdcAfter - usdcBefore;
  console.log("USDC received:", (Number(usdcReceived) / 1e6).toFixed(6));
  console.log("Basescan:", `https://sepolia.basescan.org/tx/${swapTx.hash}`);

  return {
    txHash: swapTx.hash,
    usdcReceived: (Number(usdcReceived) / 1e6).toFixed(6),
  };
}

module.exports = { swapETHForUSDC };
