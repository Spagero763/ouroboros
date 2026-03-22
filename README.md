<<<<<<< HEAD

=======
# Ouroboros — The Self-Sustaining Agent

> The first AI agent that earns, thinks, and trades entirely on its own.

## What it does

Ouroboros is a fully autonomous DeFi AI agent deployed on Base Sepolia. It:

1. **Stakes ETH** into Lido, receiving stETH that accrues yield daily
2. **Earns yield** autonomously — principal is locked forever in the smart contract
3. **Thinks** — Claude analyzes the treasury state and decides: TRADE, REINVEST, or HOLD
4. **Executes** — decisions fire on-chain via Uniswap V3 on Base
5. **Records** — every decision logged permanently to an ERC-8004 on-chain identity

No human involvement after deployment. No top-ups. Ever.

## Live contracts (Base Sepolia)

| Contract | Address |
|----------|---------|
| OuroborosTreasury | `0x97CDC84FcFab7b24998C93f0130EFbB0c5dBa247` |
| MockStETH | `0xC187f626c518f4a7591bAA7387CbdBAB1DC99bc9` |

## Architecture
```
Human deposits ETH once
        ↓
Treasury contract locks principal
        ↓
stETH yield accrues daily
        ↓
Agent wakes up (24hr cron)
        ↓
Claude analyzes treasury state
        ↓
Decision: TRADE → Uniswap swap
          REINVEST → compound
          HOLD → wait
        ↓
ERC-8004 logs decision on-chain
        ↓
Agent sleeps until next cycle
```

## Tech stack

- **Smart contracts** — Solidity 0.8.20, Hardhat, OpenZeppelin
- **Agent loop** — Node.js, ethers.js, node-cron
- **AI inference** — Claude (Anthropic) via API
- **Trading** — Uniswap V3 on Base Sepolia
- **Identity** — ERC-8004 on-chain agent identity
- **Frontend** — React, Vite, ethers.js
- **Network** — Base Sepolia testnet

## How the agent sustains itself

The treasury contract enforces a single rule in Solidity: **only yield above the principal can ever be spent**. The principal is mathematically locked. The agent earns yield, pays for its own Claude inference, executes trades with the remainder, and logs everything on-chain. It has a permanent verifiable history of every decision it has ever made.

>>>>>>> 058a717 (Add README and .env.example)
