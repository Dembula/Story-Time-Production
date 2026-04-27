/**
 * Smoke test: start Next.js dev server and verify it responds.
 * Run with: node scripts/smoke-dev.mjs
 * Exits 0 if the app responds within the timeout, 1 otherwise.
 */
import { spawn } from "child_process";
import { createRequire } from "module";
import { createServer } from "net";

const START_PORT = Number(process.env.PORT) || 3000;
let PORT = START_PORT;
let BASE = `http://127.0.0.1:${PORT}`;
const WAIT_MS = 90000;
const POLL_MS = 800;
const require = createRequire(import.meta.url);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function portIsAvailable(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port);
  });
}

async function pickAvailablePort(startPort) {
  let p = startPort;
  for (let i = 0; i < 20; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const free = await portIsAvailable(p);
    if (free) return p;
    p += 1;
  }
  return startPort;
}

async function waitForServer() {
  const start = Date.now();
  while (Date.now() - start < WAIT_MS) {
    try {
      const res = await fetch(`${BASE}/`, {
        method: "GET",
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) return true;
    } catch {
      // not ready yet
    }
    await sleep(POLL_MS);
  }
  return false;
}

async function main() {
  PORT = await pickAvailablePort(START_PORT);
  BASE = `http://127.0.0.1:${PORT}`;
  const nextCli = require.resolve("next/dist/bin/next");
  const logs = [];
  const child = spawn(process.execPath, [nextCli, "dev", "--port", String(PORT)], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
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

  child.stderr?.on("data", (chunk) => {
    const line = String(chunk);
    logs.push(line);
  });
  child.stdout?.on("data", (chunk) => {
    const line = String(chunk);
    logs.push(line);
    const m = line.match(/Local:\s+http:\/\/localhost:(\d+)/i);
    if (m?.[1]) {
      PORT = Number(m[1]);
      BASE = `http://127.0.0.1:${PORT}`;
    }
  });

  const ok = await waitForServer();
  if (ok) {
    console.log("Smoke test passed: dev server responded at", BASE);
    finish(0);
  } else {
    console.error("Smoke test failed: no response within", WAIT_MS / 1000, "s");
    const tail = logs.join("").slice(-2000);
    if (tail) console.error("Server log tail:\n", tail);
    finish(1);
  }
}

main();
