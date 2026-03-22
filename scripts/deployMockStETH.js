const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying MockStETH with wallet:", deployer.address);

  const MockStETH = await ethers.getContractFactory("MockStETH");
  const mockStETH = await MockStETH.deploy();
  await mockStETH.waitForDeployment();

  const address = await mockStETH.getAddress();

  console.log("------------------------------------------");
  console.log("MockStETH deployed to:", address);
  console.log("Copy this into MOCK_STETH_ADDRESS in your .env");
  console.log("------------------------------------------");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});