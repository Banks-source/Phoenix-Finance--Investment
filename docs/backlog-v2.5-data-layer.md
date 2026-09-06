# Phoenix Finance — backlog: v2.5 data layer + v3 thesis engine

Repo: `Banks-source/Phoenix-Finance--Investment`
Written: 2026-08-08 · Source: investment-thesis session (`01 - Projects/phoenix-investment-thesis.md`)

> Note: this document is kept as the source record. Its content was pushed live as GitHub Issues #3–#14 on 2026-08-22 — check those issues for current status, comments and assignment rather than editing this file to track progress.

Each `##` block below is one GitHub issue. Suggested labels in each block.

---

## Architecture decision (read first — context for every issue below)

**Kubera is the aggregator. Phoenix is the intelligence layer on top of it.**

Lloyd already has NAB, CBA, Trezor, SwyftX, MetaMask and Phantom connected in Kubera. Kubera exposes a personal REST API (Settings → API; 30 req/min, 500/day on Essentials, 1000/day on Black). Phoenix pulls from that one endpoint instead of building and maintaining six separate wallet/exchange/bank integrations.

**Critical scope boundary — this changes what still needs building:**

| Need | Source | Why |
|------|--------|-----|
| Balances, holdings, net worth, asset-level values | **Kubera API** | It already aggregates all of it |
| Categorised *transactions* for budgeting | **Still NAB/CBA CSV** | Kubera is a net-worth tracker — it does not expose transaction-level spend data. v1 Budget cannot be built on Kubera. |

So: Kubera solves the **investment/net-worth** side (v2.5 + v3). It does **not** solve the **budget** side (v1). Both pipelines are needed; they serve different questions.

**Rejected:** direct integration with Basiq/Frollo/Adatree (CDR aggregators). They're built for accredited businesses — 12-month minimums, per-user billing, accreditation overhead. Disproportionate for a two-person household app when Kubera already holds the connections.

---

## ISSUE 1 → GitHub #3

### Build Kubera API client and nightly sync

**Labels:** `v2.5`, `data-layer`, `backend`, `priority:high`

**Goal.** Phoenix pulls the full portfolio from Kubera on a schedule and stores it as its own time-series, so Phoenix owns the history even if Kubera is later cancelled.

**Context.** Kubera aggregates NAB, CBA, Trezor, SwyftX, MetaMask, Phantom and manual assets (super, property). Its API is the single ingestion point for all balance/holding data. Rate limits are tight (30/min, 500–1000/day) so sync must be scheduled and cached, never called per page-load.

**Acceptance criteria.**
- API key stored in Supabase vault / env, never client-side. Key is read-only by nature but treat as a secret.
- Nightly job (Vercel cron) fetches the full portfolio; writes a dated snapshot row per asset to a `portfolio_snapshots` table.
- Snapshots are append-only — never overwrite history. This is what makes Kubera cancellable later.
- Handles rate-limit 429s with backoff; a failed sync alerts rather than silently leaving stale data.
- Manual "sync now" button, throttled to respect the daily quota.
- Asset records carry a stable Kubera ID so the same holding tracks across snapshots.
- Unit tests for the parser against a captured sample response (shape may change without notice — fail loudly, don't coerce).

**Out of scope.** Writing back to Kubera. Phoenix reads only.

**Open question for Lloyd.** Which Kubera tier are you on? Determines whether the daily quota is 500 or 1000, which affects sync frequency.

---

## ISSUE 2 → GitHub #4

### Map Kubera assets to thesis sleeves

**Labels:** `v3`, `thesis-engine`, `backend`

**Goal.** Every asset from Kubera is classified into one of the thesis sleeves so allocation can be computed automatically.

**Context.** The thesis defines six sleeves with bands. Kubera returns assets with its own categories, which won't match. A mapping layer is needed, with a human approval step for anything unrecognised (same pattern as the v1 transaction categoriser).

**Sleeves and bands (from `phoenix-investment-thesis.md`):**

| Sleeve | Band |
|--------|------|
| BTC / crypto | 30–40% |
| AI/tech + raw materials | 20–30% |
| EM equity | 10–20% |
| Health / biotech | 5–10% |
| Dry powder (cash, stables, short bonds) | 5–15% |
| Metals | 0% (trigger-gated) |

**Acceptance criteria.**
- `sleeve_mappings` table: Kubera asset ID → sleeve, with an override flag for manual assignment.
- Unmapped assets surface in a review queue rather than defaulting to a sleeve or being silently dropped.
- Basis for percentages is **investable net worth**: includes super, **excludes PPR**. Make this a named, testable function — it's the denominator for every band check and getting it wrong silently corrupts every downstream calculation.
- Assets flagged `excluded_from_investable` (PPR, personal vehicles) are held but not counted in the denominator.
- Legacy/non-thesis holdings can be tagged as such (see Issue 6).

---

## ISSUE 3 → GitHub #5

### Allocation dashboard with band-breach detection

**Labels:** `v3`, `thesis-engine`, `frontend`

**Goal.** One screen answers: where am I against the bands, and what's out of range?

**Acceptance criteria.**
- Current allocation vs band per sleeve, showing actual %, band range, and drift.
- Any sleeve outside its band is visually flagged with the required direction of correction (trim/add) and the dollar amount to return to mid-band.
- **BTC concentration check is separate and explicit** — measured against total net worth, not investable net worth, because the hard rule is written that way (≤40% NW). Do not conflate the two denominators.
- Historical allocation chart from `portfolio_snapshots`.
- Read-only. **The app signals, it never executes.** No broker write APIs, no trade buttons — this constraint is in the PRD and is non-negotiable.

---

## ISSUE 4 → GitHub #6

### Quarterly review workflow (≤30 min, timed)

**Labels:** `v3`, `thesis-engine`, `frontend`

**Goal.** The thesis's quarterly review runs inside Phoenix as a guided six-step flow, completable in under 30 minutes.

**Context.** The thesis specifies a six-step checklist with a 5-minute budget per step. If the review takes longer than 30 minutes it won't get done, and the whole DCA-core-plus-quarterly-overlay posture collapses into drift. The time budget is a product requirement, not a nice-to-have.

**Acceptance criteria.**
- Six steps, matching the thesis: (1) update values, (2) band check, (3) cycle inputs, (4) kill-criteria scan, (5) actions, (6) log.
- Steps 1 and 2 are pre-computed from the Kubera sync — Lloyd reviews rather than enters.
- Step 4 presents all eight kill criteria as an explicit yes/no scan; none can be skipped without being marked "not assessed".
- Step 6 generates a dated markdown entry appending to the thesis Thinking Changelog, written back to the vault (or exported for paste).
- Elapsed timer visible. If a review exceeds 30 minutes, log it — repeated overruns mean the checklist needs simplifying.
- Quarterly reminder, with the review archived so past reviews are auditable.

---

## ISSUE 5 → GitHub #7

### Encode the hard rules as automated checks

**Labels:** `v3`, `thesis-engine`, `backend`, `priority:high`

**Goal.** The thesis's hard rules are continuously evaluated, not remembered.

**Context.** These rules exist because of the Tyquin St and Ocean Grove losses. Their value is that they fire *before* a decision, not after. Each is machine-checkable against portfolio data.

**Rules to encode:**

| # | Rule | Check |
|---|------|-------|
| 1 | No co-invested illiquid deals | Any asset flagged illiquid AND co-owned → alert |
| 2 | BTC ≤40% NW; other single assets ≤15% | Continuous; alert on breach |
| 3 | Leverage: PPR mortgage or ≤30% LVR income property only | Any new liability not matching → alert. No margin, no PG, no development finance. |
| 4 | Liquidity floor: 3 months expenses + credit line | Cash+stables vs 3× monthly spend (from v1 budget data) |
| 5 | Never sell BTC in a drawdown to fund spending | Detect BTC balance decrease coinciding with drawdown → prompt for reason, log it |

**Acceptance criteria.**
- Each rule is an independent, unit-tested function returning pass/fail/not-assessable plus a human-readable reason.
- Rule 4 depends on v1 budget data for the spend denominator — until that exists, use the thesis estimate ($250K/yr ÷ 12) and label it clearly as an estimate.
- Breaches surface on the dashboard and in the quarterly review, and are logged with a timestamp so a history of breaches exists.
- Rules are versioned — when the thesis changes, old evaluations remain interpretable against the rule version in force at the time.

---

## ISSUE 6 → GitHub #8

### Flag legacy holdings that breach the thesis

**Labels:** `v3`, `thesis-engine`, `priority:high`

**Goal.** Surface positions held today that would not be bought under the current thesis, so they get an explicit exit decision rather than quiet persistence.

**Context.** Known case: the **biofuels position (~$150K inside super)** is illiquid and co-invested — it breaches hard rule 1. It predates the thesis. It is not a thesis position and should not be counted as one. There may be others.

**Acceptance criteria.**
- `legacy_position` flag with a required reason and a review date.
- Legacy positions shown separately from thesis sleeves in the allocation view — they must not make the allocation look compliant when it isn't.
- Quarterly review prompts for a decision on each: exit, hold with reason, or reclassify.
- Biofuels seeded as the first entry, flagged against rule 1, with the note that exit path is an advisor-meeting agenda item.

---

## ISSUE 7 → GitHub #9

### Compare AU brokers for thesis-aligned investing and Phoenix integration

**Labels:** `research`, `v3`, `spike`

**Goal.** Pick a broker. Decision brief, not a build.

**Context.** Lloyd is starting equity purchases to build the AI/tech, EM and health sleeves. The broker must (a) hold the ETFs the bands require, (b) support automated DCA, (c) export cleanly into Phoenix, and (d) suit his ownership situation.

**Evaluate:** Pearler · SelfWealth · CommSec · Stake · Interactive Brokers · Betashares Direct.

**Criteria, weighted:**
1. **CHESS sponsorship vs custodian.** CHESS registers shares in Lloyd's name under his own HIN; custodian models hold them on his behalf. Given the live creditor matters and the thesis's emphasis on control and liquidity, direct legal ownership deserves real weight — flag it explicitly rather than treating it as a footnote.
2. **Can it hold the sleeve ETFs?** Specifically: ASX spot-BTC ETF, semis, uranium, lithium, robotics, India, broad-EM, global healthcare. A broker that can't hold the bands is disqualified regardless of fees.
3. **Fees at realistic DCA size** — model actual monthly contribution amounts, not headline rates.
4. **Data out:** API > scheduled CSV > manual export. Note Sharesight-compatible feeds as a fallback ingestion path.
5. **Auto-invest support** — the DCA posture depends on automation; manual monthly trades will decay.
6. **AU tax reporting quality** (CGT, franking).

**Acceptance criteria.**
- Comparison table + a clear recommendation with reasoning.
- Explicit statement of what the recommendation trades away.
- Follow-up issue raised for the integration path of whichever broker wins.

**Note.** Not financial advice — this is an operational tooling decision. Instrument selection stays with Lloyd and his advisor.

---

## ISSUE 8 → GitHub #10

### Automate NAB/CBA transaction ingestion (v1 budget pipeline)

**Labels:** `v1`, `data-layer`, `backend`

**Goal.** Remove the manual step from bank transaction import, without adding a CDR aggregator.

**Context.** Kubera does **not** provide transaction-level data — it tracks balances and net worth. The v1 budget features (categorisation, budget-vs-actual, cash-flow forecast, deficit tracker) need transactions, so the CSV pipeline remains necessary. 16,586 rows (Jan 2022 – Mar 2026) already exist as the historical baseline.

**Acceptance criteria.**
- Watched-folder or email-attachment drop that auto-detects and parses NAB and CBA export formats.
- Idempotent import: re-importing an overlapping file creates no duplicates. Dedupe on date + amount + description + account, with a review queue for near-matches rather than silent merging.
- Parser failures surface the offending rows — never silently skip.
- Feeds the existing four-type category structure (Spending / Bills-Fixed / Transfers / Debt) per PRD §7.
- Produces the verified household spend figure that Issue 5's rule 4 and the thesis's `$250K/yr` open question both depend on.

**Deferred.** CDR/Basiq adapter behind the same interface, if the cost ever justifies it. Not now.

---

## ISSUE 9 → GitHub #11

### Partitioning sign-off gate (blocker — do not implement around this)

**Labels:** `blocked`, `compliance`, `priority:high`

**Goal.** Confirm the data-partitioning approach for Milani's financial data before any implementation touches it.

**Context.** `SOLUTION_DESIGN.md` §4 recommends two separate Supabase projects with no shared credentials, given Lloyd's active debt/insolvency situation. This is **pending advisor sign-off** and was already flagged `⚠️ verify` in the vault. Adding Kubera as an aggregator does not change this — if anything it raises the stakes, because Kubera may hold both parties' assets in one account.

**Acceptance criteria.**
- Written advisor confirmation obtained before any code path stores or joins Milani's data.
- If Kubera holds joint or Milani-owned assets, the sync (Issue 1) must respect the partition — decide and document whether those assets are excluded at fetch time or stored separately.
- This issue blocks Issues 1 and 8 for any Milani-owned data. Lloyd-only data may proceed.

---

## ISSUE 10 → GitHub #12

### Build the read-only Agent API (v1)

**Labels:** `v3`, `agent-layer`, `backend`

**Goal.** A stable, versioned, read-only HTTP surface that answers *questions* about the portfolio — the single thing every AI client (and the Phoenix UI itself) reads from.

**Context.** Before exposing anything to an LLM, there needs to be a deliberate surface that is not the internal CRUD API. Internal APIs change shape constantly and expose everything; an agent surface should be narrow, stable, and designed around the questions actually being asked.

**Design principle — expose questions, not schema.** A generic `query_table` or raw SQL endpoint leaks the whole database through one hole *and* produces worse model output. Purpose-built endpoints are simultaneously the security boundary and the quality mechanism.

**Endpoints (v1):**

| Endpoint | Returns |
|----------|---------|
| `GET /api/agent/v1/allocation` | Current sleeve allocation vs bands, drift, breach flags |
| `GET /api/agent/v1/net-worth?from=&to=` | Net-worth time series from `portfolio_snapshots` |
| `GET /api/agent/v1/hard-rules` | Pass/fail/not-assessable per rule with reasons (Issue 5) |
| `GET /api/agent/v1/kill-criteria` | Status of all eight thesis kill criteria |
| `GET /api/agent/v1/thesis` | Current beliefs, bands and rules as structured data |
| `GET /api/agent/v1/legacy-positions` | Holdings flagged as breaching the thesis (Issue 6) |
| `GET /api/agent/v1/spend-summary?period=` | Aggregated spend by category — **aggregates only, no line items** |

**Acceptance criteria.**
- Read-only. No POST/PUT/PATCH/DELETE exists on this router at all — enforced structurally, not by convention.
- Every response is a typed, versioned schema. Breaking changes bump to `/v2`; `/v1` keeps working.
- Responses carry `as_of` timestamps so a model can tell fresh data from stale.
- **Data minimisation by default:** no account numbers, no wallet addresses, no counterparty names, no transaction line items on any `/v1` endpoint. Those belong to tier B (Issue 12).
- Milani partition enforced here, server-side. Never a client-supplied filter.
- Same layer serves the Phoenix UI — one source of truth for what the numbers mean.

---

## ISSUE 11 → GitHub #13

### Build the Phoenix MCP server (remote, OAuth)

**Labels:** `v3`, `agent-layer`, `backend`, `priority:high`

**Goal.** One MCP server, deployed alongside Phoenix, that Claude, ChatGPT and local models can all connect to as a connector.

**Context.** MCP is the convergence point, and critically this runs on **existing chat subscriptions, not paid API access**. Custom connectors are available on Claude Free/Pro/Max/Team/Enterprise across claude.ai, Cowork, Desktop and mobile; ChatGPT supports them under developer mode on Plus/Pro. No API keys, no per-token billing — the only running cost is hosting Phoenix itself.

**The constraint that drives the design:** Claude connects to remote MCP servers **from Anthropic's cloud infrastructure, not from the user's device** — this holds even in Claude Desktop and Cowork. So a remote connector must be reachable on the public internet; `localhost` will not work for web, mobile or Cowork. ChatGPT likewise accepts remote HTTPS only.

**Do this issue only if phone/ChatGPT access is actually wanted.** If Claude Desktop plus a local model is enough, Issue 12 alone delivers it with no public endpoint and materially less risk. Build order should be 12 → 11, not 11 → 12.

**Acceptance criteria.**
- Streamable HTTP transport at `/api/mcp`, deployed with the existing Vercel app.
- OAuth 2.1 with PKCE per the MCP authorization spec. **A bearer token in an env var is not sufficient for a remote server holding this data.**
- One token per client (Claude / ChatGPT / phone), independently revocable — a compromised device is revoked alone.
- Tools wrap the Issue 10 endpoints one-to-one. Tool descriptions are written for a model to read: state what the tool answers and when to use it.
- **Tier A only** on the remote server: derived aggregates, allocations, rule statuses. No raw transactions, no identifiers.
- Every tool call written to the audit log (Issue 5's table) with client identity, tool, arguments and timestamp.
- Rate limiting per token.
- Tools return structured content plus a short human-readable summary — models handle both better than raw JSON alone.

**Explicitly out of scope.** Any tool that writes, places an order, or moves money. The PRD's "signals only, never auto-executes" rule is absolute and extends here.

**Setup note, recorded from direct experience:** an OAuth-capable connector (GitHub App or equivalent) requires two separate steps — *authorization* (identity) and *installation* (resource access). It's easy to complete only the first. Confirm the app appears under the provider's *installations* list before assuming it works, and always initiate the connection from the client's own Connect button rather than the provider's install page directly, so OAuth `state` round-trips correctly.

---

## ISSUE 12 → GitHub #14

### Local stdio MCP server for tier-B (sensitive) data — BUILD THIS FIRST

**Labels:** `v3`, `agent-layer`, `privacy`, `priority:high`

**Goal.** Full-detail access — transaction line items, account-level holdings, wallet-level positions — available to a model running on Lloyd's own machine, without that data traversing a third-party LLM provider.

**Context.** Tier A deliberately excludes raw detail. But some genuinely useful questions ("what did we actually spend on groceries in Q2", "which wallet holds what") need it. Sending that to a hosted provider is a real decision, not a default — particularly with live creditor matters where the data is discoverable and the surface area matters.

A local stdio MCP server, talking to a local model via LM Studio or llama.cpp, keeps that data on the machine. Claude Desktop can also mount a local stdio server, so the same server serves both if Lloyd chooses.

**Acceptance criteria.**
- Node stdio MCP server, run locally, reading from Supabase with a separate read-only credential.
- Exposes tier-B tools: transaction search, account-level holdings, wallet detail.
- Never deployed to Vercel. Never reachable over the network. This is the whole point.
- Documented setup for LM Studio, llama.cpp and Claude Desktop.
- Same audit logging as tier A.

**Decision for Lloyd.** Whether ChatGPT gets access at all is worth deciding deliberately rather than by default — the tier split makes it a choice rather than an accident.

---

## Sequencing

```
Issue 9 (sign-off)  ──blocks──►  Issue 1, Issue 8  (for Milani data only)

Issue 1 (Kubera sync)
   └─► Issue 2 (sleeve mapping)
          └─► Issue 3 (allocation dashboard)
                 └─► Issue 4 (quarterly review)
   └─► Issue 5 (hard rules)  ◄── needs Issue 8 for the spend denominator
   └─► Issue 6 (legacy holdings)

Issue 7 (broker spike) — independent, can run in parallel
Issue 8 (bank CSV) — independent of Kubera work

Agent layer:
Issue 2 + Issue 5  ──►  Issue 10 (Agent API)
                            ├─► Issue 12 (local stdio MCP)     — FIRST: Claude Desktop + local models
                            └─► Issue 11 (remote MCP + OAuth)   — LATER, only if phone/ChatGPT wanted
```

Suggested first three: **Issue 1**, **Issue 7**, **Issue 9**. They unblock everything else and none depend on each other.

The agent layer (10 → 11/12) should come **after** Issues 2 and 5, not before. An MCP server over an empty or unmapped database is a demo; over the sleeve mapping and hard-rule engine it's the thing that makes Phoenix worth building rather than staying in Kubera.

---

## Open questions carried from the thesis

- Super gate — advisor meeting to settle SMSF sequencing and clawback risk. **Nothing in super moves before this.**
- Verified household spend number (Issue 8 produces it).
- Liquidity buffer: 3 months + credit line now; ramp to 6 months once destabilising debt clears.
- Super balance reconciliation — canonical $383K vs stale vault entries ($300K, $800K).
- Biofuels exit path (Issue 6).
