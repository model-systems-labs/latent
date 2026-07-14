import { classHighlighter, highlightCode } from "@lezer/highlight";
import { parser } from "@lezer/javascript";
import { memo } from "react";

type HighlightedSegment = {
  classes: string;
  text: string;
};

function highlightedLines(source: string): HighlightedSegment[][] {
  const lines: HighlightedSegment[][] = [[]];
  highlightCode(
    source,
    parser.parse(source),
    classHighlighter,
    (text, classes) => lines[lines.length - 1].push({ text, classes }),
    () => lines.push([]),
  );
  return lines;
}

export const SyntaxCode = memo(function SyntaxCode({ code, label, startLine = 1 }: { code: string; label: string; startLine?: number }) {
  return (
    <div className="syntax-code" aria-label={label} role="region" tabIndex={0}>
      <pre>
        <code>
          {highlightedLines(code).map((line, lineIndex) => (
            <span className="syntax-code-line" key={`${startLine + lineIndex}:${lineIndex}`}>
              <span className="syntax-line-number" aria-hidden="true">{startLine + lineIndex}</span>
              <span className="syntax-line-source">
                {line.length ? line.map((segment, segmentIndex) => (
                  <span className={segment.classes || undefined} key={`${segmentIndex}:${segment.text}`}>{segment.text}</span>
                )) : " "}
              </span>
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
});
