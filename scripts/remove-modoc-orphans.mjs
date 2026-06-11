import fs from "fs";

const files = [
  "src/app/creator/projects/[projectId]/production/[tool]/page.tsx",
  "src/app/creator/projects/[projectId]/production/call-sheet-generator-client.tsx",
  "src/app/creator/projects/[projectId]/production/production-control-center-client.tsx",
  "src/app/creator/projects/[projectId]/pre-production/[tool]/page.tsx",
];

function removeModocJsxBlocks(content) {
  const marker = "{modoc &&";
  let result = "";
  let i = 0;

  while (i < content.length) {
    const start = content.indexOf(marker, i);
    if (start === -1) {
      result += content.slice(i);
      break;
    }
    result += content.slice(i, start);

    // Find opening ( after marker
    let p = start + marker.length;
    while (p < content.length && content[p] !== "(") p++;
    if (content[p] !== "(") {
      result += marker;
      i = start + marker.length;
      continue;
    }

    let depth = 0;
    let inString = false;
    let stringChar = "";
    let end = p;
    for (; end < content.length; end++) {
      const ch = content[end];
      const prev = content[end - 1];
      if (inString) {
        if (ch === stringChar && prev !== "\\") inString = false;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") {
        inString = true;
        stringChar = ch;
        continue;
      }
      if (ch === "(") depth++;
      else if (ch === ")") {
        depth--;
        if (depth === 0) {
          end++;
          break;
        }
      }
    }

    // Skip optional trailing newline
    i = end;
    if (content[i] === "\n") i++;
  }

  return result;
}

for (const f of files) {
  const orig = fs.readFileSync(f, "utf8");
  const c = removeModocJsxBlocks(orig);
  if (c !== orig) {
    fs.writeFileSync(f, c);
    console.log("Fixed", f, "removed", orig.length - c.length, "chars");
  } else {
    console.log("No change", f);
  }
}
