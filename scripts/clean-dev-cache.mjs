import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const targets = [path.join(root, ".next"), path.join(root, "node_modules", ".cache")];

for (const dir of targets) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`Removed ${path.relative(root, dir)}`);
  }
}

if (process.platform === "win32") {
  try {
    execSync(
      'powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"name = \'node.exe\'\\" | Where-Object { $_.CommandLine -match \'storytime\' -and $_.CommandLine -match \'next\' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"',
      { stdio: "ignore" },
    );
  } catch {
    // ignore
  }
}

console.log("Dev cache cleared. Starting dev server...\n");
