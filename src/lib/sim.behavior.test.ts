// Behavior-focused tests: each test targets one specific engine feature with
// a minimal constructed scenario. Catches logic bugs that the preset-level
// smoke tests can't isolate.
// Run with: npx tsx src/lib/sim.behavior.test.ts
import { simulate, type SimInput } from "./sim";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail ? " — " + detail : ""}`);
  }
}
function near(a: number, b: number, eps = 0.01) {
  return Math.abs(a - b) <= eps * Math.max(Math.abs(a), Math.abs(b), 1);
}

// Minimal scenario builder
function build(opts: Partial<SimInput>): SimInput {
  return {
    startAge: 30,
    endAge: 35,
    accounts: [],
    expenses: [],
    liabilities: [],
    phases: [{ id: "p", name: "P", startAge: 30, endAge: 35, monthlyIncome: 0 }],
    topUpEarnsSameYearInterest: true,
    liabilityEndInclusive: true,
    ...opts,
  };
}

// ============================================================================
console.log("\n— Drain order —");
{
  // Two accounts, no income, expense forces drain. Lower drainOrder drains first.
  const r = simulate(build({
    accounts: [
      { id: "high", name: "High", balance: 100, rate: 0, drainOrder: 1 },
      { id: "low", name: "Low", balance: 100, rate: 0, drainOrder: 2 },
    ],
    expenses: [{ id: "e", name: "e", monthly: 50 / 12, inflation: 0 }],
    phases: [
      { id: "y0", name: "Y0", startAge: 30, endAge: 30, monthlyIncome: 0 },
      { id: "spend", name: "spend", startAge: 31, endAge: 31, monthlyIncome: 0 },
    ],
    endAge: 31,
  }));
  const r1 = r.rows[1];
  const high = r1.accounts.find((a) => a.id === "high")!;
  const low = r1.accounts.find((a) => a.id === "low")!;
  check("Lower drainOrder drains first", high.balance === 50 && low.balance === 100);
}
// Reversed drain order
{
  const r = simulate(build({
    accounts: [
      { id: "a", name: "A", balance: 100, rate: 0, drainOrder: 2 },
      { id: "b", name: "B", balance: 100, rate: 0, drainOrder: 1 },
    ],
    expenses: [{ id: "e", name: "e", monthly: 50 / 12, inflation: 0 }],
    phases: [
      { id: "y0", name: "Y0", startAge: 30, endAge: 30, monthlyIncome: 0 },
      { id: "spend", name: "spend", startAge: 31, endAge: 31, monthlyIncome: 0 },
    ],
    endAge: 31,
  }));
  const r1 = r.rows[1];
  const a = r1.accounts.find((acc) => acc.id === "a")!;
  const b = r1.accounts.find((acc) => acc.id === "b")!;
  check("Drain order respected even when array order differs", a.balance === 100 && b.balance === 50);
}

console.log("\n— Transfers —");
{
  // Transfer moves balance + proportional principal from source to dest
  const r = simulate(build({
    accounts: [
      { id: "src", name: "Src", balance: 100, rate: 0, drainOrder: 1 },
      { id: "dst", name: "Dst", balance: 0, rate: 0, drainOrder: 2 },
    ],
    phases: [
      { id: "y0", name: "Y0", startAge: 30, endAge: 30, monthlyIncome: 0 },
      { id: "mv", name: "mv", startAge: 31, endAge: 31, monthlyIncome: 0,
        transfers: [{ fromId: "src", toId: "dst", amount: 40 }] },
    ],
    endAge: 31,
  }));
  const r1 = r.rows[1];
  check("Transfer reduces source balance", r1.accounts.find((a) => a.id === "src")!.balance === 60);
  check("Transfer increases destination balance", r1.accounts.find((a) => a.id === "dst")!.balance === 40);
  check("Total preserved (no money created/destroyed)", r1.totalAssets === 100);
}
// Transfer capped by source balance
{
  const r = simulate(build({
    accounts: [
      { id: "src", name: "Src", balance: 10, rate: 0, drainOrder: 1 },
      { id: "dst", name: "Dst", balance: 0, rate: 0, drainOrder: 2 },
    ],
    phases: [
      { id: "y0", name: "Y0", startAge: 30, endAge: 30, monthlyIncome: 0 },
      { id: "mv", name: "mv", startAge: 31, endAge: 31, monthlyIncome: 0,
        transfers: [{ fromId: "src", toId: "dst", amount: 1_000_000 }] },
    ],
    endAge: 31,
  }));
  const r1 = r.rows[1];
  check("Transfer capped by source balance (no overdraft)", r1.accounts.find((a) => a.id === "src")!.balance === 0);
  check("Destination receives only what source had", r1.accounts.find((a) => a.id === "dst")!.balance === 10);
}
// Transfer to/from non-existent account is a no-op
{
  const r = simulate(build({
    accounts: [{ id: "a", name: "A", balance: 100, rate: 0, drainOrder: 1 }],
    phases: [
      { id: "y0", name: "Y0", startAge: 30, endAge: 30, monthlyIncome: 0 },
      { id: "x", name: "x", startAge: 31, endAge: 31, monthlyIncome: 0,
        transfers: [{ fromId: "ghost", toId: "a", amount: 100 }] },
    ],
    endAge: 31,
  }));
  check("Transfer with bad fromId is a no-op (no crash)", r.rows[1].accounts[0].balance === 100);
}

console.log("\n— Income inflation —");
{
  const r = simulate(build({
    accounts: [{ id: "a", name: "A", balance: 0, rate: 0, drainOrder: 1, isCash: true }],
    phases: [
      { id: "y0", name: "Y0", startAge: 30, endAge: 30, monthlyIncome: 0 },
      { id: "earn", name: "earn", startAge: 31, endAge: 33,
        monthlyIncome: 1000, incomeInflation: 0.10, surplusAccountId: "a" },
    ],
    endAge: 33,
  }));
  // yearsInPhase: 0 at age 31, 1 at 32, 2 at 33. monthlyIncome × 12 × 1.10^k
  check("Income year 1 = 12000", near(r.rows[1].income, 12000));
  check("Income year 2 = 12000 × 1.10 = 13200", near(r.rows[2].income, 13200));
  check("Income year 3 = 12000 × 1.10² = 14520", near(r.rows[3].income, 14520));
}

console.log("\n— Expense cap activation —");
{
  const r = simulate(build({
    accounts: [{ id: "a", name: "A", balance: 1_000_000, rate: 0, drainOrder: 1 }],
    expenses: [{ id: "food", name: "Food", monthly: 1000, inflation: 0.10, monthlyCap: 1500 }],
    phases: [
      { id: "y0", name: "Y0", startAge: 30, endAge: 30, monthlyIncome: 0 },
      { id: "spend", name: "spend", startAge: 31, endAge: 40, monthlyIncome: 0 },
    ],
    endAge: 40,
  }));
  // At year k, monthly = min(1000 × 1.10^k, 1500). Hits cap when 1.10^k = 1.5 → k ≈ 4.25
  // So at k=4 (age 34): 1000 × 1.4641 = 1464.10 (uncapped). At k=5 (age 35): 1610.51 → capped to 1500.
  const age34 = r.rows.find((row) => row.age === 34)!;
  const age35 = r.rows.find((row) => row.age === 35)!;
  const food34 = age34.expenseBreakdown[0].yearly / 12;
  const food35 = age35.expenseBreakdown[0].yearly / 12;
  check("Food at age 34 is below cap (uninflated yet)", food34 < 1500);
  check("Food at age 35 hits cap (1500/mo)", near(food35, 1500));
  check("Food at age 40 still capped", near(r.rows[r.rows.length - 1].expenseBreakdown[0].yearly / 12, 1500));
}

console.log("\n— Liability end (inclusive vs exclusive) —");
{
  // Inclusive: pays through endAge=32
  const incl = simulate(build({
    accounts: [{ id: "a", name: "A", balance: 100_000, rate: 0, drainOrder: 1 }],
    liabilities: [{ id: "L", name: "L", monthly: 1000, inflation: 0, endAge: 32 }],
    phases: [
      { id: "y0", name: "Y0", startAge: 30, endAge: 30, monthlyIncome: 0 },
      { id: "p", name: "p", startAge: 31, endAge: 33, monthlyIncome: 0 },
    ],
    endAge: 33,
    liabilityEndInclusive: true,
  }));
  check("Inclusive: liability paid at endAge", incl.rows.find((r) => r.age === 32)!.liabilityTotal === 12000);
  check("Inclusive: zero liability after endAge", incl.rows.find((r) => r.age === 33)!.liabilityTotal === 0);

  const excl2 = simulate(build({
    accounts: [{ id: "a", name: "A", balance: 100_000, rate: 0, drainOrder: 1 }],
    liabilities: [{ id: "L", name: "L", monthly: 1000, inflation: 0, endAge: 32 }],
    phases: [
      { id: "y0", name: "Y0", startAge: 30, endAge: 30, monthlyIncome: 0 },
      { id: "p", name: "p", startAge: 31, endAge: 33, monthlyIncome: 0 },
    ],
    endAge: 33,
    liabilityEndInclusive: false,
  }));
  check("Exclusive: zero liability at endAge (last payment was endAge-1)",
    excl2.rows.find((r) => r.age === 32)!.liabilityTotal === 0);
  check("Exclusive: liability paid at endAge-1",
    excl2.rows.find((r) => r.age === 31)!.liabilityTotal === 12000);
}

console.log("\n— Year 0 snapshot semantics —");
{
  // Even with non-zero income/expenses defined, year 0 should not drain or deposit
  const r = simulate(build({
    accounts: [{ id: "a", name: "A", balance: 100, rate: 0.10, drainOrder: 1, isCash: true }],
    expenses: [{ id: "e", name: "e", monthly: 100, inflation: 0 }],
    phases: [
      { id: "y0", name: "Y0", startAge: 30, endAge: 30, monthlyIncome: 5000, surplusAccountId: "a" },
      { id: "p", name: "p", startAge: 31, endAge: 31, monthlyIncome: 0 },
    ],
    endAge: 31,
  }));
  const y0 = r.rows[0];
  check("Year 0: portfolio outflow = 0", y0.portfolioOutflow === 0);
  check("Year 0: surplus saved = 0", y0.surplusSaved === 0);
  check("Year 0: interest not credited", y0.interestEarned === 0);
  check("Year 0: balance unchanged", y0.totalAssets === 100);
}

console.log("\n— Surplus cascade & auto-Cash —");
{
  // With ONLY an EPF account (capped at 100), 200k surplus should auto-create Cash.
  const r = simulate({
    startAge: 30, endAge: 31,
    accounts: [{ id: "epf", name: "EPF", balance: 0, rate: 0, drainOrder: 1, maxYearlyTopUp: 100 }],
    expenses: [],
    liabilities: [],
    phases: [
      { id: "y0", name: "Y0", startAge: 30, endAge: 30, monthlyIncome: 0 },
      { id: "earn", name: "earn", startAge: 31, endAge: 31,
        monthlyIncome: 200 / 12, surplusAccountId: "epf" },
    ],
    topUpEarnsSameYearInterest: true, liabilityEndInclusive: true,
  });
  const r1 = r.rows[1];
  check("EPF capped at 100", r1.accounts.find((a) => a.id === "epf")!.balance === 100);
  const cash = r1.accounts.find((a) => a.id === "cash-auto");
  check("Cash account auto-created", !!cash);
  check("Cash absorbed overflow of 100", cash?.balance === 100);
}
// Existing isCash account is reused (NOT duplicated)
{
  const r = simulate({
    startAge: 30, endAge: 31,
    accounts: [
      { id: "mycash", name: "MyCash", balance: 0, rate: 0, drainOrder: 5, isCash: true },
      { id: "epf", name: "EPF", balance: 0, rate: 0, drainOrder: 1, maxYearlyTopUp: 100 },
    ],
    expenses: [],
    liabilities: [],
    phases: [
      { id: "y0", name: "Y0", startAge: 30, endAge: 30, monthlyIncome: 0 },
      { id: "earn", name: "earn", startAge: 31, endAge: 31,
        monthlyIncome: 200 / 12, surplusAccountId: "epf" },
    ],
    topUpEarnsSameYearInterest: true, liabilityEndInclusive: true,
  });
  const r1 = r.rows[1];
  check("Pre-existing isCash account receives overflow",
    r1.accounts.find((a) => a.id === "mycash")!.balance === 100);
  check("No duplicate cash-auto created",
    !r1.accounts.find((a) => a.id === "cash-auto"));
}

console.log("\n— Cascade preferred → next-highest-rate —");
{
  const r = simulate({
    startAge: 30, endAge: 31,
    accounts: [
      { id: "low", name: "Low", balance: 0, rate: 0.01, drainOrder: 1 },
      { id: "high", name: "High", balance: 0, rate: 0.10, drainOrder: 2 },
      { id: "epf", name: "EPF", balance: 0, rate: 0.06, drainOrder: 3, maxYearlyTopUp: 100 },
    ],
    expenses: [],
    liabilities: [],
    phases: [
      { id: "y0", name: "Y0", startAge: 30, endAge: 30, monthlyIncome: 0 },
      { id: "earn", name: "earn", startAge: 31, endAge: 31,
        monthlyIncome: 300 / 12, surplusAccountId: "epf" },
    ],
    topUpEarnsSameYearInterest: true, liabilityEndInclusive: true,
  });
  const r1 = r.rows[1];
  // EPF: 100 (capped). High (next highest 10%): all 200. Low: 0.
  check("EPF cap respected", r1.accounts.find((a) => a.id === "epf")!.balance === 100);
  check("Overflow goes to highest-rate non-preferred (10%)",
    r1.accounts.find((a) => a.id === "high")!.balance === 200);
  check("Lowest-rate account untouched by cascade",
    r1.accounts.find((a) => a.id === "low")!.balance === 0);
}

console.log("\n— No surplusAccountId → consumed (lifestyle creep) —");
{
  const r = simulate({
    startAge: 30, endAge: 31,
    accounts: [{ id: "a", name: "A", balance: 0, rate: 0, drainOrder: 1, isCash: true }],
    expenses: [],
    liabilities: [],
    phases: [
      { id: "y0", name: "Y0", startAge: 30, endAge: 30, monthlyIncome: 0 },
      { id: "earn", name: "earn", startAge: 31, endAge: 31, monthlyIncome: 1000 },
      // No surplusAccountId — surplus should be consumed
    ],
    topUpEarnsSameYearInterest: true, liabilityEndInclusive: true,
  });
  check("Surplus exists", r.rows[1].surplus > 0);
  check("Surplus NOT saved when no target set", r.rows[1].surplusSaved === 0);
  check("Account balance unchanged", r.rows[1].accounts[0].balance === 0);
}

console.log("\n— Principal vs interest accounting —");
{
  const r = simulate({
    startAge: 30, endAge: 32,
    accounts: [{ id: "a", name: "A", balance: 1000, rate: 0.10, drainOrder: 1 }],
    expenses: [{ id: "e", name: "e", monthly: 50 / 12, inflation: 0 }],
    liabilities: [],
    phases: [
      { id: "y0", name: "Y0", startAge: 30, endAge: 30, monthlyIncome: 0 },
      { id: "drain", name: "drain", startAge: 31, endAge: 32, monthlyIncome: 0 },
    ],
    topUpEarnsSameYearInterest: true, liabilityEndInclusive: true,
  });
  // Engine drains BEFORE crediting interest in the same year.
  // Year 1: balance 1000 - 50 = 950 (principal clamped to 950), + 10% = 1045.
  // Once balance exceeds original principal again, principal stays put thereafter.
  const r1 = r.rows[1];
  const r2 = r.rows[2];
  check("Interest > 0 after drain", r1.interestEarned > 0);
  check("Year 1 principal reduced by drain (since interest credited after drain)",
    r1.accounts[0].principal === 950);
  check("Year 2 principal unchanged when interest > drain",
    r2.accounts[0].principal === r1.accounts[0].principal);
  check("Year 2 balance > principal (interest earned)", r2.accounts[0].balance > r2.accounts[0].principal);
}
// Force eating principal
{
  const r = simulate({
    startAge: 30, endAge: 31,
    accounts: [{ id: "a", name: "A", balance: 100, rate: 0, drainOrder: 1 }],
    expenses: [{ id: "e", name: "e", monthly: 80 / 12, inflation: 0 }],
    liabilities: [],
    phases: [
      { id: "y0", name: "Y0", startAge: 30, endAge: 30, monthlyIncome: 0 },
      { id: "drain", name: "drain", startAge: 31, endAge: 31, monthlyIncome: 0 },
    ],
    topUpEarnsSameYearInterest: true, liabilityEndInclusive: true,
  });
  const r1 = r.rows[1];
  check("Principal reduced when no interest to cover drain", r1.accounts[0].principal === 20);
  check("Balance == principal when 0% rate", r1.accounts[0].balance === r1.accounts[0].principal);
}

console.log("\n— Shortfall / runs-out behavior —");
{
  const r = simulate({
    startAge: 30, endAge: 35,
    accounts: [{ id: "a", name: "A", balance: 100, rate: 0, drainOrder: 1 }],
    expenses: [{ id: "e", name: "e", monthly: 60 / 12, inflation: 0 }],
    liabilities: [],
    phases: [
      { id: "y0", name: "Y0", startAge: 30, endAge: 30, monthlyIncome: 0 },
      { id: "drain", name: "drain", startAge: 31, endAge: 35, monthlyIncome: 0 },
    ],
    topUpEarnsSameYearInterest: true, liabilityEndInclusive: true,
  });
  // Year 1: 100-60=40. Year 2: 40-60=−20 → drain 40, shortfall 20.
  check("runsOutAtAge set when portfolio empties", r.runsOutAtAge === 32);
  check("Year of shortfall has shortfall > 0", r.rows.find((row) => row.age === 32)!.shortfall === 20);
  check("portfolioDrained = portfolioOutflow - shortfall",
    near(r.rows.find((row) => row.age === 32)!.portfolioDrained, 40));
  // Subsequent years also shortfall
  check("Years after broke also have shortfall > 0",
    r.rows.find((row) => row.age === 33)!.shortfall > 0);
}

console.log("\n— Multiple transfers in same phase —");
{
  const r = simulate({
    startAge: 30, endAge: 31,
    accounts: [
      { id: "a", name: "A", balance: 100, rate: 0, drainOrder: 1 },
      { id: "b", name: "B", balance: 100, rate: 0, drainOrder: 2 },
      { id: "c", name: "C", balance: 0, rate: 0, drainOrder: 3 },
    ],
    expenses: [],
    liabilities: [],
    phases: [
      { id: "y0", name: "Y0", startAge: 30, endAge: 30, monthlyIncome: 0 },
      { id: "x", name: "x", startAge: 31, endAge: 31, monthlyIncome: 0,
        transfers: [
          { fromId: "a", toId: "c", amount: 50 },
          { fromId: "b", toId: "c", amount: 50 },
        ],
      },
    ],
    topUpEarnsSameYearInterest: true, liabilityEndInclusive: true,
  });
  const r1 = r.rows[1];
  check("Both transfers applied", r1.accounts.find((a) => a.id === "c")!.balance === 100);
  check("Source A correctly reduced", r1.accounts.find((a) => a.id === "a")!.balance === 50);
  check("Source B correctly reduced", r1.accounts.find((a) => a.id === "b")!.balance === 50);
  check("Total preserved across multiple transfers", r1.totalAssets === 200);
}

console.log("\n— Phase coverage gaps (unphased years) —");
{
  // Deliberately leave a gap to verify "Unphased" behavior is graceful (no crash, zero income)
  const r = simulate({
    startAge: 30, endAge: 32,
    accounts: [{ id: "a", name: "A", balance: 100, rate: 0, drainOrder: 1 }],
    expenses: [],
    liabilities: [],
    phases: [
      { id: "first", name: "First", startAge: 30, endAge: 30, monthlyIncome: 1000 },
      // Age 31 has no phase
      { id: "third", name: "Third", startAge: 32, endAge: 32, monthlyIncome: 1000 },
    ],
    topUpEarnsSameYearInterest: true, liabilityEndInclusive: true,
  });
  const gap = r.rows.find((row) => row.age === 31)!;
  check("Unphased year is labeled 'Unphased'", gap.phaseName === "Unphased");
  check("Unphased year has 0 income", gap.income === 0);
}

console.log("\n— Fixed Assets —");
{
  // No sellAge: zero impact on simulation
  const noSell = simulate({
    startAge: 30, endAge: 31,
    accounts: [{ id: "cash", name: "Cash", balance: 0, rate: 0, drainOrder: 0, isCash: true }],
    expenses: [], liabilities: [],
    fixedAssets: [{ id: "h", name: "House", currentValue: 500_000, appreciation: 0.03 }],
    phases: [{ id: "y0", name: "Y0", startAge: 30, endAge: 30, monthlyIncome: 0 },
             { id: "p", name: "p", startAge: 31, endAge: 31, monthlyIncome: 0 }],
    topUpEarnsSameYearInterest: true, liabilityEndInclusive: true,
  });
  check("FA without sellAge: zero proceeds", noSell.rows[1].assetSaleProceeds === 0);
  check("FA without sellAge: total assets unchanged from start",
    noSell.rows[1].totalAssets === 0);

  // Sell at specific age, no linked loan → proceeds = appreciated value
  const sellSimple = simulate({
    startAge: 30, endAge: 32,
    accounts: [{ id: "cash", name: "Cash", balance: 0, rate: 0, drainOrder: 0, isCash: true }],
    expenses: [], liabilities: [],
    fixedAssets: [{ id: "h", name: "House", currentValue: 100_000, appreciation: 0.10, sellAge: 32 }],
    phases: [{ id: "y0", name: "Y0", startAge: 30, endAge: 30, monthlyIncome: 0 },
             { id: "p", name: "p", startAge: 31, endAge: 32, monthlyIncome: 0, surplusAccountId: "cash" }],
    topUpEarnsSameYearInterest: true, liabilityEndInclusive: true,
  });
  const sellRow = sellSimple.rows.find((r) => r.age === 32)!;
  // yearsHeld = 2, appreciated = 100k × 1.1² = 121k
  check("FA sell at age 32: proceeds = appreciated value (~121k)",
    near(sellRow.assetSaleProceeds, 121_000, 1e-6));
  check("FA sell: assetsSold includes name", sellRow.assetsSold.includes("House"));
  check("FA sell: cash account got the deposit", near(sellRow.accounts[0].balance, 121_000, 1e-6));

  // Override sell price
  const override = simulate({
    startAge: 30, endAge: 31,
    accounts: [{ id: "cash", name: "Cash", balance: 0, rate: 0, drainOrder: 0, isCash: true }],
    expenses: [], liabilities: [],
    fixedAssets: [{ id: "h", name: "House", currentValue: 100_000, appreciation: 0.10, sellAge: 31, sellPriceOverride: 200_000 }],
    phases: [{ id: "y0", name: "Y0", startAge: 30, endAge: 30, monthlyIncome: 0 },
             { id: "p", name: "p", startAge: 31, endAge: 31, monthlyIncome: 0, surplusAccountId: "cash" }],
    topUpEarnsSameYearInterest: true, liabilityEndInclusive: true,
  });
  check("FA sellPriceOverride takes precedence",
    near(override.rows[1].assetSaleProceeds, 200_000));

  // Linked liability stops at sell, and netProceeds = sale − remaining payments
  const linked = simulate({
    startAge: 30, endAge: 35,
    accounts: [{ id: "cash", name: "Cash", balance: 0, rate: 0, drainOrder: 0, isCash: true }],
    expenses: [],
    liabilities: [{ id: "loan", name: "Loan", monthly: 1000, inflation: 0, endAge: 34 }],
    fixedAssets: [{
      id: "h", name: "House", currentValue: 200_000, appreciation: 0,
      linkedLiabilityId: "loan", sellAge: 32,
    }],
    phases: [{ id: "y0", name: "Y0", startAge: 30, endAge: 30, monthlyIncome: 0 },
             { id: "p", name: "p", startAge: 31, endAge: 35, monthlyIncome: 0, surplusAccountId: "cash" }],
    topUpEarnsSameYearInterest: true, liabilityEndInclusive: true,
  });
  // At age 32, remaining payments (years 32, 33, 34 inclusive) = 3 × 12,000 = 36,000
  // Net proceeds = 200,000 − 36,000 = 164,000
  const linkedSell = linked.rows.find((r) => r.age === 32)!;
  check("FA linked: net proceeds = price − remaining payments (164k)",
    near(linkedSell.assetSaleProceeds, 164_000));
  // Liability total at age 32 = 0 (loan ended due to sale)
  check("FA linked: liabilityTotal == 0 in year of sale", linkedSell.liabilityTotal === 0);
  // Subsequent years: liability is also 0
  check("FA linked: liabilityTotal == 0 at age 33",
    linked.rows.find((r) => r.age === 33)!.liabilityTotal === 0);

  // Loan > value → no negative cash
  const underwater = simulate({
    startAge: 30, endAge: 35,
    accounts: [{ id: "cash", name: "Cash", balance: 0, rate: 0, drainOrder: 0, isCash: true }],
    expenses: [],
    liabilities: [{ id: "loan", name: "Loan", monthly: 10_000, inflation: 0, endAge: 34 }],
    fixedAssets: [{
      id: "h", name: "House", currentValue: 50_000, appreciation: 0,
      linkedLiabilityId: "loan", sellAge: 31,
    }],
    phases: [{ id: "y0", name: "Y0", startAge: 30, endAge: 30, monthlyIncome: 0 },
             { id: "p", name: "p", startAge: 31, endAge: 35, monthlyIncome: 0, surplusAccountId: "cash" }],
    topUpEarnsSameYearInterest: true, liabilityEndInclusive: true,
  });
  // remaining = 4 × 120,000 = 480,000; sale = 50,000 → underwater
  check("FA underwater: proceeds clamped to 0 (no negative cash)",
    underwater.rows[1].assetSaleProceeds === 0);
  check("FA underwater: liability still stops (no further payments)",
    underwater.rows.find((r) => r.age === 32)!.liabilityTotal === 0);
}

console.log("\n— Total integrity invariants across all rows —");
{
  // Construct a varied scenario and check identities
  const r = simulate({
    startAge: 30, endAge: 40,
    accounts: [
      { id: "cash", name: "Cash", balance: 1000, rate: 0, drainOrder: 0, isCash: true },
      { id: "stk", name: "Stk", balance: 5000, rate: 0.04, drainOrder: 1 },
      { id: "epf", name: "EPF", balance: 10000, rate: 0.06, drainOrder: 2, maxYearlyTopUp: 5000 },
    ],
    expenses: [
      { id: "f", name: "Food", monthly: 500, inflation: 0.05, monthlyCap: 1500 },
      { id: "o", name: "Other", monthly: 300, inflation: 0 },
    ],
    liabilities: [{ id: "h", name: "House", monthly: 800, inflation: 0, endAge: 38 }],
    phases: [
      { id: "y0", name: "Y0", startAge: 30, endAge: 30, monthlyIncome: 0 },
      { id: "work", name: "Work", startAge: 31, endAge: 35, monthlyIncome: 4000,
        incomeInflation: 0.03, surplusAccountId: "epf" },
      { id: "ret", name: "Ret", startAge: 36, endAge: 40, monthlyIncome: 0,
        transfers: [{ fromId: "stk", toId: "epf", amount: 500 }],
      },
    ],
    topUpEarnsSameYearInterest: true, liabilityEndInclusive: true,
  });
  for (const row of r.rows) {
    const sumBal = row.accounts.reduce((s, a) => s + a.balance, 0);
    check(`Age ${row.age}: Σ balances == totalAssets`, near(sumBal, row.totalAssets, 1e-6));
    const sumPrin = row.accounts.reduce((s, a) => s + a.principal, 0);
    check(`Age ${row.age}: Σ principal == totalPrincipal`, near(sumPrin, row.totalPrincipal, 1e-6));
    check(`Age ${row.age}: principal + interest == total`,
      near(row.totalPrincipal + row.totalInterest, row.totalAssets, 1e-6));
    for (const a of row.accounts) {
      check(`Age ${row.age} ${a.id}: principal <= balance`, a.principal <= a.balance + 1e-6);
    }
    check(`Age ${row.age}: drained + shortfall == outflow`,
      near(row.portfolioDrained + row.shortfall, row.portfolioOutflow, 1e-6));
  }
}

console.log("\n== Behavior tests summary ==");
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} behavior tests failed`);
