// Retirement simulation engine — deterministic year-by-year cashflow projection.
// Mirrors the Python reference (../../build_sheet.py).

export type Account = {
  id: string;
  name: string;
  balance: number;
  rate: number; // e.g. 0.06 for 6%
  drainOrder: number; // lower = drained first
  // Annual cap on deposits from surplus (e.g. EPF self-contribution limit RM100k).
  // Overflow cascades to next-highest-rate account.
  maxYearlyTopUp?: number;
  // Marker for the lazy-created 0% Cash fallback. Don't set manually.
  isCash?: boolean;
};

export type ExpenseItem = {
  id: string;
  name: string;
  monthly: number;
  inflation: number; // e.g. 0.03
  monthlyCap?: number; // optional ceiling (today's ringgit applied to inflated value)
};

export type Liability = {
  id: string;
  name: string;
  monthly: number;
  endAge: number; // inclusive
  inflation: number;
  // Optional start age — pay only when age >= startAge. Defaults to plan startAge.
  startAge?: number;
};

export type Phase = {
  id: string;
  name: string;
  startAge: number;
  endAge: number; // inclusive
  // Monthly income during this phase. Annual income = monthlyIncome × 12.
  monthlyIncome: number;
  // Optional inflation rate applied to income each year (e.g. raises)
  incomeInflation?: number; // default 0
  // Preferred destination for income surplus (income − expenses − liabilities).
  // If the account's maxYearlyTopUp cap is hit, overflow cascades to the next-highest-rate
  // account that still has room. If all caps are saturated, a Cash (0%) account is
  // auto-created to absorb the rest. Leave undefined to consume surplus as lifestyle.
  surplusAccountId?: string;
  // Optional transfers between accounts at start of year (until source empty).
  // Different from surplus deposits — transfers move EXISTING balance, not new money.
  transfers?: { fromId: string; toId: string; amount: number }[];
};

// A FixedAsset is something you own that has value (house, car, equipment).
// It does NOT count toward Total Assets until you sell it (which converts it to cash).
// Optionally links to a Liability (loan); selling stops the loan and nets the proceeds.
export type FixedAsset = {
  id: string;
  name: string;
  currentValue: number;         // value today (at plan start)
  appreciation: number;         // annual rate, e.g. 0.03 for 3%
  linkedLiabilityId?: string;   // which Liability is force-ended when sold
  sellAge?: number;             // when to sell (omit = never sell)
  sellPriceOverride?: number;   // explicit price; else appreciated value used
};

export type SimInput = {
  startAge: number;
  endAge: number;
  accounts: Account[];
  expenses: ExpenseItem[];
  liabilities: Liability[];
  phases: Phase[];
  fixedAssets?: FixedAsset[];   // optional — defaults to []
  // Assumption toggles
  topUpEarnsSameYearInterest: boolean; // default true
  liabilityEndInclusive: boolean; // default true (pay through endAge)
};

export type YearRow = {
  age: number;
  yearIndex: number;
  phaseName: string;
  income: number;
  surplus: number;
  surplusSaved: number;
  // Net cash injection from Fixed Asset sales this year (sale price − remaining loan).
  assetSaleProceeds: number;
  // Names of assets sold this year (for display).
  assetsSold: string[];
  transfers: number;
  expenseTotal: number;
  liabilityTotal: number;
  totalSpend: number;
  // Portfolio outflow REQUESTED (= max(0, totalSpend - income))
  portfolioOutflow: number;
  // Portfolio outflow ACTUALLY taken from accounts (= portfolioOutflow - shortfall).
  // Differs from portfolioOutflow only when the portfolio empties mid-year.
  portfolioDrained: number;
  accounts: { id: string; balance: number; principal: number }[];
  totalAssets: number;
  totalPrincipal: number;
  totalInterest: number;
  interestEarned: number;
  shortfall: number;
  expenseBreakdown: { id: string; name: string; yearly: number }[];
};

export type SimResult = {
  rows: YearRow[];
  runsOutAtAge: number | null;
  peakAge: number;
  peakAssets: number;
};

function inflated(
  monthly: number,
  rate: number,
  years: number,
  cap?: number
): number {
  const v = monthly * Math.pow(1 + rate, years);
  return cap != null ? Math.min(v, cap) : v;
}

function phaseFor(phases: Phase[], age: number): Phase | undefined {
  return phases.find((p) => age >= p.startAge && age <= p.endAge);
}

export function simulate(input: SimInput): SimResult {
  const { startAge, endAge, expenses, liabilities, phases } = input;

  // Deep-copy account state
  type AcctState = {
    id: string;
    name: string;
    balance: number;
    rate: number;
    principal: number;
    drainOrder: number;
    maxYearlyTopUp?: number;
    isCash?: boolean;
  };
  const accts: AcctState[] = input.accounts.map((a) => ({
    id: a.id,
    name: a.name,
    balance: a.balance,
    rate: a.rate,
    principal: a.balance, // initial balance counts as principal
    drainOrder: a.drainOrder,
    maxYearlyTopUp: a.maxYearlyTopUp,
    isCash: a.isCash,
  }));

  // Track per-account top-up amount for the current year (for cap enforcement
  // and for the topUpEarnsSameYearInterest exclusion). Reset each year.
  const yearlyTopUps = new Map<string, number>();

  function ensureCashAccount(): AcctState {
    let cash = accts.find((a) => a.isCash);
    if (cash) return cash;
    const maxDrain = accts.reduce((m, a) => Math.max(m, a.drainOrder), 0);
    cash = {
      id: "cash-auto",
      name: "Cash",
      balance: 0,
      rate: 0,
      principal: 0,
      drainOrder: maxDrain + 1, // drained last (no growth to preserve)
      isCash: true,
    };
    accts.push(cash);
    return cash;
  }

  // Cascade-fill an amount into the preferred account first, then by rate descending,
  // honoring each account's maxYearlyTopUp. Auto-creates a Cash account if everything
  // is capped and overflow remains.
  function depositCascade(amount: number, preferredId?: string): number {
    if (amount <= 0) return 0;
    let remaining = amount;
    const visited = new Set<string>();
    const tryFill = (acct: AcctState | undefined) => {
      if (!acct || remaining <= 0 || visited.has(acct.id)) return;
      visited.add(acct.id);
      const already = yearlyTopUps.get(acct.id) ?? 0;
      const cap = acct.maxYearlyTopUp;
      const room = cap == null ? Infinity : Math.max(0, cap - already);
      const put = Math.min(remaining, room);
      if (put > 0) {
        acct.balance += put;
        acct.principal += put;
        yearlyTopUps.set(acct.id, already + put);
        remaining -= put;
      }
    };
    if (preferredId) tryFill(accts.find((a) => a.id === preferredId));
    const byRate = [...accts]
      .filter((a) => !a.isCash)
      .sort((a, b) => b.rate - a.rate);
    for (const a of byRate) tryFill(a);
    if (remaining > 0) {
      const cash = ensureCashAccount();
      visited.delete(cash.id);
      tryFill(cash);
    }
    return amount - remaining;
  }

  const rows: YearRow[] = [];
  let peakAssets = 0;
  let peakAge = startAge;
  let runsOutAtAge: number | null = null;
  // Liabilities can be force-ended early (e.g. when a linked asset is sold).
  // Map<liabilityId, lastAgeToPay (inclusive)>
  const liabilityForceEnd = new Map<string, number>();
  // Track which assets have been sold (to prevent double-sell on edge cases).
  const soldAssets = new Set<string>();

  for (let age = startAge; age <= endAge; age++) {
    const yearIndex = age - startAge;
    const phase = phaseFor(phases, age);
    const phaseName = phase?.name ?? (yearIndex === 0 ? "Year 0" : "Unphased");

    let transfersTotal = 0;
    yearlyTopUps.clear();

    // Start-of-year: detect Fixed Asset sales for THIS year and force-end linked liabilities
    // BEFORE we compute this year's liability total (so the sold year owes nothing).
    type PendingSale = { name: string; netProceeds: number };
    const pendingSales: PendingSale[] = [];
    if (yearIndex > 0) {
      for (const fa of input.fixedAssets ?? []) {
        if (fa.sellAge !== age || soldAssets.has(fa.id)) continue;
        soldAssets.add(fa.id);

        const yearsHeld = Math.max(0, age - input.startAge);
        const appreciated = fa.currentValue * Math.pow(1 + (fa.appreciation ?? 0), yearsHeld);
        const salePrice = fa.sellPriceOverride ?? appreciated;

        // Future payments from `age` onward to liability end
        let remainingLoan = 0;
        if (fa.linkedLiabilityId) {
          const L = liabilities.find((l) => l.id === fa.linkedLiabilityId);
          if (L) {
            const liabStart = L.startAge ?? input.startAge;
            const lastPayAge = input.liabilityEndInclusive ? L.endAge : L.endAge - 1;
            for (let a = age; a <= lastPayAge; a++) {
              remainingLoan += inflated(L.monthly, L.inflation, a - liabStart) * 12;
            }
            // Force-end the loan: no payment this year or later
            liabilityForceEnd.set(L.id, age - 1);
          }
        }

        const netProceeds = Math.max(0, salePrice - remainingLoan);
        pendingSales.push({ name: fa.name, netProceeds });
      }
    }

    // Start-of-year: transfers
    if (phase?.transfers) {
      for (const t of phase.transfers) {
        const from = accts.find((a) => a.id === t.fromId);
        const to = accts.find((a) => a.id === t.toId);
        if (!from || !to) continue;
        const move = Math.min(t.amount, from.balance);
        if (move <= 0) continue;
        // Proportional principal transfer
        const principalShare =
          from.balance > 0 ? from.principal * (move / from.balance) : move;
        from.balance -= move;
        from.principal = Math.max(0, from.principal - principalShare);
        to.balance += move;
        to.principal += principalShare;
        transfersTotal += move;
      }
    }

    // Expenses
    const expenseBreakdown = expenses.map((e) => ({
      id: e.id,
      name: e.name,
      yearly: inflated(e.monthly, e.inflation, yearIndex, e.monthlyCap) * 12,
    }));
    const expenseTotal = expenseBreakdown.reduce((s, x) => s + x.yearly, 0);

    // Liabilities (e.g. house) — respect force-end overrides (asset sales clear the loan)
    let liabilityTotal = 0;
    for (const L of liabilities) {
      const liabStart = L.startAge ?? input.startAge;
      const forceEnd = liabilityForceEnd.get(L.id);
      const effectiveEnd = forceEnd !== undefined ? forceEnd : L.endAge;
      const inRange = age >= liabStart && (input.liabilityEndInclusive ? age <= effectiveEnd : age < effectiveEnd);
      if (inRange) {
        const yearsSinceLiabilityStart = age - liabStart;
        liabilityTotal +=
          inflated(L.monthly, L.inflation, yearsSinceLiabilityStart) * 12;
      }
    }

    // Income for this year (inflated within phase)
    let annualIncome = 0;
    if (yearIndex > 0 && phase) {
      const yearsInPhase = age - phase.startAge;
      const infl = phase.incomeInflation ?? 0;
      annualIncome = phase.monthlyIncome * 12 * Math.pow(1 + infl, Math.max(0, yearsInPhase));
    }

    const needed = expenseTotal + liabilityTotal;
    // Year 0 is a snapshot of current state — no cashflow applied
    const portfolioOutflow = yearIndex === 0 ? 0 : Math.max(0, needed - annualIncome);
    const surplus = yearIndex === 0 ? 0 : Math.max(0, annualIncome - needed);

    // Drain by drainOrder
    const sorted = [...accts].sort((a, b) => a.drainOrder - b.drainOrder);
    let remaining = portfolioOutflow;
    for (const acct of sorted) {
      if (remaining <= 0) break;
      const take = Math.min(acct.balance, remaining);
      acct.balance -= take;
      remaining -= take;
      // Principal: interest spent first, then principal
      acct.principal = Math.min(acct.principal, acct.balance);
    }
    const shortfall = remaining;
    const portfolioDrained = portfolioOutflow - shortfall;
    if (shortfall > 0 && runsOutAtAge === null) runsOutAtAge = age;

    // Interest credit at end of year (skip year 0).
    // Credited BEFORE surplus is deposited so the surplus (year-end inflow) doesn't
    // earn same-year interest.
    let interestEarned = 0;
    if (yearIndex > 0) {
      for (const acct of accts) {
        const earned = acct.balance * acct.rate;
        acct.balance += earned;
        interestEarned += earned;
      }
    }

    // Surplus savings cascade: preferred → next-highest-rate → Cash (0%, lazy)
    let surplusSaved = 0;
    if (surplus > 0 && phase?.surplusAccountId) {
      surplusSaved = depositCascade(surplus, phase.surplusAccountId);
    }

    // Deposit Fixed Asset sale proceeds (after interest credit, same lane as surplus)
    let assetSaleProceeds = 0;
    const assetsSold: string[] = [];
    for (const s of pendingSales) {
      assetsSold.push(s.name);
      assetSaleProceeds += s.netProceeds;
      if (s.netProceeds > 0) depositCascade(s.netProceeds, phase?.surplusAccountId);
    }

    const totalAssets = accts.reduce((s, a) => s + a.balance, 0);
    const totalPrincipal = accts.reduce((s, a) => s + a.principal, 0);

    if (totalAssets > peakAssets) {
      peakAssets = totalAssets;
      peakAge = age;
    }

    rows.push({
      age,
      yearIndex,
      phaseName,
      income: annualIncome,
      surplus,
      surplusSaved,
      assetSaleProceeds,
      assetsSold,
      transfers: transfersTotal,
      expenseTotal,
      liabilityTotal,
      totalSpend: expenseTotal + liabilityTotal,
      portfolioOutflow,
      portfolioDrained,
      accounts: accts.map((a) => ({
        id: a.id,
        balance: a.balance,
        principal: a.principal,
      })),
      totalAssets,
      totalPrincipal,
      totalInterest: totalAssets - totalPrincipal,
      interestEarned,
      shortfall,
      expenseBreakdown,
    });
  }

  return { rows, runsOutAtAge, peakAge, peakAssets };
}

// ============================================================================
// Account color tokens — consistent across charts, tables, indicators
// ============================================================================

const ACCOUNT_COLORS: Record<string, string> = {
  epf: "#0f766e",       // teal — highest-yield
  asm: "#2563eb",       // blue
  stk: "#9333ea",       // purple — equity
  cash: "#64748b",      // slate — liquid
  "cash-auto": "#94a3b8",
};
const FALLBACK_PALETTE = ["#d97706", "#0891b2", "#db2777", "#65a30d", "#7c3aed"];

export function accountColor(accountId: string, fallbackIndex = 0): string {
  return ACCOUNT_COLORS[accountId] ?? FALLBACK_PALETTE[fallbackIndex % FALLBACK_PALETTE.length];
}

// Aggregate phase totals for the Income-vs-Spend chart.
export function aggregatePhases(
  rows: YearRow[],
  phases: { id: string; name: string; startAge: number; endAge: number }[]
): { id: string; name: string; income: number; spend: number; net: number; years: number }[] {
  return phases.map((p) => {
    let income = 0;
    let spend = 0;
    let years = 0;
    for (const r of rows) {
      if (r.age >= p.startAge && r.age <= p.endAge && r.yearIndex > 0) {
        income += r.income;
        spend += r.totalSpend;
        years++;
      }
    }
    return { id: p.id, name: p.name, income, spend, net: income - spend, years };
  });
}

// ============================================================================
// Profile × Strategy model
// A Profile describes WHO you are (age, accounts, expenses, mortgage, phases).
// A Strategy describes HOW you save (account caps, surplus target, transfers).
// Combine them → SimInput.
// ============================================================================

export type ProfileKey = "freshGrad" | "youngPro" | "midCareer" | "lean" | "preRetire";
export type StrategyKey = "aggressive" | "conservative" | "noTopUp";

export const PROFILES: Record<ProfileKey, string> = {
  freshGrad: "Fresh Graduate (18)",
  youngPro: "Young Professional (25)",
  midCareer: "Mid Career (31)",
  lean: "Lean Lifestyle (31)",
  preRetire: "Pre-Retirement (55)",
};

export const STRATEGIES: Record<StrategyKey, string> = {
  aggressive: "Aggressive Arbitrage",
  conservative: "Conservative No-Transfer",
  noTopUp: "No Top-Up (consume surplus)",
};

export const PROFILE_DESCRIPTIONS: Record<ProfileKey, string> = {
  freshGrad: "Just started working. Tiny balances, low salary, no mortgage. Long horizon to compound.",
  youngPro: "A few years in. Modest balances, mid salary, just got a mortgage.",
  midCareer: "Established career. Decent balances, RM15k/mo, mortgage halfway through.",
  lean: "Same income as Mid Career but frugal lifestyle (low food cap). Retire fully at 35.",
  preRetire: "Final stretch before retirement. High salary, large balances, mortgage almost paid off.",
};

export const STRATEGY_DESCRIPTIONS: Record<StrategyKey, string> = {
  aggressive: "EPF capped at RM100k/yr, surplus → EPF, transfer ASM→EPF in retirement (arbitrage 5%→6%).",
  conservative: "EPF capped at RM100k/yr, surplus → EPF. No transfers — simpler mental model.",
  noTopUp: "No surplus saving (assumed consumed). Pure stress test of starting balances.",
};

type ProfileShape = {
  startAge: number;
  endAge: number;
  // Accounts WITHOUT maxYearlyTopUp (that's a strategy concern)
  accounts: Omit<Account, "maxYearlyTopUp">[];
  expenses: ExpenseItem[];
  liabilities: Liability[];
  // Phases WITHOUT surplusAccountId / transfers (strategy concerns)
  phases: Omit<Phase, "surplusAccountId" | "transfers">[];
  fixedAssets?: FixedAsset[];
};

type StrategyShape = {
  // Caps applied by account id
  accountCaps: Partial<Record<string, number>>;
  // Per-phase overrides
  phaseOverrides: Partial<Record<string, { surplusAccountId?: string; transfers?: Phase["transfers"] }>>;
};

function combineInternal(p: ProfileShape, s: StrategyShape): SimInput {
  return {
    startAge: p.startAge,
    endAge: p.endAge,
    accounts: p.accounts.map((a) => ({
      ...a,
      maxYearlyTopUp: s.accountCaps[a.id],
    })),
    expenses: p.expenses,
    liabilities: p.liabilities,
    fixedAssets: p.fixedAssets ?? [],
    phases: p.phases.map((ph) => {
      const ov = s.phaseOverrides[ph.id] ?? {};
      return { ...ph, surplusAccountId: ov.surplusAccountId, transfers: ov.transfers };
    }),
    topUpEarnsSameYearInterest: true,
    liabilityEndInclusive: true,
  };
}

// ----- Profile definitions ---------------------------------------------------
function profileFreshGrad(): ProfileShape {
  return {
    startAge: 18,
    endAge: 80,
    accounts: [
      { id: "cash", name: "Cash", balance: 1_000, rate: 0, drainOrder: 0, isCash: true },
      { id: "stk", name: "Stocks", balance: 0, rate: 0.04, drainOrder: 1 },
      { id: "asm", name: "ASM", balance: 2_000, rate: 0.05, drainOrder: 2 },
      { id: "epf", name: "EPF", balance: 5_000, rate: 0.06, drainOrder: 3 },
    ],
    expenses: [
      { id: "food", name: "Food", monthly: 500, inflation: 0.05, monthlyCap: 8000 },
      { id: "ins", name: "Insurance", monthly: 150, inflation: 0.03, monthlyCap: 3000 },
      { id: "others", name: "Others", monthly: 200, inflation: 0.03, monthlyCap: 2000 },
      { id: "yt", name: "Subscriptions", monthly: 30, inflation: 0.03, monthlyCap: 500 },
      { id: "rent", name: "Rent / room", monthly: 600, inflation: 0.03 },
      { id: "parents", name: "Parents allowance", monthly: 200, inflation: 0 },
      { id: "util", name: "Utilities", monthly: 80, inflation: 0 },
      { id: "fuel", name: "Transport", monthly: 200, inflation: 0 },
      { id: "tel", name: "Phone/Internet", monthly: 80, inflation: 0 },
    ],
    liabilities: [],
    phases: [
      { id: "current", name: "Year 0 (Current)", startAge: 18, endAge: 18, monthlyIncome: 0 },
      { id: "early", name: "Career building", startAge: 19, endAge: 27, monthlyIncome: 3_000, incomeInflation: 0.05 },
      { id: "mid", name: "Mid career", startAge: 28, endAge: 45, monthlyIncome: 8_000, incomeInflation: 0.03 },
      { id: "peak", name: "Peak earning", startAge: 46, endAge: 60, monthlyIncome: 15_000, incomeInflation: 0.02 },
      { id: "retired", name: "Retirement", startAge: 61, endAge: 80, monthlyIncome: 0 },
    ],
  };
}

function profileYoungPro(): ProfileShape {
  return {
    startAge: 25,
    endAge: 80,
    accounts: [
      { id: "cash", name: "Cash", balance: 1_000, rate: 0, drainOrder: 0, isCash: true },
      { id: "stk", name: "Stocks", balance: 5_000, rate: 0.04, drainOrder: 1 },
      { id: "asm", name: "ASM", balance: 10_000, rate: 0.05, drainOrder: 2 },
      { id: "epf", name: "EPF", balance: 30_000, rate: 0.06, drainOrder: 3 },
    ],
    expenses: [
      { id: "food", name: "Food", monthly: 700, inflation: 0.05, monthlyCap: 8000 },
      { id: "ins", name: "Insurance", monthly: 250, inflation: 0.03, monthlyCap: 3000 },
      { id: "others", name: "Others", monthly: 300, inflation: 0.03, monthlyCap: 2000 },
      { id: "yt", name: "Subscriptions", monthly: 50, inflation: 0.03, monthlyCap: 500 },
      { id: "condo", name: "Condo maintenance", monthly: 300, inflation: 0 },
      { id: "parents", name: "Parents allowance", monthly: 300, inflation: 0 },
      { id: "carins", name: "Car insurance", monthly: 250, inflation: 0 },
      { id: "util", name: "Utilities", monthly: 120, inflation: 0 },
      { id: "fuel", name: "Petrol / EV", monthly: 200, inflation: 0 },
      { id: "tel", name: "Phone/Internet", monthly: 100, inflation: 0 },
    ],
    liabilities: [
      { id: "house", name: "Housing loan", monthly: 1_500, inflation: 0, endAge: 55 },
    ],
    fixedAssets: [
      { id: "house-asset", name: "House", currentValue: 350_000, appreciation: 0.03, linkedLiabilityId: "house" },
    ],
    phases: [
      { id: "current", name: "Year 0 (Current)", startAge: 25, endAge: 25, monthlyIncome: 0 },
      { id: "build", name: "Build & save", startAge: 26, endAge: 35, monthlyIncome: 5_000, incomeInflation: 0.04 },
      { id: "mid", name: "Mid career", startAge: 36, endAge: 50, monthlyIncome: 10_000, incomeInflation: 0.03 },
      { id: "peak", name: "Peak earning", startAge: 51, endAge: 60, monthlyIncome: 15_000, incomeInflation: 0.02 },
      { id: "retired", name: "Retirement", startAge: 61, endAge: 80, monthlyIncome: 0 },
    ],
  };
}

function profileMidCareer(): ProfileShape {
  // Mirrors the current malaysiaPreset shape (used as default)
  return {
    startAge: 31,
    endAge: 80,
    accounts: [
      { id: "cash", name: "Cash", balance: 1_000, rate: 0, drainOrder: 0, isCash: true },
      { id: "stk", name: "Stocks", balance: 75_000, rate: 0.04, drainOrder: 1 },
      { id: "asm", name: "ASM", balance: 244_000, rate: 0.05, drainOrder: 2 },
      { id: "epf", name: "EPF", balance: 200_000, rate: 0.06, drainOrder: 3 },
    ],
    expenses: [
      { id: "food", name: "Food", monthly: 750, inflation: 0.05, monthlyCap: 8000 },
      { id: "ins", name: "Insurance", monthly: 350, inflation: 0.03, monthlyCap: 3000 },
      { id: "others", name: "Others", monthly: 250, inflation: 0.03, monthlyCap: 2000 },
      { id: "yt", name: "Subscriptions", monthly: 50, inflation: 0.03, monthlyCap: 500 },
      { id: "condo", name: "Condo maintenance", monthly: 350, inflation: 0 },
      { id: "parents", name: "Parents allowance", monthly: 250, inflation: 0 },
      { id: "carins", name: "Car insurance", monthly: 250, inflation: 0 },
      { id: "util", name: "Utilities", monthly: 100, inflation: 0 },
      { id: "fuel", name: "Petrol / EV", monthly: 100, inflation: 0 },
      { id: "gym", name: "Gym", monthly: 83, inflation: 0 },
      { id: "tel", name: "Phone/Internet", monthly: 75, inflation: 0 },
      { id: "veh", name: "Vehicle upkeep", monthly: 42, inflation: 0 },
      { id: "tax", name: "Property tax", monthly: 42, inflation: 0 },
    ],
    liabilities: [{ id: "house", name: "Housing loan", monthly: 2250, inflation: 0, endAge: 60 }],
    fixedAssets: [
      { id: "house-asset", name: "House", currentValue: 500_000, appreciation: 0.03, linkedLiabilityId: "house" },
    ],
    phases: [
      { id: "current", name: "Year 0 (Current)", startAge: 31, endAge: 31, monthlyIncome: 0 },
      { id: "accum", name: "Accumulation", startAge: 32, endAge: 36, monthlyIncome: 15_000, incomeInflation: 0 },
      { id: "semi", name: "Semi-Retirement", startAge: 37, endAge: 41, monthlyIncome: 3_000, incomeInflation: 0 },
      { id: "full", name: "Full Retirement", startAge: 42, endAge: 60, monthlyIncome: 0 },
      { id: "debtfree", name: "Debt-Free Retirement", startAge: 61, endAge: 80, monthlyIncome: 0 },
    ],
  };
}

function profileLean(): ProfileShape {
  return {
    startAge: 31,
    endAge: 80,
    accounts: profileMidCareer().accounts,
    expenses: [
      { id: "food", name: "Food", monthly: 500, inflation: 0.05, monthlyCap: 8000 },
      { id: "ins", name: "Insurance", monthly: 250, inflation: 0.03, monthlyCap: 3000 },
      { id: "others", name: "Others", monthly: 150, inflation: 0.03, monthlyCap: 2000 },
      { id: "yt", name: "Subscriptions", monthly: 30, inflation: 0.03, monthlyCap: 500 },
      { id: "condo", name: "Condo maintenance", monthly: 350, inflation: 0 },
      { id: "parents", name: "Parents allowance", monthly: 250, inflation: 0 },
      { id: "carins", name: "Car insurance", monthly: 250, inflation: 0 },
      { id: "util", name: "Utilities", monthly: 100, inflation: 0 },
      { id: "fuel", name: "Petrol / EV", monthly: 80, inflation: 0 },
      { id: "gym", name: "Gym", monthly: 50, inflation: 0 },
      { id: "tel", name: "Phone/Internet", monthly: 60, inflation: 0 },
      { id: "veh", name: "Vehicle upkeep", monthly: 42, inflation: 0 },
      { id: "tax", name: "Property tax", monthly: 42, inflation: 0 },
    ],
    liabilities: [{ id: "house", name: "Housing loan", monthly: 2250, inflation: 0, endAge: 60 }],
    fixedAssets: [
      { id: "house-asset", name: "House", currentValue: 500_000, appreciation: 0.03, linkedLiabilityId: "house" },
    ],
    phases: [
      { id: "current", name: "Year 0 (Current)", startAge: 31, endAge: 31, monthlyIncome: 0 },
      { id: "sprint", name: "FIRE Sprint", startAge: 32, endAge: 35, monthlyIncome: 15_000, incomeInflation: 0 },
      { id: "retired", name: "Lean Retirement", startAge: 36, endAge: 80, monthlyIncome: 0 },
    ],
  };
}

function profilePreRetire(): ProfileShape {
  return {
    startAge: 55,
    endAge: 90,
    accounts: [
      { id: "cash", name: "Cash", balance: 1_000, rate: 0, drainOrder: 0, isCash: true },
      { id: "stk", name: "Stocks", balance: 200_000, rate: 0.04, drainOrder: 1 },
      { id: "asm", name: "ASM", balance: 400_000, rate: 0.05, drainOrder: 2 },
      { id: "epf", name: "EPF", balance: 800_000, rate: 0.06, drainOrder: 3 },
    ],
    expenses: [
      { id: "food", name: "Food", monthly: 1200, inflation: 0.05, monthlyCap: 8000 },
      { id: "ins", name: "Insurance", monthly: 800, inflation: 0.03, monthlyCap: 3000 },
      { id: "others", name: "Others", monthly: 600, inflation: 0.03, monthlyCap: 2000 },
      { id: "yt", name: "Subscriptions", monthly: 100, inflation: 0.03, monthlyCap: 500 },
      { id: "condo", name: "Condo maintenance", monthly: 500, inflation: 0 },
      { id: "parents", name: "Parents care", monthly: 800, inflation: 0 },
      { id: "carins", name: "Car insurance", monthly: 350, inflation: 0 },
      { id: "util", name: "Utilities", monthly: 200, inflation: 0 },
      { id: "fuel", name: "Petrol / EV", monthly: 200, inflation: 0 },
      { id: "tel", name: "Phone/Internet", monthly: 150, inflation: 0 },
    ],
    liabilities: [{ id: "house", name: "Housing loan", monthly: 2250, inflation: 0, endAge: 60 }],
    fixedAssets: [
      { id: "house-asset", name: "House", currentValue: 800_000, appreciation: 0.03, linkedLiabilityId: "house" },
    ],
    phases: [
      { id: "current", name: "Year 0 (Current)", startAge: 55, endAge: 55, monthlyIncome: 0 },
      { id: "sprint", name: "Final Sprint", startAge: 56, endAge: 60, monthlyIncome: 18_000, incomeInflation: 0 },
      { id: "retired", name: "Retirement", startAge: 61, endAge: 90, monthlyIncome: 0 },
    ],
  };
}

export function profileByKey(k: ProfileKey): ProfileShape {
  switch (k) {
    case "freshGrad": return profileFreshGrad();
    case "youngPro": return profileYoungPro();
    case "lean": return profileLean();
    case "preRetire": return profilePreRetire();
    case "midCareer":
    default: return profileMidCareer();
  }
}

// ----- Strategy definitions --------------------------------------------------
function strategyAggressive(profile: ProfileShape): StrategyShape {
  // Find the first phase with income > 0 to anchor "retirement" transfers
  const incomePhases = profile.phases.filter((p) => p.monthlyIncome > 0);
  const noIncomePhases = profile.phases.filter((p) => p.monthlyIncome === 0 && p.id !== "current");
  const overrides: StrategyShape["phaseOverrides"] = {};
  for (const p of incomePhases) overrides[p.id] = { surplusAccountId: "epf" };
  // Add ASM→EPF transfer only in retirement (zero-income) phases
  for (const p of noIncomePhases) overrides[p.id] = { transfers: [{ fromId: "asm", toId: "epf", amount: 50_000 }] };
  return { accountCaps: { epf: 100_000 }, phaseOverrides: overrides };
}

function strategyConservative(profile: ProfileShape): StrategyShape {
  const overrides: StrategyShape["phaseOverrides"] = {};
  for (const p of profile.phases) {
    if (p.monthlyIncome > 0) overrides[p.id] = { surplusAccountId: "epf" };
  }
  return { accountCaps: { epf: 100_000 }, phaseOverrides: overrides };
}

function strategyNoTopUp(_profile: ProfileShape): StrategyShape {
  // No caps, no surplus targets — surplus is consumed (lifestyle creep), nothing saved.
  return { accountCaps: {}, phaseOverrides: {} };
}

export function strategyByKey(k: StrategyKey, profile: ProfileShape): StrategyShape {
  switch (k) {
    case "conservative": return strategyConservative(profile);
    case "noTopUp": return strategyNoTopUp(profile);
    case "aggressive":
    default: return strategyAggressive(profile);
  }
}

export function combine(profileKey: ProfileKey, strategyKey: StrategyKey): SimInput {
  const p = profileByKey(profileKey);
  const s = strategyByKey(strategyKey, p);
  return combineInternal(p, s);
}

// ----- Back-compat wrappers (so existing tests/snapshots still work) ---------
// New code should use combine(profile, strategy) directly.
export function malaysiaPreset(): SimInput { return combine("midCareer", "aggressive"); }
export function conservativePreset(): SimInput { return combine("midCareer", "conservative"); }
export function leanFirePreset(): SimInput { return combine("lean", "aggressive"); }
export function noTopUpPreset(): SimInput {
  // Stress test: zero income forever (compound starting balances).
  // Closest profile is midCareer but with all monthlyIncome forced to 0.
  const base = combine("midCareer", "noTopUp");
  return {
    ...base,
    phases: base.phases.map((p) => ({ ...p, monthlyIncome: 0, surplusAccountId: undefined, transfers: undefined })),
  };
}
