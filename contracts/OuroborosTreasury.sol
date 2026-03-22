// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract OuroborosTreasury is Ownable {

    IERC20 public stETH;
    address public agent;
    uint256 public principal;
    uint256 public cycleCount;
    uint256 public totalYieldSpent;

    struct DecisionRecord {
        uint256 cycle;
        string decision;
        uint256 amount;
        string reason;
        bytes32 txHash;
        uint256 timestamp;
    }

    DecisionRecord[] public decisionHistory;

    event Deposited(address indexed from, uint256 amount);
    event YieldWithdrawn(address indexed agent, uint256 amount, string reason);
    event AgentUpdated(address indexed newAgent);
    event DecisionLogged(
        uint256 indexed cycle,
        string decision,
        uint256 amount,
        string reason,
        bytes32 txHash,
        uint256 timestamp
    );

    constructor(address _stETH, address _agent) Ownable(msg.sender) {
        stETH = IERC20(_stETH);
        agent = _agent;
    }

    function deposit(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        stETH.transferFrom(msg.sender, address(this), amount);
        principal += amount;
        emit Deposited(msg.sender, amount);
    }

    function availableYield() public view returns (uint256) {
        uint256 currentBalance = stETH.balanceOf(address(this));
        if (currentBalance <= principal) return 0;
        return currentBalance - principal;
    }

    function spendYield(uint256 amount, string calldata reason) external returns (uint256) {
        require(msg.sender == agent, "Only agent can spend yield");
        require(amount <= availableYield(), "Cannot spend more than yield");
        require(amount > 0, "Amount must be greater than 0");

        cycleCount++;
        totalYieldSpent += amount;
        stETH.transfer(agent, amount);
        emit YieldWithdrawn(agent, amount, reason);
        return cycleCount;
    }

    function logDecision(
        string calldata decision,
        uint256 amount,
        string calldata reason,
        bytes32 txHash
    ) external {
        require(msg.sender == agent, "Only agent can log decisions");

        DecisionRecord memory record = DecisionRecord({
            cycle: cycleCount,
            decision: decision,
            amount: amount,
            reason: reason,
            txHash: txHash,
            timestamp: block.timestamp
        });

        decisionHistory.push(record);

        emit DecisionLogged(
            cycleCount,
            decision,
            amount,
            reason,
            txHash,
            block.timestamp
        );
    }

    function getDecisionHistory() external view returns (DecisionRecord[] memory) {
        return decisionHistory;
    }

    function setAgent(address _agent) external onlyOwner {
        agent = _agent;
        emit AgentUpdated(_agent);
    }

    function getState() external view returns (
        uint256 _principal,
        uint256 _currentBalance,
        uint256 _availableYield,
        address _agent,
        uint256 _cycleCount,
        uint256 _totalYieldSpent
    ) {
        return (
            principal,
            stETH.balanceOf(address(this)),
            availableYield(),
            agent,
            cycleCount,
            totalYieldSpent
        );
    }
}