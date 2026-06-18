# MandatePay — 3-minute demo video script (draft)

**Goal:** in 3 minutes, prove the four claims a judge cares about — (1) it's a *complete* agent,
(2) it uses Terminal 3's **Agent-Auth** for real, (3) it's *creative* (judgment + on-chain + trust
UX), and (4) **nothing is faked** (real signatures, real on-chain agent-auth tx, real LLM reasoning).

**Legend:** 🖱️ = what *you* click / show on screen · 🎙️ = what *you* say (voiceover) · 🏆 = the
judge-facing point (don't say it, just make sure the shot lands it).

> Tip: keep one terminal tab pre-warmed with the live agent-auth tx proof (Beat 6) and one browser tab
> on the dashboard. Pre-fill the HR textbox is fine — the *parse* is what's live.

---

### Beat 0 — Hook (0:00–0:20)
- 🖱️ Title card → cut to the dashboard landing (mandate card empty, roster visible).
- 🎙️ *"To let an AI agent run payroll, you normally hand it everyone's bank account numbers and hope.
  That's a data leak, an over-spend, and a wrong-account transfer waiting to happen. MandatePay removes
  all three — by construction — on Terminal 3."*
- 🏆 Frames the T3 thesis (agents without raw PII) as the problem we solve.

### Beat 1 — CFO signs a bounded mandate (0:20–0:45)
- 🖱️ Click **Sign Mandate**. Show the terms: ceiling, allowlist, per-line cap, validity window.
- 🎙️ *"The CFO signs a mandate the agent can read but never exceed — a ceiling, an allowlist, a
  per-line cap, a validity window. It's an EIP-191 signature over the canonical delegation credential.
  The agent gets a leash, not the keys."*
- 🏆 **Agent-Auth depth #1:** real `buildDelegationCredential` → RFC-8785 JCS → EIP-191 sign. Show the
  recovered signer == CFO address (proves it's a real signature, verified the same way the TEE does).

### Beat 2 — A messy HR update arrives — in Russian (0:45–1:20) ⭐ our trump card
- 🖱️ Paste into the HR-intake box (free-form, Russian):
  `Борис Иванов уволился; Кэрол Петрова с 15-го числа переходит на 0.5 ставки; отделу sales — премия 10%`
  → click **Interpret**.
- 🖱️ Show the agent's reviewable **diff**: terminate (Борис) · rate-change 0.5 (Кэрол) · +10% bonus to
  the **three** sales members (Alice, Dinesh, Emma) — a team instruction expanded per-employee.
- 🎙️ *"This is free-form, and it's Russian — not a form. The agent (Claude Sonnet 4.6) reasons over it:
  it understands 'уволился' is a termination, '0.5 ставки' is a rate change, and 'отделу sales — премия'
  has to fan out to every person on the sales team. A regex couldn't do this. But notice — the LLM only
  proposes. It never authorizes a cent."*
- 🏆 **Creativity #1 + proof it's reasoning, not patterns:** the same deltas come out of the English and
  Russian phrasings; the model expands a team-wide instruction by matching the roster. (Have the EN run
  ready as a 2-second cutaway if asked.)

### Beat 3 — Split-screen: what the agent saw vs what the bank got (1:20–1:50)
- 🖱️ Open the **split-screen** for a payout line. Left: the agent's actual `EmployeePayoutContext` —
  `recipientRef` / `{{account}}`. Right: the rail's `DispatchReceipt` — masked account `•••• 4242`.
- 🎙️ *"Here's the zero-PII boundary you can *see*. Left is exactly what the agent held — an opaque
  reference and a placeholder. Right is what the rail dispatched — a masked account. The agent never
  touched a real number. And this isn't a mockup: the left pane renders the agent's real object, which
  by construction has no field for an account number — try to put one there and the code throws."*
- 🏆 **Creativity #2:** trust you can see, backed by real objects + a runtime `assertNoRawAccount` guard.

### Beat 4 — The anomaly: Emma is halted and escalated (1:50–2:20)
- 🖱️ Scroll the proposal: Alice / Carol / Dinesh = **ready**; **Emma = halted-escalated** (red). Open
  Emma's escalation note.
- 🎙️ *"Emma's bank account changed recently — a classic mule-account red flag. The deterministic layer
  halts that line and the agent writes a plain-language escalation for a human. Three payouts go through;
  the suspicious one is stopped cold. And the whole batch is checked against the signed ceiling before
  anything moves."*
- 🏆 **Completeness + the split:** the *deterministic* layer halts (not the LLM); the LLM only writes the
  explanation. Ceiling/window/per-line all enforced here.

### Beat 5 — Live attested audit ledger (2:20–2:40)
- 🖱️ Open the **Ledger** tab: host-stamped immutable batches, each line with `tx_hash`; the **TDX
  attestation badge** on the node `/status`.
- 🎙️ *"Every decision — dispatched, halted, denied — lands in an immutable, attested ledger. Who
  authorized, for whom, how much, when. The attestation badge is a real remote-attestation of the
  enclave that stamped it."*
- 🏆 **Completeness:** the audit trail closes the loop; attestation = "trust you can verify."

### Beat 6 — "None of this is theatre" (2:40–3:00) ⭐ proof shot
- 🖱️ Cut to the pre-warmed terminal: the live run against `cn-api.sg.testnet.t3n.terminal3.io` —
  handshake → SIWE → DID `did:t3n:cb2c…542e` → **`agent-auth-update` committed: `tx:302:44993`,
  `tx:302:44995`**.
- 🎙️ *"And to be clear about what's real: the Agent-Auth layer runs against Terminal 3's live testnet —
  these are real on-chain authorization grants. We took their flagship payroll contract all the way to
  its authorization layer; the one piece we mock — the bank dispatch — we mock *honestly*, because the
  built-in contract isn't provisionable on the sandbox yet, and we filed six reproducible bugs about it
  instead of faking a payout."*
- 🏆 **Honesty + Agent-Auth depth #2:** real tx hashes on screen. Ends on credibility, not a fake green
  checkmark. (See `docs/R1_RESOLUTION.md`, `docs/BUG_REPORT_HEADLINE.md`.)

---

### Shot list / pre-flight
- [ ] Dashboard up on `localhost:3000`, roster loaded, mandate unsigned.
- [ ] HR box pre-loaded with the Russian string (parse live on click).
- [ ] Terminal pre-run with the agent-auth proof visible (`tx:302:44993/95`), DID masked to `cb2c…542e`.
- [ ] Split-screen and Ledger tabs reachable in one click each.
- [ ] Optional 2-sec cutaway: the English HR run producing identical deltas (reasoning proof).

### Timing budget
| Beat | Window | Hard stop |
|---|---|---|
| 0 Hook | 0:00–0:20 | 0:20 |
| 1 Sign mandate | 0:20–0:45 | 0:45 |
| 2 HR update (RU) | 0:45–1:20 | 1:20 |
| 3 Split-screen | 1:20–1:50 | 1:50 |
| 4 Anomaly halt | 1:50–2:20 | 2:20 |
| 5 Ledger | 2:20–2:40 | 2:40 |
| 6 Proof / close | 2:40–3:00 | 3:00 |
