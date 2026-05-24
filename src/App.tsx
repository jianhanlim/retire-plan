import { Fragment, useEffect, useMemo, useState } from "react";
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
import {
  PROFILES,
  PROFILE_DESCRIPTIONS,
  STRATEGIES,
  STRATEGY_DESCRIPTIONS,
  combine,
  simulate,
  malaysiaPreset,
  type Account,
  type ExpenseItem,
  type FixedAsset,
  type Liability,
  type Phase,
  type ProfileKey,
  type StrategyKey,
  type SimInput,
} from "./lib/sim";
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
import { Welcome, shouldAutoShowWelcome } from "./Welcome";
import { useT, LANG_NAMES, type Lang } from "./lib/i18n";
import "./App.css";

const makeFmt = (privacy: boolean) => (n: number) =>
  privacy ? "RM•••" : "RM" + Math.round(n).toLocaleString("en-MY");

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export default function App() {
  const { t, lang, setLang } = useT();
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
  const [welcomeOpen, setWelcomeOpen] = useState<boolean>(() => shouldAutoShowWelcome());
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

  function updateFixedAsset(id: string, patch: Partial<FixedAsset>) {
    setInput((s) => ({
      ...s,
      fixedAssets: (s.fixedAssets ?? []).map((fa) => (fa.id === id ? { ...fa, ...patch } : fa)),
    }));
  }
  function addFixedAsset() {
    setInput((s) => ({
      ...s,
      fixedAssets: [
        ...(s.fixedAssets ?? []),
        { id: uid(), name: "New Asset", currentValue: 0, appreciation: 0.03 },
      ],
    }));
  }
  function removeFixedAsset(id: string) {
    setInput((s) => ({ ...s, fixedAssets: (s.fixedAssets ?? []).filter((fa) => fa.id !== id) }));
  }

  function updatePhase(id: string, patch: Partial<Phase>) {
    setInput((s) => ({
      ...s,
      phases: s.phases.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  }
  // Update a phase's endAge AND cascade the change to the next phase's startAge,
  // keeping all phases contiguous (next.start = this.end + 1).
  function updatePhaseEndAge(id: string, newEnd: number) {
    setInput((s) => {
      const sortedIdx = [...s.phases].sort((a, b) => a.startAge - b.startAge);
      const idxInSorted = sortedIdx.findIndex((p) => p.id === id);
      if (idxInSorted < 0) return s;
      // Compute new boundaries from the edited phase forward
      const updates: Record<string, { startAge?: number; endAge?: number }> = {};
      // Constrain: newEnd must be >= this phase's start age
      const thisPhase = sortedIdx[idxInSorted];
      const safeNewEnd = Math.max(thisPhase.startAge, newEnd);
      updates[id] = { endAge: safeNewEnd };
      let cursor = safeNewEnd + 1;
      for (let i = idxInSorted + 1; i < sortedIdx.length; i++) {
        const p = sortedIdx[i];
        const duration = Math.max(0, p.endAge - p.startAge);
        const isLast = i === sortedIdx.length - 1;
        const newStart = cursor;
        const computedEnd = isLast ? s.endAge : newStart + duration;
        updates[p.id] = { startAge: newStart, endAge: Math.max(newStart, computedEnd) };
        cursor = updates[p.id].endAge! + 1;
      }
      return {
        ...s,
        phases: s.phases.map((p) => (updates[p.id] ? { ...p, ...updates[p.id] } : p)),
      };
    });
  }

  const [profileKey, setProfileKey] = useState<ProfileKey | "">("");
  const [strategyKey, setStrategyKey] = useState<StrategyKey>("aggressive");

  function resetPreset() {
    if (profileKey) setInput(combine(profileKey, strategyKey));
    else setInput(malaysiaPreset());
  }
  function applyProfile(k: ProfileKey) {
    setProfileKey(k);
    setInput(combine(k, strategyKey));
  }
  function applyStrategy(k: StrategyKey) {
    setStrategyKey(k);
    if (profileKey) setInput(combine(profileKey, k));
  }
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);
  const [showAllYears, setShowAllYears] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [openCards, setOpenCards] = useState<Set<string>>(new Set());
  const toggleCard = (id: string) =>
    setOpenCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const cardClass = (id: string) =>
    "card editable-table mobile-collapsible" + (openCards.has(id) ? " mobile-open" : "");
  const toggleRow = (id: string) =>
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const rowClass = (id: string) => (expandedRows.has(id) ? "expanded" : "");

  function addTransfer(phaseId: string) {
    const phase = input.phases.find((p) => p.id === phaseId);
    if (!phase) return;
    const firstTwo = input.accounts.slice(0, 2);
    if (firstTwo.length < 2) return;
    const newTransfer = {
      fromId: firstTwo[0].id,
      toId: firstTwo[1].id,
      amount: 0,
    };
    updatePhase(phaseId, { transfers: [...(phase.transfers ?? []), newTransfer] });
  }
  function updateTransfer(
    phaseId: string,
    index: number,
    patch: Partial<{ fromId: string; toId: string; amount: number }>
  ) {
    const phase = input.phases.find((p) => p.id === phaseId);
    if (!phase) return;
    const transfers = [...(phase.transfers ?? [])];
    transfers[index] = { ...transfers[index], ...patch };
    updatePhase(phaseId, { transfers });
  }
  function removeTransfer(phaseId: string, index: number) {
    const phase = input.phases.find((p) => p.id === phaseId);
    if (!phase) return;
    const transfers = (phase.transfers ?? []).filter((_, i) => i !== index);
    updatePhase(phaseId, { transfers });
  }

  // Phase boundary validation
  const phaseIssues = useMemo(() => {
    const sorted = [...input.phases].sort((a, b) => a.startAge - b.startAge);
    const byId: Record<string, { start: string; end: string }> = {};
    for (const p of input.phases) byId[p.id] = { start: "", end: "" };
    if (sorted.length === 0) return { byId, banner: "" as string };

    const messages: string[] = [];
    // First phase must start at plan start
    if (sorted[0].startAge !== input.startAge) {
      byId[sorted[0].id].start = `Should start at ${input.startAge} (plan start)`;
      messages.push(`First phase doesn't start at age ${input.startAge}`);
    }
    // Last phase must end at plan end
    const last = sorted[sorted.length - 1];
    if (last.endAge !== input.endAge) {
      byId[last.id].end = `Should end at ${input.endAge} (plan end)`;
      messages.push(`Last phase doesn't end at age ${input.endAge}`);
    }
    // Each phase: end >= start
    for (const p of input.phases) {
      if (p.endAge < p.startAge) {
        byId[p.id].end = "End age must be ≥ start age";
        messages.push(`"${p.name}" has end age before start age`);
      }
    }
    // Consecutive: each phase[i].startAge == phase[i-1].endAge + 1
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const expected = prev.endAge + 1;
      if (curr.startAge !== expected) {
        const diff = curr.startAge - expected;
        const msg = diff > 0 ? `Gap: ${diff} year(s) after "${prev.name}"` : `Overlaps "${prev.name}" by ${-diff} year(s)`;
        byId[curr.id].start = msg;
        messages.push(msg);
      }
    }
    return { byId, banner: messages.join(" • ") };
  }, [input.phases, input.startAge, input.endAge]);

  function updateHorizon(patch: { startAge?: number; endAge?: number }) {
    setInput((s) => {
      const startAge = patch.startAge ?? s.startAge;
      const endAge = patch.endAge ?? s.endAge;
      // Re-snap phases to fit the new horizon (preserve durations).
      const sorted = [...s.phases].sort((a, b) => a.startAge - b.startAge);
      let cursor = startAge;
      const fixed = sorted.map((p, i) => {
        const duration = Math.max(0, p.endAge - p.startAge);
        const newStart = cursor;
        const isLast = i === sorted.length - 1;
        const newEnd = isLast ? endAge : Math.min(newStart + duration, endAge);
        cursor = newEnd + 1;
        return { ...p, startAge: newStart, endAge: Math.max(newStart, newEnd) };
      });
      return { ...s, startAge, endAge, phases: fixed };
    });
  }

  function snapPhasesContiguous() {
    if (input.phases.length === 0) return;
    const sorted = [...input.phases].sort((a, b) => a.startAge - b.startAge);
    let cursor = input.startAge;
    const fixed = sorted.map((p, i) => {
      const duration = Math.max(0, p.endAge - p.startAge);
      const newStart = cursor;
      let newEnd = newStart + duration;
      if (i === sorted.length - 1) newEnd = input.endAge;
      cursor = newEnd + 1;
      return { ...p, startAge: newStart, endAge: newEnd };
    });
    setInput((s) => ({ ...s, phases: fixed }));
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
      <Welcome open={welcomeOpen} onClose={() => setWelcomeOpen(false)} />
      <header>
        <h1>Money Runway</h1>
        <p className="tagline">
          {t("A retirement simulator that takes real life seriously.")}
        </p>
        <p className="why">
          {t("Most calculators flatten everything to one inflation rate and one savings account. Money Runway models")}
          <b> {t("per-line expense inflation")}</b>, <b>{t("per-account return rates")}</b>, <b>{t("contribution caps")}</b> {t("(e.g. EPF RM100k/yr)")},
          <b> {t("cascade savings")}</b> {t("(preferred → next-highest-rate → cash)")}, <b>{t("withdrawal drain order")}</b>,
          <b> {t("sellable assets")}</b> {t("with linked loans")}, {t("and")} <b>{t("life-phase income changes")}</b> {t("(career → semi-retirement → retirement)")}.
          {" "}{t("All math runs in your browser — no signup, no data leaves your device.")}
        </p>
        <div className="actions actions-secondary">
          <select
            className="lang-picker"
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
            aria-label="Language"
            title="Language / Bahasa / 语言"
          >
            {(Object.entries(LANG_NAMES) as [Lang, string][]).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
          <button onClick={() => setWelcomeOpen(true)} title={t("How does this work?")} aria-label={t("Help")}>
            ❓ {t("Help")}
          </button>
          <button onClick={() => setPrivacy((p) => !p)} title="Toggle privacy mode">
            {privacy ? `🔓 ${t("Show")}` : `🔒 ${t("Hide")}`}
          </button>
          <button onClick={handleSave} title="Save current scenario to this browser">💾 {t("Save")}</button>
          <button onClick={copyShareLink} title="Copy a shareable URL">🔗 {t("Share")}</button>
          <button onClick={() => exportToXlsx(input, result)} title="Download year-by-year XLSX">📊 {t("XLSX")}</button>
        </div>
        <div className="actions actions-primary">
          <label className="preset-picker">
            <span>{t("Profile:")}</span>
            <select
              value={profileKey}
              onChange={(e) => {
                if (e.target.value) applyProfile(e.target.value as ProfileKey);
              }}
            >
              <option value="" disabled>{t("Choose your profile…")}</option>
              {(Object.entries(PROFILES) as [ProfileKey, string][]).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
          </label>
          <label className="preset-picker">
            <span>{t("Strategy:")}</span>
            <select
              value={strategyKey}
              onChange={(e) => applyStrategy(e.target.value as StrategyKey)}
            >
              {(Object.entries(STRATEGIES) as [StrategyKey, string][]).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
          </label>
          <button onClick={resetPreset} title="Reload current Profile × Strategy combo">{t("Reset")}</button>
        </div>
        <div className="picker-descriptions">
          {profileKey ? (
            <div>
              <b>{PROFILES[profileKey]}:</b> {PROFILE_DESCRIPTIONS[profileKey]}
            </div>
          ) : (
            <div className="picker-hint">
              <b>{t("Pick a profile")}</b> {t("to load realistic starting numbers, or just start editing the cards below.")}
            </div>
          )}
          <div>
            <b>{STRATEGIES[strategyKey]}:</b> {STRATEGY_DESCRIPTIONS[strategyKey]}
          </div>
        </div>
      </header>

      <section className="how-it-works">
        <details>
          <summary>{t("How does this work?")}</summary>
          <div>
            <p>{t("hiw.eachYear")}</p>
            <p>{t("hiw.surplus")}</p>
            <p>{t("hiw.transfers")}</p>
            <p>{t("hiw.privacy")}</p>
          </div>
        </details>
      </section>

      <details className="section-group">
      <summary className="section-header">{t("⚙️ Settings")}</summary>
      <section className="grid">
        <div className="card">
          <h2>{t("Time horizon")}</h2>
          <label>
            {t("Start age")} <input type="number" value={input.startAge} onChange={(e) => updateHorizon({ startAge: +e.target.value })} />
          </label>
          <label>
            {t("End age")} <input type="number" value={input.endAge} onChange={(e) => updateHorizon({ endAge: +e.target.value })} />
          </label>
        </div>
        <div className="card">
          <h2>{t("Assumption toggles")}</h2>
          <label>
            <input
              type="checkbox"
              checked={input.topUpEarnsSameYearInterest}
              onChange={(e) => setInput((s) => ({ ...s, topUpEarnsSameYearInterest: e.target.checked }))}
            />
            {t("Top-ups earn interest in the year they're deposited")}
          </label>
          <label>
            <input
              type="checkbox"
              checked={input.liabilityEndInclusive}
              onChange={(e) => setInput((s) => ({ ...s, liabilityEndInclusive: e.target.checked }))}
            />
            {t("Pay liability through its end age inclusive")}
          </label>
          <p className="hint">{t("Both options together shift the \"money runs out\" age by several years. Bracket the range.")}</p>
        </div>
      </section>
      </details>

      <details className="section-group">
      <summary className="section-header">{t("💰 Your money")}</summary>
      <section className="grid">
        <div className={cardClass("accounts")}>
          <h2 onClick={() => toggleCard("accounts")} className="card-title">{t("Accounts")}</h2>
          <details className="col-help">
            <summary>{t("ⓘ What do these columns mean?")}</summary>
            <dl>
              <dt>{t("Name")}</dt><dd>{t("help.accounts.name")}</dd>
              <dt>{t("Balance")}</dt><dd>{t("help.accounts.balance")}</dd>
              <dt>{t("Rate %")}</dt><dd>{t("help.accounts.rate")}</dd>
              <dt>{t("Drain")}</dt><dd>{t("help.accounts.drain")}</dd>
              <dt>{t("Max Top-up")}</dt><dd>{t("help.accounts.maxTopUp")}</dd>
            </dl>
          </details>
          <table>
            <thead>
              <tr>
                <th title="Account name (e.g. EPF, ASM, brokerage)">Name</th>
                <th title="Starting balance">Balance</th>
                <th title="Annual return rate, e.g. EPF 6%">Rate %</th>
                <th title="Order accounts are drained when income is short (1 = first)">Drain</th>
                <th title="Annual deposit limit (e.g. EPF self-contribution capped at RM100k). Leave blank for uncapped.">Max Top-up</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {input.accounts.map((a) => (
                <tr key={a.id} className={rowClass(a.id)}>
                  <td data-label="Name">
                    <input value={a.name} onChange={(e) => updateAccount(a.id, { name: e.target.value })} />
                    <button className="row-toggle" onClick={() => toggleRow(a.id)} aria-label="Toggle details" type="button">
                      {expandedRows.has(a.id) ? "▾" : "▸"}
                    </button>
                  </td>
                  <td data-label="Balance"><input type="number" value={a.balance} onChange={(e) => updateAccount(a.id, { balance: +e.target.value })} /></td>
                  <td data-label="Rate %"><input type="number" step="0.01" value={(a.rate * 100).toFixed(2)} onChange={(e) => updateAccount(a.id, { rate: +e.target.value / 100 })} /></td>
                  <td data-label="Drain order"><input type="number" value={a.drainOrder} onChange={(e) => updateAccount(a.id, { drainOrder: +e.target.value })} /></td>
                  <td data-label="Max Top-up/yr">
                    <input
                      type="number"
                      placeholder="—"
                      value={a.maxYearlyTopUp ?? ""}
                      onChange={(e) =>
                        updateAccount(a.id, {
                          maxYearlyTopUp: e.target.value === "" ? undefined : +e.target.value,
                        })
                      }
                    />
                  </td>
                  <td className="row-actions"><button onClick={() => removeAccount(a.id)} aria-label="Remove account">× {`${t("Remove")}`}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={addAccount}>{t("+ Add account")}</button>
          <p className="hint">{t("drain.order.hint")}</p>
        </div>

        <div className={cardClass("expenses")}>
          <h2 onClick={() => toggleCard("expenses")} className="card-title">{t("Expenses (monthly)")}</h2>
          <details className="col-help">
            <summary>{t("ⓘ What do these columns mean?")}</summary>
            <dl>
              <dt>{t("Name")}</dt><dd>{t("help.expenses.name")}</dd>
              <dt>{t("Monthly")}</dt><dd>{t("help.expenses.monthly")}</dd>
              <dt>{t("Infl %")}</dt><dd>{t("help.expenses.infl")}</dd>
              <dt>{t("Cap")}</dt><dd>{t("help.expenses.cap")}</dd>
            </dl>
          </details>
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
                <tr key={e.id} className={rowClass(e.id)}>
                  <td data-label="Name">
                    <input value={e.name} onChange={(ev) => updateExpense(e.id, { name: ev.target.value })} />
                    <button className="row-toggle" onClick={() => toggleRow(e.id)} aria-label="Toggle details" type="button">
                      {expandedRows.has(e.id) ? "▾" : "▸"}
                    </button>
                  </td>
                  <td data-label="Monthly"><input type="number" value={e.monthly} onChange={(ev) => updateExpense(e.id, { monthly: +ev.target.value })} /></td>
                  <td data-label="Inflation %"><input type="number" step="0.1" value={(e.inflation * 100).toFixed(1)} onChange={(ev) => updateExpense(e.id, { inflation: +ev.target.value / 100 })} /></td>
                  <td data-label="Monthly cap"><input type="number" placeholder="—" value={e.monthlyCap ?? ""} onChange={(ev) => updateExpense(e.id, { monthlyCap: ev.target.value === "" ? undefined : +ev.target.value })} /></td>
                  <td className="row-actions"><button onClick={() => removeExpense(e.id)} aria-label="Remove expense">× {`${t("Remove")}`}</button></td>
                </tr>
              ))}
              <tr className="expense-total-row">
                <td><b>{t("Total (today)")}</b></td>
                <td className="num"><b>{fmtRM(input.expenses.reduce((s, e) => s + e.monthly, 0))}/{t("mo")}</b></td>
                <td colSpan={3} className="hint">
                  ≈ {fmtRM(input.expenses.reduce((s, e) => s + e.monthly, 0) * 12)}/{t("yr")}. {t("expense.total.note")}
                </td>
              </tr>
            </tbody>
          </table>
          <button onClick={addExpense}>{t("+ Add expense")}</button>
        </div>

        <div className={cardClass("liabilities")}>
          <h2 onClick={() => toggleCard("liabilities")} className="card-title">{t("Liabilities")}</h2>
          <details className="col-help">
            <summary>{t("ⓘ What do these columns mean?")}</summary>
            <dl>
              <dt>{t("Name")}</dt><dd>{t("help.liabilities.name")}</dd>
              <dt>{t("Monthly")}</dt><dd>{t("help.liabilities.monthly")}</dd>
              <dt>{t("Start Age")}</dt><dd>{t("help.liabilities.startAge")}</dd>
              <dt>{t("End Age")}</dt><dd>{t("help.liabilities.endAge")}</dd>
              <dt>{t("Infl %")}</dt><dd>{t("help.liabilities.infl")}</dd>
            </dl>
          </details>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Monthly</th>
                <th>Start Age</th>
                <th>End Age</th>
                <th>Infl %</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {input.liabilities.map((L) => (
                <tr key={L.id} className={rowClass(L.id)}>
                  <td data-label="Name">
                    <input value={L.name} onChange={(e) => updateLiability(L.id, { name: e.target.value })} />
                    <button className="row-toggle" onClick={() => toggleRow(L.id)} aria-label="Toggle details" type="button">
                      {expandedRows.has(L.id) ? "▾" : "▸"}
                    </button>
                  </td>
                  <td data-label="Monthly"><input type="number" value={L.monthly} onChange={(e) => updateLiability(L.id, { monthly: +e.target.value })} /></td>
                  <td data-label="Start age">
                    <input
                      type="number"
                      placeholder={String(input.startAge)}
                      value={L.startAge ?? ""}
                      onChange={(e) => updateLiability(L.id, { startAge: e.target.value === "" ? undefined : +e.target.value })}
                    />
                  </td>
                  <td data-label="End age"><input type="number" value={L.endAge} onChange={(e) => updateLiability(L.id, { endAge: +e.target.value })} /></td>
                  <td data-label="Inflation %"><input type="number" step="0.1" value={(L.inflation * 100).toFixed(1)} onChange={(e) => updateLiability(L.id, { inflation: +e.target.value / 100 })} /></td>
                  <td className="row-actions"><button onClick={() => removeLiability(L.id)} aria-label="Remove liability">× {`${t("Remove")}`}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={addLiability}>{t("+ Add liability")}</button>
        </div>

        <div className={cardClass("fixedAssets")}>
          <h2 onClick={() => toggleCard("fixedAssets")} className="card-title">{t("🏠 Fixed assets")}</h2>
          <p className="hint" style={{ marginTop: 0 }}>{t("help.fixedAssets.lead")}</p>
          <details className="col-help">
            <summary>{t("ⓘ What do these columns mean?")}</summary>
            <dl>
              <dt>{t("Name")}</dt><dd>{t("help.fixedAssets.name")}</dd>
              <dt>{t("Current Value")}</dt><dd>{t("help.fixedAssets.currentValue")}</dd>
              <dt>{t("Apprec %")}</dt><dd>{t("help.fixedAssets.apprec")}</dd>
              <dt>{t("Linked Loan")}</dt><dd>{t("help.fixedAssets.linkedLoan")}</dd>
              <dt>{t("Sell Age")}</dt><dd>{t("help.fixedAssets.sellAge")}</dd>
              <dt>{t("Sell Price")}</dt><dd>{t("help.fixedAssets.sellPrice")}</dd>
            </dl>
          </details>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Current Value</th>
                <th>Apprec %</th>
                <th>Linked Loan</th>
                <th>Sell Age</th>
                <th>Sell Price</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(input.fixedAssets ?? []).map((fa) => (
                <tr key={fa.id} className={rowClass(fa.id)}>
                  <td data-label="Name">
                    <input value={fa.name} onChange={(e) => updateFixedAsset(fa.id, { name: e.target.value })} />
                    <button className="row-toggle" onClick={() => toggleRow(fa.id)} aria-label="Toggle details" type="button">
                      {expandedRows.has(fa.id) ? "▾" : "▸"}
                    </button>
                  </td>
                  <td data-label="Current Value"><input type="number" value={fa.currentValue} onChange={(e) => updateFixedAsset(fa.id, { currentValue: +e.target.value })} /></td>
                  <td data-label="Appreciation %"><input type="number" step="0.1" value={(fa.appreciation * 100).toFixed(1)} onChange={(e) => updateFixedAsset(fa.id, { appreciation: +e.target.value / 100 })} /></td>
                  <td data-label="Linked Loan">
                    <select
                      value={fa.linkedLiabilityId ?? ""}
                      onChange={(e) => updateFixedAsset(fa.id, { linkedLiabilityId: e.target.value || undefined })}
                    >
                      <option value="">— none —</option>
                      {input.liabilities.map((L) => (
                        <option key={L.id} value={L.id}>{L.name}</option>
                      ))}
                    </select>
                  </td>
                  <td data-label="Sell Age">
                    <input
                      type="number"
                      placeholder="never"
                      value={fa.sellAge ?? ""}
                      onChange={(e) => updateFixedAsset(fa.id, { sellAge: e.target.value === "" ? undefined : +e.target.value })}
                    />
                  </td>
                  <td data-label="Sell Price (override)">
                    <input
                      type="number"
                      placeholder="auto"
                      value={fa.sellPriceOverride ?? ""}
                      onChange={(e) => updateFixedAsset(fa.id, { sellPriceOverride: e.target.value === "" ? undefined : +e.target.value })}
                    />
                  </td>
                  <td className="row-actions"><button onClick={() => removeFixedAsset(fa.id)} aria-label="Remove asset">× {`${t("Remove")}`}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={addFixedAsset}>{t("+ Add fixed asset")}</button>
        </div>
      </section>
      </details>

      <details className="section-group">
      <summary className="section-header">{t("📅 Your life")}</summary>
      <section className="grid grid-full">
        <div className="card editable-table phases-card">
          <h2>{t("Phases")}</h2>
          <details className="col-help">
            <summary>{t("ⓘ What do these columns mean?")}</summary>
            <dl>
              <dt>{t("Name")}</dt><dd>{t("help.phases.name")}</dd>
              <dt>{t("Start")}</dt><dd>{t("help.phases.start")}</dd>
              <dt>{t("End")}</dt><dd>{t("help.phases.end")}</dd>
              <dt>{t("Monthly Income")}</dt><dd>{t("help.phases.monthlyIncome")}</dd>
              <dt>{t("Income Infl %")}</dt><dd>{t("help.phases.incomeInfl")}</dd>
              <dt>{t("Save Surplus To")}</dt><dd>{t("help.phases.surplus")}</dd>
            </dl>
            <p className="col-help-extra">{t("help.phases.transfers")}</p>
          </details>
          {phaseIssues.banner && (
            <div className="phase-warning">
              <span>⚠ {phaseIssues.banner}</span>
              <button onClick={snapPhasesContiguous} title={t("Snap to contiguous")}>
                {t("Snap to contiguous")}
              </button>
            </div>
          )}
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
              {input.phases.map((p, idx) => {
                const expanded = expandedPhase === p.id;
                const xferCount = p.transfers?.length ?? 0;
                const isLast = idx === input.phases.length - 1;
                return (
                  <Fragment key={p.id}>
                    <tr className={rowClass(p.id)}>
                      <td>
                        <button
                          className="expand-btn"
                          onClick={() => setExpandedPhase(expanded ? null : p.id)}
                          title="Edit transfers"
                          aria-label="Toggle transfers editor"
                        >
                          {expanded ? "▾" : "▸"}
                        </button>
                        <input
                          value={p.name}
                          onChange={(e) => updatePhase(p.id, { name: e.target.value })}
                          style={{ width: "calc(100% - 28px)" }}
                        />
                        {xferCount > 0 && (
                          <span className="badge transfer" title={`${xferCount} transfer rule(s)`}>
                            {xferCount} transfer{xferCount > 1 ? "s" : ""}
                          </span>
                        )}
                        <button className="row-toggle" onClick={() => toggleRow(p.id)} aria-label="Toggle row details" type="button">
                          {expandedRows.has(p.id) ? "▾" : "▸"}
                        </button>
                      </td>
                      <td data-label="Start">
                        <span
                          className="locked-value"
                          title={idx === 0 ? "Locked to plan start (edit in Settings)" : "Locked to previous phase end + 1"}
                        >
                          {p.startAge}
                        </span>
                      </td>
                      <td data-label="End">
                        {isLast ? (
                          <span
                            className="locked-value"
                            title="Locked to plan end (edit in Settings)"
                          >
                            {p.endAge}
                          </span>
                        ) : (
                          <input
                            type="number"
                            value={p.endAge}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === "") return; // allow clearing mid-edit
                              updatePhaseEndAge(p.id, +v);
                            }}
                            className={phaseIssues.byId[p.id]?.end ? "input-error" : ""}
                            title={phaseIssues.byId[p.id]?.end || undefined}
                          />
                        )}
                      </td>
                      <td data-label="Monthly Income"><input type="number" value={p.monthlyIncome} onChange={(e) => updatePhase(p.id, { monthlyIncome: +e.target.value })} /></td>
                      <td data-label="Income Infl %"><input type="number" step="0.1" value={((p.incomeInflation ?? 0) * 100).toFixed(1)} onChange={(e) => updatePhase(p.id, { incomeInflation: +e.target.value / 100 })} /></td>
                      <td data-label="Save Surplus To">
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
                    {expanded && (
                      <tr className="phase-expanded">
                        <td colSpan={6}>
                          <div className="transfers-editor">
                            <div className="te-header">
                              <b>{t("Annual transfers")}</b>
                              <span className="hint" style={{ marginLeft: 8 }}>{t("Move existing balance between accounts each year.")}</span>
                            </div>
                            {(p.transfers ?? []).map((tr, i) => (
                              <div key={i} className="te-row">
                                <span>{t("Move")}</span>
                                <input
                                  type="number"
                                  value={tr.amount}
                                  onChange={(e) => updateTransfer(p.id, i, { amount: +e.target.value })}
                                  className="te-amount"
                                />
                                <span>{t("from")}</span>
                                <select
                                  value={tr.fromId}
                                  onChange={(e) => updateTransfer(p.id, i, { fromId: e.target.value })}
                                >
                                  {input.accounts.map((a) => (
                                    <option key={a.id} value={a.id}>{a.name}</option>
                                  ))}
                                </select>
                                <span>→</span>
                                <select
                                  value={tr.toId}
                                  onChange={(e) => updateTransfer(p.id, i, { toId: e.target.value })}
                                >
                                  {input.accounts.map((a) => (
                                    <option key={a.id} value={a.id}>{a.name}</option>
                                  ))}
                                </select>
                                <button onClick={() => removeTransfer(p.id, i)} title={t("Remove")}>×</button>
                              </div>
                            ))}
                            <button
                              onClick={() => addTransfer(p.id)}
                              disabled={input.accounts.length < 2}
                            >
                              {t("+ Add transfer")}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
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

      </section>
      </details>

      <details className="saved-details">
        <summary>💾 {t("Saved scenarios")} ({savedNames.length})</summary>
        <div>
          {savedNames.length === 0 ? (
            <p className="hint">{t("saved.empty")}</p>
          ) : (
            <ul className="saved-list">
              {savedNames.map((n) => (
                <li key={n}>
                  <span>{n}</span>
                  <span>
                    <button onClick={() => handleLoad(n)}>{t("Load")}</button>
                    <button onClick={() => handleDelete(n)}>{t("Delete")}</button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>

      <h2 className="section-header">{t("📈 Results")}</h2>

      <section className="verdict">
        <div className="metric">
          <div className="label">{t("Peak Wealth")}</div>
          <div className="value">{fmtRM(result.peakAssets)}</div>
          <div className="sub">{t("at age")} {result.peakAge}</div>
        </div>
        <div className="metric">
          <div className="label">{t("End of Plan")} ({input.endAge})</div>
          <div className="value">{lastRow ? fmtRM(lastRow.totalAssets) : "—"}</div>
        </div>
        <div className="metric">
          <div className="label">{t("Outcome")}</div>
          <div className={`value ${result.runsOutAtAge ? "bad" : "good"}`}>
            {result.runsOutAtAge ? `${t("Runs out @")} ${result.runsOutAtAge}` : `${t("Solvent through")} ${input.endAge}`}
          </div>
        </div>
      </section>

      <section className="chart-wrap">
        <h2>{t("Asset trajectory")}</h2>
        <ResponsiveContainer width="100%" height={360}>
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="age" tickMargin={4} />
            <YAxis
              hide={privacy}
              width={56}
              tickFormatter={(v) => {
                const n = Number(v);
                if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
                if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
                return `${n}`;
              }}
            />
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

      <section className="card">
        <div className="snapshot-header">
          <h2>{showAllYears ? t("Year-by-year detail") : t("Milestone snapshot")}</h2>
          <button onClick={() => setShowAllYears((v) => !v)} className="toggle-btn">
            {showAllYears ? t("Show milestones only") : t("Show every year")}
          </button>
        </div>
        <details className="col-help">
          <summary>{t("ⓘ What do these columns mean?")}</summary>
          <dl>
            <dt>{t("Age")}</dt><dd>{t("help.snapshot.age")}</dd>
            <dt>{t("Phase")}</dt><dd>{t("help.snapshot.phase")}</dd>
            <dt>{t("Total")}</dt><dd>{t("help.snapshot.total")}</dd>
            <dt>{t("help.snapshot.accountCols.label")}</dt><dd>{t("help.snapshot.accountCols")}</dd>
            <dt>{t("Income (yr)")}</dt><dd>{t("help.snapshot.income")}</dd>
            <dt>{t("Living costs (yr)")}</dt><dd>{t("help.snapshot.livingCosts")}</dd>
            <dt>{t("Liability (yr)")}</dt><dd>{t("help.snapshot.liability")}</dd>
            <dt>{t("Total Spend (yr)")}</dt><dd>{t("help.snapshot.totalSpend")}</dd>
            <dt>{t("Drained (yr)")}</dt><dd>{t("help.snapshot.drained")}</dd>
          </dl>
        </details>
        <div className="scroll-x">
          <table className="snapshot">
            <thead>
              <tr>
                <th>{t("Age")}</th>
                <th>{t("Phase")}</th>
                <th className="num">{t("Total")}</th>
                {input.accounts.map((a) => (
                  <th key={a.id} className="num">{a.name}</th>
                ))}
                <th className="num">{t("Income (yr)")}</th>
                <th className="num">{t("Living costs (yr)")}</th>
                <th className="num">{t("Liability (yr)")}</th>
                <th className="num">{t("Total Spend (yr)")}</th>
                <th className="num">{t("Drained (yr)")}</th>
              </tr>
            </thead>
            <tbody>
              {result.rows
                .filter((r) => showAllYears || milestones.includes(r.age))
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
        <h2>{t("What this tool does & doesn't model")}</h2>
        <div className="scope-grid">
          <div>
            <h3>{t("✓ Handles")}</h3>
            <ul>
              <li><b>Profile × Strategy</b>: 5 life profiles (Fresh Graduate → Pre-Retirement) × 3 saving strategies = 15 ready-made starting points</li>
              <li>Multiple <b>accounts</b> with different return rates, drain order, and annual top-up caps (e.g. EPF capped at RM100k/yr)</li>
              <li><b>Expense buckets</b> with per-line inflation and monthly caps; running total shown</li>
              <li><b>Liabilities</b> with start-age, end-age, and inflation (mortgages, loans)</li>
              <li><b>Fixed Assets</b> (house, car) — appreciate over time, optionally linked to a loan; selling pays off the loan and injects net cash via the cascade</li>
              <li><b>Life phases</b> with monthly income, optional income inflation (raises); start ages auto-snap so phases stay contiguous</li>
              <li><b>Surplus cascade</b>: income above expenses flows into your preferred account (e.g. EPF) up to its cap, then overflows to the next-highest-rate account, finally to a 0% Cash account</li>
              <li><b>Inter-account transfers</b> (e.g. ASM → EPF arbitrage) on a per-phase basis</li>
              <li><b>Principal vs interest</b> tracking — see when you start eating into capital</li>
              <li>Two <b>assumption toggles</b> for ambiguous modeling choices (liability end inclusive; top-up interest timing)</li>
              <li><b>Phase validation</b>: detects gaps/overlaps with a one-click "snap to contiguous" fix</li>
              <li><b>Milestone snapshot</b> with toggle to expand to year-by-year detail</li>
              <li><b>XLSX export</b> of the full year-by-year simulation with assumptions sheet</li>
              <li><b>Privacy</b>: all math runs in your browser; share via URL hash (never sent to server); auto-save survives refresh; "Hide numbers" mode for screenshots; save/load named scenarios in localStorage</li>
            </ul>
          </div>
          <div>
            <h3>{t("✗ Does not handle")}</h3>
            <ul>
              <li><b>Migrating to another country</b> in retirement (currency, tax, cost-of-living change)</li>
              <li><b>Stochastic returns</b> / market crashes / sequence-of-returns risk — returns are constant year-over-year, no Monte Carlo</li>
              <li><b>Tax</b> — no income tax, capital gains, withholding, or tax-deferred account rules</li>
              <li><b>One-off cash events</b>: lump-sum inheritance, large gifts, lottery, severance (workaround: temporarily inflate income for one year)</li>
              <li><b>Income variation within a phase</b> (bonuses, sabbaticals, mid-phase raises) — phase income is flat or inflates at a fixed rate; split into more phases instead</li>
              <li><b>Recurring side income</b> (rental, dividends from a separate stream, pension/annuity) as first-class entities — workaround: model as a phase with that monthly income</li>
              <li><b>Spouse / dependent finances</b> — single-portfolio simulation; combine manually</li>
              <li><b>Account-specific local rules</b>: EPF Account 1/2/3 split, age-55 unlock, RM1.3M withdrawal threshold, US RMDs, CPF quirks</li>
              <li><b>Account access locks</b> by age — all accounts are fully liquid in the sim</li>
              <li><b>Healthcare shocks</b> beyond inflated insurance premiums (no out-of-pocket hospital bills)</li>
              <li><b>Monthly/quarterly compounding</b> — annual only</li>
              <li><b>Goal-seeking solver</b> ("what income do I need to last to 80?") and tornado / sensitivity analysis</li>
              <li><b>Scenario comparison</b> side-by-side</li>
            </ul>
          </div>
        </div>
        <p className="hint">{t("Treat the verdict as a baseline. Add a buffer for what isn't modeled.")}</p>
      </section>

      <footer>
        <p className="byline">
          {t("Built by")} <b>{t("a PhD")}</b> · AI / Data Science
        </p>
        <p>
          {t("Open source on")} <a href="https://github.com/jianhanlim/retire-plan">GitHub</a> ·
          {" "}{t("All calculations are local; nothing is sent to a server.")}
        </p>
      </footer>
    </div>
  );
}
