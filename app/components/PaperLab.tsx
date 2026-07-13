"use client";

import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { CodeBlock, CourseLesson } from "@latent/course-kit";
import { courseLessons } from "../lessons/course";
import { LessonExperiment } from "./LessonExperiment";
import {
  lessonIsComplete,
  initializeLearnerPersistence,
  loadLearnerState,
  recordVerifiedCells,
  saveLessonPractice,
  useLearnerState,
} from "../lib/learner-state";
import { ensureProjectWorkspace, initializeProjectPersistence, saveLessonProjectFile, type LessonProjectSeed } from "../lib/project-workspace";
import { runPracticeContracts } from "../features/ide/browser-lab-service";
import { ArtifactRuntimePanel } from "../features/artifacts/ArtifactRuntimePanel";
import { recordValidatedLessonArtifact } from "../features/artifacts/lesson-artifacts";
import { latentTensorOperations } from "@latent/tensor";
import { lessonImplementationPrelude, lessonImplementationSource } from "../lessons/implementation-source";
import { canonicalProjectSeeds } from "../lib/canonical-project";
import { bindBlockVerification, invalidateBlockVerification, practiceBlockSource, restoreSourceBoundVerification, waitForPracticeHydration } from "../features/ide/practice-state";

type ChatMessage = { role: "user" | "assistant"; content: string };
type CheckResult = { label: string; passed: boolean; detail: string };

function Atmosphere() {
  return (
    <div className="page-atmosphere" aria-hidden="true">
      <span className="orbit orbit-one" />
      <span className="orbit orbit-two" />
      <span className="orbit orbit-three" />
      <span className="node node-one" />
      <span className="node node-two" />
      <span className="warm-star" />
    </div>
  );
}

export function HeaderSection({ lesson }: { lesson: CourseLesson }) {
  return (
    <header className="paper-hero">
      <p className="eyebrow">{lesson.eyebrow}</p>
      <h1>{lesson.title}</h1>
      <p className="paper-thesis">{lesson.thesis}</p>
      <div className="hero-record">
        <span>{lesson.modeLabel}</span>
        <span>{lesson.authors}</span>
        <span>{lesson.year}</span>
      </div>
      <section className="source-set" aria-labelledby="lesson-sources-title">
        <div className="source-set-heading">
          <h2 id="lesson-sources-title">Sources</h2>
          <span>{lesson.sources.length} references</span>
        </div>
        <ul className="source-list">
          {lesson.sources.map((source) => (
            <li className="source-entry" key={source.url}>
              <a href={source.url} target="_blank" rel="noreferrer">
                <span className="source-citation">
                  <strong>{source.title}</strong>
                  <span>{source.authors} · {source.year} ↗</span>
                </span>
                <p>{source.relevance}</p>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </header>
  );
}

export function DiagramSection({ lesson }: { lesson: CourseLesson }) {
  const isRecurrent = lesson.id === "character-rnns";
  const isNeuralLanguageModel = lesson.id === "neural-language-models";
  const recurrentSteps = [
    { time: "t − 1", input: "x_(t−1)", previous: "h_(t−2)", state: "h_(t−1)", prediction: "p(x_t)" },
    { time: "t", input: "x_t", previous: "h_(t−1)", state: "h_t", prediction: "p(x_(t+1))" },
    { time: "t + 1", input: "x_(t+1)", previous: "h_t", state: "h_(t+1)", prediction: "p(x_(t+2))" },
  ];
  return (
    <figure className={`concept-diagram${isRecurrent ? " recurrence-diagram" : ""}${isNeuralLanguageModel ? " neural-lm-diagram" : ""}`}>
      <header><span>Mechanism</span><strong>{lesson.diagram.title}</strong></header>
      {isRecurrent ? (
        <div className="recurrence-unroll" role="img" aria-label="Three recurrent time steps. Each input and previous hidden state produce a new hidden state, then logits and a next-character probability. The hidden state flows into the next step and the same parameters are reused.">
          <div className="unroll-columns">
            {recurrentSteps.map((step) => (
              <div className="unroll-step" key={step.time}>
                <span className="unroll-time">position {step.time}</span>
                <code className="unroll-input">{step.input}<small>current character</small></code>
                <i aria-hidden="true">↓</i>
                <strong className="unroll-state">{step.state}<small>new memory</small></strong>
                <code className="unroll-equation">tanh(Wxh {step.input} + Whh {step.previous} + b)</code>
                <i aria-hidden="true">↓</i>
                <code className="unroll-output">logits → softmax → {step.prediction}</code>
              </div>
            ))}
          </div>
          <div className="unroll-rails">
            <span><b>Hidden-state flow</b> h_(t−1) → h_t → h_(t+1)</span>
            <span><b>Generation loop</b> sample from p(x_(t+1)) → encode as x_(t+1)</span>
            <span><b>Shared at every position</b> Wxh · Whh · Why · biases</span>
          </div>
        </div>
      ) : isNeuralLanguageModel ? (
        <div className="neural-probability-path" role="img" aria-label="A two-word context is converted to ids, embedding rows, a mean context vector, vocabulary logits, stable softmax probabilities, and negative log-likelihood for the target word. Unlike an exact count, learned vectors can share parameters across related contexts.">
          <div className="generalization-contrast">
            <span><b>Exact count</b><code>“the researcher” unseen → no direct trigram estimate</code></span>
            <span><b>Learned coordinates</b><code>similar predictive use → shared embedding geometry</code></span>
          </div>
          <ol className="probability-stages">
            {lesson.diagram.nodes.map((node, index) => (
              <li key={node.label}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><strong>{node.label}</strong><code>{node.value}</code></div>
              </li>
            ))}
          </ol>
          <div className="toy-vocabulary" aria-label="Toy output vocabulary labels">
            <span><b>Output order</b> reads · writes · sleeps</span>
            <span><b>Observed target</b> reads</span>
          </div>
        </div>
      ) : (
        <div className="concept-flow">
          {lesson.diagram.nodes.map((node, index) => (
            <div key={node.label}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{node.label}</strong>
              <code>{node.value}</code>
            </div>
          ))}
        </div>
      )}
      <figcaption>{lesson.diagram.caption}</figcaption>
    </figure>
  );
}

export function ParagraphSection({ lesson }: { lesson: CourseLesson }) {
  return (
    <section className="paper-section summary-section" id="summary">
      <div className="section-title"><span>01</span><h2>Summary</h2></div>
      <div className={`summary-layout${lesson.id === "character-rnns" ? " recurrence-summary" : ""}`}>
        <div className="summary-copy">
          {lesson.summary.map((paragraph) => (
            <p key={paragraph.label}><strong>{paragraph.label}</strong> {paragraph.body}</p>
          ))}
        </div>
        <div className="summary-evidence">
          <DiagramSection lesson={lesson} />
          <dl className="fidelity-record">
            <div><dt>Source finding</dt><dd>{lesson.claims.paper}</dd></div>
            <div><dt>Browser reproduction</dt><dd>{lesson.claims.lab}</dd></div>
            <div><dt>Out of scope</dt><dd>{lesson.claims.limit}</dd></div>
          </dl>
        </div>
      </div>
    </section>
  );
}

export function TextBoxSection({ lesson }: { lesson: CourseLesson }) {
  const [openRouterKey, setOpenRouterKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [question, setQuestion] = useState("");
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [asking, setAsking] = useState(false);
  const [questionError, setQuestionError] = useState("");
  const [answerModel, setAnswerModel] = useState("");
  const sourceContext = lesson.sources
    .map((source) => `- "${source.title}" — ${source.authors} (${source.year}). Relevance: ${source.relevance}`)
    .join("\n");

  const askPaper = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    if (!openRouterKey.trim() || !trimmedQuestion || asking) return;
    const nextChat = [...chat, { role: "user", content: trimmedQuestion } as ChatMessage];
    setChat(nextChat);
    setQuestion("");
    setQuestionError("");
    setAsking(true);
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openRouterKey.trim()}`,
          "Content-Type": "application/json",
          "HTTP-Referer": window.location.origin,
          "X-Title": "Latent LLM Paper Course",
        },
        body: JSON.stringify({
          model: "openrouter/auto",
          messages: [
            { role: "system", content: `${lesson.paperContext}\n\nCurated source set:\n${sourceContext}\nSynthesize across these sources when relevant, and identify which source supports each part of the answer.` },
            ...nextChat.map((message) => ({ role: message.role, content: message.content })),
          ],
        }),
      });
      const data = await response.json() as {
        error?: { message?: string };
        model?: string;
        choices?: Array<{ message?: { content?: string } }>;
      };
      if (!response.ok) throw new Error(data.error?.message ?? `OpenRouter returned ${response.status}.`);
      const answer = data.choices?.[0]?.message?.content?.trim();
      if (!answer) throw new Error("The model returned an empty answer.");
      setChat((current) => [...current, { role: "assistant", content: answer }]);
      setAnswerModel(data.model ?? "openrouter/auto");
    } catch (error) {
      setQuestionError(error instanceof Error ? error.message : "The question could not be answered.");
    } finally {
      setAsking(false);
    }
  };

  return (
    <section className="paper-section questions-section" id="questions">
      <div className="section-title"><span>02</span><h2>Questions</h2></div>
      <div className="questions-layout">
        <p className="questions-intro">{lesson.questions.intro}</p>
        <div className="key-panel">
          <label>
            <span>OpenRouter API key</span>
            <div className="key-input">
              <input type={showKey ? "text" : "password"} value={openRouterKey} onChange={(event) => setOpenRouterKey(event.target.value)} placeholder="sk-or-v1-…" autoComplete="off" />
              <button type="button" onClick={() => setShowKey((value) => !value)}>{showKey ? "Hide" : "Show"}</button>
            </div>
          </label>
          <div className="key-note"><i /><span>Your key stays in this tab and clears on refresh.</span></div>
          <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">Get a key ↗</a>
        </div>
        <div className="paper-chat">
          <div className="chat-log" aria-live="polite">
            {chat.length === 0 ? (
              <div className="empty-chat">
                <span>Suggested questions</span>
                {lesson.questions.suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => setQuestion(suggestion)}>{suggestion}</button>)}
              </div>
            ) : chat.map((message, index) => (
              <div className={`chat-message ${message.role}`} key={`${message.role}-${index}`}>
                <span>{message.role === "user" ? "You" : "Source guide"}</span><p>{message.content}</p>
              </div>
            ))}
          </div>
          <form className="question-form" onSubmit={askPaper}>
            <textarea aria-label="Question about the source set" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask anything about these sources…" />
            <button type="submit" disabled={!openRouterKey.trim() || !question.trim() || asking}>{asking ? "Thinking…" : "Ask"}</button>
          </form>
          <div className="chat-status">
            <span>{questionError || (answerModel ? `Answered by ${answerModel}` : "Grounded in the lesson sources")}</span>
            {openRouterKey ? <button type="button" onClick={() => setOpenRouterKey("")}>Clear key</button> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function starterCodeFor(block: CodeBlock) {
  const signature = block.code.split("\n")[0];
  return `${signature}\n  // TODO: implement ${block.label.toLowerCase()}.\n}`;
}

function projectSeedForLesson(lesson: CourseLesson, hidden: string[], currentAnswers: Record<string, string>, verified: string[]): LessonProjectSeed {
  const blocks = lesson.implementation.codeBlocks;
  const contentFor = (practice: boolean) => lessonImplementationSource(lesson, blocks
    .map((block, index) => `// ${String(index + 1).padStart(2, "0")} · ${block.label}\n${practice && hidden.includes(block.id) ? currentAnswers[block.id] ?? "" : block.code}`));
  return {
    path: `${lesson.courseId ?? "models"}/${lesson.implementation.filename}`,
    courseId: lesson.courseId ?? "models",
    lessonId: lesson.id,
    title: lesson.title,
    content: contentFor(true),
    referenceContent: contentFor(false),
    verifiedCells: verified.length,
    totalCells: blocks.length,
  };
}

export function CodingSection({ lesson: lessonProp }: { lesson: CourseLesson }) {
  // RSC payloads can replace an equivalent prop object after learner-state events.
  // Resolve it to the module-owned definition so hydration remains single-shot.
  const lesson = courseLessons.find((candidate) => candidate.id === lessonProp.id) ?? lessonProp;
  const blocks = lesson.implementation.codeBlocks;
  const projectPath = `${lesson.courseId ?? "models"}/${lesson.implementation.filename}`;
  const [hiddenBlocks, setHiddenBlocks] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [verifiedBlockIds, setVerifiedBlockIds] = useState<string[]>([]);
  const [verifiedSources, setVerifiedSources] = useState<Record<string, string>>({});
  const [cellResults, setCellResults] = useState<Record<string, CheckResult | undefined>>({});
  const [practiceMessage, setPracticeMessage] = useState("The reference implementation is complete and runnable.");
  const [runningBlockIds, setRunningBlockIds] = useState<string[]>([]);
  const [artifactRevision, setArtifactRevision] = useState(0);
  const [practiceReady, setPracticeReady] = useState(false);
  const hiddenBlocksRef = useRef<string[]>([]);
  const answersRef = useRef<Record<string, string>>({});
  const verifiedBlockIdsRef = useRef<string[]>([]);
  const verifiedSourcesRef = useRef<Record<string, string>>({});
  const runningBlockIdsRef = useRef<string[]>([]);
  const practiceReadyRef = useRef(false);

  useEffect(() => {
    let active = true;
    void waitForPracticeHydration(
      initializeProjectPersistence(),
      initializeLearnerPersistence(),
    ).then(() => {
      if (!active || practiceReadyRef.current) return;
      const saved = loadLearnerState().lessons[lesson.id];
      const savedHidden = saved?.hiddenBlocks.filter((id) => blocks.some((block) => block.id === id)) ?? [];
      const savedAnswers = saved?.answers ?? {};
      const restoredVerification = restoreSourceBoundVerification(
        blocks,
        savedHidden,
        savedAnswers,
        saved?.verifiedCells ?? [],
        saved?.verifiedSources ?? {},
      );
      const savedVerified = restoredVerification.ids;
      const verifiedSources = restoredVerification.sources;
      hiddenBlocksRef.current = savedHidden;
      answersRef.current = savedAnswers;
      verifiedBlockIdsRef.current = savedVerified;
      verifiedSourcesRef.current = verifiedSources;
      practiceReadyRef.current = true;
      setHiddenBlocks(savedHidden);
      setAnswers(savedAnswers);
      setVerifiedBlockIds(savedVerified);
      setVerifiedSources(verifiedSources);
      if ((saved?.verifiedCells.length ?? 0) !== savedVerified.length) {
        recordVerifiedCells(lesson.id, savedVerified, verifiedSources);
      }
      ensureProjectWorkspace([projectSeedForLesson(lesson, savedHidden, savedAnswers, savedVerified), ...canonicalProjectSeeds()]);
      setPracticeMessage(savedHidden.length
        ? "Your device-local practice state and project file were restored."
        : "The reference implementation is complete and runnable.");
      setPracticeReady(true);
    });
    return () => { active = false; };
  }, [blocks, lesson]);

  const sourceFor = (block: CodeBlock) => practiceBlockSource(block, hiddenBlocksRef.current, answersRef.current);
  const applyPracticeState = (
    nextHidden: string[],
    nextAnswers: Record<string, string>,
    nextVerified: string[],
    nextVerifiedSources: Record<string, string>,
  ) => {
    hiddenBlocksRef.current = nextHidden;
    answersRef.current = nextAnswers;
    verifiedBlockIdsRef.current = nextVerified;
    verifiedSourcesRef.current = nextVerifiedSources;
    setHiddenBlocks(nextHidden);
    setAnswers(nextAnswers);
    setVerifiedBlockIds(nextVerified);
    setVerifiedSources(nextVerifiedSources);
  };
  const setRunning = (ids: string[]) => {
    runningBlockIdsRef.current = ids;
    setRunningBlockIds(ids);
  };
  const toggleBlock = (block: CodeBlock) => {
    const currentHidden = hiddenBlocksRef.current;
    const nextHidden = currentHidden.includes(block.id) ? currentHidden.filter((id) => id !== block.id) : [...currentHidden, block.id];
    const nextAnswers = { ...answersRef.current, [block.id]: answersRef.current[block.id] ?? starterCodeFor(block) };
    const invalidated = invalidateBlockVerification({ ids: verifiedBlockIdsRef.current, sources: verifiedSourcesRef.current }, block.id);
    const nextVerified = invalidated.ids;
    const nextVerifiedSources = invalidated.sources;
    setCellResults((current) => ({ ...current, [block.id]: undefined }));
    applyPracticeState(nextHidden, nextAnswers, nextVerified, nextVerifiedSources);
    saveLessonPractice(lesson.id, nextHidden, nextAnswers);
    recordVerifiedCells(lesson.id, nextVerified, nextVerifiedSources);
    saveLessonProjectFile(projectSeedForLesson(lesson, nextHidden, nextAnswers, nextVerified));
    setPracticeMessage("Implementation changed. Run the affected cell again.");
  };
  const hideAll = () => {
    const nextHidden = blocks.map((block) => block.id);
    const nextAnswers = Object.fromEntries(blocks.map((block) => [block.id, starterCodeFor(block)]));
    applyPracticeState(nextHidden, nextAnswers, [], {});
    saveLessonPractice(lesson.id, nextHidden, nextAnswers);
    recordVerifiedCells(lesson.id, [], {});
    saveLessonProjectFile(projectSeedForLesson(lesson, nextHidden, nextAnswers, []));
    setCellResults({});
    setPracticeMessage("All conceptual blocks are hidden. Reconstruct them in any valid way.");
  };
  const showSolution = () => {
    const currentAnswers = answersRef.current;
    applyPracticeState([], currentAnswers, [], {});
    saveLessonPractice(lesson.id, [], currentAnswers);
    recordVerifiedCells(lesson.id, [], {});
    saveLessonProjectFile(projectSeedForLesson(lesson, [], currentAnswers, []));
    setCellResults({});
    setPracticeMessage("Reference solution restored. Previous attempts remain available if you hide a cell again.");
  };
  const runCell = async (block: CodeBlock) => {
    if (!practiceReadyRef.current || runningBlockIdsRef.current.length) return;
    const sourceSnapshot = sourceFor(block);
    const hiddenSnapshot = [...hiddenBlocksRef.current];
    const answersSnapshot = { ...answersRef.current };
    setRunning([block.id]);
    setPracticeMessage(`Compiling ${block.label} in the isolated browser lab…`);
    try {
      const [result] = await runPracticeContracts({
        path: projectPath,
        source: lessonImplementationSource(lesson, [sourceSnapshot]),
        contractIds: [`${lesson.id}/${block.id}`],
      });
      const check = result ?? { label: block.label, passed: false, detail: "The isolated test returned no result." };
      if (sourceFor(block) !== sourceSnapshot) {
        setCellResults((current) => ({ ...current, [block.id]: undefined }));
        setPracticeMessage(`${block.label} changed while its check was running. Run the current source again.`);
        return;
      }
      const currentVerification = { ids: verifiedBlockIdsRef.current, sources: verifiedSourcesRef.current };
      const nextVerification = check.passed
        ? bindBlockVerification(currentVerification, block.id, sourceSnapshot)
        : invalidateBlockVerification(currentVerification, block.id);
      const nextVerified = nextVerification.ids;
      const nextVerifiedSources = nextVerification.sources;
      applyPracticeState(hiddenSnapshot, answersSnapshot, nextVerified, nextVerifiedSources);
      recordVerifiedCells(lesson.id, nextVerified, nextVerifiedSources);
      saveLessonProjectFile(projectSeedForLesson(lesson, hiddenSnapshot, answersSnapshot, nextVerified));
      setCellResults((current) => ({ ...current, [block.id]: check }));
      setPracticeMessage(check.passed ? `${block.label} passed host-owned assertions.` : `${block.label} needs attention. Review the failed behavior below; your other cells were not changed.`);
    } catch (error) {
      const check = { label: block.label, passed: false, detail: error instanceof Error ? error.message : "The isolated test failed." };
      setCellResults((current) => ({ ...current, [block.id]: check }));
      setPracticeMessage(`${block.label} stopped safely.`);
    } finally {
      setRunning([]);
    }
  };
  const runAll = async () => {
    if (!practiceReadyRef.current || runningBlockIdsRef.current.length) return;
    const hiddenSnapshot = [...hiddenBlocksRef.current];
    const answersSnapshot = { ...answersRef.current };
    const sourceSnapshots = Object.fromEntries(blocks.map((block) => [block.id, sourceFor(block)]));
    setRunning(blocks.map((block) => block.id));
    setPracticeMessage("Compiling this lesson and running every contract in an isolated worker…");
    try {
      const combinedSource = lessonImplementationSource(lesson, blocks.map((block) => sourceSnapshots[block.id]));
      const results = await runPracticeContracts({
        path: projectPath,
        source: combinedSource,
        contractIds: blocks.map((block) => `${lesson.id}/${block.id}`),
      });
      const resultById = new Map(results.map((result) => [result.id, result]));
      const ordered = blocks.map((block) => resultById.get(`${lesson.id}/${block.id}`) ?? { id: `${lesson.id}/${block.id}`, path: projectPath, label: block.label, passed: false, detail: "The isolated test returned no result." });
      if (blocks.some((block) => sourceFor(block) !== sourceSnapshots[block.id])) {
        setCellResults({});
        setPracticeMessage("The lesson source changed while checks were running. Run the current source again.");
        return;
      }
      const nextVerified = blocks.filter((_, index) => ordered[index].passed).map((block) => block.id);
      const nextVerifiedSources = Object.fromEntries(nextVerified.map((id) => [id, sourceSnapshots[id]]));
      applyPracticeState(hiddenSnapshot, answersSnapshot, nextVerified, nextVerifiedSources);
      recordVerifiedCells(lesson.id, nextVerified, nextVerifiedSources);
      saveLessonProjectFile(projectSeedForLesson(lesson, hiddenSnapshot, answersSnapshot, nextVerified));
      setCellResults(Object.fromEntries(blocks.map((block, index) => [block.id, ordered[index]])));
      const passed = ordered.filter((result) => result.passed).length;
      if (passed === ordered.length) {
        try {
          const artifact = await recordValidatedLessonArtifact({
            lessonId: lesson.id,
            source: combinedSource,
            results: ordered.map((result, index) => ({
              id: result.id ?? `${lesson.id}/${blocks[index].id}`,
              label: result.label,
              passed: result.passed,
              detail: result.detail,
            })),
          });
          setArtifactRevision((revision) => revision + 1);
          setPracticeMessage(`All isolated behavioral checks pass. Artifact ${artifact.contentHash.slice(7, 19)} is ready for the next lesson.`);
        } catch (artifactError) {
          setPracticeMessage(`All isolated behavioral checks pass, but the artifact could not be stored: ${artifactError instanceof Error ? artifactError.message : "local storage is unavailable"}`);
        }
      } else {
        setPracticeMessage(`${passed} of ${ordered.length} isolated behavioral checks pass.`);
      }
    } catch (error) {
      setPracticeMessage(error instanceof Error ? error.message : "The isolated lesson test failed safely.");
    } finally {
      setRunning([]);
    }
  };
  const verifiedCells = verifiedBlockIds.length;

  return (
    <section className="paper-section implementation-section" id="implementation">
      <div className="section-title"><span>03</span><h2>Implementation</h2></div>
      <p className="implementation-intro">{lesson.implementation.intro}</p>
      {lesson.implementation.tensorOps?.length ? (
        <div className="tensor-runtime-strip">
          <div><span>Tensor runtime</span><strong>runtime/latent-tensor.js</strong><p>Shape checks and automatic differentiation are provided; you implement the model operation.</p></div>
          <div aria-label="Latent Tensor operations used in this lesson">
            {latentTensorOperations(lesson.implementation.tensorOps).map((operation) => <span title={operation.purpose} key={operation.name}>{operation.name}</span>)}
          </div>
        </div>
      ) : null}
      <div className="practice-editor" aria-busy={!practiceReady}>
        <div className="editor-toolbar">
          <div className="editor-file"><span>{projectPath}</span><strong>{!practiceReady ? "Restoring saved work…" : hiddenBlocks.length === 0 ? "Reference · saved" : `${hiddenBlocks.length} cells in practice`}</strong></div>
          <div className="editor-progress" aria-label={`${verifiedCells} of ${blocks.length} cells verified`}>
            <span>{verifiedCells}/{blocks.length} verified</span><i><b style={{ width: `${verifiedCells / blocks.length * 100}%` }} /></i>
          </div>
          <div className="toolbar-actions"><button type="button" onClick={hideAll} disabled={!practiceReady || runningBlockIds.length > 0}>Practice all</button><button type="button" onClick={showSolution} disabled={!practiceReady || hiddenBlocks.length === 0 || runningBlockIds.length > 0}>Restore all</button><Link href={`/workspace?file=${encodeURIComponent(`${lesson.courseId ?? "models"}/${lesson.implementation.filename}`)}`}>Open in IDE ↗</Link></div>
        </div>
        <div className="code-surface">
          {lesson.implementation.tensorOps?.length ? (
            <div className="tensor-import-line"><span>dependency</span><code>{lessonImplementationPrelude(lesson)}</code><em>read only</em></div>
          ) : null}
          {blocks.map((block, blockIndex) => {
            const hidden = hiddenBlocks.includes(block.id);
            const startLine = blocks.slice(0, blockIndex).reduce((line, previous) => line + previous.code.split("\n").length + 1, lesson.implementation.tensorOps?.length ? 3 : 1);
            const result = cellResults[block.id];
            return (
              <div
                className={`practice-block ${hidden ? "is-hidden" : ""}`}
                data-reference-code={encodeURIComponent(block.code)}
                key={block.id}
              >
                <div className="block-heading">
                  <div><span>0{blockIndex + 1}</span><strong>{block.label}</strong><em>{block.purpose}</em></div>
                  <div className="block-actions">
                    <button className="run-cell-button" type="button" onClick={() => void runCell(block)} disabled={!practiceReady || runningBlockIds.length > 0}>{runningBlockIds.includes(block.id) ? "Running…" : "Run cell"}</button>
                    <button type="button" onClick={() => toggleBlock(block)} disabled={!practiceReady || runningBlockIds.length > 0}>{hidden ? "Show reference" : "Practice cell"}</button>
                  </div>
                </div>
                {block.concepts?.length ? <div className="concept-strip" aria-label={`${block.label} variables`}>{block.concepts.map((concept) => <span key={concept.name}><code>{concept.name}</code><em>{concept.detail}</em></span>)}</div> : null}
                {hidden ? (
                  <div className="answer-area">
                    <div className="practice-guidance">
                      <div><span>Practice mode</span><strong>Complete, then run.</strong></div>
                      <button type="button" disabled={!practiceReady || runningBlockIds.length > 0} onClick={() => {
                        const currentHidden = [...hiddenBlocksRef.current];
                        const nextAnswers = { ...answersRef.current, [block.id]: starterCodeFor(block) };
                        const invalidated = invalidateBlockVerification({ ids: verifiedBlockIdsRef.current, sources: verifiedSourcesRef.current }, block.id);
                        const nextVerified = invalidated.ids;
                        const nextVerifiedSources = invalidated.sources;
                        applyPracticeState(currentHidden, nextAnswers, nextVerified, nextVerifiedSources);
                        saveLessonPractice(lesson.id, currentHidden, nextAnswers);
                        recordVerifiedCells(lesson.id, nextVerified, nextVerifiedSources);
                        saveLessonProjectFile(projectSeedForLesson(lesson, currentHidden, nextAnswers, nextVerified));
                        setCellResults((current) => ({ ...current, [block.id]: undefined }));
                      }}>Reset starter</button>
                    </div>
                    <textarea aria-label={`Reimplement ${block.label}`} value={answers[block.id] ?? ""} disabled={!practiceReady || runningBlockIds.length > 0} onChange={(event) => {
                      const currentHidden = [...hiddenBlocksRef.current];
                      const nextAnswers = { ...answersRef.current, [block.id]: event.target.value };
                      const invalidated = invalidateBlockVerification({ ids: verifiedBlockIdsRef.current, sources: verifiedSourcesRef.current }, block.id);
                      const nextVerified = invalidated.ids;
                      const nextVerifiedSources = invalidated.sources;
                      applyPracticeState(currentHidden, nextAnswers, nextVerified, nextVerifiedSources);
                      saveLessonPractice(lesson.id, currentHidden, nextAnswers);
                      recordVerifiedCells(lesson.id, nextVerified, nextVerifiedSources);
                      saveLessonProjectFile(projectSeedForLesson(lesson, currentHidden, nextAnswers, nextVerified));
                      setCellResults((current) => ({ ...current, [block.id]: undefined }));
                      setPracticeMessage("Implementation changed. Run the affected cell again.");
                    }} spellCheck="false" />
                  </div>
                ) : (
                  <div className="code-lines">{block.code.split("\n").map((line, lineIndex) => <div key={`${block.id}-${lineIndex}`}><span>{startLine + lineIndex}</span><code>{line || " "}</code></div>)}</div>
                )}
                <div className="cell-footer">
                  {result ? <span className={result.passed ? "cell-result passed" : "cell-result failed"}><i>{result.passed ? "✓" : "×"}</i>{result.detail}</span> : verifiedBlockIds.includes(block.id) && verifiedSources[block.id] === (hidden ? answers[block.id] ?? "" : block.code) ? <span className="cell-result passed"><i>✓</i>Verified previously on this device</span> : <span>{practiceReady ? "Not run" : "Waiting for saved progress"}</span>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="editor-footer"><p>{practiceReady ? practiceMessage : "Restoring your saved practice before editing is enabled…"}</p><button type="button" onClick={() => void runAll()} disabled={!practiceReady || runningBlockIds.length > 0}>{runningBlockIds.length ? "Running in sandbox…" : "Run behavioral checks"}</button></div>
      </div>
      <LessonExperiment lesson={lesson} />
      <ArtifactRuntimePanel lesson={lesson} refreshKey={artifactRevision} />
    </section>
  );
}

export function PaperLab({ lesson }: { lesson: CourseLesson }) {
  const learnerState = useLearnerState();
  const trackLessons = courseLessons.filter((candidate) => candidate.courseId === lesson.courseId);
  const trackIndex = trackLessons.findIndex((candidate) => candidate.id === lesson.id);
  const previous = trackLessons[trackIndex - 1];
  const next = trackLessons[trackIndex + 1];
  const courseHref = `/courses/${lesson.courseId ?? "models"}`;
  const progress = learnerState.lessons[lesson.id];
  const complete = lessonIsComplete(learnerState, lesson.id, lesson.implementation.codeBlocks.length);
  return (
    <main>
      <Atmosphere />
      <header className="site-header lesson-header">
        <Link className="wordmark" href="/" aria-label="Latent course home"><i />latent</Link>
        <nav aria-label="Lesson navigation"><a href="#summary">Summary</a><a href="#questions">Questions</a><a href="#implementation">Implementation</a><a href="#artifacts">Artifacts</a></nav>
        <span>{lesson.courseTitle ?? "Model Foundations"} · {String(trackIndex + 1).padStart(2, "0")} / {String(trackLessons.length).padStart(2, "0")}</span>
      </header>
      <article className="paper-page" id="top">
        <HeaderSection lesson={lesson} />
        <ParagraphSection lesson={lesson} />
        <TextBoxSection lesson={lesson} />
        <CodingSection lesson={lesson} />
        <footer className="paper-footer lesson-footer">
          {previous ? <Link href={`/lessons/${previous.id}`}>← {previous.title}</Link> : <Link href={courseHref}>← Module</Link>}
          <p>{complete ? `Lesson ${trackIndex + 1} complete` : `${progress?.verifiedCells.length ?? 0}/${lesson.implementation.codeBlocks.length} checks · ${progress?.experimentComplete ? "experiment complete" : "experiment pending"}`}</p>
          {next ? <Link href={`/lessons/${next.id}`}>{next.title} →</Link> : <Link href={courseHref}>Module ↑</Link>}
        </footer>
      </article>
    </main>
  );
}
