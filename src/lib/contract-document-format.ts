/** Split plain-text contract terms into printable pages (~55 lines each). */
export function paginateContractTerms(terms: string, linesPerPage = 55): string[] {
  const lines = terms.replace(/\r\n/g, "\n").split("\n");
  if (lines.length === 0) return [""];
  const pages: string[] = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage).join("\n"));
  }
  return pages;
}

export function highlightSearchInText(text: string, query: string): string {
  if (!query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`(${escaped})`, "gi"), "⟦$1⟧");
}
