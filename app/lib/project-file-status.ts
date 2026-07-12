import type { ProjectUnitResult } from "./project-workspace";

export type ProjectFileStatusTone =
  | "provided"
  | "ready"
  | "pending"
  | "in-progress"
  | "complete"
  | "passed"
  | "assembled"
  | "failed";

export type ProjectFileStatus = {
  tone: ProjectFileStatusTone;
  label: string;
  complete: boolean;
};

export function projectFileStatus({
  isLessonFile,
  readOnly = false,
  verifiedCells = 0,
  totalCells = 1,
  results = [],
}: {
  isLessonFile: boolean;
  readOnly?: boolean;
  verifiedCells?: number;
  totalCells?: number;
  results?: ProjectUnitResult[];
}): ProjectFileStatus {
  if (results.some((result) => !result.passed)) {
    return { tone: "failed", label: "Needs work", complete: false };
  }
  if (results.length && results.every((result) => result.passed)) {
    return { tone: "passed", label: "Tests pass", complete: true };
  }
  if (readOnly) return { tone: "provided", label: "Provided", complete: true };
  if (!isLessonFile) return { tone: "ready", label: "Ready", complete: true };

  const total = Math.max(1, totalCells);
  const verified = Math.min(total, Math.max(0, verifiedCells));
  if (verified >= total) return { tone: "complete", label: "Complete", complete: true };
  if (verified > 0) return { tone: "in-progress", label: `${verified}/${total} complete`, complete: false };
  return { tone: "pending", label: "Pending", complete: false };
}
