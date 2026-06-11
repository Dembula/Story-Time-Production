import fs from "fs";

const f = "src/app/creator/projects/[projectId]/pre-production/[tool]/page.tsx";
let lines = fs.readFileSync(f, "utf8").split("\n");
const out = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();
  // Skip orphan `}` or `)}` lines (remnants of removed modoc buttons)
  if (trimmed === "}" || trimmed === ")}" ) {
    const prev = out[out.length - 1] ?? "";
    const next = lines[i + 1] ?? "";
    if (
      prev.includes("</label>") ||
      prev.includes("border-cyan-500") ||
      next.trim().startsWith("</div>") ||
      next.trim().startsWith("</header>")
    ) {
      continue;
    }
  }
  out.push(line);
}

let c = out.join("\n");

// Remove dead modoc component blocks (no longer referenced)
const deadStart = c.indexOf("function getModocMessageContent");
const deadEnd = c.indexOf("interface ScriptReviewWorkspaceProps");
if (deadStart !== -1 && deadEnd !== -1 && deadEnd > deadStart) {
  c = c.slice(0, deadStart) + c.slice(deadEnd);
}

c = c.replace(/import \{ ModocFieldPopover \} from "@\/components\/modoc";\n/, "");
c = c.replace(/import \{ useModoc, useModocOptional \} from "@\/components\/modoc\/use-modoc";\n/, "");
c = c.replace(/, Bot/g, "").replace(/Bot, /g, "");

fs.writeFileSync(f, c);
console.log("Done");
