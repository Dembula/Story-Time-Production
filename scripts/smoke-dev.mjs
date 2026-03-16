/**
 * Smoke test: start Next.js dev server and verify it responds.
 * Run with: node scripts/smoke-dev.mjs
 * Exits 0 if the app responds within the timeout, 1 otherwise.
 */
import { spawn } from "child_process";

const PORT = Number(process.env.PORT) || 3000;
const BASE = `http://127.0.0.1:${PORT}`;
const WAIT_MS = 90000;
const POLL_MS = 800;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer() {
  const start = Date.now();
  while (Date.now() - start < WAIT_MS) {
    try {
      const res = await fetch(`${BASE}/`, { method: "GET" });
      if (res.ok) return true;
    } catch {
      // not ready yet
    }
    await sleep(POLL_MS);
  }
  return false;
}

async function main() {
  const child = spawn("npx", ["next", "dev"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });

  let done = false;
  const finish = (code) => {
    if (done) return;
    done = true;
    try {
      child.kill("SIGTERM");
    } catch (_) {}
    process.exit(code);
  };

  child.on("error", (err) => {
    console.error("Failed to start dev server:", err.message);
    finish(1);
  });

  child.stderr?.on("data", () => {});
  child.stdout?.on("data", () => {});

  const ok = await waitForServer();
  if (ok) {
    console.log("Smoke test passed: dev server responded at", BASE);
    finish(0);
  } else {
    console.error("Smoke test failed: no response within", WAIT_MS / 1000, "s");
    finish(1);
  }
}

main();
