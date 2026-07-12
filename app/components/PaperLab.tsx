"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { CodeBlock, CourseLesson, LessonSource } from "../lib/lesson-types";
import { courseLessons } from "../lessons/course";
import { LessonExperiment } from "./LessonExperiment";
import {
  lessonIsComplete,
  loadLearnerState,
  recordVerifiedCells,
  saveLessonPractice,
  useLearnerState,
} from "../lib/learner-state";
import { ensureProjectWorkspace, saveLessonProjectFile, type LessonProjectSeed } from "../lib/project-workspace";
import { runPracticeContracts } from "../features/ide/browser-lab-service";
import { ArtifactRuntimePanel } from "../features/artifacts/ArtifactRuntimePanel";
import { recordValidatedLessonArtifact } from "../features/artifacts/lesson-artifacts";

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
  const primary = lesson.sources[0];
  const supporting = lesson.sources.slice(1);
  const sourceCard = (source: LessonSource) => (
    <a href={source.url} target="_blank" rel="noreferrer" key={`${source.role}-${source.title}`}>
      <span>{source.role} · {source.year}</span>
      <strong>{source.title}</strong>
      <p>{source.relevance}</p>
      <em>{source.authors} ↗</em>
    </a>
  );
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
      <div className="source-set" aria-label={`${lesson.sources.length} sources for ${lesson.title}`}>
        <div className="source-set-heading">
          <span>Source set</span>
          <em>{lesson.sources.length} primary and supporting references</em>
        </div>
        <div className="source-set-grid">
          {primary ? sourceCard(primary) : null}
          <details className="supporting-sources">
            <summary><span>{supporting.length} supporting sources</span><em>{supporting.map((source) => source.title).join(" · ")}</em></summary>
            <div>{supporting.map(sourceCard)}</div>
          </details>
        </div>
      </div>
    </header>
  );
}

export function DiagramSection({ lesson }: { lesson: CourseLesson }) {
  return (
    <figure className="concept-diagram">
      <header><span>Mechanism</span><strong>{lesson.diagram.title}</strong></header>
      <div className="concept-flow">
        {lesson.diagram.nodes.map((node, index) => (
          <div key={node.label}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{node.label}</strong>
            <code>{node.value}</code>
          </div>
        ))}
      </div>
      <figcaption>{lesson.diagram.caption}</figcaption>
    </figure>
  );
}

export function ParagraphSection({ lesson }: { lesson: CourseLesson }) {
  return (
    <section className="paper-section summary-section" id="summary">
      <div className="section-title"><span>01</span><h2>Summary</h2></div>
      <div className="summary-layout">
        <div className="summary-copy">
          {lesson.summary.map((paragraph) => (
            <p key={paragraph.label}><strong>{paragraph.label}</strong> {paragraph.body}</p>
          ))}
        </div>
        <div className="summary-evidence">
          <DiagramSection lesson={lesson} />
          <dl className="fidelity-record">
            <div><dt>Primary claim</dt><dd>{lesson.claims.paper}</dd></div>
            <div><dt>Browser reproduction</dt><dd>{lesson.claims.lab}</dd></div>
            <div><dt>Boundary</dt><dd>{lesson.claims.limit}</dd></div>
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
    .map((source) => `- ${source.role}: "${source.title}" — ${source.authors} (${source.year}). Relevance: ${source.relevance}`)
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
        <aside className="key-panel">
          <p>{lesson.questions.intro}</p>
          <label>
            <span>OpenRouter API key</span>
            <div className="key-input">
              <input type={showKey ? "text" : "password"} value={openRouterKey} onChange={(event) => setOpenRouterKey(event.target.value)} placeholder="sk-or-v1-…" autoComplete="off" />
              <button type="button" onClick={() => setShowKey((value) => !value)}>{showKey ? "Hide" : "Show"}</button>
            </div>
          </label>
          <div className="key-note"><i /><span>Held only in this tab&apos;s memory and sent directly to OpenRouter. Refreshing clears it.</span></div>
          <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">Create a limited key ↗</a>
        </aside>
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
            <textarea aria-label="Question about the source set" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask across the papers, specifications, implementations, or lesson boundaries…" />
            <button type="submit" disabled={!openRouterKey.trim() || !question.trim() || asking}>{asking ? "Thinking…" : "Ask sources"}</button>
          </form>
          <div className="chat-status">
            <span>{questionError || (answerModel ? `Answered by ${answerModel}` : "Grounded in the technical lesson notes")}</span>
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
  const contentFor = (practice: boolean) => blocks
    .map((block, index) => `// ${String(index + 1).padStart(2, "0")} · ${block.label}\n${practice && hidden.includes(block.id) ? currentAnswers[block.id] ?? "" : block.code}`)
    .join("\n\n");
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

export function CodingSection({ lesson }: { lesson: CourseLesson }) {
  const blocks = lesson.implementation.codeBlocks;
  const projectPath = `${lesson.courseId ?? "models"}/${lesson.implementation.filename}`;
  const [hiddenBlocks, setHiddenBlocks] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [verifiedBlockIds, setVerifiedBlockIds] = useState<string[]>([]);
  const [cellResults, setCellResults] = useState<Record<string, CheckResult | undefined>>({});
  const [checks, setChecks] = useState<CheckResult[]>([]);
  const [practiceMessage, setPracticeMessage] = useState("The reference implementation is complete and runnable.");
  const [runningBlockIds, setRunningBlockIds] = useState<string[]>([]);
  const [artifactRevision, setArtifactRevision] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = loadLearnerState().lessons[lesson.id];
      const savedHidden = saved?.hiddenBlocks.filter((id) => blocks.some((block) => block.id === id)) ?? [];
      const savedAnswers = saved?.answers ?? {};
      const savedVerified = saved?.verifiedCells.filter((id) => blocks.some((block) => block.id === id)) ?? [];
      setHiddenBlocks(savedHidden);
      setAnswers(savedAnswers);
      setVerifiedBlockIds(savedVerified);
      ensureProjectWorkspace([projectSeedForLesson(lesson, savedHidden, savedAnswers, savedVerified)]);
      if (savedHidden.length) setPracticeMessage("Your device-local practice state and project file were restored.");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [blocks, lesson]);

  const sourceFor = (block: CodeBlock) => hiddenBlocks.includes(block.id) ? answers[block.id] ?? "" : block.code;
  const toggleBlock = (block: CodeBlock) => {
    const nextHidden = hiddenBlocks.includes(block.id) ? hiddenBlocks.filter((id) => id !== block.id) : [...hiddenBlocks, block.id];
    const nextAnswers = { ...answers, [block.id]: answers[block.id] ?? starterCodeFor(block) };
    const nextVerified = verifiedBlockIds.filter((id) => id !== block.id);
    setChecks([]);
    setCellResults((current) => ({ ...current, [block.id]: undefined }));
    setHiddenBlocks(nextHidden);
    setAnswers(nextAnswers);
    setVerifiedBlockIds(nextVerified);
    saveLessonPractice(lesson.id, nextHidden, nextAnswers);
    recordVerifiedCells(lesson.id, nextVerified);
    saveLessonProjectFile(projectSeedForLesson(lesson, nextHidden, nextAnswers, nextVerified));
    setPracticeMessage("Implementation changed. Run the affected cell again.");
  };
  const hideAll = () => {
    const nextHidden = blocks.map((block) => block.id);
    const nextAnswers = Object.fromEntries(blocks.map((block) => [block.id, starterCodeFor(block)]));
    setHiddenBlocks(nextHidden);
    setAnswers(nextAnswers);
    setVerifiedBlockIds([]);
    saveLessonPractice(lesson.id, nextHidden, nextAnswers);
    recordVerifiedCells(lesson.id, []);
    saveLessonProjectFile(projectSeedForLesson(lesson, nextHidden, nextAnswers, []));
    setCellResults({});
    setChecks([]);
    setPracticeMessage("All conceptual blocks are hidden. Reconstruct them in any valid way.");
  };
  const showSolution = () => {
    setHiddenBlocks([]);
    saveLessonPractice(lesson.id, [], answers);
    saveLessonProjectFile(projectSeedForLesson(lesson, [], answers, verifiedBlockIds));
    setCellResults({});
    setChecks([]);
    setPracticeMessage("Reference solution restored. Previous attempts remain available if you hide a cell again.");
  };
  const runCell = async (block: CodeBlock) => {
    if (runningBlockIds.length) return;
    setRunningBlockIds([block.id]);
    setPracticeMessage(`Compiling ${block.label} in the isolated browser lab…`);
    try {
      const [result] = await runPracticeContracts({
        path: projectPath,
        source: sourceFor(block),
        contractIds: [`${lesson.id}/${block.id}`],
      });
      const check = result ?? { label: block.label, passed: false, detail: "The isolated test returned no result." };
      const nextVerified = check.passed ? [...new Set([...verifiedBlockIds, block.id])] : verifiedBlockIds.filter((id) => id !== block.id);
      setVerifiedBlockIds(nextVerified);
      recordVerifiedCells(lesson.id, nextVerified);
      saveLessonProjectFile(projectSeedForLesson(lesson, hiddenBlocks, answers, nextVerified));
      setCellResults((current) => ({ ...current, [block.id]: check }));
      setPracticeMessage(check.passed ? `${block.label} passed host-owned assertions.` : `${block.label} needs attention.`);
    } catch (error) {
      const check = { label: block.label, passed: false, detail: error instanceof Error ? error.message : "The isolated test failed." };
      setCellResults((current) => ({ ...current, [block.id]: check }));
      setPracticeMessage(`${block.label} stopped safely.`);
    } finally {
      setRunningBlockIds([]);
    }
  };
  const runAll = async () => {
    if (runningBlockIds.length) return;
    setRunningBlockIds(blocks.map((block) => block.id));
    setPracticeMessage("Compiling this lesson and running every contract in an isolated worker…");
    try {
      const combinedSource = blocks.map((block) => sourceFor(block)).join("\n\n");
      const results = await runPracticeContracts({
        path: projectPath,
        source: combinedSource,
        contractIds: blocks.map((block) => `${lesson.id}/${block.id}`),
      });
      const resultById = new Map(results.map((result) => [result.id, result]));
      const ordered = blocks.map((block) => resultById.get(`${lesson.id}/${block.id}`) ?? { id: `${lesson.id}/${block.id}`, path: projectPath, label: block.label, passed: false, detail: "The isolated test returned no result." });
      const nextVerified = blocks.filter((_, index) => ordered[index].passed).map((block) => block.id);
      setVerifiedBlockIds(nextVerified);
      recordVerifiedCells(lesson.id, nextVerified);
      saveLessonProjectFile(projectSeedForLesson(lesson, hiddenBlocks, answers, nextVerified));
      setChecks(ordered);
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
      setRunningBlockIds([]);
    }
  };
  const passedChecks = checks.filter((check) => check.passed).length;
  const verifiedCells = verifiedBlockIds.length;

  return (
    <section className="paper-section implementation-section" id="implementation">
      <div className="section-title"><span>03</span><h2>Implementation</h2></div>
      <p className="implementation-intro">{lesson.implementation.intro}</p>
      <div className="practice-editor">
        <div className="editor-toolbar">
          <div className="editor-file"><span>{projectPath}</span><strong>{hiddenBlocks.length === 0 ? "Complete reference · saved to capstone" : `Practice · ${hiddenBlocks.length} cells active · saved locally`}</strong></div>
          <div className="editor-progress" aria-label={`${verifiedCells} of ${blocks.length} cells verified`}>
            <span>{verifiedCells}/{blocks.length} verified</span><i><b style={{ width: `${verifiedCells / blocks.length * 100}%` }} /></i>
          </div>
          <div className="toolbar-actions"><button type="button" onClick={hideAll}>Practice all</button><button type="button" onClick={showSolution} disabled={hiddenBlocks.length === 0}>Restore all</button><Link href={`/workspace?file=${encodeURIComponent(`${lesson.courseId ?? "models"}/${lesson.implementation.filename}`)}`}>Open this file in IDE ↗</Link></div>
        </div>
        <div className="code-surface">
          {blocks.map((block, blockIndex) => {
            const hidden = hiddenBlocks.includes(block.id);
            const startLine = blocks.slice(0, blockIndex).reduce((line, previous) => line + previous.code.split("\n").length + 1, 1);
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
                    <button className="run-cell-button" type="button" onClick={() => void runCell(block)} disabled={runningBlockIds.length > 0}>{runningBlockIds.includes(block.id) ? "Running…" : "Run cell"}</button>
                    <button type="button" onClick={() => toggleBlock(block)} disabled={runningBlockIds.length > 0}>{hidden ? "Show reference" : "Practice cell"}</button>
                  </div>
                </div>
                {block.concepts?.length ? <div className="concept-strip" aria-label={`${block.label} variables`}>{block.concepts.map((concept) => <span key={concept.name}><code>{concept.name}</code><em>{concept.detail}</em></span>)}</div> : null}
                {hidden ? (
                  <div className="answer-area">
                    <div className="practice-guidance">
                      <div><span>Practice mode</span><strong>Complete the function, then run this cell.</strong></div>
                      <button type="button" onClick={() => {
                        const nextAnswers = { ...answers, [block.id]: starterCodeFor(block) };
                        const nextVerified = verifiedBlockIds.filter((id) => id !== block.id);
                        setAnswers(nextAnswers);
                        setVerifiedBlockIds(nextVerified);
                        saveLessonPractice(lesson.id, hiddenBlocks, nextAnswers);
                        recordVerifiedCells(lesson.id, nextVerified);
                        saveLessonProjectFile(projectSeedForLesson(lesson, hiddenBlocks, nextAnswers, nextVerified));
                        setCellResults((current) => ({ ...current, [block.id]: undefined }));
                      }}>Reset starter</button>
                    </div>
                    <textarea aria-label={`Reimplement ${block.label}`} value={answers[block.id] ?? ""} onChange={(event) => {
                      const nextAnswers = { ...answers, [block.id]: event.target.value };
                      const nextVerified = verifiedBlockIds.filter((id) => id !== block.id);
                      setAnswers(nextAnswers);
                      setVerifiedBlockIds(nextVerified);
                      saveLessonPractice(lesson.id, hiddenBlocks, nextAnswers);
                      recordVerifiedCells(lesson.id, nextVerified);
                      saveLessonProjectFile(projectSeedForLesson(lesson, hiddenBlocks, nextAnswers, nextVerified));
                      setCellResults((current) => ({ ...current, [block.id]: undefined }));
                      setChecks([]);
                      setPracticeMessage("Implementation changed. Run the affected cell again.");
                    }} spellCheck="false" />
                  </div>
                ) : (
                  <div className="code-lines">{block.code.split("\n").map((line, lineIndex) => <div key={`${block.id}-${lineIndex}`}><span>{startLine + lineIndex}</span><code>{line || " "}</code></div>)}</div>
                )}
                <div className="cell-footer">
                  {result ? <span className={result.passed ? "cell-result passed" : "cell-result failed"}><i>{result.passed ? "✓" : "×"}</i>{result.detail}</span> : <span>Not run yet · checks behavior, not exact text.</span>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="editor-footer"><p>{practiceMessage}</p><button type="button" onClick={() => void runAll()} disabled={runningBlockIds.length > 0}>{runningBlockIds.length ? "Running in sandbox…" : "Run behavioral checks"}</button></div>
      </div>
      {checks.length ? (
        <div className="check-grid" aria-live="polite">
          {checks.map((check) => <div className={check.passed ? "check passed" : "check failed"} key={check.label}><i>{check.passed ? "✓" : "×"}</i><span><strong>{check.label}</strong><em>{check.detail}</em></span></div>)}
          <div className="check-score"><strong>{passedChecks}/{checks.length}</strong><span>checks pass</span></div>
        </div>
      ) : null}
      <ArtifactRuntimePanel lesson={lesson} refreshKey={artifactRevision} />
      <LessonExperiment lesson={lesson} />
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
      <header className="site-header">
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
