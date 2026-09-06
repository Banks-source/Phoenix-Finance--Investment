# AU broker comparison for thesis-aligned investing (#9)

**Status:** Decision brief, not a build. Not financial advice — this is an operational tooling decision. Instrument selection stays with Lloyd and his advisor.

**Goal:** pick a broker to build the AI/tech, EM and health sleeves via automated DCA, that exports cleanly into Phoenix.

## Comparison

| Broker | Ownership | Fee (per trade) | Auto-invest | ETF range | Data out | AU tax reporting |
|---|---|---|---|---|---|---|
| **Pearler** | CHESS (own HIN) | $6.50 flat | Yes — any ASX-listed ETF/share, multiple targets | Full ASX | Direct Sharesight API feed | Standard contract notes |
| SelfWealth | CHESS (own HIN) | $9.50 flat | Limited | Full ASX | Sharesight CSV import + auto-sync | Standard |
| CommSec | CHESS (own HIN) | $10–19.95 | No native DCA automation | Full ASX | Sharesight direct feed | Full bank-grade reporting |
| Stake | CHESS (own HIN) | $3 (ASX), 1% FX on US | No native auto-invest | ASX + US | Sharesight direct feed | Standard |
| Interactive Brokers | **Custodian (no HIN)** | Low, ~0.002% FX | Available (via API/scheduling) | ASX + full global | TWS API — most sophisticated | Full annual statements, FIFO/method-selectable |
| Betashares Direct | **Custodian (no HIN)** | $0 | **Capped at 5 Betashares-issued ETFs only** | All ASX ETFs for manual buy | Limited | Standard |

## Against the weighted criteria

1. **CHESS vs custodian** — given the live creditor matters and the thesis's emphasis on control and liquidity, this carries real weight, not a footnote. Interactive Brokers and Betashares Direct both use a custodian model (no personal HIN) — shares are held on Lloyd's behalf, not registered directly in his name. That's a genuine mark against both, regardless of their other strengths.

2. **Can it hold the sleeve ETFs?** (ASX spot-BTC ETF, semis, uranium, lithium, robotics, India, broad-EM, global healthcare) — every CHESS broker (Pearler, SelfWealth, CommSec, Stake) can hold any ASX-listed ETF, so none are disqualified on range. **Betashares Direct is disqualified for automation specifically**: its auto-invest is capped at 5 Betashares-issued ETFs only, and the ASX spot-BTC ETFs (VanEck's VBTC, BlackRock's IBIT) are not Betashares products — so the BTC/crypto sleeve, the largest band in the thesis (30–40%), couldn't be automated on this platform at all.

3. **Fees at realistic DCA size** — Pearler's auto-invest charges $6.50 per execution *per target ETF*, so a DCA schedule spanning multiple sleeve ETFs (crypto, AI/tech, EM, health) stacks that fee per ETF per contribution. At $1,000+/month combined, this lands under 1% — reasonable, but worth structuring the schedule around fewer, broader ETFs per sleeve rather than many narrow ones to avoid fee drag. Stake is cheapest per-trade ($3) but has no native auto-invest, meaning manual monthly execution — which the "auto-invest support" criterion below flags as a real risk (manual trades decay).

4. **Data out** — Pearler, SelfWealth, CommSec, and Stake all have a Sharesight-compatible feed (Pearler and CommSec via direct API sync; SelfWealth via CSV import + auto-sync). Interactive Brokers has its own well-documented TWS API, more powerful but more engineering effort than reading a Sharesight export. Any of the CHESS brokers gives Phoenix a workable path in.

5. **Auto-invest support** — this is where the field narrows sharply. Pearler is purpose-built for this (schedule recurring buys across multiple ASX-listed targets). Betashares Direct's auto-invest exists but is capped to its own 5 ETFs. CommSec, SelfWealth, and Stake have no native recurring-purchase automation — DCA would mean a manual trade every month, which is exactly the failure mode ("manual monthly trades will decay") this criterion warns about.

6. **AU tax reporting quality** — Interactive Brokers is the strongest here (full annual statements, selectable CGT matching method). The CHESS brokers are all standard/adequate — contract notes plus whatever a portfolio tracker (Sharesight) computes from the trade history, which is the normal AU retail setup.

## Recommendation: Pearler

It's the only broker that clears every criterion without a structural disqualifier: direct CHESS ownership (own HIN), can hold every sleeve ETF including the ASX spot-BTC ETFs, genuine multi-target auto-invest (not capped to one issuer's funds), a direct Sharesight feed for clean data-out, and strong SMSF support — directly relevant since the SMSF portfolio already holds the bulk of the crypto/equity exposure.

**What this recommendation trades away:**
- **No US-listed securities.** Pearler is ASX-only. If direct US stock/ETF exposure is ever wanted (not just ASX-domiciled ETFs tracking global indices), Stake or Interactive Brokers would be needed instead, or as a second account alongside Pearler.
- **Higher per-trade cost than Stake or Betashares Direct** if trading frequently — irrelevant for a DCA-only posture, but worth knowing if the strategy ever shifts toward more active trading.
- **Auto-invest fees stack per target ETF.** Spreading the sleeve allocation across many narrow ETFs (e.g. a separate ETF per sleeve sub-theme) multiplies the $6.50-per-execution cost. Fewer, broader ETFs per sleeve keep this reasonable.
- **Weaker tax-reporting tooling than Interactive Brokers** — Pearler's own reporting is standard contract notes; a portfolio tracker (Sharesight) is doing the CGT/franking computation either way, same as with any CHESS broker.

## Follow-up

Raised as [issue #18: Pearler integration path](https://github.com/Banks-source/Phoenix-Finance--Investment/issues/18) — once real DCA purchases start, Phoenix needs an ingestion path for Pearler trade data (Sharesight API as the likely intermediary, or direct CSV) feeding into `portfolio_snapshots`/the sleeve allocation, the same way Kubera and Redbark feed it today.
