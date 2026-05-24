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

- Multiple investment accounts with different return rates (e.g. EPF, ASM, stocks, KWAP, bonds)
- Account drain order (which bucket gets spent first)
- Expenses broken into buckets with **per-line inflation** and **monthly caps** (e.g. food at 5% capped at RM7k, insurance at 3% capped at RM2k)
- Liabilities with a fixed end-age (mortgage, car loan, education loan)
- Life phases with three income modes: salary covers everything / salary covers personal only / no income
- Top-ups at start of year (e.g. EPF self-contribution)
- Inter-account transfers (e.g. ASM → EPF arbitrage)
- Principal vs interest accounting — see when you actually start eating into the money you saved
- Toggle the two modeling ambiguities that materially shift outcomes (see Modeling notes)

## What this tool does NOT model

These are real-world factors that can break the projection. Plan around them manually:

- **Country migration / currency change.** Moving to another country in retirement changes tax treatment, cost of living, and may require currency conversion of locked accounts (EPF can be withdrawn fully when emigrating). The sim assumes you stay in one currency/jurisdiction.
- **Stochastic returns.** Returns are constant year-to-year. No Monte Carlo, no sequence-of-returns risk, no bear markets. A 4% average that swings -20% in year one looks very different from 4% straight-line.
- **Tax.** No income tax, capital gains tax, withholding, or tax-advantaged account rules beyond what you encode in the return rate. EPF dividends are tax-free in Malaysia; brokerage isn't. Build that into the rate or expense lines yourself.
- **Healthcare shocks.** Insurance premiums inflate at the rate you set, but the sim doesn't model a one-off RM200k hospital bill or long-term care.
- **Major one-off events.** No support for "lump sum at age 55" (inheritance), "pay off mortgage at age 45" (large one-time outflow), "buy second property at 50", weddings, university fees for children, etc. Workaround: temporarily inflate a "Liability" or "Expense" for that single year.
- **Variable / part-time income.** Income is binary per phase (covers all / covers personal / none). No "I earn RM3k/month freelance from 45-55."
- **Rental / passive income.** No income streams. Workaround: model as a negative expense or extend the liability end-age to offset.
- **Property appreciation / sale.** The house is a liability, not an asset. Selling or downsizing isn't modeled.
- **Spouse / dependent finances.** Single-portfolio simulation. Two-income households need to aggregate manually.
- **Account-specific withdrawal rules.** No EPF "Account 1/2/3" split, no minimum balance rules, no age-55 unlock. All accounts are fully liquid in the sim.
- **Required Minimum Distributions (US), CPF quirks (Singapore), RRIF (Canada), etc.**
- **Pension / annuity income** — fixed monthly payments starting at a specific age. Not yet supported.
- **Compounding frequency.** Annual only. No monthly/quarterly compounding.
- **Mid-year cashflow timing.** Top-ups and transfers happen at start of year; interest credited at end. Withdrawals are treated as a single annual lump.

If you need any of the above, the sim's verdict should be treated as a *baseline* — your real plan needs a buffer.

## Modeling notes

Two ambiguities materially shift end-of-life balance and can move the "runs out" age by 3-5 years. The app exposes both as toggles:

1. **Liability end-age inclusivity.** "Pay until age 60" can mean last payment at 59 (29 years) or through 60 inclusive (30 years). Default: inclusive.
2. **Top-up same-year interest.** Whether a top-up deposited at the start of a year earns interest that same year. Default: yes.

These are also documented in the exported XLSX's Assumptions sheet.

## License

MIT
