// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title PayrollUSD (mUSD)
/// @notice A minimal, self-contained ERC-20 test token used as the salary unit
///         for the MandatePay on-chain payout demo on Sepolia. NOT a real
///         stablecoin — it is a faucet-style test token so payroll runs move
///         visible value to employee wallets you can watch on Etherscan.
///
/// @dev    6 decimals (USD-like, mirrors USDC). The deployer is the owner and
///         receives the initial supply (it is the payroll treasury). The owner
///         can mint more for top-ups. No external dependencies — `forge build`
///         and deploy need nothing installed.
contract PayrollUSD {
    string public constant name = "Payroll USD";
    string public constant symbol = "mUSD";
    uint8 public constant decimals = 6;

    uint256 public totalSupply;
    address public owner;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    error NotOwner();
    error InsufficientBalance();
    error InsufficientAllowance();
    error ZeroAddress();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /// @notice Mints 100,000,000 mUSD to the deployer (the treasury).
    constructor() {
        owner = msg.sender;
        _mint(msg.sender, 100_000_000 * (10 ** uint256(decimals)));
    }

    /// @notice Owner can mint more test tokens (top-up the treasury).
    function mint(address to, uint256 value) external onlyOwner {
        _mint(to, value);
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            if (allowed < value) revert InsufficientAllowance();
            allowance[from][msg.sender] = allowed - value;
        }
        _transfer(from, to, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal {
        if (to == address(0)) revert ZeroAddress();
        uint256 bal = balanceOf[from];
        if (bal < value) revert InsufficientBalance();
        unchecked {
            balanceOf[from] = bal - value;
            balanceOf[to] += value;
        }
        emit Transfer(from, to, value);
    }

    function _mint(address to, uint256 value) internal {
        if (to == address(0)) revert ZeroAddress();
        totalSupply += value;
        unchecked {
            balanceOf[to] += value;
        }
        emit Transfer(address(0), to, value);
    }
}
