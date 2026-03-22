const { ethers } = require("ethers");
require("dotenv").config();

async function swapETHForUSDC(amountInWei) {
  console.log("Starting Uniswap swap...");
  console.log("Amount:", ethers.formatEther(amountInWei), "ETH");

  const weth = new ethers.Contract(WETH, WETH_ABI, wallet);
  const swapRouter = new ethers.Contract(SWAP_ROUTER, SWAP_ROUTER_ABI, wallet);
  const usdc = new ethers.Contract(USDC, USDC_ABI, wallet);

  const ethBalance = await provider.getBalance(wallet.address);
  console.log("ETH balance:", ethers.formatEther(ethBalance), "ETH");

  // Reserve 0.005 ETH for gas, cap swap at remaining balance
  const gasReserve = ethers.parseEther("0.005");
  const maxSwappable = ethBalance > gasReserve ? ethBalance - gasReserve : 0n;

  if (maxSwappable === 0n) {
    throw new Error("Insufficient ETH for swap after gas reserve");
  }

  // Use the smaller of requested amount or max swappable
  const actualAmount = amountInWei > maxSwappable ? maxSwappable : amountInWei;
  console.log("Actual swap amount:", ethers.formatEther(actualAmount), "ETH");

  const wethBalance = await weth.balanceOf(wallet.address);
  let currentNonce = await provider.getTransactionCount(wallet.address);

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
  console.log("USDC received:", (Number(usdcReceived) / 1e6).toFixed(6), "USDC");
  console.log("Basescan:", `https://sepolia.basescan.org/tx/${swapTx.hash}`);

  return {
    txHash: swapTx.hash,
    usdcReceived: (Number(usdcReceived) / 1e6).toFixed(6),
  };
}module.exports = { swapETHForUSDC };
