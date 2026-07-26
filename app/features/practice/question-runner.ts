"use client";

import type { PracticeQuestion } from "@latent/course-kit";
import {
  runBrowserPracticeContracts,
  type PracticeContractRun,
} from "@/app/features/ide/browser-lab-service";
import { runPythonLessonContracts } from "@/app/features/ide/python-lesson-service";
import { adaptPracticeQuestion } from "@/app/features/practice/question-adapter";

export type MethodQuestionRunMode = "examples" | "check";

export function contractVersionForMethodQuestion(
  libraryVersion: string,
  question: Pick<PracticeQuestion, "id">,
) {
  return `question-groups-v1:${libraryVersion}:${question.id}:1`;
}

export async function runMethodQuestion(input: {
  question: PracticeQuestion;
  libraryVersion: string;
  source: string;
  mode: MethodQuestionRunMode;
  signal?: AbortSignal;
}): Promise<PracticeContractRun> {
  const cases = input.mode === "examples"
    ? input.question.cases.filter((exerciseCase) => exerciseCase.visibility === "example")
    : [...input.question.cases];
  if (!cases.length) throw new Error("That question has no checks for this run.");

  const scopedQuestion: PracticeQuestion = { ...input.question, cases };
  const adapted = adaptPracticeQuestion(scopedQuestion, input.source, {
    contractId: `${input.question.id}:${input.mode}`,
  });
  const contractVersion = contractVersionForMethodQuestion(
    input.libraryVersion,
    input.question,
  );

  if (input.question.language === "python") {
    const run = await runPythonLessonContracts({
      path: adapted.path,
      source: adapted.source,
      contracts: [adapted.contract],
      signal: input.signal,
    });
    return {
      cases: run.cases,
      results: run.results,
      output: run.output,
      stdout: run.stdout,
      stderr: run.stderr,
    };
  }

  return runBrowserPracticeContracts({
    path: adapted.path,
    source: adapted.source,
    contracts: [adapted.contract],
    contractVersion,
    signal: input.signal,
  });
}
