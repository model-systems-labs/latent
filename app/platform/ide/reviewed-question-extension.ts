import {
  type ExerciseContract,
  type VirtualSourceFile,
} from "@latent/browser-lab";
import {
  defineBrowserIdeExtension,
  type BrowserIdeExtensionDefinition,
  type BrowserLabIdeRuntimeOptions,
} from "@latent/browser-lab/ide";
import { BROWSER_LAB_COMPILER_VERSION } from "@latent/browser-lab/compiler";
import {
  validateQuestionGroupLibrary,
  type PracticeQuestion,
  type QuestionGroupLibrary,
  type QuestionGroupRuntimeRequirement,
} from "@latent/course-kit";
import { methodQuestionLibrary } from "../../../examples/learning-platform/llm-learning/content/practice/question-library";
import {
  createPracticeQuestionContract,
  practiceQuestionExportName,
} from "../../features/practice/question-adapter";

const SUPPORTED_ENGINE = "esbuild-wasm";

export type BundledMethodQuestionIdeExercise = {
  readonly definition: BrowserIdeExtensionDefinition;
  readonly runtimeOptions: BrowserLabIdeRuntimeOptions;
  readonly libraryId: string;
  readonly groupId: string;
  readonly question: PracticeQuestion;
};

function coordinateHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function runtimeForQuestion(
  library: QuestionGroupLibrary,
  question: PracticeQuestion,
): QuestionGroupRuntimeRequirement {
  const runtime = library.runtimes.find((candidate) => candidate.id === question.runtimeId);
  if (!runtime) throw new Error(`Question ${question.id} refers to missing runtime ${question.runtimeId}.`);
  return runtime;
}

/**
 * This check is necessary but not authorization. Only
 * `bundledMethodQuestionIdeExtension` below turns a question into executable
 * application source, and it reads from the reviewed, compiled-in library.
 */
export function assertReviewedQuestionBrowserRuntime(
  library: QuestionGroupLibrary,
  question: PracticeQuestion,
): QuestionGroupRuntimeRequirement {
  const runtime = runtimeForQuestion(library, question);
  if (
    runtime.environment !== "browser-worker"
    || (runtime.language !== "javascript" && runtime.language !== "typescript")
    || runtime.language !== question.language
  ) {
    throw new Error(`Question ${question.id} does not declare a supported browser JavaScript or TypeScript runtime.`);
  }
  if (
    runtime.engine !== SUPPORTED_ENGINE
    || `${runtime.engine}-${runtime.engineVersion}` !== BROWSER_LAB_COMPILER_VERSION
  ) {
    throw new Error(
      `Question ${question.id} requires ${runtime.engine}@${runtime.engineVersion}; this host provides ${BROWSER_LAB_COMPILER_VERSION}.`,
    );
  }
  if (!runtime.capabilities.includes(question.entrypoint.kind)) {
    throw new Error(`Question ${question.id} does not declare its ${question.entrypoint.kind} runtime capability.`);
  }
  const usesExceptions = question.cases.some((practiceCase) => (
    practiceCase.assertions.some((assertion) => assertion.kind === "throws")
  ));
  if (usesExceptions && !runtime.capabilities.includes("exceptions")) {
    throw new Error(`Question ${question.id} uses exception checks without the exceptions runtime capability.`);
  }
  if (
    (question.language === "javascript" && !question.path.endsWith(".js"))
    || (question.language === "typescript" && !question.path.endsWith(".ts"))
  ) {
    throw new Error(`Question ${question.id} uses a source path outside Browser IDE v1.`);
  }
  return runtime;
}

function targetDeclaration(question: PracticeQuestion) {
  return question.entrypoint.kind === "class-method"
    ? { keyword: "class", name: question.entrypoint.className }
    : { keyword: "function", name: question.entrypoint.functionName };
}

function exposeReviewedEntrypoint(
  question: PracticeQuestion,
  learnerSource = question.starterCode,
): string {
  const target = targetDeclaration(question);
  const escaped = target.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const exported = new RegExp(`(^|\\n)[\\t ]*export[\\t ]+${target.keyword}[\\t ]+${escaped}\\b`);
  if (exported.test(learnerSource)) return learnerSource;
  const declaration = new RegExp(`(^|\\n)([\\t ]*)${target.keyword}[\\t ]+${escaped}\\b`);
  if (!declaration.test(learnerSource)) {
    throw new Error(`Reviewed question ${question.id} has no top-level ${target.keyword} ${target.name} declaration.`);
  }
  return learnerSource.replace(
    declaration,
    `$1$2export ${target.keyword} ${target.name}`,
  );
}

/**
 * Question Group progress stores the portable learner source used by the
 * existing practice player. Remove only the export inserted by the IDE bridge;
 * the app-owned wrapper remains a separate read-only virtual file.
 */
export function restoreReviewedQuestionSource(
  question: PracticeQuestion,
  ideSource: string,
): string {
  const target = targetDeclaration(question);
  const escaped = target.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const exported = new RegExp(
    `(^|\\n)([\\t ]*)export[\\t ]+${target.keyword}[\\t ]+${escaped}\\b`,
  );
  return ideSource.replace(exported, `$1$2${target.keyword} ${target.name}`);
}

function wrapperPathFor(question: PracticeQuestion): string {
  return question.path.replace(/\.([jt]s)$/, ".__latent_checks.$1");
}

function relativeTargetSpecifier(question: PracticeQuestion): string {
  const basename = question.path.slice(question.path.lastIndexOf("/") + 1).replace(/\.[jt]s$/, "");
  return `./${basename}`;
}

function trustedWrapperSource(question: PracticeQuestion, exportName: string): string {
  const specifier = relativeTargetSpecifier(question);
  if (question.entrypoint.kind === "function") {
    return `import { ${question.entrypoint.functionName} as __latent_target } from ${JSON.stringify(specifier)};

export function ${exportName}(...__latent_args) {
  return __latent_target(...__latent_args);
}
`;
  }
  return `import { ${question.entrypoint.className} as __LatentTarget } from ${JSON.stringify(specifier)};

export function ${exportName}(__latent_constructor_args, __latent_method_args) {
  const __latent_instance = new __LatentTarget(...__latent_constructor_args);
  return __latent_instance.${question.entrypoint.methodName}(...__latent_method_args);
}
`;
}

function bindContractToWrapper(
  contract: ExerciseContract,
  wrapperPath: string,
): ExerciseContract {
  return {
    ...contract,
    cases: contract.cases.map((exerciseCase) => ({
      ...exerciseCase,
      invoke: { ...exerciseCase.invoke, modulePath: wrapperPath },
    })),
  };
}

function definitionDescription(question: PracticeQuestion): string {
  if (question.prompt.length <= 1_000) return question.prompt;
  return `${question.prompt.slice(0, 999)}…`;
}

function sourceLoader(question: PracticeQuestion): VirtualSourceFile["loader"] {
  return question.language === "typescript" ? "ts" : "js";
}

function validatedBundledLibrary(): QuestionGroupLibrary {
  const validation = validateQuestionGroupLibrary(methodQuestionLibrary);
  if (!validation.valid) {
    throw new Error(
      `The bundled method-practice library failed its release validator: ${validation.errors[0]?.message ?? "unknown error"}`,
    );
  }
  return validation.library;
}

function reviewedRuntimeOptions(
  runtime: QuestionGroupRuntimeRequirement,
): BrowserLabIdeRuntimeOptions {
  return {
    limits: {
      cpuTimeoutMs: Math.min(runtime.limits.timeoutMs, 5_000),
      wallTimeoutMs: runtime.limits.timeoutMs,
      maxLogCharacters: Math.min(runtime.limits.maxOutputBytes, 100_000),
      maxSerializedValueBytes: Math.min(runtime.limits.maxOutputBytes, 1024 * 1024),
    },
  };
}

/**
 * Convert one reviewed, compiled-in method question into the supported IDE
 * seam. Remote Question Group JSON never reaches this function and never gains
 * runtime authority merely by declaring a runtime profile.
 */
export function bundledMethodQuestionIdeExercise(
  questionId: string,
): BundledMethodQuestionIdeExercise {
  const library = validatedBundledLibrary();
  const match = library.groups
    .flatMap((group) => group.questions.map((question) => ({ group, question })))
    .find(({ question }) => question.id === questionId);
  if (!match) throw new Error(`The bundled method-practice library does not contain ${questionId}.`);
  const { group, question } = match;
  const runtime = assertReviewedQuestionBrowserRuntime(library, question);

  const exportName = practiceQuestionExportName(question);
  const wrapperPath = wrapperPathFor(question);
  const contract = bindContractToWrapper(
    createPracticeQuestionContract(question, {
      contractId: `bundled/${question.id}`,
      exportName,
    }),
    wrapperPath,
  );
  const coordinateSuffix = coordinateHash(
    `${library.library.id}\u0000${library.library.version}\u0000${question.id}`,
  );
  const definition = defineBrowserIdeExtension({
    schemaVersion: 1,
    id: `question.${question.id}.${coordinateSuffix}`,
    title: question.title,
    description: definitionDescription(question),
    initialFilePath: question.path,
    files: [
      {
        path: question.path,
        loader: sourceLoader(question),
        title: question.title,
        editable: true,
        contents: exposeReviewedEntrypoint(question),
      },
      {
        path: wrapperPath,
        loader: sourceLoader(question),
        title: "Host-owned check adapter",
        editable: false,
        contents: trustedWrapperSource(question, exportName),
      },
    ],
    entryPoints: [wrapperPath],
    checks: {
      contractVersion: `question-groups-v1:${library.library.version}:${question.id}:1`,
      contracts: [contract],
    },
  });
  return {
    definition,
    runtimeOptions: reviewedRuntimeOptions(runtime),
    libraryId: `${library.library.id}@${library.library.version}`,
    groupId: group.id,
    question,
  };
}

export function bundledMethodQuestionIdeExtension(
  questionId: string,
): BrowserIdeExtensionDefinition {
  return bundledMethodQuestionIdeExercise(questionId).definition;
}
