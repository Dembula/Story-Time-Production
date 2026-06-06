import { spawn, execSync } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const port = Number(process.env.PORT ?? 3000);

function portInUse(checkPort) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(true));
    server.once("listening", () => {
      server.close(() => resolve(false));
    });
    server.listen(checkPort, "127.0.0.1");
  });
}

function stopStorytimeNextProcesses() {
  if (process.platform !== "win32") return;
  try {
    execSync(
      'powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"name = \'node.exe\'\\" | Where-Object { $_.CommandLine -match \'storytime\' -and $_.CommandLine -match \'next\' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"',
      { stdio: "ignore" },
    );
  } catch {
    // ignore
  }
}

if (await portInUse(port)) {
  console.error(
    `\n[storytime] Port ${port} is already in use — another dev server is probably running.`,
  );
  console.error("[storytime] Stop it first, or run: npm run dev:clean\n");
  process.exit(1);
}

if (process.platform === "win32") {
  stopStorytimeNextProcesses();
}

const child = spawn("npm", ["exec", "next", "dev"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
  shell: true,
});

child.on("exit", (code) => process.exit(code ?? 0));
