import { useEffect, useMemo, useState } from "react";
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
import {
  autosave,
  decodeScenarioFromHash,
  deleteScenario,
  getShareableUrl,
  listSavedScenarios,
  loadAutosave,
  loadScenario,
  saveScenario,
  scenarioExists,
} from "./lib/storage";
import "./App.css";

const makeFmt = (privacy: boolean) => (n: number) =>
  privacy ? "RM•••" : "RM" + Math.round(n).toLocaleString("en-MY");

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export default function App() {
  const [input, setInput] = useState<SimInput>(() => {
    // Priority: shared URL → autosave → preset
    if (typeof window !== "undefined" && window.location.hash) {
      const fromHash = decodeScenarioFromHash(window.location.hash);
      if (fromHash) return fromHash;
    }
    const auto = loadAutosave();
    if (auto) return auto;
    return malaysiaPreset();
  });
  const [privacy, setPrivacy] = useState(false);
  const [savedNames, setSavedNames] = useState<string[]>(() => listSavedScenarios());
  const fmtRM = useMemo(() => makeFmt(privacy), [privacy]);
  const result = useMemo(() => simulate(input), [input]);

  // Clear URL hash only if it decoded successfully (preserve broken hash so user sees the issue)
  useEffect(() => {
    if (window.location.hash && decodeScenarioFromHash(window.location.hash)) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  // Autosave working state on every change (debounced via React batching)
  useEffect(() => {
    const id = setTimeout(() => autosave(input), 250);
    return () => clearTimeout(id);
  }, [input]);

  // Milestones = start/end of every phase + plan start + plan end + runs-out year
  const milestones = useMemo(() => {
    const set = new Set<number>();
    set.add(input.startAge);
    set.add(input.endAge);
    for (const p of input.phases) {
      set.add(p.startAge);
      set.add(p.endAge);
    }
    if (result.runsOutAtAge) set.add(result.runsOutAtAge);
    return [...set]
      .filter((v) => v >= input.startAge && v <= input.endAge)
      .sort((a, b) => a - b);
  }, [input.startAge, input.endAge, input.phases, result.runsOutAtAge]);

  const chartData = useMemo(
    () =>
      result.rows.map((r) => {
        const row: Record<string, number | string> = {
          age: r.age,
          total: Math.round(r.totalAssets),
        };
        for (const a of r.accounts) {
          row[a.id] = Math.round(a.balance);
        }
        return row;
      }),
    [result.rows]
  );
  const lastRow = result.rows[result.rows.length - 1];

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
  async function copyShareLink() {
    const url = getShareableUrl(input);
    try {
      await navigator.clipboard.writeText(url);
      alert("Share link copied to clipboard.\n\nAnyone with this link will see your scenario (computed locally in their browser).");
    } catch {
      prompt("Copy this link:", url);
    }
  }
  function handleSave() {
    const name = prompt("Save scenario as:")?.trim();
    if (!name) return;
    if (scenarioExists(name) && !confirm(`"${name}" already exists. Overwrite?`)) return;
    const res = saveScenario(name, input);
    if (!res.ok) {
      alert(`Could not save: ${res.error}\n\n(Browser storage may be full or disabled.)`);
      return;
    }
    setSavedNames(listSavedScenarios());
  }
  function handleLoad(name: string) {
    const s = loadScenario(name);
    if (s) setInput(s);
  }
  function handleDelete(name: string) {
    if (!confirm(`Delete scenario "${name}"?`)) return;
    deleteScenario(name);
    setSavedNames(listSavedScenarios());
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
          <button onClick={resetPreset}>Reset to preset</button>
          <button onClick={() => exportToXlsx(input, result)}>Export XLSX</button>
          <button onClick={copyShareLink}>Copy share link</button>
          <button onClick={handleSave}>Save scenario</button>
          <button onClick={() => setPrivacy((p) => !p)}>
            {privacy ? "🔓 Show numbers" : "🔒 Hide numbers"}
          </button>
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
          <div className="value">{lastRow ? fmtRM(lastRow.totalAssets) : "—"}</div>
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
            <YAxis hide={privacy} tickFormatter={(v) => `RM${(v / 1000).toFixed(0)}k`} />
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
          <p className="hint">
            <b>Drain order:</b> when the portfolio has to pay (income shortfall), accounts are emptied in
            ascending Drain number — <b>1 first, then 2, then 3</b>. The preset drains Stocks (4%) before
            ASM (5%) before EPF (6%), so the highest-compounding account is preserved longest. This is
            the standard "lowest-return-first" withdrawal strategy.
          </p>
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
              {input.phases.map((p) => {
                const acctName = (id: string) =>
                  input.accounts.find((a) => a.id === id)?.name ?? id;
                return (
                  <tr key={p.id}>
                    <td>
                      <input value={p.name} onChange={(e) => updatePhase(p.id, { name: e.target.value })} />
                      {(p.topUps?.length || p.transfers?.length) ? (
                        <div className="phase-strategy">
                          {p.topUps?.map((t, i) => (
                            <span key={`t${i}`} className="badge topup" title="Annual top-up (e.g. EPF self-contribution)">
                              +{fmtRM(t.amount)} → {acctName(t.accountId)}
                            </span>
                          ))}
                          {p.transfers?.map((t, i) => (
                            <span key={`x${i}`} className="badge transfer" title="Annual transfer (interest-rate arbitrage)">
                              {acctName(t.fromId)} → {acctName(t.toId)} {fmtRM(t.amount)}/yr
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </td>
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
                );
              })}
            </tbody>
          </table>
          <p className="hint">
            <b>Monthly Income:</b> your take-home salary during this phase (× 12 = annual income).<br />
            <b>Income Infl:</b> annual raise rate (set 0 for flat).<br />
            <b>Save Surplus To:</b> if income exceeds expenses + liabilities, where to deposit the surplus.
            Pick <i>— consumed —</i> if surplus is spent on lifestyle (not saved).
          </p>
          <p className="hint">
            <b className="badge topup">+ Top-up</b> = annual deposit from outside the portfolio
            (e.g. EPF self-contribution from your salary). Independent of income/surplus.<br />
            <b className="badge transfer">→ Transfer</b> = move money <i>between</i> your accounts each year.
            The preset shifts <b>RM50k/yr from ASM (5%) to EPF (6%)</b> during semi/full retirement —
            this is <b>interest-rate arbitrage</b>: same money, higher yield, compounds for decades.
            (Editing top-ups/transfers requires JSON for now — coming next.)
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
          <h2>Saved scenarios</h2>
          {savedNames.length === 0 ? (
            <p className="hint">
              No saved scenarios yet. Use <b>Save scenario</b> above to store the current setup.
              Scenarios live in your browser only — they're never uploaded.
            </p>
          ) : (
            <ul className="saved-list">
              {savedNames.map((n) => (
                <li key={n}>
                  <span>{n}</span>
                  <span>
                    <button onClick={() => handleLoad(n)}>Load</button>
                    <button onClick={() => handleDelete(n)}>Delete</button>
                  </span>
                </li>
              ))}
            </ul>
          )}
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
                <th className="num">Total</th>
                {input.accounts.map((a) => (
                  <th key={a.id} className="num">{a.name}</th>
                ))}
                <th className="num">Income (yr)</th>
                <th className="num">Personal (yr)</th>
                <th className="num">Liability (yr)</th>
                <th className="num">Total Spend (yr)</th>
                <th className="num">Drained (yr)</th>
              </tr>
            </thead>
            <tbody>
              {result.rows
                .filter((r) => milestones.includes(r.age))
                .map((r) => {
                  const isYear0 = r.yearIndex === 0;
                  return (
                    <tr key={r.age} className={r.shortfall > 0 ? "shortfall" : ""}>
                      <td>{r.age}</td>
                      <td>{r.phaseName}</td>
                      <td className="num"><b>{fmtRM(r.totalAssets)}</b></td>
                      {r.accounts.map((a) => (
                        <td key={a.id} className="num">{fmtRM(a.balance)}</td>
                      ))}
                      <td className="num">{isYear0 ? "—" : fmtRM(r.income)}</td>
                      <td className="num">{isYear0 ? "—" : fmtRM(r.expenseTotal)}</td>
                      <td className="num">{isYear0 ? "—" : fmtRM(r.liabilityTotal)}</td>
                      <td className="num">{isYear0 ? "—" : fmtRM(r.totalSpend)}</td>
                      <td className="num">
                        {isYear0 ? "—" : fmtRM(r.portfolioDrained)}
                        {r.shortfall > 0 && (
                          <span className="shortfall-tag" title={`Shortfall ${fmtRM(r.shortfall)} — portfolio empty`}>
                            ⚠
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
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
              <li>Life phases with monthly income &amp; optional income inflation (raises)</li>
              <li>Surplus auto-savings: income above expenses can flow into any account</li>
              <li>Annual top-ups (e.g. EPF self-contribution) &amp; inter-account transfers (arbitrage)</li>
              <li>Principal vs interest tracking — see when you start eating into capital</li>
              <li>Assumption toggles for the two ambiguous modeling choices</li>
              <li>XLSX export of the full year-by-year simulation</li>
              <li>Save scenarios in your browser, share via URL (hash fragment, never sent to a server), privacy mode for screenshots</li>
              <li>Auto-save: your edits survive a page refresh</li>
            </ul>
          </div>
          <div>
            <h3>✗ Does not handle</h3>
            <ul>
              <li>Migrating to another country in retirement (currency, tax, cost-of-living change)</li>
              <li>Stochastic returns / market crashes / sequence-of-returns risk (returns are constant)</li>
              <li>Tax (income tax, capital gains, withholding, tax-deferred accounts)</li>
              <li>One-off events: lump-sum inheritance, mortgage early settlement, weddings, kids' tuition</li>
              <li>Income that varies <i>within</i> a phase (mid-phase raises, bonuses, sabbaticals) — phase income is flat or inflates at a fixed rate</li>
              <li>Rental, dividend, or pension/annuity income streams (workaround: model as a phase with that income)</li>
              <li>Property appreciation, sale, downsizing (house is a liability only)</li>
              <li>Spouse / dependent finances (single portfolio only)</li>
              <li>Account-specific rules: EPF Acc 1/2/3 split, age-55 unlock, RM1.3M withdrawal threshold, RMDs, CPF quirks</li>
              <li>Account access locks (all accounts are fully liquid in the sim)</li>
              <li>Top-up caps (e.g. EPF self-contribution capped at RM100k/yr — you can enter any amount)</li>
              <li>Healthcare shocks beyond inflated premiums</li>
              <li>Monthly compounding (annual only)</li>
              <li>Goal-seeking ("when can I retire?") and Monte Carlo sensitivity</li>
              <li>Scenario comparison side-by-side</li>
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
