/** Pyodide's line callback omits the delimiter; preserve readable boundaries. */
export function normalizePythonOutput(text: string): string {
  if (!text || text.endsWith("\n")) return text;
  return `${text}\n`;
}
