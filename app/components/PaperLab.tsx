"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import Link from "next/link";
import type { CodeBlock, CourseLesson } from "../lib/lesson-types";
import { courseLessons } from "../lessons/course";
import { LessonExperiment } from "./LessonExperiment";

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
      <a className="paper-link" href={lesson.paperUrl} target="_blank" rel="noreferrer">
        <span>Original source</span>
        <strong>{lesson.paperTitle}</strong>
        <em>Read ↗</em>
      </a>
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
            <div><dt>Paper claim</dt><dd>{lesson.claims.paper}</dd></div>
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
            { role: "system", content: lesson.paperContext },
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
                <span>{message.role === "user" ? "You" : "Paper guide"}</span><p>{message.content}</p>
              </div>
            ))}
          </div>
          <form className="question-form" onSubmit={askPaper}>
            <textarea aria-label="Question about the source" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about a claim, equation, assumption, or limitation…" />
            <button type="submit" disabled={!openRouterKey.trim() || !question.trim() || asking}>{asking ? "Thinking…" : "Ask source"}</button>
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

function evaluateBlock(block: CodeBlock, source: string): CheckResult {
  if (!source.trim()) return { label: block.label, passed: false, detail: "This cell is empty." };
  try {
    if (!block.checkCode) {
      new Function(`"use strict";\n${source}`)();
      return { label: block.label, passed: true, detail: "Source is syntactically valid." };
    }
    const result = new Function(`"use strict";\n${source}\n${block.checkCode}`)() as { passed?: unknown; detail?: unknown };
    return {
      label: block.label,
      passed: result?.passed === true,
      detail: typeof result?.detail === "string" ? result.detail : result?.passed === true ? "Behavioral check passed." : "Behavioral check failed.",
    };
  } catch (error) {
    return { label: block.label, passed: false, detail: error instanceof Error ? error.message : "The cell could not run." };
  }
}

function starterCodeFor(block: CodeBlock) {
  const signature = block.code.split("\n")[0];
  return `${signature}\n  // TODO: implement ${block.label.toLowerCase()}.\n}`;
}

export function CodingSection({ lesson }: { lesson: CourseLesson }) {
  const blocks = lesson.implementation.codeBlocks;
  const [hiddenBlocks, setHiddenBlocks] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [cellResults, setCellResults] = useState<Record<string, CheckResult | undefined>>({});
  const [checks, setChecks] = useState<CheckResult[]>([]);
  const [practiceMessage, setPracticeMessage] = useState("The reference implementation is complete and runnable.");

  const sourceFor = (block: CodeBlock) => hiddenBlocks.includes(block.id) ? answers[block.id] ?? "" : block.code;
  const toggleBlock = (block: CodeBlock) => {
    setChecks([]);
    setCellResults((current) => ({ ...current, [block.id]: undefined }));
    setHiddenBlocks((current) => current.includes(block.id) ? current.filter((id) => id !== block.id) : [...current, block.id]);
    setAnswers((current) => ({ ...current, [block.id]: current[block.id] ?? starterCodeFor(block) }));
    setPracticeMessage("Implementation changed. Run the affected cell again.");
  };
  const hideAll = () => {
    setHiddenBlocks(blocks.map((block) => block.id));
    setAnswers(Object.fromEntries(blocks.map((block) => [block.id, starterCodeFor(block)])));
    setCellResults({});
    setChecks([]);
    setPracticeMessage("All conceptual blocks are hidden. Reconstruct them in any valid way.");
  };
  const showSolution = () => {
    setHiddenBlocks([]);
    setCellResults({});
    setChecks([]);
    setPracticeMessage("Reference solution restored. Previous attempts remain available if you hide a cell again.");
  };
  const runCell = (block: CodeBlock) => {
    const result = evaluateBlock(block, sourceFor(block));
    setCellResults((current) => ({ ...current, [block.id]: result }));
    setPracticeMessage(result.passed ? `${block.label} passed.` : `${block.label} needs attention.`);
  };
  const runAll = () => {
    const results = blocks.map((block) => evaluateBlock(block, sourceFor(block)));
    setChecks(results);
    setCellResults(Object.fromEntries(blocks.map((block, index) => [block.id, results[index]])));
    const passed = results.filter((result) => result.passed).length;
    setPracticeMessage(passed === results.length ? "All behavioral checks pass. Run the experiment below." : `${passed} of ${results.length} behavioral checks pass.`);
  };
  const passedChecks = checks.filter((check) => check.passed).length;
  const verifiedCells = Object.values(cellResults).filter((result) => result?.passed).length;

  return (
    <section className="paper-section implementation-section" id="implementation">
      <div className="section-title"><span>03</span><h2>Implementation</h2></div>
      <p className="implementation-intro">{lesson.implementation.intro}</p>
      <div className="practice-editor">
        <div className="editor-toolbar">
          <div className="editor-file"><span>{lesson.implementation.filename}</span><strong>{hiddenBlocks.length === 0 ? "Complete reference" : `Practice · ${hiddenBlocks.length} cells active`}</strong></div>
          <div className="editor-progress" aria-label={`${verifiedCells} of ${blocks.length} cells verified`}>
            <span>{verifiedCells}/{blocks.length} verified</span><i><b style={{ width: `${verifiedCells / blocks.length * 100}%` }} /></i>
          </div>
          <div className="toolbar-actions"><button type="button" onClick={hideAll}>Practice all</button><button type="button" onClick={showSolution} disabled={hiddenBlocks.length === 0}>Restore all</button></div>
        </div>
        <div className="code-surface">
          {blocks.map((block, blockIndex) => {
            const hidden = hiddenBlocks.includes(block.id);
            const startLine = blocks.slice(0, blockIndex).reduce((line, previous) => line + previous.code.split("\n").length + 1, 1);
            const result = cellResults[block.id];
            return (
              <div className={`practice-block ${hidden ? "is-hidden" : ""}`} key={block.id}>
                <div className="block-heading">
                  <div><span>0{blockIndex + 1}</span><strong>{block.label}</strong><em>{block.purpose}</em></div>
                  <div className="block-actions">
                    <button className="run-cell-button" type="button" onClick={() => runCell(block)}>Run cell</button>
                    <button type="button" onClick={() => toggleBlock(block)}>{hidden ? "Show reference" : "Practice cell"}</button>
                  </div>
                </div>
                {block.concepts?.length ? <div className="concept-strip" aria-label={`${block.label} variables`}>{block.concepts.map((concept) => <span key={concept.name}><code>{concept.name}</code><em>{concept.detail}</em></span>)}</div> : null}
                {hidden ? (
                  <div className="answer-area">
                    <div className="practice-guidance">
                      <div><span>Practice mode</span><strong>Complete the function, then run this cell.</strong></div>
                      <button type="button" onClick={() => {
                        setAnswers((current) => ({ ...current, [block.id]: starterCodeFor(block) }));
                        setCellResults((current) => ({ ...current, [block.id]: undefined }));
                      }}>Reset starter</button>
                    </div>
                    <textarea aria-label={`Reimplement ${block.label}`} value={answers[block.id] ?? ""} onChange={(event) => {
                      setAnswers((current) => ({ ...current, [block.id]: event.target.value }));
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
        <div className="editor-footer"><p>{practiceMessage}</p><button type="button" onClick={runAll}>Run behavioral checks</button></div>
      </div>
      {checks.length ? (
        <div className="check-grid" aria-live="polite">
          {checks.map((check) => <div className={check.passed ? "check passed" : "check failed"} key={check.label}><i>{check.passed ? "✓" : "×"}</i><span><strong>{check.label}</strong><em>{check.detail}</em></span></div>)}
          <div className="check-score"><strong>{passedChecks}/{checks.length}</strong><span>checks pass</span></div>
        </div>
      ) : null}
      <LessonExperiment lesson={lesson} />
    </section>
  );
}

export function PaperLab({ lesson }: { lesson: CourseLesson }) {
  const previous = courseLessons[lesson.number - 2];
  const next = courseLessons[lesson.number];
  return (
    <main>
      <Atmosphere />
      <header className="site-header">
        <Link className="wordmark" href="/" aria-label="Latent course home"><i />latent</Link>
        <nav aria-label="Lesson navigation"><a href="#summary">Summary</a><a href="#questions">Questions</a><a href="#implementation">Implementation</a></nav>
        <span>Lesson {String(lesson.number).padStart(2, "0")} / {String(courseLessons.length).padStart(2, "0")}</span>
      </header>
      <article className="paper-page" id="top">
        <HeaderSection lesson={lesson} />
        <ParagraphSection lesson={lesson} />
        <TextBoxSection lesson={lesson} />
        <CodingSection lesson={lesson} />
        <footer className="paper-footer lesson-footer">
          {previous ? <Link href={`/papers/${previous.id}`}>← {previous.title}</Link> : <Link href="/">← Curriculum</Link>}
          <p>Lesson {lesson.number} complete</p>
          {next ? <Link href={`/papers/${next.id}`}>{next.title} →</Link> : <Link href="/">Curriculum ↑</Link>}
        </footer>
      </article>
    </main>
  );
}
