import { runDueCreatorPoolDistributions } from "../src/lib/payments/creator-pool-distribution";

async function main() {
  const results = await runDueCreatorPoolDistributions();
  console.log(JSON.stringify({ ok: true, results }, null, 2));
}

main().catch((error) => {
  console.error("creator-pool-distribution failed:", error);
  process.exitCode = 1;
});
