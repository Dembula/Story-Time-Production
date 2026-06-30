export type ContractDiffLine = {
  lineNumber: number;
  kind: "same" | "added" | "removed" | "changed";
  textA: string | null;
  textB: string | null;
};

export function diffContractTerms(termsA: string, termsB: string): ContractDiffLine[] {
  const linesA = termsA.replace(/\r\n/g, "\n").split("\n");
  const linesB = termsB.replace(/\r\n/g, "\n").split("\n");
  const max = Math.max(linesA.length, linesB.length);
  const out: ContractDiffLine[] = [];

  for (let i = 0; i < max; i++) {
    const a = linesA[i] ?? null;
    const b = linesB[i] ?? null;
    if (a === b) {
      out.push({ lineNumber: i + 1, kind: "same", textA: a, textB: b });
    } else if (a == null && b != null) {
      out.push({ lineNumber: i + 1, kind: "added", textA: null, textB: b });
    } else if (a != null && b == null) {
      out.push({ lineNumber: i + 1, kind: "removed", textA: a, textB: null });
    } else {
      out.push({ lineNumber: i + 1, kind: "changed", textA: a, textB: b });
    }
  }
  return out;
}

export function summarizeContractDiff(diff: ContractDiffLine[]) {
  const added = diff.filter((d) => d.kind === "added").length;
  const removed = diff.filter((d) => d.kind === "removed").length;
  const changed = diff.filter((d) => d.kind === "changed").length;
  return { added, removed, changed, total: diff.length };
}
