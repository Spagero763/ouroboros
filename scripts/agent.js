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
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Claude error: ${JSON.stringify(data)}`);
  return data.content[0].text.trim();
}

async function runAgentCycle() {
  log("========================================");
  log("Ouroboros cycle starting...");
  log("========================================");

  try {
    // Single provider and wallet for entire cycle
    const provider = new ethers.JsonRpcProvider("https://sepolia.base.org");
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const treasury = new ethers.Contract(process.env.TREASURY_ADDRESS, TREASURY_ABI, wallet);
    const stETH = new ethers.Contract(process.env.MOCK_STETH_ADDRESS, STETH_ABI, wallet);

    // Get starting nonce
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

    // Step 3 — Ask Claude
    log("Asking Claude for decision...");
    const prompt = `You are Ouroboros, a fully autonomous DeFi AI agent on Base Sepolia.

State:
- Principal locked: ${principal} stETH (untouchable)
- Balance: ${balance} stETH
- Available yield: ${yieldAvailable} stETH
- Cycles run: ${cycles}

Rules:
- yield < 0.05 stETH → HOLD
- yield 0.05 to 0.3 stETH → TRADE (swap to USDC)
- yield > 0.3 stETH → REINVEST (compound)

Respond ONLY in this JSON format:
{
  "decision": "TRADE" or "REINVEST" or "HOLD",
  "amount": <number max ${yieldAvailable}>,
  "reason": "<one sentence>",
  "confidence": <1-10>
}`;

    const raw = await callClaude(prompt);
    log(`Claude: ${raw}`);

    let decision;
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      decision = JSON.parse(match ? match[0] : raw);
    } catch (e) {
      log("Could not parse Claude response. Skipping.");
      return;
    }

    log(`Decision:   ${decision.decision}`);
    log(`Amount:     ${decision.amount} stETH`);
    log(`Reason:     ${decision.reason}`);
    log(`Confidence: ${decision.confidence}/10`);

    // Step 4 — Execute
    if (decision.decision === "HOLD") {
      log("HOLD — no action this cycle.");
    } else {
      const amount = ethers.parseEther(String(decision.amount));
      const maxYield = await treasury.availableYield();
      const safe = amount > maxYield ? maxYield : amount;
      const reason = `${decision.decision}: ${decision.reason}`;

      // spendYield
      log(`Calling spendYield(${ethers.formatEther(safe)} stETH)...`);
      const spendTx = await treasury.spendYield(safe, reason, { nonce: nonce++ });
      await spendTx.wait();
      log(`spendYield confirmed: ${spendTx.hash}`);
      log(`Basescan: https://sepolia.basescan.org/tx/${spendTx.hash}`);

      // logDecision — ERC-8004
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

      // Attempt swap
      if (decision.decision === "TRADE") {
        try {
          log("Executing Uniswap swap...");
          const swap = await swapETHForUSDC(safe);
          log(`Swap confirmed: ${swap.txHash}`);
          log(`USDC received: ${swap.usdcReceived}`);
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