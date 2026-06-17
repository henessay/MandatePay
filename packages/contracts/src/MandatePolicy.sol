// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MandatePolicy
/// @notice On-chain DEFENSE-IN-DEPTH MIRROR of a CFO-signed payroll mandate.
///
///         MandatePay delegates payroll payouts to an AI agent acting under a
///         CFO-signed mandate. The PRIMARY, load-bearing enforcement is a
///         TEE-signed delegation credential constructed off-chain. THIS CONTRACT
///         IS NOT LOAD-BEARING. It is a secondary, independent re-enforcement of
///         the same mandate bounds so that a payout which somehow bypassed the
///         signed bounds still cannot execute on-chain.
///
///         If the chain is unavailable, the TEE bounds still hold; this contract
///         exists purely so the bounds are checked a second time, by a second
///         independent system, before value moves.
///
/// @dev    The agent's payout path calls {authorizeDisbursement} before
///         dispatching funds. That function mutates state (running spend +
///         nonce consumption) so it is a transaction, not a view.
contract MandatePolicy {
    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------

    /// @notice A single mandate's bounds and running state.
    /// @param ceilingCents Total amount (in cents) the mandate may ever disburse.
    /// @param spentCents   Running total already authorized under this mandate.
    /// @param notBefore    Unix timestamp before which disbursements are rejected.
    /// @param notAfter     Unix timestamp after which disbursements are rejected.
    /// @param active       False once never-created or revoked.
    struct Mandate {
        uint256 ceilingCents;
        uint256 spentCents;
        uint64 notBefore;
        uint64 notAfter;
        bool active;
    }

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    /// @notice The CFO / mandate authority. Set once at deploy.
    address public immutable owner;

    /// @notice mandateId => mandate bounds + running state.
    mapping(bytes32 => Mandate) public mandates;

    /// @notice mandateId => recipient => max cents per single disbursement.
    /// @dev A cap of 0 means the recipient is NOT allowlisted.
    mapping(bytes32 => mapping(address => uint256)) public lineCapCents;

    /// @notice mandateId => nonce => used. Replay protection for disbursements.
    mapping(bytes32 => mapping(bytes32 => bool)) public usedNonce;

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    event MandateCreated(
        bytes32 indexed mandateId,
        uint256 ceilingCents,
        uint64 notBefore,
        uint64 notAfter,
        uint256 recipientCount
    );

    event DisbursementAuthorized(
        bytes32 indexed mandateId,
        address indexed recipient,
        uint256 amountCents,
        bytes32 nonce,
        uint256 newSpentCents
    );

    event MandateRevoked(bytes32 indexed mandateId);

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    error NotOwner();
    error MandateExists();
    error LengthMismatch();
    error NotAllowlisted(address recipient);
    error LineCapExceeded(uint256 amount, uint256 cap);
    error CeilingExceeded(uint256 spent, uint256 amount, uint256 ceiling);
    error NonceReused(bytes32 nonce);
    error MandateInactive();
    error OutsideWindow();

    // ---------------------------------------------------------------------
    // Modifiers
    // ---------------------------------------------------------------------

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // ---------------------------------------------------------------------
    // Construction
    // ---------------------------------------------------------------------

    /// @param _owner The CFO / mandate authority address.
    constructor(address _owner) {
        owner = _owner;
    }

    // ---------------------------------------------------------------------
    // Mandate lifecycle (owner only)
    // ---------------------------------------------------------------------

    /// @notice Create a mandate with a spend ceiling, validity window, and a
    ///         recipient allowlist with per-recipient line caps.
    /// @dev    Mirrors the bounds embedded in the TEE-signed credential.
    /// @param mandateId    Unique identifier for this mandate.
    /// @param ceilingCents Total period ceiling in cents.
    /// @param notBefore    Validity window start (unix seconds).
    /// @param notAfter     Validity window end (unix seconds).
    /// @param recipients   Allowlisted recipient addresses.
    /// @param caps         Per-recipient per-disbursement cap in cents (parallel
    ///                     to `recipients`; a cap of 0 leaves a recipient off the
    ///                     allowlist).
    function createMandate(
        bytes32 mandateId,
        uint256 ceilingCents,
        uint64 notBefore,
        uint64 notAfter,
        address[] calldata recipients,
        uint256[] calldata caps
    ) external onlyOwner {
        if (mandates[mandateId].active) revert MandateExists();
        if (recipients.length != caps.length) revert LengthMismatch();

        mandates[mandateId] = Mandate({
            ceilingCents: ceilingCents,
            spentCents: 0,
            notBefore: notBefore,
            notAfter: notAfter,
            active: true
        });

        for (uint256 i = 0; i < recipients.length; i++) {
            lineCapCents[mandateId][recipients[i]] = caps[i];
        }

        emit MandateCreated(mandateId, ceilingCents, notBefore, notAfter, recipients.length);
    }

    /// @notice Revoke a mandate, rejecting all further disbursements.
    function revokeMandate(bytes32 mandateId) external onlyOwner {
        mandates[mandateId].active = false;
        emit MandateRevoked(mandateId);
    }

    // ---------------------------------------------------------------------
    // Payout-path check
    // ---------------------------------------------------------------------

    /// @notice Re-enforce the mandate bounds for a single disbursement and, on
    ///         success, consume the nonce and increment the running spend.
    /// @dev    Called by the agent's payout path BEFORE dispatching funds. This
    ///         is the on-chain mirror of the TEE bound check. Reverts with a
    ///         specific custom error on any violation.
    /// @param mandateId   The mandate being drawn against.
    /// @param recipient   Payout recipient (must be allowlisted, cap > 0).
    /// @param amountCents Disbursement amount in cents.
    /// @param nonce       Unique per-disbursement nonce (replay protection).
    function authorizeDisbursement(
        bytes32 mandateId,
        address recipient,
        uint256 amountCents,
        bytes32 nonce
    ) external {
        Mandate storage m = mandates[mandateId];

        // 1. Mandate must be live.
        if (!m.active) revert MandateInactive();

        // 2. Inside the validity window.
        if (block.timestamp < m.notBefore || block.timestamp > m.notAfter) {
            revert OutsideWindow();
        }

        // 3. Recipient must be allowlisted (cap of 0 == not allowlisted).
        uint256 cap = lineCapCents[mandateId][recipient];
        if (cap == 0) revert NotAllowlisted(recipient);

        // 4. Single disbursement must not exceed the per-line cap.
        if (amountCents > cap) revert LineCapExceeded(amountCents, cap);

        // 5. Running spend must not exceed the total ceiling.
        if (m.spentCents + amountCents > m.ceilingCents) {
            revert CeilingExceeded(m.spentCents, amountCents, m.ceilingCents);
        }

        // 6. Nonce must be fresh (replay protection).
        if (usedNonce[mandateId][nonce]) revert NonceReused(nonce);

        // Effects.
        usedNonce[mandateId][nonce] = true;
        m.spentCents += amountCents;

        emit DisbursementAuthorized(mandateId, recipient, amountCents, nonce, m.spentCents);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @notice Cents remaining under the mandate ceiling. Zero if overspent or
    ///         unknown mandate.
    function remainingCents(bytes32 mandateId) external view returns (uint256) {
        Mandate storage m = mandates[mandateId];
        if (m.spentCents >= m.ceilingCents) return 0;
        return m.ceilingCents - m.spentCents;
    }

    /// @notice Whether a recipient is allowlisted under a mandate (cap > 0).
    function isAllowlisted(bytes32 mandateId, address recipient) external view returns (bool) {
        return lineCapCents[mandateId][recipient] > 0;
    }

    /// @notice Per-disbursement cap (cents) for a recipient under a mandate.
    function capOf(bytes32 mandateId, address recipient) external view returns (uint256) {
        return lineCapCents[mandateId][recipient];
    }
}
