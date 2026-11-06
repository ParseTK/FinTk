// Fails when the production build grows past its size budget, so a heavy dependency or an
// accidental import shows up in the pull request that adds it. Run after `npm run build`.
// Sizes are gzipped, which is what a visitor downloads.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const BUDGETS = [
  { name: "JavaScript (all chunks)", ext: ".js", maxKb: 250 },
  { name: "CSS (all files)", ext: ".css", maxKb: 25 },
];

const dist = process.env.NEXT_DIST_DIR || ".next";
const root = join(dist, "static");

function* files(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* files(path);
    else yield path;
  }
}

let failed = false;
for (const { name, ext, maxKb } of BUDGETS) {
  let bytes = 0;
  for (const file of files(root))
    if (file.endsWith(ext)) bytes += gzipSync(readFileSync(file)).length;
  const kb = bytes / 1024;
  const ok = kb <= maxKb;
  failed ||= !ok;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${kb.toFixed(1)} KB gzipped (budget ${maxKb} KB)`);
}
process.exit(failed ? 1 : 0);
