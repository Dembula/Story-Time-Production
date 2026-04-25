/**
 * Removes Next output and webpack persistent cache so dev/build does not
 * resolve stale routes (e.g. deleted API handlers) or half-written .next.
 */
import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const targets = [path.join(cwd, ".next"), path.join(cwd, "node_modules", ".cache")];

for (const dir of targets) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`Cleared ${path.relative(cwd, dir)}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`Skip ${path.relative(cwd, dir)}: ${msg}`);
  }
}
