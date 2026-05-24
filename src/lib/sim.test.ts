// Quick sanity test — run with `npx tsx src/lib/sim.test.ts`
import { simulate, malaysiaPreset } from "./sim";

const result = simulate(malaysiaPreset());
const milestones = [31, 36, 41, 45, 50, 55, 60, 65, 70, 75, 80];
console.log("Age | Phase                  | Total Assets | Yearly Spend");
console.log("-".repeat(72));
for (const r of result.rows) {
  if (milestones.includes(r.age)) {
    console.log(
      `${String(r.age).padStart(3)} | ${r.phaseName.padEnd(22)} | ` +
        `${r.totalAssets.toFixed(0).padStart(12)} | ` +
        `${r.totalSpend.toFixed(0).padStart(12)}`
    );
  }
}
console.log(`\nPeak: RM${result.peakAssets.toFixed(0)} at age ${result.peakAge}`);
console.log(
  result.runsOutAtAge
    ? `⚠ Runs out at age ${result.runsOutAtAge}`
    : "✓ No shortfall through end"
);
