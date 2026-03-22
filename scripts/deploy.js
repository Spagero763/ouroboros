const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with wallet:", deployer.address);

  const MOCK_STETH_ADDRESS = process.env.MOCK_STETH_ADDRESS;
  const AGENT_ADDRESS = process.env.AGENT_ADDRESS;

  if (!MOCK_STETH_ADDRESS || !AGENT_ADDRESS) {
    throw new Error("Missing MOCK_STETH_ADDRESS or AGENT_ADDRESS in .env");
  }

  const Treasury = await ethers.getContractFactory("OuroborosTreasury");
  const treasury = await Treasury.deploy(MOCK_STETH_ADDRESS, AGENT_ADDRESS);
  await treasury.waitForDeployment();

  const address = await treasury.getAddress();

  console.log("------------------------------------------");
  console.log("Ouroboros Treasury deployed to:", address);
  console.log("Save this address for the agent script");
  console.log("------------------------------------------");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});