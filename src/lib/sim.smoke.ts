// Smoke / regression tests. Run with: npx tsx src/lib/sim.smoke.ts
// Asserts invariants that must hold regardless of preset tuning.
import {
  simulate, malaysiaPreset, conservativePreset,
  leanFirePreset, noTopUpPreset,
  type SimInput,
} from "./sim";

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

console.log("\n== Aggressive preset ==");
{
  const input = malaysiaPreset();
  const result = simulate(input);
  const y0 = result.rows[0];
  const startTotal = input.accounts.reduce((s, a) => s + a.balance, 0);
  check("Year 0 total = sum of starting balances", y0.totalAssets === startTotal);
  check("Year 0 portfolio outflow is 0 (snapshot)", y0.portfolioOutflow === 0);
  check("Year 0 has no surplus saved", y0.surplusSaved === 0);

  // Identity: every year, Personal + Liability − Income == max(0, drain + shortfall)
  // (And surplus = max(0, income - need))
  for (const r of result.rows.slice(1)) {
    const need = r.expenseTotal + r.liabilityTotal;
    const expectedOutflow = Math.max(0, need - r.income);
    check(
      `Age ${r.age}: outflow == max(0, need - income)`,
      near(r.portfolioOutflow, expectedOutflow),
      `got ${r.portfolioOutflow.toFixed(2)}, expected ${expectedOutflow.toFixed(2)}`
    );
    check(
      `Age ${r.age}: drained + shortfall == outflow`,
      near(r.portfolioDrained + r.shortfall, r.portfolioOutflow)
    );
    const expectedSurplus = Math.max(0, r.income - need);
    check(
      `Age ${r.age}: surplus == max(0, income - need)`,
      near(r.surplus, expectedSurplus)
    );
  }

  // EPF cap enforcement: in accumulation, EPF top-up via cascade must be ≤ 100k
  for (const r of result.rows) {
    const epf = r.accounts.find((a) => a.id === "epf");
    if (!epf || r.yearIndex === 0) continue;
    // Year-over-year EPF growth in accumulation should not exceed cap + interest
    // Hard to verify directly without internal state; just check surplusSaved <= cascade cap (cap + other accounts' free space + cash)
    check(`Age ${r.age}: surplusSaved <= surplus (cascade can't deposit more than available)`, r.surplusSaved <= r.surplus + 0.01);
  }

  // Accumulation: at RM15k/mo, surplus must save into EPF (preferred) up to cap
  const acc36 = result.rows.find((r) => r.age === 36)!;
  check(
    "Accumulation surplus saved is positive (RM15k/mo > expenses)",
    acc36.surplus > 0 && acc36.surplusSaved > 0
  );

  // Solvency: with RM15k income + arbitrage, must survive past 70
  check(
    "Aggressive preset solvent past age 70",
    !result.runsOutAtAge || result.runsOutAtAge > 70,
    `runs out at ${result.runsOutAtAge ?? "never"}`
  );

  console.log(`Aggressive: peak ${result.peakAssets.toFixed(0)} @ ${result.peakAge}, runs out: ${result.runsOutAtAge ?? "never"}`);
}

console.log("\n== Conservative (No-Transfer) preset ==");
{
  const input = conservativePreset();
  const result = simulate(input);

  // Phases must NOT contain transfers
  const totalTransferAmts = input.phases.flatMap((p) => p.transfers ?? []).length;
  check("Conservative preset has zero transfers", totalTransferAmts === 0);

  // Drain order observed: stocks first → ASM → EPF
  const stkEmpty = result.rows.findIndex((r) => r.yearIndex > 0 && (r.accounts.find((a) => a.id === "stk")?.balance ?? 0) === 0);
  const asmEmpty = result.rows.findIndex((r) => r.yearIndex > 0 && (r.accounts.find((a) => a.id === "asm")?.balance ?? 0) === 0);
  const epfEmpty = result.rows.findIndex((r) => r.yearIndex > 0 && (r.accounts.find((a) => a.id === "epf")?.balance ?? 0) === 0);
  check(
    "Stocks empties before ASM (or both never empty)",
    stkEmpty === -1 || asmEmpty === -1 || stkEmpty <= asmEmpty
  );
  check(
    "ASM empties before EPF (or both never empty)",
    asmEmpty === -1 || epfEmpty === -1 || asmEmpty <= epfEmpty
  );

  console.log(`Conservative: peak ${result.peakAssets.toFixed(0)} @ ${result.peakAge}, runs out: ${result.runsOutAtAge ?? "never"}`);
}

console.log("\n== Cascade overflow → auto-Cash ==");
{
  // Construct a scenario where surplus exceeds EPF cap. Only EPF (capped) and nothing else.
  const input: SimInput = {
    startAge: 30,
    endAge: 32,
    accounts: [
      { id: "epf", name: "EPF", balance: 0, rate: 0.06, drainOrder: 1, maxYearlyTopUp: 100_000 },
    ],
    expenses: [],
    liabilities: [],
    phases: [
      { id: "y0", name: "Y0", startAge: 30, endAge: 30, monthlyIncome: 0 },
      {
        id: "high", name: "High income", startAge: 31, endAge: 32,
        monthlyIncome: 20_000, // 240k/yr surplus, EPF cap 100k → 140k overflow
        surplusAccountId: "epf",
      },
    ],
    topUpEarnsSameYearInterest: true,
    liabilityEndInclusive: true,
  };
  const result = simulate(input);
  const y2 = result.rows[1]; // age 31
  const cashAcct = y2.accounts.find((a) => a.id === "cash-auto");
  check("Cash account auto-created on overflow", !!cashAcct);
  check(
    "Cash absorbed the overflow (240k income, 100k cap → 140k to cash)",
    cashAcct ? near(cashAcct.balance, 140_000) : false
  );
  const epfAcct = y2.accounts.find((a) => a.id === "epf")!;
  // EPF: 100k deposited + 0 interest (started at 0, interest credited before deposit)
  check("EPF capped at 100k for year 1", near(epfAcct.balance, 100_000));
}

console.log("\n== Cascade: preferred → next-highest-rate ==");
{
  // Three accounts, EPF capped lower than surplus. Overflow should go to ASM (next highest rate), not Cash.
  const input: SimInput = {
    startAge: 30,
    endAge: 31,
    accounts: [
      { id: "stk", name: "Stocks", balance: 0, rate: 0.04, drainOrder: 1 },
      { id: "asm", name: "ASM", balance: 0, rate: 0.05, drainOrder: 2 },
      { id: "epf", name: "EPF", balance: 0, rate: 0.06, drainOrder: 3, maxYearlyTopUp: 100_000 },
    ],
    expenses: [],
    liabilities: [],
    phases: [
      { id: "y0", name: "Y0", startAge: 30, endAge: 30, monthlyIncome: 0 },
      {
        id: "high", name: "High income", startAge: 31, endAge: 31,
        monthlyIncome: 12_500, // 150k/yr surplus
        surplusAccountId: "epf",
      },
    ],
    topUpEarnsSameYearInterest: true,
    liabilityEndInclusive: true,
  };
  const result = simulate(input);
  const r = result.rows[1];
  const get = (id: string) => r.accounts.find((a) => a.id === id)!;
  // 150k surplus → EPF gets 100k (cap), overflow 50k → ASM (next-highest rate 5%) gets 50k. Stocks unchanged.
  check("EPF filled to cap", near(get("epf").balance, 100_000));
  check("ASM got overflow (50k)", near(get("asm").balance, 50_000));
  check("Stocks (lowest rate) untouched", near(get("stk").balance, 0));
  check("No Cash account needed", !r.accounts.find((a) => a.id === "cash-auto"));
}

console.log("\n== Lean FIRE preset ==");
{
  const input = leanFirePreset();
  const result = simulate(input);
  // Phase change: should fully retire at 36 (sprint ends 35)
  const sprintEnd = input.phases.find((p) => p.id === "sprint")!.endAge;
  check("FIRE sprint ends at age 35", sprintEnd === 35);
  // Food cap is tighter
  const foodAt80 = result.rows[result.rows.length - 1].expenseBreakdown.find((e) => e.id === "food")!;
  check("Lean food spend is capped at <= RM2000/mo (24k/yr)", foodAt80.yearly <= 24_000 + 1);
  console.log(`Lean FIRE: peak ${result.peakAssets.toFixed(0)} @ ${result.peakAge}, runs out: ${result.runsOutAtAge ?? "never"}`);
}

console.log("\n== No Top-Up preset ==");
{
  const input = noTopUpPreset();
  const result = simulate(input);
  // All phases must have zero income
  const anyIncome = input.phases.some((p) => p.monthlyIncome > 0);
  check("All phases have zero income", !anyIncome);
  // No surplus saved anywhere
  const totalSurplusSaved = result.rows.reduce((s, r) => s + r.surplusSaved, 0);
  check("Zero total surplus saved", totalSurplusSaved === 0);
  console.log(`No Top-Up: peak ${result.peakAssets.toFixed(0)} @ ${result.peakAge}, runs out: ${result.runsOutAtAge ?? "never"}`);
}

console.log("\n== Summary ==");
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error(`${failed} smoke check(s) failed`);
