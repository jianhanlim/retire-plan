# retire-plan

Year-by-year personal retirement simulator. Configure accounts, expenses with per-line inflation and caps, liabilities (mortgage), and life phases (accumulation / semi-retirement / full retirement). The app projects net worth from your current age through the end of plan and tells you whether — and when — your money runs out.

**Privacy:** every calculation runs in your browser. No backend, no analytics, no signup.

**Live:** https://jianhanlim.github.io/retire-plan/

## Features

- Configurable accounts with per-account return rate and drain order
- Expense buckets with custom inflation rates and optional monthly caps
- Liabilities with end-age (e.g. a mortgage that finishes at 60)
- Life phases with income behavior (`covers all` / `covers personal only` / `no income`)
- Principal vs interest tracking
- Trajectory chart with "money runs out" marker
- Milestone snapshot table
- One-click XLSX export
- Assumption toggles (top-up interest timing, liability end-age inclusivity) so you can bracket the realistic range

## Local development

```bash
npm install
npm run dev
```

Requires Node 20.19+ or 22.12+ (build).

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds and publishes to GitHub Pages.

In repo settings → Pages → "Build and deployment" → set Source to **GitHub Actions** the first time.

## What this tool can model

- Multiple investment accounts with different return rates and a configurable drain order (which bucket gets spent first)
- Expenses broken into buckets with **per-line inflation** and **monthly caps** (e.g. food at 5% capped at RM7k, insurance at 3% capped at RM2k)
- Liabilities with a fixed end-age (mortgage, car loan, education loan)
- Life phases with **explicit monthly income** and optional **income inflation** (annual raises)
- **Surplus auto-savings**: when income exceeds expenses + liabilities, the surplus can flow into any account you pick (or be treated as consumed lifestyle)
- Annual top-ups (e.g. EPF self-contribution) and inter-account transfers (e.g. ASM → EPF arbitrage)
- Principal vs interest accounting — see when you actually start eating into the money you saved
- Two assumption toggles for the modeling ambiguities that materially shift outcomes (see Modeling notes)
- XLSX export of the full year-by-year simulation

## What this tool does NOT model

These are real-world factors that can break the projection. Plan around them manually:

- **Country migration / currency change.** Moving to another country in retirement changes tax treatment, cost of living, and may require currency conversion of locked accounts (EPF can be withdrawn fully when emigrating). The sim assumes you stay in one currency/jurisdiction.
- **Stochastic returns / sequence-of-returns risk.** Returns are constant year-to-year. No Monte Carlo, no bear markets. A 4% average that swings -20% in year one looks very different from 4% straight-line.
- **Tax.** No income tax, capital gains tax, withholding, or tax-advantaged account rules beyond what you encode in the return rate.
- **Healthcare shocks.** Premiums inflate at the rate you set, but no one-off hospital bills or long-term care.
- **Major one-off events.** No native support for "inheritance at 55", "settle mortgage at 45", "buy second property at 50", weddings, university fees. Workaround: temporarily inflate a Liability or Expense for that year.
- **Income variation within a phase.** Income is flat per phase or grows at a fixed inflation rate. No mid-phase raises, bonuses, or sabbaticals — split into multiple phases instead.
- **Rental / dividend / pension income.** Not first-class. Workaround: model as a phase with that monthly income, or as a negative expense.
- **Property appreciation / sale / downsizing.** The house is a liability only.
- **Spouse / dependent finances.** Single-portfolio simulation; combine manually.
- **Account-specific rules.** No EPF Account 1/2/3 split, no age-55 unlock, no RM1.3M withdrawal threshold, no RMDs, no CPF quirks. All accounts are fully liquid.
- **Top-up caps.** EPF self-contribution is capped at RM100k/yr by law — the sim doesn't enforce it; you can enter any amount.
- **Annual compounding only.** No monthly/quarterly compounding.
- **Mid-year cashflow timing.** Top-ups and transfers happen at start of year; interest credited at end; withdrawals are a single annual lump.
- **Goal-seeking & sensitivity analysis.** No "when can I retire?" solver, no tornado chart of which input matters most, no Monte Carlo.
- **Scenario comparison & sharing.** Single scenario at a time, not stored to URL or compared side-by-side.

If you need any of the above, treat the sim's verdict as a *baseline* — your real plan needs a buffer.

## Modeling notes

Two ambiguities materially shift end-of-life balance and can move the "runs out" age by 3-5 years. The app exposes both as toggles:

1. **Liability end-age inclusivity.** "Pay until age 60" can mean last payment at 59 (29 years) or through 60 inclusive (30 years). Default: inclusive.
2. **Top-up same-year interest.** Whether a top-up deposited at the start of a year earns interest that same year. Default: yes.

These are also documented in the exported XLSX's Assumptions sheet.

## License

MIT
