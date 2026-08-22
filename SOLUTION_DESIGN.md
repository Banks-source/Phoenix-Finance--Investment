# Phoenix Finance — Solution Design (v1: Budget)

**Status:** Draft — pending sign-off on §4 (partition architecture) before implementation
**Last updated:** 2026-08-08

## 1. Stack

Mirrors the Vitals app pattern:

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (Postgres + Auth)
- Recharts for charts
- Claude API for categorisation assist
- Vercel for hosting
- PWA, web-first (manifest + service worker, installable on mobile/desktop)

Fresh build. The old Open Claw prototype is not reused.

## 2. Tabs

| Tab | Purpose |
|---|---|
| Overview | Household summary: deficit/surplus tracker, this-month snapshot, key alerts |
| Budget | Budget-vs-actual by category and type, per month; cash-flow forecast |
| Categories | Taxonomy management, the categorisation review/approval queue, merchant → category mapping |
| Transactions | Full ledger — filter, search, edit, approve individual transactions |
| Merchants | Merchant list with aggregated spend, bulk recategorisation by merchant |

## 3. Data model

Applies identically inside each partition (see §4).

**`accounts`**
`id, institution (NAB|CBA), account_label, account_number_masked, owner`

**`transactions`**
`id, date, amount, account_id, transaction_type, detail, merchant, category, sub_category, type (Spending|Bills_Fixed|Transfers|Debt|Income|Needs_Categorisation), source (historical_import|bank_import|manual), status (approved|pending_review), confidence, created_at`

**`categories`** (reference data, seeded from the locked taxonomy in PRD §7)
`id, name, type, notes`

**`merchant_rules`**
`id, merchant_pattern, category, sub_category, type, match_count, last_used` — built from the historical corpus, used to auto-suggest categorisation on new imports.

**`budgets`**
`id, category_or_type, month, target_amount`

**`review_queue`**
Not a separate table — modeled as `transactions.status = 'pending_review'`, surfaced in the Categories and Transactions tabs.

## 4. Data separation — v1 decision (2026-07-02): combined store

**Superseded design note:** the original plan here was two fully separate Supabase projects (one per person, no shared credentials) because Milani's data was flagged as needing genuine structural separation given Lloyd's debt/insolvency situation — see PRD §10. On 2026-07-02, Lloyd explicitly confirmed combining everything into a single store for v1, overriding that earlier requirement, ahead of the planned advisor sign-off.

**v1 implementation:** single Supabase project, single schema. Every row in `accounts` and `transactions` carries an `owner` field (`lloyd | milani | joint`), populated using this rule: NAB accounts → `lloyd`; CBA accounts → `milani` (per Lloyd's account list). The household view is a straightforward query over the combined tables rather than a cross-project merge.

**This is flagged as a live risk, not resolved:** if Lloyd's advisor later determines genuine separation is required, migrating off a combined store is materially harder than starting separated (data has to be split out, app logic that assumes one store has to be reworked, and any interim exposure during the combined period can't be undone). The original two-project design is preserved above in git history and should be revisited before the app holds a meaningful volume of new data if the advisor conversation lands differently.

## 5. Import pipeline

**Historical backfill (one-time, v1 launch):**
1. Parse the four workbook "Transactions" sheets (16,586 rows, see PRD §6).
2. Normalize column names and category labels per the locked taxonomy (PRD §7).
3. Assign `type` per the taxonomy table. Rows matching Ashby Loan, Cash Withdrawal, or "Financial" categories get `type = Needs_Categorisation` and `status = pending_review`. Everything else imports as `status = approved` (it's already been through manual categorisation historically — no need to re-review 16K rows).
4. Split each row into the correct partition (Lloyd's project or Milani's project) based on account ownership. **Gap to resolve during import:** most historical accounts aren't explicitly owner-tagged (only "CBA - Milani Everyday" is). Needs a one-time manual account → owner mapping step before backfill runs.
5. Build `merchant_rules` from the backfilled data (merchant → category/sub_category/type, keyed by normalized merchant string).

**Going-forward imports (new NAB/CBA exports):**
Raw bank exports won't include Category/Sub Category/Merchant-cleaned fields — those were manually maintained in Excel. So the categorisation engine has to do real work going forward:
1. User uploads a new CSV export (or pastes rows).
2. For each row, attempt merchant match against `merchant_rules` (exact, then fuzzy).
3. Unmatched merchants go to the Claude API with the four-type taxonomy and category list in the prompt; returns suggested category/sub_category/type + confidence.
4. Every new transaction lands as `status = pending_review` regardless of confidence — no silent auto-categorisation, per the explicit requirement. High-confidence matches are pre-filled for fast one-click approval in the Categories/Transactions tab; low-confidence ones need manual selection.
5. On approval, the transaction becomes `status = approved` and feeds Budget/Cash-flow/Deficit views. On repeated approval of the same merchant → category pairing, `merchant_rules` confidence increases.

## 6. Budget, forecast, deficit logic

- **Budget vs actual:** per category and per type, per month, comparing `budgets.target_amount` to summed `approved` transactions. Transfers and Income excluded from "expense" totals (this is the core fix — Investment/Money Movement no longer distort the numbers).
- **Cash-flow forecast:** identify recurring Bills/Fixed transactions (same merchant + similar amount + similar day-of-month across ≥3 months) to project fixed costs forward; blend with trailing 3-month average run-rate for Spending; add scheduled Debt repayments. Produces a rolling forward forecast (default 3 months).
- **Deficit tracker:** monthly Income minus (Spending + Bills/Fixed + Debt), shown as a running trend. Transfers excluded (they're not expenses).

## 7. Deployment

- Vercel project per environment (single production environment for v1 — no staging needed for a 2-person household app).
- Environment variables: two sets of Supabase URL/anon key/service role key (Lloyd's project, Milani's project), Claude API key (server-side only, never shipped to client).
- PWA manifest + service worker for installability on mobile.

## 8. Explicitly out of scope for v1

- Tax pack, Kubera integration, investment thesis engine, spending optimisation alerts — see PRD §8 (v2–v4, noted only).
- Any trade execution — the app will eventually signal, never execute (v3).

## 9. Agent-layer architecture (v3 — LLM/MCP access, added 2026-08-08)

Forward-looking design for how Phoenix's investment-thesis data becomes queryable by Claude, ChatGPT, and local models, once v3 (investment thesis engine) is built. Captured now so the shape is agreed before implementation. Tracked as issues #3–#14.

### 9.1 Kubera as the aggregator, Phoenix as the intelligence layer

Lloyd already has NAB, CBA, Trezor, SwyftX, MetaMask and Phantom connected inside Kubera. Kubera exposes a personal REST API (30 req/min, 500–1000 req/day depending on tier). Rather than building six separate wallet/exchange/bank integrations, Phoenix's sync layer (#3) reads that one endpoint and stores an append-only time-series in `portfolio_snapshots` — so Phoenix retains full history even if Kubera is later cancelled.

**Critical boundary:** Kubera provides balances and holdings, not transaction-level detail. So the two data pipelines stay separate and serve different purposes:

| Pipeline | Source | Feeds |
|---|---|---|
| Balances / holdings / net worth | Kubera API sync (#3) | Sleeve mapping (#4), allocation dashboard (#5), hard-rule checks (#7) |
| Categorised transactions | NAB/CBA CSV pipeline (#10) | v1 Budget (§5–§6 above), the spend denominator used by hard rule 4 |

**Rejected:** direct CDR aggregator integration (Basiq/Frollo/Adatree) — built for accredited businesses with 12-month minimums and per-user billing, disproportionate for a two-person household app when Kubera already holds the connections.

### 9.2 Thesis engine (#4–#8)

Kubera assets are mapped to the six investment-thesis sleeves (BTC/crypto, AI/tech + materials, EM equity, health/biotech, dry powder, metals) against **investable net worth** (includes super, excludes PPR). This mapping is what makes the allocation dashboard, the automated hard-rule checks (concentration cap, leverage cap, liquidity floor, co-investment rule), and the timed (≤30 min) quarterly review workflow possible. Legacy positions that breach the thesis — starting with the ~$150K biofuels holding inside super — are flagged separately rather than counted as compliant.

### 9.3 Read-only Agent API (#12)

A narrow, versioned HTTP surface (`/api/agent/v1/*`) sits between the database and any LLM client. It exposes **questions, not schema** — `get_allocation`, `get_net_worth`, `check_hard_rules`, `scan_kill_criteria` — rather than a generic query endpoint. This is deliberate: a `query_table`-style endpoint would both leak the whole database through one hole and produce worse model output than purpose-built tools. No POST/PUT/PATCH/DELETE exists on this router; it is structurally read-only, not read-only by convention. Milani's data partition (§4) is enforced server-side here, never trusted to a client-supplied filter.

### 9.4 Two-tier MCP access (#13, #14)

| Tier | Transport | Data | Reaches |
|---|---|---|---|
| A | Remote MCP server, OAuth 2.1 + PKCE, hosted with the Vercel app | Aggregates only — allocations, rule statuses, net-worth history. No raw transactions, no account/wallet identifiers. | Claude (web/Cowork/mobile/Desktop) and ChatGPT, inside existing chat subscriptions — no separate API billing |
| B | Local stdio MCP server, runs on Lloyd's machine, never deployed or network-reachable | Full detail — transaction line items, wallet-level holdings, account detail | Claude Desktop and local models (LM Studio, llama.cpp) only |

**Build order: tier B first.** It requires no public endpoint, carries materially less exposure given the live creditor matters, and is sufficient if Claude Desktop plus a local model meets the need. Tier A (remote) is built only if phone or ChatGPT access is specifically wanted — it necessarily exposes an endpoint reachable from Anthropic's/OpenAI's cloud infrastructure, since neither can reach a purely local server for web/mobile clients.

**Constant across both tiers:** every tool call is logged (client identity, tool, arguments, timestamp), and no tool ever writes, places a trade, or moves money. The PRD's "signals only, never auto-executes" rule is absolute and extends to every agent-facing surface, not just the human-facing UI.

**Setup note, recorded from direct experience standing up the GitHub connector used to create these issues:** OAuth-capable connectors (GitHub App or equivalent) require two separate steps — *authorization* (identity) and *installation* (resource access) — and it's easy to complete only the first, producing a confusing "works for reads, 403s on writes" state. Confirm any such connector appears under the provider's *installations* list, not just its *authorized applications* list, before assuming it's fully wired up. Also always initiate the connection from the client's own "Connect" action rather than a provider's install page directly, so OAuth state round-trips correctly.
