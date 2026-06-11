import fs from "fs";

const files = [
  "src/app/creator/projects/[projectId]/production/[tool]/page.tsx",
  "src/app/creator/projects/[projectId]/production/call-sheet-generator-client.tsx",
  "src/app/creator/projects/[projectId]/production/production-control-center-client.tsx",
  "src/app/creator/projects/[projectId]/pre-production/[tool]/page.tsx",
];

function clean(content) {
  let c = content;

  // All modoc modal blocks
  c = c.replace(
    /\{modoc\s*&&\s*modoc(?:Open|ReportOpen)[\s\S]*?<\/ProductionModocReportModal>\s*\)\}/g,
    "",
  );
  c = c.replace(
    /\{modoc\s*&&[\s\S]*?modocReportOpen[\s\S]*?<\/ModocReportModal>\s*\)\}/g,
    "",
  );
  c = c.replace(
    /\{modoc\s*&&\s*modocReviewScriptId[\s\S]*?<\/ModocScriptReviewModal>\s*\)\}/g,
    "",
  );
  c = c.replace(/\{modoc\s*&&[\s\S]*?<\/ModocFieldPopover>\s*\)\}/g, "");

  // Cyan Bot buttons
  c = c.replace(
    /<Button[\s\S]*?border-cyan-500[\s\S]*?<Bot[\s\S]*?<\/Button>\s*/g,
    "",
  );
  c = c.replace(
    /\{modoc\s*&&\s*\(\s*<button[\s\S]*?(?:text-cyan-400|border-cyan-500)[\s\S]*?<\/button>\s*\)\}/g,
    "",
  );

  // modoc state
  c = c.replace(/^\s*const modoc = useModocOptional\(\);\s*\n/gm, "");
  c = c.replace(/^\s*const \[modocReportOpen, setModocReportOpen\] = useState\(false\);\s*\n/gm, "");
  c = c.replace(/^\s*const \[modocOpen, setModocOpen\] = useState\(false\);\s*\n/gm, "");
  c = c.replace(/^\s*const \[modocFieldOpen, setModocFieldOpen\][^\n]+\n/gm, "");
  c = c.replace(/^\s*const \[modocScriptOpen, setModocScriptOpen\] = useState\(false\);\s*\n/gm, "");
  c = c.replace(/^\s*const \[modocReviewScriptId, setModocReviewScriptId\][^\n]+\n/gm, "");

  return c;
}

for (const f of files) {
  const orig = fs.readFileSync(f, "utf8");
  const c = clean(orig);
  if (c !== orig) {
    fs.writeFileSync(f, c);
    console.log("Updated", f, "delta", orig.length - c.length);
  } else {
    console.log("No change", f);
  }
}
