import * as XLSX from "xlsx";
import type { SimInput, SimResult } from "./sim";

export function exportToXlsx(input: SimInput, result: SimResult, filename = "retire-plan.xlsx") {
  const acctIds = input.accounts.map((a) => a.id);
  const acctNames = Object.fromEntries(input.accounts.map((a) => [a.id, a.name]));

  // Simulation sheet
  const simHeaders = [
    "Age",
    "Year",
    "Phase",
    ...acctIds.map((id) => `${acctNames[id]} Balance`),
    "Total Assets",
    ...acctIds.map((id) => `${acctNames[id]} Principal`),
    "Total Principal",
    "Total Interest",
    "Interest Earned (yr)",
    "Income (yr)",
    "Surplus",
    "Surplus Saved",
    "Top-Ups",
    "Transfers",
    "Personal Expenses (yr)",
    "Liabilities (yr)",
    "Total Spend (yr)",
    "Portfolio Outflow",
    "Shortfall",
  ];
  const simRows = result.rows.map((r) => {
    const balByAcct = Object.fromEntries(r.accounts.map((a) => [a.id, a.balance]));
    const prinByAcct = Object.fromEntries(r.accounts.map((a) => [a.id, a.principal]));
    return [
      r.age,
      r.yearIndex,
      r.phaseName,
      ...acctIds.map((id) => Math.round(balByAcct[id] ?? 0)),
      Math.round(r.totalAssets),
      ...acctIds.map((id) => Math.round(prinByAcct[id] ?? 0)),
      Math.round(r.totalPrincipal),
      Math.round(r.totalInterest),
      Math.round(r.interestEarned),
      Math.round(r.income),
      Math.round(r.surplus),
      Math.round(r.surplusSaved),
      Math.round(r.topUps),
      Math.round(r.transfers),
      Math.round(r.expenseTotal),
      Math.round(r.liabilityTotal),
      Math.round(r.totalSpend),
      Math.round(r.portfolioOutflow),
      Math.round(r.shortfall),
    ];
  });

  // Expense breakdown sheet
  const expHeaders = ["Age", ...input.expenses.map((e) => e.name), "Total"];
  const expRows = result.rows.map((r) => {
    const total = r.expenseBreakdown.reduce((s, x) => s + x.yearly, 0);
    return [r.age, ...r.expenseBreakdown.map((x) => Math.round(x.yearly)), Math.round(total)];
  });

  // Assumptions
  const assumptions = [
    ["Parameter", "Value"],
    ["Start Age", input.startAge],
    ["End Age", input.endAge],
    ["Top-up earns same-year interest", input.topUpEarnsSameYearInterest ? "Yes" : "No"],
    ["Liability end inclusive", input.liabilityEndInclusive ? "Yes" : "No"],
    [],
    ["Accounts", "Balance", "Rate", "Drain Order"],
    ...input.accounts.map((a) => [a.name, a.balance, a.rate, a.drainOrder]),
    [],
    ["Expenses", "Monthly", "Inflation", "Monthly Cap"],
    ...input.expenses.map((e) => [e.name, e.monthly, e.inflation, e.monthlyCap ?? ""]),
    [],
    ["Liabilities", "Monthly", "End Age", "Inflation"],
    ...input.liabilities.map((L) => [L.name, L.monthly, L.endAge, L.inflation]),
    [],
    ["Phases", "Start", "End", "Monthly Income", "Income Infl", "Surplus → Account"],
    ...input.phases.map((p) => [p.name, p.startAge, p.endAge, p.monthlyIncome, p.incomeInflation ?? 0, p.surplusAccountId ?? "—"]),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([simHeaders, ...simRows]),
    "Simulation"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([expHeaders, ...expRows]),
    "Expenses"
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(assumptions), "Assumptions");

  XLSX.writeFile(wb, filename);
}
