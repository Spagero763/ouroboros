const { ethers } = require("ethers");
const cron = require("node-cron");
const { swapETHForUSDC } = require("./uniswap");
require("dotenv").config();

const TREASURY_ABI = [
  "function getState() view returns (uint256, uint256, uint256, address, uint256, uint256)",
  "function spendYield(uint256 amount, string reason) returns (uint256)",
  "function availableYield() view returns (uint256)",
  "function logDecision(string decision, uint256 amount, string reason, bytes32 txHash) external",
];
const STETH_ABI = ["function simulateYield(address to, uint256 amount)"];

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function callClaude(prompt) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 128,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Claude error: ${JSON.stringify(data)}`);
  return data.content[0].text.trim();
}

function getDecisionType(yieldFloat) {
  if (yieldFloat < 0.05) return "HOLD";
  if (yieldFloat <= 0.3) return "TRADE";
  return "REINVEST";
}

async function runAgentCycle() {
  log("========================================");
  log("Ouroboros cycle starting...");
  log("========================================");

  try {
    const provider = new ethers.JsonRpcProvider("https://sepolia.base.org");
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const treasury = new ethers.Contract(process.env.TREASURY_ADDRESS, TREASURY_ABI, wallet);
    const stETH = new ethers.Contract(process.env.MOCK_STETH_ADDRESS, STETH_ABI, wallet);

    let nonce = await provider.getTransactionCount(wallet.address, "pending");
    log(`Starting nonce: ${nonce}`);

    // Step 1 — Read state
    const state = await treasury.getState();
    const principal = ethers.formatEther(state[0]);
    const balance = ethers.formatEther(state[1]);
    const yieldAvailable = ethers.formatEther(state[2]);
    const cycles = state[4].toString();
    const spent = ethers.formatEther(state[5]);

    log(`Principal locked:  ${principal} stETH`);
    log(`Current balance:   ${balance} stETH`);
    log(`Available yield:   ${yieldAvailable} stETH`);
    log(`Cycles completed:  ${cycles}`);
    log(`Total yield spent: ${spent} stETH`);

    // Step 2 — Simulate yield if none
    if (parseFloat(yieldAvailable) <= 0) {
      log("No yield. Simulating 0.5 stETH for demo...");
      const tx = await stETH.simulateYield(
        process.env.TREASURY_ADDRESS,
        ethers.parseEther("0.5"),
        { nonce: nonce++ }
      );
      await tx.wait();
      log(`Yield simulated. Tx: ${tx.hash}`);
      return;
    }

    // Step 3 — Determine decision in code (not Claude)
    const yieldFloat = parseFloat(yieldAvailable);
    const decisionType = getDecisionType(yieldFloat);
    log(`Decision type (from rules): ${decisionType}`);

    // Ask Claude only for the reason
    log("Asking Claude for reasoning...");
    const prompt = `You are Ouroboros, an autonomous DeFi agent. The decision is ${decisionType} based on ${yieldAvailable} stETH yield.

Write exactly ONE sentence explaining why ${decisionType} is the correct action for this yield amount.
Be specific about the amount. No JSON. Just the sentence.`;

    const reason = await callClaude(prompt);
    log(`Reason: ${reason}`);

    const decision = {
      decision: decisionType,
      amount: yieldFloat,
      reason: reason.replace(/^["']|["']$/g, '').trim(),
    };

    log(`Decision:   ${decision.decision}`);
    log(`Amount:     ${decision.amount} stETH`);
    log(`Reason:     ${decision.reason}`);

    // Step 4 — Execute
    if (decision.decision === "HOLD") {
      log("HOLD — no action this cycle.");
    } else {
      const amount = ethers.parseEther(String(decision.amount));
      const maxYield = await treasury.availableYield();
      const safe = amount > maxYield ? maxYield : amount;
      const reason = `${decision.decision}: ${decision.reason}`;

      log(`Calling spendYield(${ethers.formatEther(safe)} stETH)...`);
      const spendTx = await treasury.spendYield(safe, reason, { nonce: nonce++ });
      await spendTx.wait();
      log(`spendYield confirmed: ${spendTx.hash}`);
      log(`Basescan: https://sepolia.basescan.org/tx/${spendTx.hash}`);

      log("Writing decision to ERC-8004 on-chain record...");
      const txBytes = ethers.zeroPadValue(spendTx.hash, 32);
      const logTx = await treasury.logDecision(
        decision.decision,
        safe,
        decision.reason,
        txBytes,
        { nonce: nonce++ }
      );
      await logTx.wait();
      log(`ERC-8004 logged: ${logTx.hash}`);
      log(`Basescan: https://sepolia.basescan.org/tx/${logTx.hash}`);

      if (decision.decision === "TRADE") {
        try {
          log("Executing Uniswap swap...");
          const swap = await swapETHForUSDC(safe);
          log(`Swap confirmed: ${swap.txHash}`);
        } catch (swapErr) {
          log(`Swap failed (testnet liquidity): ${swapErr.message}`);
          log("Decision still logged on-chain. Continuing.");
        }
      }
    }

    // Step 5 — Prep next cycle
    log("Simulating 0.5 stETH yield for next cycle...");
    const freshNonce = await provider.getTransactionCount(wallet.address, "pending");
    const nextTx = await stETH.simulateYield(
      process.env.TREASURY_ADDRESS,
      ethers.parseEther("0.5"),
      { nonce: freshNonce }
    );
    await nextTx.wait();
    log(`Next yield ready. Tx: ${nextTx.hash}`);

    log("========================================");
    log("Cycle complete. Sleeping until next run.");
    log("========================================");

  } catch (err) {
    log(`ERROR: ${err.message}`);
  }
}

log(`Ouroboros starting...`);
log(`Wallet:   ${new ethers.Wallet(process.env.PRIVATE_KEY).address}`);
log(`Treasury: ${process.env.TREASURY_ADDRESS}`);

runAgentCycle();
cron.schedule("0 5 * * *", runAgentCycle);
log("Running. Next scheduled: 5am UTC daily. Ctrl+C to stop.");