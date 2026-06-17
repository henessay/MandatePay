// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MandatePolicy} from "../src/MandatePolicy.sol";

/// @dev Minimal local cheatcode interface — NO forge-std dependency.
///      Only the cheatcodes used by these tests are declared.
interface Vm {
    function expectRevert() external;
    function prank(address) external;
    function warp(uint256) external;
    function startPrank(address) external;
    function stopPrank() external;
}

/// @dev Tiny local assertion harness in lieu of forge-std's Test.
contract Asserts {
    function assertTrue(bool cond, string memory err) internal pure {
        require(cond, err);
    }

    function assertEq(uint256 a, uint256 b, string memory err) internal pure {
        require(a == b, err);
    }

    function assertEq(bool a, bool b, string memory err) internal pure {
        require(a == b, err);
    }
}

contract MandatePolicyTest is Asserts {
    Vm constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    MandatePolicy policy;

    address cfo = address(0xCF0);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address eve = address(0xE5E); // never allowlisted

    bytes32 constant MID = keccak256("payroll-2026-Q2");

    uint64 constant T_START = 1_000_000;
    uint64 constant T_END = 2_000_000;

    // Default mandate params used by most tests.
    uint256 constant CEILING = 100_000_00; // $100,000.00 in cents
    uint256 constant ALICE_CAP = 50_000_00; // $50,000.00
    uint256 constant BOB_CAP = 30_000_00; // $30,000.00

    function setUp() public {
        policy = new MandatePolicy(cfo);

        address[] memory recips = new address[](2);
        recips[0] = alice;
        recips[1] = bob;
        uint256[] memory caps = new uint256[](2);
        caps[0] = ALICE_CAP;
        caps[1] = BOB_CAP;

        vm.prank(cfo);
        policy.createMandate(MID, CEILING, T_START, T_END, recips, caps);

        // Place "now" inside the validity window for most tests.
        vm.warp(T_START + 1);
    }

    // ----- happy path -----

    function test_HappyPath_AuthorizeIncrementsSpendAndRemaining() public {
        assertEq(policy.remainingCents(MID), CEILING, "remaining should start at ceiling");

        policy.authorizeDisbursement(MID, alice, 10_000_00, keccak256("n1"));

        (, uint256 spent,,,) = policy.mandates(MID);
        assertEq(spent, 10_000_00, "spent should be 10k");
        assertEq(policy.remainingCents(MID), CEILING - 10_000_00, "remaining should drop");
    }

    // ----- allowlist -----

    function test_NonAllowlistedRecipientReverts() public {
        vm.expectRevert();
        policy.authorizeDisbursement(MID, eve, 100, keccak256("n-eve"));
    }

    function test_IsAllowlistedViews() public view {
        assertEq(policy.isAllowlisted(MID, alice), true, "alice allowlisted");
        assertEq(policy.isAllowlisted(MID, eve), false, "eve not allowlisted");
        assertEq(policy.capOf(MID, bob), BOB_CAP, "bob cap");
    }

    // ----- per-line cap -----

    function test_AmountAboveLineCapReverts() public {
        vm.expectRevert();
        policy.authorizeDisbursement(MID, alice, ALICE_CAP + 1, keccak256("n-over"));
    }

    function test_AmountAtLineCapSucceeds() public {
        policy.authorizeDisbursement(MID, alice, ALICE_CAP, keccak256("n-at"));
        (, uint256 spent,,,) = policy.mandates(MID);
        assertEq(spent, ALICE_CAP, "spent equals cap");
    }

    // ----- ceiling -----

    function test_CeilingExceededRevertsOnCrossingDisbursement() public {
        // Two at-cap disbursements: 50k + 30k = 80k (ok), within 100k ceiling.
        policy.authorizeDisbursement(MID, alice, ALICE_CAP, keccak256("c1")); // 50k
        policy.authorizeDisbursement(MID, bob, BOB_CAP, keccak256("c2")); // +30k = 80k

        (, uint256 spent,,,) = policy.mandates(MID);
        assertEq(spent, ALICE_CAP + BOB_CAP, "spent 80k after two");

        // A third 30k would push to 110k > 100k ceiling -> revert. Within bob's cap.
        vm.expectRevert();
        policy.authorizeDisbursement(MID, bob, BOB_CAP, keccak256("c3"));

        // Spend unchanged after the reverted call.
        (, uint256 spent2,,,) = policy.mandates(MID);
        assertEq(spent2, ALICE_CAP + BOB_CAP, "spend unchanged after revert");
    }

    // ----- nonce / replay -----

    function test_ReusedNonceReverts() public {
        policy.authorizeDisbursement(MID, alice, 100_00, keccak256("dup"));
        vm.expectRevert();
        policy.authorizeDisbursement(MID, alice, 100_00, keccak256("dup"));
    }

    function test_DistinctNoncesSucceed() public {
        policy.authorizeDisbursement(MID, alice, 100_00, keccak256("d1"));
        policy.authorizeDisbursement(MID, alice, 100_00, keccak256("d2"));
        (, uint256 spent,,,) = policy.mandates(MID);
        assertEq(spent, 200_00, "two distinct nonces accumulate");
    }

    // ----- time window -----

    function test_BeforeNotBeforeReverts() public {
        vm.warp(T_START - 1);
        vm.expectRevert();
        policy.authorizeDisbursement(MID, alice, 100_00, keccak256("early"));
    }

    function test_AfterNotAfterReverts() public {
        vm.warp(uint256(T_END) + 1);
        vm.expectRevert();
        policy.authorizeDisbursement(MID, alice, 100_00, keccak256("late"));
    }

    // ----- access control -----

    function test_NonOwnerCreateMandateReverts() public {
        address[] memory recips = new address[](0);
        uint256[] memory caps = new uint256[](0);
        vm.prank(eve);
        vm.expectRevert();
        policy.createMandate(keccak256("other"), 1, T_START, T_END, recips, caps);
    }

    function test_NonOwnerRevokeReverts() public {
        vm.prank(eve);
        vm.expectRevert();
        policy.revokeMandate(MID);
    }

    function test_RevokedMandateRejectsDisbursement() public {
        vm.prank(cfo);
        policy.revokeMandate(MID);

        vm.expectRevert();
        policy.authorizeDisbursement(MID, alice, 100_00, keccak256("post-revoke"));
    }

    // ----- array length mismatch -----

    function test_CreateMandateLengthMismatchReverts() public {
        address[] memory recips = new address[](2);
        recips[0] = alice;
        recips[1] = bob;
        uint256[] memory caps = new uint256[](1);
        caps[0] = ALICE_CAP;

        vm.prank(cfo);
        vm.expectRevert();
        policy.createMandate(keccak256("mismatch"), CEILING, T_START, T_END, recips, caps);
    }

    // ----- duplicate mandate -----

    function test_CreateMandateTwiceReverts() public {
        address[] memory recips = new address[](0);
        uint256[] memory caps = new uint256[](0);
        vm.prank(cfo);
        vm.expectRevert();
        policy.createMandate(MID, CEILING, T_START, T_END, recips, caps);
    }
}
