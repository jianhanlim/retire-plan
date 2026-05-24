// LocalStorage + URL hash persistence for scenarios.
// All data stays on the user's device.
import type { SimInput } from "./sim";

const LS_PREFIX = "retire-plan:scenario:";
const LS_INDEX = "retire-plan:scenarios";

function safeBtoa(s: string): string {
  // Encode UTF-8 → btoa safely
  return btoa(unescape(encodeURIComponent(s)));
}
function safeAtob(s: string): string {
  return decodeURIComponent(escape(atob(s)));
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
    if (typeof parsed === "object" && parsed && "accounts" in parsed) {
      return parsed as SimInput;
    }
    return null;
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

export function saveScenario(name: string, input: SimInput): void {
  localStorage.setItem(LS_PREFIX + name, JSON.stringify(input));
  const list = new Set(listSavedScenarios());
  list.add(name);
  localStorage.setItem(LS_INDEX, JSON.stringify([...list]));
}

export function loadScenario(name: string): SimInput | null {
  const raw = localStorage.getItem(LS_PREFIX + name);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SimInput;
  } catch {
    return null;
  }
}

export function deleteScenario(name: string): void {
  localStorage.removeItem(LS_PREFIX + name);
  const list = listSavedScenarios().filter((n) => n !== name);
  localStorage.setItem(LS_INDEX, JSON.stringify(list));
}
