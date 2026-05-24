// LocalStorage + URL hash persistence for scenarios.
// All data stays on the user's device.
import type { SimInput } from "./sim";

const LS_PREFIX = "retire-plan:scenario:";
const LS_INDEX = "retire-plan:scenarios";
export const LS_AUTOSAVE = "retire-plan:autosave";

function safeBtoa(s: string): string {
  // UTF-8 safe base64 — handles emoji/CJK without using deprecated escape/unescape
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function safeAtob(s: string): string {
  const bin = atob(s);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function isValidScenario(x: unknown): x is SimInput {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.startAge === "number" &&
    typeof r.endAge === "number" &&
    Array.isArray(r.accounts) &&
    Array.isArray(r.expenses) &&
    Array.isArray(r.liabilities) &&
    Array.isArray(r.phases)
  );
}

export function encodeScenarioToHash(input: SimInput): string {
  return safeBtoa(JSON.stringify(input));
}

export function decodeScenarioFromHash(hash: string): SimInput | null {
  try {
    const trimmed = hash.replace(/^#/, "").replace(/^s=/, "");
    if (!trimmed) return null;
    const json = safeAtob(trimmed);
    const parsed = JSON.parse(json);
    return isValidScenario(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function getShareableUrl(input: SimInput): string {
  const hash = encodeScenarioToHash(input);
  return `${window.location.origin}${window.location.pathname}#s=${hash}`;
}

export function listSavedScenarios(): string[] {
  try {
    const raw = localStorage.getItem(LS_INDEX);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function saveScenario(name: string, input: SimInput): { ok: true } | { ok: false; error: string } {
  try {
    localStorage.setItem(LS_PREFIX + name, JSON.stringify(input));
    const list = new Set(listSavedScenarios());
    list.add(name);
    localStorage.setItem(LS_INDEX, JSON.stringify([...list]));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Storage failed" };
  }
}

export function scenarioExists(name: string): boolean {
  return localStorage.getItem(LS_PREFIX + name) !== null;
}

export function loadScenario(name: string): SimInput | null {
  const raw = localStorage.getItem(LS_PREFIX + name);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return isValidScenario(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function autosave(input: SimInput): void {
  try {
    localStorage.setItem(LS_AUTOSAVE, JSON.stringify(input));
  } catch {
    // Quota exceeded or private browsing — silently skip; user can manually save
  }
}

export function loadAutosave(): SimInput | null {
  const raw = localStorage.getItem(LS_AUTOSAVE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return isValidScenario(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function deleteScenario(name: string): void {
  localStorage.removeItem(LS_PREFIX + name);
  const list = listSavedScenarios().filter((n) => n !== name);
  localStorage.setItem(LS_INDEX, JSON.stringify(list));
}
