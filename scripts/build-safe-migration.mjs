import fs from "fs";
import path from "path";

const driftPath = path.join("prisma", "migrations", "_drift_full.sql");
const outDir = path.join("prisma", "migrations", "20260607150000_sync_creator_stakeholder_tools");
const outPath = path.join(outDir, "migration.sql");

const raw = fs.readFileSync(driftPath, "utf8");
const lines = raw.split(/\r?\n/);

const parts = [];
let i = 0;

function push(line) {
  parts.push(line);
}

push("-- Sync missing creator / stakeholder tool tables (safe apply)");
push("");

// CREATE TABLE blocks
while (i < lines.length) {
  const line = lines[i];
  if (line.startsWith("CREATE TABLE ")) {
    const block = [line.replace(/^CREATE TABLE /, "CREATE TABLE IF NOT EXISTS ")];
    i++;
    while (i < lines.length && !lines[i].startsWith(");") && lines[i].trim() !== ");") {
      block.push(lines[i]);
      i++;
    }
    if (i < lines.length) {
      block.push(lines[i]);
      i++;
    }
    parts.push(block.join("\n"));
    parts.push("");
    continue;
  }
  i++;
}

// CREATE INDEX / UNIQUE INDEX
i = 0;
while (i < lines.length) {
  const line = lines[i];
  if (line.startsWith("CREATE UNIQUE INDEX ") || line.startsWith("CREATE INDEX ")) {
    const stmt = line.replace(/^CREATE (UNIQUE )?INDEX /, "CREATE $1INDEX IF NOT EXISTS ");
    push(stmt + ";");
  }
  i++;
}
push("");

// Safe ADD COLUMN only (skip type alters and drops)
for (const line of lines) {
  const addCol = line.match(/^ALTER TABLE "([^"]+)" ADD COLUMN\s+"([^"]+)"/);
  if (addCol && !line.includes("SET DATA TYPE")) {
    const [, table, col] = addCol;
    push(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${col}" TEXT;`);
  }
}

// Foreign keys (-- AddForeignKey section)
i = 0;
while (i < lines.length) {
  if (lines[i].trim() === "-- AddForeignKey") {
    i++;
    while (i < lines.length && lines[i].startsWith("ALTER TABLE")) {
      const fkLine = lines[i];
      const m = fkLine.match(
        /^ALTER TABLE "([^"]+)" ADD CONSTRAINT "([^"]+)" FOREIGN KEY \("([^"]+)"\) REFERENCES "([^"]+)"\("([^"]+)"\) ON DELETE (.+) ON UPDATE (.+);$/,
      );
      if (m) {
        const [, table, constraint, col, refTable, refCol, onDel, onUp] = m;
        push(`DO $$ BEGIN`);
        push(`  IF NOT EXISTS (`);
        push(`    SELECT 1 FROM pg_constraint WHERE conname = '${constraint}'`);
        push(`  ) THEN`);
        push(
          `    ALTER TABLE "${table}" ADD CONSTRAINT "${constraint}" FOREIGN KEY ("${col}") REFERENCES "${refTable}"("${refCol}") ON DELETE ${onDel} ON UPDATE ${onUp};`,
        );
        push(`  END IF;`);
        push(`END $$;`);
      } else {
        push(fkLine);
      }
      i++;
    }
    continue;
  }
  i++;
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, parts.join("\n") + "\n");
console.log("Wrote", outPath, "bytes:", fs.statSync(outPath).size);
