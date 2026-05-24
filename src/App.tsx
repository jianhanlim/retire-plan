import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { simulate, malaysiaPreset, type SimInput, type Account, type ExpenseItem, type Liability, type Phase } from "./lib/sim";
import { exportToXlsx } from "./lib/exportXlsx";
import "./App.css";

const fmtRM = (n: number) =>
  "RM" + Math.round(n).toLocaleString("en-MY");

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export default function App() {
  const [input, setInput] = useState<SimInput>(() => malaysiaPreset());
  const result = useMemo(() => simulate(input), [input]);

  const milestones = [
    input.startAge,
    input.startAge + 5,
    input.startAge + 10,
    45,
    50,
    55,
    60,
    65,
    70,
    75,
    input.endAge,
  ].filter((v, i, a) => a.indexOf(v) === i && v >= input.startAge && v <= input.endAge);

  const chartData = result.rows.map((r) => {
    const row: Record<string, number | string> = {
      age: r.age,
      total: Math.round(r.totalAssets),
    };
    for (const a of r.accounts) {
      row[a.id] = Math.round(a.balance);
    }
    return row;
  });

  function updateAccount(id: string, patch: Partial<Account>) {
    setInput((s) => ({
      ...s,
      accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
  }
  function addAccount() {
    setInput((s) => ({
      ...s,
      accounts: [
        ...s.accounts,
        { id: uid(), name: "New Account", balance: 0, rate: 0.04, drainOrder: s.accounts.length + 1 },
      ],
    }));
  }
  function removeAccount(id: string) {
    setInput((s) => ({ ...s, accounts: s.accounts.filter((a) => a.id !== id) }));
  }

  function updateExpense(id: string, patch: Partial<ExpenseItem>) {
    setInput((s) => ({
      ...s,
      expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
  }
  function addExpense() {
    setInput((s) => ({
      ...s,
      expenses: [
        ...s.expenses,
        { id: uid(), name: "New Expense", monthly: 0, inflation: 0.03 },
      ],
    }));
  }
  function removeExpense(id: string) {
    setInput((s) => ({ ...s, expenses: s.expenses.filter((e) => e.id !== id) }));
  }

  function updateLiability(id: string, patch: Partial<Liability>) {
    setInput((s) => ({
      ...s,
      liabilities: s.liabilities.map((L) => (L.id === id ? { ...L, ...patch } : L)),
    }));
  }
  function addLiability() {
    setInput((s) => ({
      ...s,
      liabilities: [
        ...s.liabilities,
        { id: uid(), name: "New Liability", monthly: 0, inflation: 0, endAge: 60 },
      ],
    }));
  }
  function removeLiability(id: string) {
    setInput((s) => ({ ...s, liabilities: s.liabilities.filter((L) => L.id !== id) }));
  }

  function updatePhase(id: string, patch: Partial<Phase>) {
    setInput((s) => ({
      ...s,
      phases: s.phases.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  }

  function resetPreset() {
    setInput(malaysiaPreset());
  }

  const colors = ["#2563eb", "#16a34a", "#dc2626", "#9333ea", "#ea580c", "#0891b2"];

  return (
    <div className="app">
      <header>
        <h1>retire-plan</h1>
        <p className="tagline">
          Year-by-year retirement simulator. Inputs never leave your browser.
        </p>
        <div className="actions">
          <button onClick={resetPreset}>Reset to Malaysia preset</button>
          <button onClick={() => exportToXlsx(input, result)}>Export XLSX</button>
        </div>
      </header>

      <section className="verdict">
        <div className="metric">
          <div className="label">Peak Wealth</div>
          <div className="value">{fmtRM(result.peakAssets)}</div>
          <div className="sub">at age {result.peakAge}</div>
        </div>
        <div className="metric">
          <div className="label">End of Plan ({input.endAge})</div>
          <div className="value">{fmtRM(result.rows[result.rows.length - 1].totalAssets)}</div>
        </div>
        <div className="metric">
          <div className="label">Outcome</div>
          <div className={`value ${result.runsOutAtAge ? "bad" : "good"}`}>
            {result.runsOutAtAge ? `Runs out @ ${result.runsOutAtAge}` : `Solvent through ${input.endAge}`}
          </div>
        </div>
      </section>

      <section className="chart-wrap">
        <h2>Asset trajectory</h2>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData} margin={{ top: 10, right: 30, left: 30, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="age" />
            <YAxis tickFormatter={(v) => `RM${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v) => fmtRM(Number(v))} />
            <Legend />
            <Line type="monotone" dataKey="total" name="Total Assets" stroke="#111" strokeWidth={2.5} dot={false} />
            {input.accounts.map((a, i) => (
              <Line
                key={a.id}
                type="monotone"
                dataKey={a.id}
                name={a.name}
                stroke={colors[i % colors.length]}
                strokeWidth={1.5}
                dot={false}
              />
            ))}
            {result.runsOutAtAge && (
              <ReferenceLine x={result.runsOutAtAge} stroke="#dc2626" strokeDasharray="3 3" label="Empty" />
            )}
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section className="grid">
        <div className="card">
          <h2>Accounts</h2>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Balance</th>
                <th>Rate %</th>
                <th>Drain</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {input.accounts.map((a) => (
                <tr key={a.id}>
                  <td><input value={a.name} onChange={(e) => updateAccount(a.id, { name: e.target.value })} /></td>
                  <td><input type="number" value={a.balance} onChange={(e) => updateAccount(a.id, { balance: +e.target.value })} /></td>
                  <td><input type="number" step="0.01" value={(a.rate * 100).toFixed(2)} onChange={(e) => updateAccount(a.id, { rate: +e.target.value / 100 })} /></td>
                  <td><input type="number" value={a.drainOrder} onChange={(e) => updateAccount(a.id, { drainOrder: +e.target.value })} /></td>
                  <td><button onClick={() => removeAccount(a.id)}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={addAccount}>+ Add account</button>
        </div>

        <div className="card">
          <h2>Expenses (monthly)</h2>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Monthly</th>
                <th>Infl %</th>
                <th>Cap</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {input.expenses.map((e) => (
                <tr key={e.id}>
                  <td><input value={e.name} onChange={(ev) => updateExpense(e.id, { name: ev.target.value })} /></td>
                  <td><input type="number" value={e.monthly} onChange={(ev) => updateExpense(e.id, { monthly: +ev.target.value })} /></td>
                  <td><input type="number" step="0.1" value={(e.inflation * 100).toFixed(1)} onChange={(ev) => updateExpense(e.id, { inflation: +ev.target.value / 100 })} /></td>
                  <td><input type="number" value={e.monthlyCap ?? ""} onChange={(ev) => updateExpense(e.id, { monthlyCap: ev.target.value === "" ? undefined : +ev.target.value })} /></td>
                  <td><button onClick={() => removeExpense(e.id)}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={addExpense}>+ Add expense</button>
        </div>

        <div className="card">
          <h2>Liabilities</h2>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Monthly</th>
                <th>End Age</th>
                <th>Infl %</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {input.liabilities.map((L) => (
                <tr key={L.id}>
                  <td><input value={L.name} onChange={(e) => updateLiability(L.id, { name: e.target.value })} /></td>
                  <td><input type="number" value={L.monthly} onChange={(e) => updateLiability(L.id, { monthly: +e.target.value })} /></td>
                  <td><input type="number" value={L.endAge} onChange={(e) => updateLiability(L.id, { endAge: +e.target.value })} /></td>
                  <td><input type="number" step="0.1" value={(L.inflation * 100).toFixed(1)} onChange={(e) => updateLiability(L.id, { inflation: +e.target.value / 100 })} /></td>
                  <td><button onClick={() => removeLiability(L.id)}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={addLiability}>+ Add liability</button>
        </div>

        <div className="card">
          <h2>Phases</h2>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Start</th>
                <th>End</th>
                <th>Monthly Income</th>
                <th>Income Infl %</th>
                <th>Save Surplus To</th>
              </tr>
            </thead>
            <tbody>
              {input.phases.map((p) => (
                <tr key={p.id}>
                  <td><input value={p.name} onChange={(e) => updatePhase(p.id, { name: e.target.value })} /></td>
                  <td><input type="number" value={p.startAge} onChange={(e) => updatePhase(p.id, { startAge: +e.target.value })} /></td>
                  <td><input type="number" value={p.endAge} onChange={(e) => updatePhase(p.id, { endAge: +e.target.value })} /></td>
                  <td><input type="number" value={p.monthlyIncome} onChange={(e) => updatePhase(p.id, { monthlyIncome: +e.target.value })} /></td>
                  <td><input type="number" step="0.1" value={((p.incomeInflation ?? 0) * 100).toFixed(1)} onChange={(e) => updatePhase(p.id, { incomeInflation: +e.target.value / 100 })} /></td>
                  <td>
                    <select
                      value={p.surplusAccountId ?? ""}
                      onChange={(e) => updatePhase(p.id, { surplusAccountId: e.target.value || undefined })}
                    >
                      <option value="">— consumed —</option>
                      {input.accounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">
            <b>Monthly Income:</b> your take-home salary during this phase (× 12 = annual income).<br />
            <b>Income Infl:</b> annual raise rate (set 0 for flat).<br />
            <b>Save Surplus To:</b> if income exceeds expenses + liabilities, where to deposit the surplus.
            Pick <i>— consumed —</i> if surplus is spent on lifestyle (not saved).<br />
            <b>Top-ups & transfers</b> are kept from the preset and are independent of surplus.
          </p>
        </div>

        <div className="card">
          <h2>Assumption toggles</h2>
          <label>
            <input
              type="checkbox"
              checked={input.topUpEarnsSameYearInterest}
              onChange={(e) =>
                setInput((s) => ({ ...s, topUpEarnsSameYearInterest: e.target.checked }))
              }
            />
            Top-ups earn interest in the year they're deposited
          </label>
          <label>
            <input
              type="checkbox"
              checked={input.liabilityEndInclusive}
              onChange={(e) =>
                setInput((s) => ({ ...s, liabilityEndInclusive: e.target.checked }))
              }
            />
            Pay liability through its end age inclusive
          </label>
          <p className="hint">
            Both options together shift the "money runs out" age by several years. There's no single "right" answer — bracket the range.
          </p>
        </div>

        <div className="card">
          <h2>Time horizon</h2>
          <label>
            Start age <input type="number" value={input.startAge} onChange={(e) => setInput((s) => ({ ...s, startAge: +e.target.value }))} />
          </label>
          <label>
            End age <input type="number" value={input.endAge} onChange={(e) => setInput((s) => ({ ...s, endAge: +e.target.value }))} />
          </label>
        </div>
      </section>

      <section className="card">
        <h2>Milestone snapshot</h2>
        <div className="scroll-x">
          <table className="snapshot">
            <thead>
              <tr>
                <th>Age</th>
                <th>Phase</th>
                <th>Total</th>
                {input.accounts.map((a) => (
                  <th key={a.id}>{a.name}</th>
                ))}
                <th>Income</th>
                <th>Personal</th>
                <th>Liability</th>
                <th>Total Spend</th>
                <th>Portfolio Drain</th>
              </tr>
            </thead>
            <tbody>
              {result.rows
                .filter((r) => milestones.includes(r.age))
                .map((r) => (
                  <tr key={r.age} className={r.shortfall > 0 ? "shortfall" : ""}>
                    <td>{r.age}</td>
                    <td>{r.phaseName}</td>
                    <td><b>{fmtRM(r.totalAssets)}</b></td>
                    {r.accounts.map((a) => (
                      <td key={a.id}>{fmtRM(a.balance)}</td>
                    ))}
                    <td>{fmtRM(r.income)}</td>
                    <td>{fmtRM(r.expenseTotal)}</td>
                    <td>{fmtRM(r.liabilityTotal)}</td>
                    <td>{fmtRM(r.totalSpend)}</td>
                    <td>{fmtRM(r.portfolioOutflow)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card scope">
        <h2>What this tool does &amp; doesn't model</h2>
        <div className="scope-grid">
          <div>
            <h3>✓ Handles</h3>
            <ul>
              <li>Multiple accounts with different return rates &amp; drain order</li>
              <li>Expense buckets with per-line inflation &amp; monthly caps</li>
              <li>Liabilities with fixed end-age (mortgage, loans)</li>
              <li>Life phases with income behavior</li>
              <li>Top-ups &amp; inter-account transfers</li>
              <li>Principal vs interest tracking</li>
            </ul>
          </div>
          <div>
            <h3>✗ Does not handle</h3>
            <ul>
              <li>Migrating to another country in retirement (currency, tax, cost-of-living change)</li>
              <li>Stochastic returns / market crashes (returns are constant)</li>
              <li>Tax (income, capital gains, withholding)</li>
              <li>One-off events: lump-sum inheritance, mortgage early settlement, weddings, kids' tuition</li>
              <li>Variable / part-time income within a phase</li>
              <li>Rental or passive income streams</li>
              <li>Property appreciation, sale, downsizing</li>
              <li>Spouse / dependent finances (single portfolio only)</li>
              <li>Account-specific rules: EPF Acc 1/2/3, age-55 unlock, RMDs, CPF quirks</li>
              <li>Pension / annuity income</li>
              <li>Healthcare shocks beyond inflated premiums</li>
              <li>Monthly compounding (annual only)</li>
            </ul>
          </div>
        </div>
        <p className="hint">
          Treat the verdict as a baseline. Add a buffer for what isn't modeled.
        </p>
      </section>

      <footer>
        <p className="byline">
          Built by <b>Dr. Lim, PhD</b> — AI / Data Science
        </p>
        <p>
          Open source on <a href="https://github.com/jianhanlim/retire-plan">GitHub</a> ·
          All calculations are local; nothing is sent to a server.
        </p>
      </footer>
    </div>
  );
}
