import fs from "fs";

const files = [
  "src/app/creator/projects/[projectId]/pre-production/[tool]/page.tsx",
  "src/app/creator/projects/[projectId]/production/[tool]/page.tsx",
  "src/app/creator/projects/[projectId]/production/call-sheet-generator-client.tsx",
  "src/app/creator/projects/[projectId]/production/production-control-center-client.tsx",
  "src/components/project-tools/pre/IdeaDevelopmentTool.tsx",
  "src/components/project-tools/pre/ScriptWritingTool.tsx",
];

function removeOneBlock(c) {
  const start = c.indexOf("{modoc &&");
  if (start === -1) return c;

  const slice = c.slice(start);
  // Always use the SHORTEST (innermost) valid closing match
  const patterns = [
    /<ModocFieldPopover[\s\S]*?\/>\s*\)\}/,
    /<ProductionModocReportModal[\s\S]*?\/>\s*\)\}/,
    /<ModocReportModal[\s\S]*?\/>\s*\)\}/,
    /<ModocScriptReviewModal[\s\S]*?\/>\s*\)\}/,
    /\)\(\)\}/,
    /<button[\s\S]*?<\/button>\s*\)\}/,
    /<Button[\s\S]*?border-cyan-500[\s\S]*?<\/Button>\s*\)\}/,
    /<div className="pt-3 border-t[\s\S]*?<\/div>\s*\)\}/,
    /<div className="flex flex-wrap items-center gap-2">[\s\S]*?border-cyan-500[\s\S]*?<\/div>\s*\)\}/,
    /<div className="flex items-center gap-2">[\s\S]*?border-cyan-500[\s\S]*?<\/div>\s*\)\}/,
  ];

  let bestEnd = -1;
  for (const p of patterns) {
    const m = slice.match(p);
    if (m && m.index !== undefined) {
      const end = start + m.index + m[0].length;
      if (bestEnd === -1 || end < bestEnd) bestEnd = end;
    }
  }

  if (bestEnd === -1) return c;
  return c.slice(0, start) + c.slice(bestEnd);
}

function removeAllModocBlocks(c) {
  let prev = "";
  let guard = 0;
  while (prev !== c && guard < 200) {
    prev = c;
    c = removeOneBlock(c);
    guard++;
  }
  return c;
}

function clean(content, isPreProduction = false) {
  let c = removeAllModocBlocks(content);

  c = c.replace(/^\s*const modoc = useModocOptional\(\);\s*\n/gm, "");
  c = c.replace(/^\s*const \[modocFieldOpen, setModocFieldOpen\][^\n]+\n/gm, "");
  c = c.replace(/^\s*const \[modocScriptOpen, setModocScriptOpen\] = useState\(false\);\s*\n/gm, "");
  c = c.replace(/^\s*const \[modocReportOpen, setModocReportOpen\] = useState\(false\);\s*\n/gm, "");
  c = c.replace(/^\s*const \[modocOpen, setModocOpen\] = useState\(false\);\s*\n/gm, "");
  c = c.replace(/^\s*const \[modocReviewScriptId, setModocReviewScriptId\][^\n]+\n/gm, "");

  c = c.replace(/import \{ ModocFieldPopover \} from "@\/components\/modoc";\n/g, "");
  c = c.replace(/import \{ useModocOptional, useModoc \} from "@\/components\/modoc";\n/g, "");
  c = c.replace(/import \{ useModocOptional \} from "@\/components\/modoc";\n/g, "");
  c = c.replace(/import \{ useModoc, useModocOptional \} from "@\/components\/modoc\/use-modoc";\n/g, "");
  c = c.replace(/import \{ useModocOptional \} from "@\/components\/modoc\/use-modoc";\n/g, "");
  c = c.replace(/import \{ ProductionModocReportModal \} from "\.\/production-modoc-modal";\n/g, "");
  c = c.replace(/import \{ ProductionModocReportModal \} from "\.\.\/production-modoc-modal";\n/g, "");

  if (isPreProduction) {
    const deadStart = c.indexOf("function getModocMessageContent");
    const deadEnd = c.indexOf("interface ScriptReviewWorkspaceProps");
    if (deadStart !== -1 && deadEnd > deadStart) {
      c = c.slice(0, deadStart) + c.slice(deadEnd);
    }
  }

  if (!c.includes("<Bot") && !c.includes("Bot className")) {
    c = c.replace(/import \{ Bot \} from "lucide-react";\n/g, "");
    c = c.replace(/, Bot/g, "").replace(/Bot, /g, "");
  }

  return c;
}

for (const f of files) {
  const orig = fs.readFileSync(f, "utf8");
  const c = clean(orig, f.includes("pre-production"));
  fs.writeFileSync(f, c);
  const remaining = (c.match(/\{modoc &&/g) || []).length;
  console.log(f, "removed", orig.length - c.length, "modoc blocks left", remaining);
}
