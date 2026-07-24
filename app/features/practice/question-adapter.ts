import type { ExerciseContract, HostAssertion } from "@latent/browser-lab";
import type { PortableAssertion, PracticeQuestion } from "@latent/course-kit";

const JAVASCRIPT_IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const PYTHON_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

export type AdaptedPracticeQuestion = {
  path: string;
  source: string;
  exportName: string;
  contract: ExerciseContract;
};

function assertQuestionPath(question: PracticeQuestion): void {
  const parts = question.path.split("/");
  if (
    question.path.startsWith("/")
    || question.path.includes("\\")
    || parts.some((part) => !part || part === "." || part === "..")
  ) {
    throw new Error(`Practice question ${question.id} has an unsafe source path.`);
  }
  const extensions = question.language === "javascript"
    ? [".js", ".mjs", ".cjs"]
    : question.language === "typescript"
      ? [".ts"]
      : [".py"];
  if (!extensions.some((extension) => question.path.endsWith(extension))) {
    throw new Error(`Practice question ${question.id} must use ${extensions.join(" or ")} source file.`);
  }
}

function assertIdentifier(question: PracticeQuestion, value: string, label: string): void {
  const pattern = question.language === "python" ? PYTHON_IDENTIFIER : JAVASCRIPT_IDENTIFIER;
  if (!pattern.test(value)) {
    throw new Error(`Practice question ${question.id} has an invalid ${label}.`);
  }
}

function fnv1a32(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * This name is app-owned and deliberately unrelated to the learner's target
 * identifier. Contracts invoke only this wrapper, which keeps class
 * construction and method lookup out of portable question data.
 */
export function practiceQuestionExportName(
  question: Pick<PracticeQuestion, "id" | "path">,
): string {
  return `__latent_question_${fnv1a32(`${question.id}\u0000${question.path}`)}`;
}

function mapsToHostAssertion(assertion: PortableAssertion): HostAssertion {
  switch (assertion.kind) {
    case "deep-equal":
      return {
        id: assertion.id,
        label: assertion.label,
        kind: assertion.kind,
        expected: assertion.expected,
        path: assertion.path,
      };
    case "type":
      return {
        id: assertion.id,
        label: assertion.label,
        kind: assertion.kind,
        expected: assertion.expected,
        path: assertion.path,
      };
    case "truthy":
    case "finite":
      return {
        id: assertion.id,
        label: assertion.label,
        kind: assertion.kind,
        path: assertion.path,
      };
    case "range":
      return {
        id: assertion.id,
        label: assertion.label,
        kind: assertion.kind,
        minimum: assertion.minimum,
        maximum: assertion.maximum,
        path: assertion.path,
      };
    case "length":
      return {
        id: assertion.id,
        label: assertion.label,
        kind: assertion.kind,
        expected: assertion.expected,
        path: assertion.path,
      };
    case "includes":
      return {
        id: assertion.id,
        label: assertion.label,
        kind: assertion.kind,
        expected: assertion.expected,
        path: assertion.path,
      };
    case "matches":
      return {
        id: assertion.id,
        label: assertion.label,
        kind: assertion.kind,
        pattern: assertion.pattern,
        flags: assertion.flags,
        path: assertion.path,
      };
    case "throws":
      return {
        id: assertion.id,
        label: assertion.label,
        kind: assertion.kind,
        errorName: assertion.errorName,
        messagePattern: assertion.messagePattern,
      };
    default: {
      const exhaustive: never = assertion;
      return exhaustive;
    }
  }
}

export function createPracticeQuestionContract(
  question: PracticeQuestion,
  options: { contractId?: string; exportName?: string } = {},
): ExerciseContract {
  assertQuestionPath(question);
  const exportName = options.exportName ?? practiceQuestionExportName(question);
  assertIdentifier(question, exportName, "runtime export name");
  if (!question.cases.length) throw new Error(`Practice question ${question.id} has no cases.`);

  if (question.entrypoint.kind === "function") {
    assertIdentifier(question, question.entrypoint.functionName, "function name");
    if (question.cases.some((exerciseCase) => exerciseCase.constructorArgs !== undefined)) {
      throw new Error(`Function question ${question.id} cannot define constructor arguments.`);
    }
  } else {
    assertIdentifier(question, question.entrypoint.className, "class name");
    assertIdentifier(question, question.entrypoint.methodName, "method name");
  }

  const contractId = options.contractId ?? question.id;
  if (!contractId.trim()) throw new Error(`Practice question ${question.id} needs a contract id.`);

  return {
    id: contractId,
    label: question.title,
    cases: question.cases.map((exerciseCase) => ({
      id: exerciseCase.id,
      label: exerciseCase.label,
      invoke: {
        modulePath: question.path,
        exportName,
        args: question.entrypoint.kind === "class-method"
          ? [exerciseCase.constructorArgs ?? [], exerciseCase.args]
          : exerciseCase.args,
      },
      assertions: exerciseCase.assertions.map(mapsToHostAssertion),
    })),
  };
}

function containsIdentifier(source: string, identifier: string): boolean {
  const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^A-Za-z0-9_$])${escaped}([^A-Za-z0-9_$]|$)`).test(source);
}

function javascriptWrapper(question: PracticeQuestion, exportName: string): string {
  if (question.entrypoint.kind === "function") {
    return `function ${exportName}(...__latent_args) {
  return ${question.entrypoint.functionName}(...__latent_args);
}`;
  }
  return `function ${exportName}(__latent_constructor_args, __latent_method_args) {
  const __latent_instance = new ${question.entrypoint.className}(...__latent_constructor_args);
  return __latent_instance.${question.entrypoint.methodName}(...__latent_method_args);
}`;
}

function pythonWrapper(question: PracticeQuestion, exportName: string): string {
  if (question.entrypoint.kind === "function") {
    return `def ${exportName}(*__latent_args):
    return ${question.entrypoint.functionName}(*__latent_args)`;
  }
  return `def ${exportName}(__latent_constructor_args, __latent_method_args):
    __latent_instance = ${question.entrypoint.className}(*__latent_constructor_args)
    return __latent_instance.${question.entrypoint.methodName}(*__latent_method_args)`;
}

export function appendPracticeQuestionWrapper(
  question: PracticeQuestion,
  learnerSource: string,
  exportName = practiceQuestionExportName(question),
): string {
  assertQuestionPath(question);
  assertIdentifier(question, exportName, "runtime export name");
  if (containsIdentifier(learnerSource, exportName)) {
    throw new Error(`Practice question ${question.id} collides with its reserved runtime export.`);
  }
  const wrapper = question.language === "python"
    ? pythonWrapper(question, exportName)
    : javascriptWrapper(question, exportName);
  const source = learnerSource.replace(/\s+$/, "");
  const comment = question.language === "python"
    ? "# Latent app-owned practice adapter."
    : "// Latent app-owned practice adapter.";
  return `${source}\n\n${comment}\n${wrapper}\n`;
}

export function adaptPracticeQuestion(
  question: PracticeQuestion,
  learnerSource = question.starterCode,
  options: { contractId?: string } = {},
): AdaptedPracticeQuestion {
  const exportName = practiceQuestionExportName(question);
  return {
    path: question.path,
    source: appendPracticeQuestionWrapper(question, learnerSource, exportName),
    exportName,
    contract: createPracticeQuestionContract(question, {
      contractId: options.contractId,
      exportName,
    }),
  };
}
