// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockStETH is ERC20 {
    constructor() ERC20("Mock Lido Staked ETH", "stETH") {
        _mint(msg.sender, 1000 * 10 ** 18);
    }

    function simulateYield(address to, uint256 amount) external {
        _mint(to, amount);
    }
}