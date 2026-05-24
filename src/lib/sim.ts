// Retirement simulation engine — deterministic year-by-year cashflow projection.
// Mirrors the Python reference (../../build_sheet.py).

export type Account = {
  id: string;
  name: string;
  balance: number;
  rate: number; // e.g. 0.06 for 6%
  drainOrder: number; // lower = drained first
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
  // If set, income surplus (income - expenses - liabilities) is deposited into this account
  // at end of year. If not set, surplus is "consumed" (lifestyle creep) and not saved.
  surplusAccountId?: string;
  // Optional top-ups applied at start of year
  topUps?: { accountId: string; amount: number }[];
  // Optional transfers between accounts at start of year (until source empty)
  transfers?: { fromId: string; toId: string; amount: number }[];
};

export type SimInput = {
  startAge: number;
  endAge: number;
  accounts: Account[];
  expenses: ExpenseItem[];
  liabilities: Liability[];
  phases: Phase[];
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
  topUps: number;
  transfers: number;
  expenseTotal: number;
  liabilityTotal: number;
  totalSpend: number;
  portfolioOutflow: number;
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
  type AcctState = { id: string; name: string; balance: number; rate: number; principal: number; drainOrder: number };
  const accts: AcctState[] = input.accounts.map((a) => ({
    id: a.id,
    name: a.name,
    balance: a.balance,
    rate: a.rate,
    principal: a.balance, // initial balance counts as principal
    drainOrder: a.drainOrder,
  }));

  const rows: YearRow[] = [];
  let peakAssets = 0;
  let peakAge = startAge;
  let runsOutAtAge: number | null = null;

  for (let age = startAge; age <= endAge; age++) {
    const yearIndex = age - startAge;
    const phase = phaseFor(phases, age);
    const phaseName = phase?.name ?? (yearIndex === 0 ? "Year 0" : "Unphased");

    let topUpsTotal = 0;
    let transfersTotal = 0;

    // Start-of-year: top-ups
    if (phase?.topUps) {
      for (const t of phase.topUps) {
        const acct = accts.find((a) => a.id === t.accountId);
        if (!acct) continue;
        acct.balance += t.amount;
        acct.principal += t.amount;
        topUpsTotal += t.amount;
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

    // Liabilities (e.g. house)
    let liabilityTotal = 0;
    for (const L of liabilities) {
      const stillPaying = input.liabilityEndInclusive
        ? age <= L.endAge
        : age < L.endAge;
      if (stillPaying) {
        liabilityTotal +=
          inflated(L.monthly, L.inflation, yearIndex) * 12;
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
    if (shortfall > 0 && runsOutAtAge === null) runsOutAtAge = age;

    // Surplus savings: if a target account is set, deposit surplus there
    let surplusSaved = 0;
    if (surplus > 0 && phase?.surplusAccountId) {
      const target = accts.find((a) => a.id === phase.surplusAccountId);
      if (target) {
        target.balance += surplus;
        target.principal += surplus;
        surplusSaved = surplus;
      }
    }

    // Interest at end of year (skip year 0)
    let interestEarned = 0;
    if (yearIndex > 0) {
      for (const acct of accts) {
        let base = acct.balance;
        if (!input.topUpEarnsSameYearInterest) {
          // Subtract top-ups of this year before interest
          const tu =
            phase?.topUps?.find((x) => x.accountId === acct.id)?.amount ?? 0;
          base = Math.max(0, base - tu);
        }
        const earned = base * acct.rate;
        acct.balance += earned;
        interestEarned += earned;
      }
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
      topUps: topUpsTotal,
      transfers: transfersTotal,
      expenseTotal,
      liabilityTotal,
      totalSpend: expenseTotal + liabilityTotal,
      portfolioOutflow,
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

// ---------- Sample preset (illustrative numbers; users should customize) ----------
export function malaysiaPreset(): SimInput {
  const accounts: Account[] = [
    { id: "stk", name: "Stocks", balance: 75_000, rate: 0.04, drainOrder: 1 },
    { id: "asm", name: "ASM", balance: 244_000, rate: 0.05, drainOrder: 2 },
    { id: "epf", name: "EPF", balance: 200_000, rate: 0.06, drainOrder: 3 },
  ];
  const expenses: ExpenseItem[] = [
    { id: "food", name: "Food", monthly: 750, inflation: 0.05, monthlyCap: 3500 },
    { id: "ins", name: "Insurance", monthly: 350, inflation: 0.03, monthlyCap: 1000 },
    { id: "others", name: "Others (shopping/leisure)", monthly: 250, inflation: 0.03, monthlyCap: 1000 },
    { id: "yt", name: "Subscriptions", monthly: 50, inflation: 0.03, monthlyCap: 200 },
    { id: "condo", name: "Condo maintenance", monthly: 350, inflation: 0 },
    { id: "parents", name: "Parents allowance", monthly: 250, inflation: 0 },
    { id: "carins", name: "Car insurance", monthly: 250, inflation: 0 },
    { id: "util", name: "Utilities (TNB/Water)", monthly: 100, inflation: 0 },
    { id: "fuel", name: "Petrol / EV", monthly: 100, inflation: 0 },
    { id: "gym", name: "Gym", monthly: 83, inflation: 0 },
    { id: "tel", name: "Phone/Internet", monthly: 75, inflation: 0 },
    { id: "veh", name: "Vehicle upkeep", monthly: 42, inflation: 0 },
    { id: "tax", name: "Property tax", monthly: 42, inflation: 0 },
  ];
  const liabilities: Liability[] = [
    { id: "house", name: "Housing loan", monthly: 2250, inflation: 0, endAge: 60 },
  ];
  const phases: Phase[] = [
    {
      id: "current",
      name: "Year 0 (Current)",
      startAge: 31,
      endAge: 31,
      monthlyIncome: 0,
    },
    {
      id: "accum",
      name: "Accumulation",
      startAge: 32,
      endAge: 36,
      monthlyIncome: 10_000,
      incomeInflation: 0,
      // surplus consumed (no target). Explicit top-ups handle savings.
      topUps: [
        { accountId: "epf", amount: 50_000 },
        { accountId: "asm", amount: 10_000 },
      ],
    },
    {
      id: "semi",
      name: "Semi-Retirement",
      startAge: 37,
      endAge: 41,
      monthlyIncome: 3_000,
      incomeInflation: 0,
      transfers: [{ fromId: "asm", toId: "epf", amount: 50_000 }],
    },
    {
      id: "full",
      name: "Full Retirement",
      startAge: 42,
      endAge: 60,
      monthlyIncome: 0,
      transfers: [{ fromId: "asm", toId: "epf", amount: 50_000 }],
    },
    {
      id: "debtfree",
      name: "Debt-Free Retirement",
      startAge: 61,
      endAge: 80,
      monthlyIncome: 0,
    },
  ];
  return {
    startAge: 31,
    endAge: 80,
    accounts,
    expenses,
    liabilities,
    phases,
    topUpEarnsSameYearInterest: true,
    liabilityEndInclusive: true,
  };
}
