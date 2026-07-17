import { strToU8, zipSync } from "fflate";
import type { CourseLesson } from "@latent/course-kit";
import { exposeLessonFunctions } from "@latent/browser-lab/compiler";
import { llmSystemsContractSuite } from "../content/llm-systems/contracts";
import { lessonLearningOutcome } from "../content/llm-systems/learning";
import {
  PYTORCH_HANDOFF_FILES,
  PYTORCH_PORTFOLIO_README,
  PYTORCH_REQUIREMENTS,
} from "../content/pytorch/handoffs";
import { lessonIsComplete, type LearnerState } from "./learner-state";
import type { ProjectFile, ProjectState, ProjectUnitResult } from "./project-workspace";
import { trustedProjectResults } from "./project-file-status";

const PORTFOLIO_HOST_TEST_COUNT = 6;

const PORTABLE_HOST_BRIDGE = `import { encodeSse, parseSseChunk } from "./adapters/streaming-transport.js";

export type ChatRole = "system" | "user" | "assistant";
export type ChatBackend = "student" | "local";
export type GenerationPhase = "queued" | "loading" | "prefill" | "streaming" | "complete" | "cancelled" | "error";
export type PreviewInitialization = {
  buildId: string;
  buildNumber: number;
  selectedBackend: ChatBackend;
  studentReady: boolean;
  localReady: boolean;
  runtime: {
    model: { temperature: number; topK: number; maxTokens: number };
    transport: { wordsPerEvent: number; delayMs: number };
    interface: { assistantName: string; responsePrefix: string; showMetrics: boolean };
  };
  conversation: { version: 1; id: string; messages: unknown[] } | null;
};
export type BridgeMessage = { role: ChatRole; content: string };
export type StartGenerationInput = {
  requestId: string;
  backend: ChatBackend;
  messages: BridgeMessage[];
  requestFrame: string;
  options: { temperature: number; topK: number; maxTokens: number };
};
export type GenerationMetrics = { queueMs: number; modelMs: number; ttftMs: number; generatedUnits: number; generatedUnitLabel: string; durationMs: number };
export type GenerationBridgeHandlers = {
  onPhase(phase: GenerationPhase): void;
  onChunk(chunk: string): void;
  onMetrics(metrics: GenerationMetrics): void;
  onError(error: { message: string; transient: boolean }): void;
};
export type GenerationHandle = { cancel(): void };
export type PreparationEvent = { type: "progress"; progress: number; detail: string };

const STORAGE_KEY = "latent-portable-conversation-v1";
let studentReady = false;
let localReady = false;
let selectedBackend: ChatBackend = "local";

function restoredConversation() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as { version?: unknown; id?: unknown; messages?: unknown } | null;
    return value?.version === 1 && typeof value.id === "string" && Array.isArray(value.messages)
      ? { version: 1 as const, id: value.id, messages: value.messages }
      : null;
  } catch {
    return null;
  }
}

export async function initializePreview(): Promise<PreviewInitialization> {
  return {
    buildId: "portable-browser-chat",
    buildNumber: 1,
    selectedBackend,
    studentReady,
    localReady,
    runtime: {
      model: { temperature: 0.72, topK: 24, maxTokens: 160 },
      transport: { wordsPerEvent: 1, delayMs: 42 },
      interface: { assistantName: "Model", responsePrefix: "", showMetrics: true },
    },
    conversation: restoredConversation(),
  };
}

async function prepare(label: string, onEvent?: (event: PreparationEvent) => void) {
  onEvent?.({ type: "progress", progress: 25, detail: \`Setting up \${label}\` });
  await new Promise((resolve) => window.setTimeout(resolve, 120));
  onEvent?.({ type: "progress", progress: 100, detail: \`\${label} ready\` });
  return { ready: true as const };
}

export async function trainStudent(onEvent?: (event: PreparationEvent) => void) {
  const result = await prepare("Student RNN demo", onEvent);
  studentReady = true;
  return result;
}

export async function loadLocal(onEvent?: (event: PreparationEvent) => void) {
  const result = await prepare("local model demo", onEvent);
  localReady = true;
  return result;
}

export async function persistConversation(record: unknown, backend: ChatBackend) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  selectedBackend = backend;
}

export function startGeneration(input: StartGenerationInput, handlers: GenerationBridgeHandlers): GenerationHandle {
  let closed = false;
  const timers = new Set<number>();
  const started = performance.now();
  let queueEnded = started;
  let firstVisible = 0;
  const schedule = (action: () => void, delay: number) => {
    const timer = window.setTimeout(() => { timers.delete(timer); if (!closed) action(); }, delay);
    timers.add(timer);
  };
  const latestUser = [...input.messages].reverse().find((message) => message.role === "user")?.content ?? "your prompt";
  const response = \`This portable demo received “\${latestUser.slice(0, 80)}” through the streaming boundary. Swap in your model service before you deploy.\`;
  const pieces = response.match(/\\S+\\s*/g) ?? [response];
  handlers.onPhase("queued");
  schedule(() => { queueEnded = performance.now(); handlers.onPhase("prefill"); }, 40);
  schedule(() => {
    handlers.onPhase("streaming");
    pieces.forEach((piece, index) => schedule(() => {
      try {
        const frame = encodeSse("token", { delta: piece });
        const split = Math.max(1, Math.floor(frame.length * 0.6));
        const first = parseSseChunk("", frame.slice(0, split));
        const second = parseSseChunk(first.remainder, frame.slice(split));
        const event = second.events[0] as { event?: string; data?: { delta?: string } } | undefined;
        if (event?.event === "token" && typeof event.data?.delta === "string") {
          if (!firstVisible) firstVisible = performance.now();
          handlers.onChunk(event.data.delta);
        }
        if (index === pieces.length - 1) {
          const durationMs = Math.round(performance.now() - started);
          handlers.onMetrics({
            queueMs: Math.round(queueEnded - started),
            modelMs: 0,
            ttftMs: Math.round((firstVisible || performance.now()) - started),
            generatedUnits: pieces.length,
            generatedUnitLabel: "Demo word chunks",
            durationMs,
          });
          handlers.onPhase("complete");
          closed = true;
        }
      } catch (error) {
        handlers.onError({ message: error instanceof Error ? error.message : "The portable SSE demo failed.", transient: false });
        closed = true;
      }
    }, index * 42));
  }, 85);
  return {
    cancel() {
      if (closed) return;
      closed = true;
      for (const timer of timers) window.clearTimeout(timer);
      timers.clear();
      handlers.onPhase("cancelled");
    },
  };
}
`;

function safePath(path: string) {
  const normalized = path.replaceAll("\\", "/").replace(/^\/+/, "");
  if (!normalized || normalized.split("/").includes("..")) throw new Error(`This portfolio path isn't safe: ${path}`);
  return normalized;
}

function portableSource(file: ProjectFile) {
  if (file.path.endsWith(".py")) return file.content;
  if (file.path === "capstone/BrowserChat.tsx") {
    return file.content.replace('from "../vendor/react"', 'from "react"');
  }
  if (file.path === "capstone/main.tsx") {
    return file.content
      .replace('from "../vendor/react"', 'from "react"')
      .replace('from "../vendor/react-dom-client"', 'from "react-dom/client"');
  }
  if (file.path === "runtime/host-bridge.ts") return PORTABLE_HOST_BRIDGE;
  const exportNames = [...new Set(
    llmSystemsContractSuite.contracts
      .filter((contract) => contract.cases.some((exerciseCase) => exerciseCase.invoke.modulePath === file.path))
      .flatMap((contract) => contract.cases.map((exerciseCase) => exerciseCase.invoke.exportName)),
  )];
  if (exportNames.length) return exposeLessonFunctions(file.content, exportNames);
  return file.content;
}

function markdownTestReport(results: readonly ProjectUnitResult[]) {
  const lines = ["# Test report", "", `Passing: ${results.filter((result) => result.passed).length}/${results.length}`, ""];
  for (const result of results) lines.push(`- ${result.passed ? "PASS" : "FAIL"} — ${result.path} — ${result.label}: ${result.detail}`);
  return `${lines.join("\n")}\n`;
}

export function portfolioReadiness(input: {
  project: ProjectState;
  learner: LearnerState;
  lessons: readonly CourseLesson[];
}) {
  const completedLessons = input.lessons.filter((lesson) => lessonIsComplete(
    input.learner,
    lesson.id,
    lesson.implementation.codeBlocks.map((block) => block.id),
    llmSystemsContractSuite.contractVersion,
    lessonLearningOutcome(lesson.id).check.id,
  ));
  const results = Object.values(trustedProjectResults(input.project.tests)).flat();
  const requiredTests = llmSystemsContractSuite.contracts.length + PORTFOLIO_HOST_TEST_COUNT;
  const passingTests = results.filter((result) => result.passed).length;
  const fullSuitePasses = input.project.tests.runner === "browser-lab-v1"
    && results.length === requiredTests
    && passingTests === requiredTests;
  const activeBuildExists = input.project.activeBuild !== null;
  const activeBuildMatchesTests = Boolean(
    input.project.activeBuild
    && input.project.tests.sourceTreeHash === input.project.activeBuild.sourceTreeHash
    && input.project.tests.projectRevision === input.project.activeBuild.projectRevision
    && input.project.tests.contractVersion === input.project.activeBuild.contractVersion
    && input.project.runtime.buildNumber === input.project.activeBuild.buildNumber
    && input.project.runtime.builtAt > 0,
  );
  return {
    ready: completedLessons.length === input.lessons.length && fullSuitePasses && activeBuildMatchesTests,
    completedLessons,
    passingTests,
    requiredTests,
    fullSuitePasses,
    activeBuildExists,
    activeBuildMatchesTests,
  };
}

export function portfolioProjectFiles(input: {
  project: ProjectState;
  learner: LearnerState;
  lessons: readonly CourseLesson[];
  exportedAt?: string;
}) {
  const exportedAt = input.exportedAt ?? new Date().toISOString();
  const results = Object.values(trustedProjectResults(input.project.tests)).flat();
  const readiness = portfolioReadiness(input);
  const completedLessons = readiness.completedLessons;
  const sourceFiles = Object.values(input.project.files)
    .filter((file) => !file.path.startsWith("vendor/"))
    .sort((left, right) => left.path.localeCompare(right.path));
  const manifest = {
    format: "latent-portfolio-project",
    version: 1,
    exportedAt,
    projectId: "browser-chat",
    buildNumber: input.project.activeBuild?.buildNumber ?? null,
    completedLessons: completedLessons.map((lesson) => lesson.id),
    sourceFiles: sourceFiles.map((file) => file.path),
    pytorchFiles: PYTORCH_HANDOFF_FILES.map((file) => file.path),
    portableBuildReady: readiness.ready,
    tests: { passing: readiness.passingTests, total: results.length, required: readiness.requiredTests },
  };
  const files: Record<string, string> = {
    "README.md": `# Browser Chat\n\nThis is the browser-first LLM project you built in Latent. It includes your model, runtime, serving, product, and React capstone files.\n\n## Where things stand\n\n- ${completedLessons.length}/${input.lessons.length} lessons complete\n- ${manifest.tests.passing}/${readiness.requiredTests} required host-owned tests passing\n- portable build ready: ${readiness.ready ? "yes" : "no"}\n- current build: ${input.project.activeBuild ? `#${input.project.activeBuild.buildNumber}` : "none yet"}\n\n${readiness.ready ? "" : "> This copy isn't finished yet. Go back to Latent, finish every lesson file, and make a full passing build before you treat it as a runnable portfolio project.\n\n"}## Run it locally\n\n\`\`\`bash\nnpm install\nnpm run build\nnpm run dev\n\`\`\`\n\nThe exported app uses a repeatable in-browser SSE demo, so it runs without a secret or hosted backend. Read BACKEND_INTEGRATION.md before you connect a real model service.\n\nThe \`pytorch/\` folder is a separate native Python track with real \`import torch\` code. It isn't bundled into the browser app; see \`pytorch/README.md\`.\n\n## How the pieces fit together\n\n1. \`src/models\` contains the browser model foundations.\n2. \`pytorch\` turns selected ideas into native PyTorch modules and export code.\n3. \`src/systems\` handles inference accounting and scheduling.\n4. \`src/backend\` handles SSE framing and attempt-aware reliability.\n5. \`src/product\` handles the conversation, rendering, actions, context, and quality rules.\n6. \`src/capstone\` puts the React app together.\n`,
    "BACKEND_INTEGRATION.md": `# Replace the portable demo backend\n\nThe exported \`src/runtime/host-bridge.ts\` creates repeatable SSE frames right in the browser. It has no API key and doesn't make network requests.\n\nTo connect a real service:\n\n1. Keep the exported \`StartGenerationInput\`, \`GenerationBridgeHandlers\`, and \`GenerationHandle\` interface.\n2. POST the size-limited message and context payload to your own same-origin endpoint. Never put a provider key in this client.\n3. Decode response bytes with a streaming \`TextDecoder\`, then send the decoded text through \`parseSseChunk\`.\n4. Check requestId and attempt identity before you accept events.\n5. Pass AbortSignal through fetch, the stream reader, parser state, and server generation.\n6. Retry only temporary failures that happen before the user sees any output.\n7. Save only finished states, and leave out secrets and messages that are still streaming.\n\nYour lesson files are Python and still run on their own in CPython. The React app uses course-provided JavaScript adapters that pass the same tests. The browser bundler can't import Python directly, and these adapters don't pretend otherwise.\n`,
    "TEST_REPORT.md": markdownTestReport(results),
    "THIRD_PARTY_NOTICES.md": `# Third-party notices\n\nThis export uses React and React DOM (MIT) and Vite (MIT). The optional model runtime in the hosted Latent course uses Transformers.js (Apache-2.0) and SmolLM2-135M-Instruct (Apache-2.0); this archive doesn't include the model weights. The optional native Python track uses PyTorch (BSD-3-Clause), which also isn't bundled here. Check the original license texts before you redistribute anything.\n`,
    "pytorch/README.md": PYTORCH_PORTFOLIO_README,
    "pytorch/requirements.txt": PYTORCH_REQUIREMENTS,
    "portfolio-manifest.json": JSON.stringify(manifest, null, 2),
    "package.json": JSON.stringify({
      name: "latent-browser-chat-portfolio",
      version: "1.0.0",
      private: true,
      type: "module",
      scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
      dependencies: { react: "19.2.6", "react-dom": "19.2.6" },
      devDependencies: { "@types/react": "19.2.14", "@types/react-dom": "19.2.3", "@vitejs/plugin-react": "6.0.2", typescript: "5.9.3", vite: "8.1.4" },
    }, null, 2),
    "index.html": '<!doctype html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>Browser Chat</title></head><body><div id="root"></div><script type="module" src="/src/capstone/main.tsx"></script></body></html>\n',
    "vite.config.ts": 'import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\nexport default defineConfig({ plugins: [react()] });\n',
    ".gitignore": "node_modules\ndist\n.env*\n",
  };
  for (const file of sourceFiles) files[`src/${safePath(file.path)}`] = portableSource(file);
  for (const file of PYTORCH_HANDOFF_FILES) files[safePath(file.path)] = file.code;
  return files;
}

export function portfolioProjectBlob(input: Parameters<typeof portfolioProjectFiles>[0]) {
  const files = portfolioProjectFiles(input);
  const archive = zipSync(Object.fromEntries(Object.entries(files).map(([path, source]) => [path, strToU8(source)])), { level: 6 });
  const bytes = Uint8Array.from(archive);
  return new Blob([bytes.buffer], { type: "application/zip" });
}
