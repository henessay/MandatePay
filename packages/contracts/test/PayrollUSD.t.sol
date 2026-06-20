// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PayrollUSD} from "../src/PayrollUSD.sol";

/// @dev Minimal local cheatcode interface — NO forge-std dependency.
interface Vm {
    function expectRevert() external;
    function prank(address) external;
}

contract Asserts {
    function assertTrue(bool cond, string memory err) internal pure {
        require(cond, err);
    }

    function assertEq(uint256 a, uint256 b, string memory err) internal pure {
        require(a == b, err);
    }
}

contract PayrollUSDTest is Asserts {
    Vm constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    PayrollUSD token;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    uint256 constant ONE = 1_000_000; // 1 mUSD (6 decimals)

    function setUp() public {
        // This test contract is the deployer => owner + initial supply holder.
        token = new PayrollUSD();
    }

    function test_InitialSupplyToDeployer() public {
        assertEq(token.totalSupply(), 100_000_000 * ONE, "supply");
        assertEq(token.balanceOf(address(this)), 100_000_000 * ONE, "deployer balance");
        assertEq(uint256(token.decimals()), 6, "decimals");
    }

    function test_Transfer() public {
        token.transfer(alice, 6200 * ONE);
        assertEq(token.balanceOf(alice), 6200 * ONE, "alice balance");
        assertEq(token.balanceOf(address(this)), (100_000_000 - 6200) * ONE, "treasury debited");
    }

    function test_Transfer_RevertsOnInsufficientBalance() public {
        vm.prank(alice); // alice has 0
        vm.expectRevert();
        token.transfer(bob, 1);
    }

    function test_TransferFrom_WithAllowance() public {
        token.approve(alice, 5000 * ONE);
        vm.prank(alice);
        token.transferFrom(address(this), bob, 4000 * ONE);
        assertEq(token.balanceOf(bob), 4000 * ONE, "bob balance");
        assertEq(token.allowance(address(this), alice), 1000 * ONE, "allowance decremented");
    }

    function test_Mint_OnlyOwner() public {
        token.mint(alice, 1000 * ONE);
        assertEq(token.balanceOf(alice), 1000 * ONE, "owner mint");

        vm.prank(bob);
        vm.expectRevert();
        token.mint(bob, 1);
    }
}
