"use client";

import {
  canonicalLearningPackJson,
  type LearningBlock,
  type LearningFeed,
  type LearningPack,
} from "@latent/course-kit";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  LAST_INSTALLED_PACK_KEY,
  MAX_HOSTED_LEARNING_BYTES,
  allowedHostedFeedUrl,
  installedLearningPackKey,
  learningProgressKey,
  parseInstalledLearningPack,
  parseLearningFeedJson,
  resolveSameOriginPackageUrl,
  sha256Hex,
  verifyHostedPackage,
  type InstalledLearningPack,
} from "@/app/lib/open-learning";
import styles from "@/app/open-learning/studio.module.css";

const exampleFeedPath = "/open-learning/reliable-llm-changes/learning-feed.json";

type HostedPreview = {
  feedUrl: string;
  pack: LearningPack;
  sha256: string;
  siteUrl: string;
};

type ProgressState = {
  completedLessons: string[];
  cardRatings: Record<string, "know" | "review">;
};

const emptyProgress: ProgressState = { completedLessons: [], cardRatings: {} };

async function fetchBoundedText(url: URL) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      credentials: "omit",
      headers: { accept: "application/json" },
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${url.host} returned HTTP ${response.status}.`);
    const finalUrl = new URL(response.url);
    if (finalUrl.origin !== url.origin) throw new Error("Cross-origin redirects are not allowed.");
    const contentLength = response.headers.get("content-length");
    if (contentLength !== null) {
      if (!/^\d+$/.test(contentLength)) throw new Error("The remote Content-Length is invalid.");
      if (Number(contentLength) > MAX_HOSTED_LEARNING_BYTES) throw new Error("The remote file exceeds the 2 MB limit.");
    }
    if (!response.body) throw new Error("The remote response has no readable body.");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_HOSTED_LEARNING_BYTES) {
        controller.abort();
        await reader.cancel().catch(() => undefined);
        throw new Error("The remote file exceeds the 2 MB limit.");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new Error("The remote file is not valid UTF-8.");
    }
    return {
      bytes,
      text,
      url: finalUrl,
    };
  } finally {
    window.clearTimeout(timer);
  }
}

function sourceLinks(pack: LearningPack, sourceIds: readonly string[]) {
  const sourceById = new Map(pack.sources.map((source) => [source.id, source]));
  return [...new Set(sourceIds)]
    .map((id) => sourceById.get(id))
    .filter((source) => source !== undefined);
}

function QuizBlock({
  block,
  identity,
}: {
  block: Extract<LearningBlock, { type: "quiz" }>;
  identity: string;
}) {
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState(false);
  const correct = answer === block.correctChoiceId;

  return (
    <form
      className={styles.quiz}
      onSubmit={(event) => {
        event.preventDefault();
        setChecked(true);
      }}
    >
      <fieldset>
        <legend>{block.prompt}</legend>
        {block.choices.map((choice) => (
          <label key={choice.id}>
            <input
              checked={answer === choice.id}
              name={`${identity}-${block.id}`}
              onChange={() => {
                setAnswer(choice.id);
                setChecked(false);
              }}
              type="radio"
              value={choice.id}
            />
            <span>{choice.text}</span>
          </label>
        ))}
      </fieldset>
      <button type="submit">Check answer</button>
      <p aria-live="polite" className={correct ? styles.correct : styles.incorrect} role="status">
        {checked ? (correct ? "Correct." : "Not yet. Read the explanation and try again.") : ""}
      </p>
      {checked ? <p className={styles.quizExplanation}>{block.explanation}</p> : null}
    </form>
  );
}

function LessonBlockView({
  block,
  identity,
}: {
  block: LearningBlock;
  identity: string;
}) {
  if (block.type === "paragraph") return <p>{block.text}</p>;
  if (block.type === "heading") return block.level === 2 ? <h4>{block.text}</h4> : <h5>{block.text}</h5>;
  if (block.type === "list") {
    return block.style === "ordered"
      ? <ol>{block.items.map((item) => <li key={item}>{item}</li>)}</ol>
      : <ul>{block.items.map((item) => <li key={item}>{item}</li>)}</ul>;
  }
  if (block.type === "callout") {
    return <aside className={styles.callout}><strong>{block.title}</strong><p>{block.text}</p></aside>;
  }
  if (block.type === "code") {
    return (
      <figure className={styles.codeBlock}>
        {block.caption ? <figcaption>{block.caption}</figcaption> : null}
        <pre><code>{block.code}</code></pre>
      </figure>
    );
  }
  return <QuizBlock block={block} identity={identity} />;
}

export function PortablePackReader({ preview }: { preview: HostedPreview }) {
  const { pack } = preview;
  const publisherHost = new URL(preview.feedUrl).host;
  const lessons = [...pack.lessons].sort((left, right) => left.order - right.order);
  const decks = [...pack.flashcardDecks].sort((left, right) => left.order - right.order);
  const [revealedCards, setRevealedCards] = useState<string[]>([]);
  const [progress, setProgress] = useState<ProgressState>(emptyProgress);
  const progressKey = learningProgressKey(
    preview.feedUrl,
    pack.package.id,
    pack.package.version,
    preview.sha256,
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = JSON.parse(localStorage.getItem(progressKey) ?? "null") as Partial<ProgressState> | null;
        if (stored && Array.isArray(stored.completedLessons) && stored.cardRatings && typeof stored.cardRatings === "object") {
          setProgress({
            completedLessons: stored.completedLessons.filter((entry): entry is string => typeof entry === "string"),
            cardRatings: stored.cardRatings as ProgressState["cardRatings"],
          });
        } else {
          setProgress(emptyProgress);
        }
      } catch {
        setProgress(emptyProgress);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [progressKey]);

  const saveProgress = useCallback((next: ProgressState) => {
    setProgress(next);
    try {
      localStorage.setItem(progressKey, JSON.stringify(next));
    } catch {}
  }, [progressKey]);

  return (
    <section className={styles.reader} aria-labelledby="hosted-pack-title">
      <header className={styles.readerTrust}>
        <span>Hosted at {publisherHost} · Identity not verified · Not reviewed by Latent</span>
        <code>SHA-256 {preview.sha256.slice(0, 12)}…</code>
        <a href={preview.siteUrl} rel="noreferrer" target="_blank">Open publisher site ↗</a>
      </header>
      <div className={styles.readerDocument}>
        <header className={styles.readerIntro}>
          <span className="eyebrow">Published by {pack.package.authors[0]?.name}</span>
          <h2 id="hosted-pack-title">{pack.package.title}</h2>
          <p>{pack.package.description}</p>
          <nav className={styles.readerContents} aria-label="Hosted pack contents">
            <ol>
              {lessons.map((lesson) => (
                <li key={`lesson:${lesson.id}`}>
                  <a href={`#hosted-lesson-${lesson.id}`}>
                    <small>{lesson.durationMinutes} min lesson</small>
                    <span>{lesson.title}</span>
                  </a>
                </li>
              ))}
              {decks.map((deck) => (
                <li key={`deck:${deck.id}`}>
                  <a href={`#hosted-deck-${deck.id}`}>
                    <small>{deck.cards.length} flash cards</small>
                    <span>{deck.title}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </header>
        <div className={styles.readerContent}>
          {lessons.map((lesson) => (
            <section
              aria-labelledby={`hosted-lesson-${lesson.id}`}
              className={styles.readerSection}
              key={`lesson:${lesson.id}`}
            >
              <header className={styles.contentHeader}>
                <span className="eyebrow">{lesson.durationMinutes} minute lesson</span>
                <h3 id={`hosted-lesson-${lesson.id}`} tabIndex={-1}>{lesson.title}</h3>
                <p>{lesson.summary}</p>
              </header>
              <div className={styles.lessonBlocks}>
                {lesson.blocks.map((block, index) => (
                  <LessonBlockView block={block} identity={`${pack.package.id}-${lesson.id}-${index}`} key={`${block.type}-${index}`} />
                ))}
              </div>
              <section
                aria-labelledby={`hosted-lesson-${lesson.id}-sources`}
                className={styles.readerSources}
              >
                <h4 id={`hosted-lesson-${lesson.id}-sources`}>Sources used here</h4>
                <ul>
                  {sourceLinks(pack, [
                    ...lesson.sourceIds,
                    ...lesson.blocks.flatMap((block) => block.type === "quiz" ? block.sourceIds : []),
                  ]).map((source) => (
                    <li key={source.id}>
                      <a href={source.url} rel="noreferrer" target="_blank">{source.title} ↗</a>
                      <span>{source.note}</span>
                    </li>
                  ))}
                </ul>
              </section>
              <button
                aria-pressed={progress.completedLessons.includes(lesson.id)}
                className={styles.primaryButton}
                onClick={() => {
                  const complete = progress.completedLessons.includes(lesson.id);
                  saveProgress({
                    ...progress,
                    completedLessons: complete
                      ? progress.completedLessons.filter((entry) => entry !== lesson.id)
                      : [...progress.completedLessons, lesson.id],
                  });
                }}
                type="button"
              >
                {progress.completedLessons.includes(lesson.id) ? "Lesson complete" : "Mark lesson complete"}
              </button>
            </section>
          ))}
          {decks.map((deck) => (
            <section
              aria-labelledby={`hosted-deck-${deck.id}`}
              className={styles.readerSection}
              key={`deck:${deck.id}`}
            >
              <header className={styles.contentHeader}>
                <span className="eyebrow">{deck.cards.length} flash cards</span>
                <h3 id={`hosted-deck-${deck.id}`} tabIndex={-1}>{deck.title}</h3>
                <p>{deck.description}</p>
              </header>
              <p className={styles.deckStatus}>
                {deck.cards.filter((card) => progress.cardRatings[card.id] === "know").length} of {deck.cards.length} marked as known on this device.
              </p>
              <ol className={styles.cards}>
                {deck.cards.map((card, index) => {
                  const revealed = revealedCards.includes(card.id);
                  return (
                    <li className={styles.card} key={card.id}>
                      <span>Card {index + 1} of {deck.cards.length}</span>
                      <button
                        aria-expanded={revealed}
                        className={styles.cardFace}
                        onClick={() => setRevealedCards((current) => (
                          current.includes(card.id)
                            ? current.filter((entry) => entry !== card.id)
                            : [...current, card.id]
                        ))}
                        type="button"
                      >
                        <strong>{card.front}</strong>
                        {revealed ? <span><b>{card.back}</b><small>{card.explanation}</small></span> : null}
                        <em>{revealed ? "Hide answer" : "Reveal answer"}</em>
                      </button>
                      {revealed ? (
                        <div className={styles.cardActions}>
                          <button
                            aria-pressed={progress.cardRatings[card.id] === "review"}
                            onClick={() => saveProgress({
                              ...progress,
                              cardRatings: { ...progress.cardRatings, [card.id]: "review" },
                            })}
                            type="button"
                          >
                            Needs review
                          </button>
                          <button
                            aria-pressed={progress.cardRatings[card.id] === "know"}
                            onClick={() => saveProgress({
                              ...progress,
                              cardRatings: { ...progress.cardRatings, [card.id]: "know" },
                            })}
                            type="button"
                          >
                            Know it
                          </button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
              <section
                aria-labelledby={`hosted-deck-${deck.id}-sources`}
                className={styles.readerSources}
              >
                <h4 id={`hosted-deck-${deck.id}-sources`}>Sources used here</h4>
                <ul>
                  {sourceLinks(pack, [
                    ...deck.sourceIds,
                    ...deck.cards.flatMap((card) => card.sourceIds),
                  ]).map((source) => (
                    <li key={source.id}>
                      <a href={source.url} rel="noreferrer" target="_blank">{source.title} ↗</a>
                      <span>{source.note}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HostedLearningReader() {
  const [feedInput, setFeedInput] = useState(exampleFeedPath);
  const [feed, setFeed] = useState<{ data: LearningFeed; url: URL } | null>(null);
  const [selectedIdentity, setSelectedIdentity] = useState("");
  const [hostedStatus, setHostedStatus] = useState("");
  const [hostedPreview, setHostedPreview] = useState<HostedPreview | null>(null);
  const [installed, setInstalled] = useState(false);
  const hostedRequestGeneration = useRef(0);

  const previewEntry = useCallback(async (
    nextFeed: { data: LearningFeed; url: URL },
    identity: string,
    requestGeneration: number,
  ) => {
    if (requestGeneration !== hostedRequestGeneration.current) return;
    setHostedPreview(null);
    setInstalled(false);
    const entry = nextFeed.data.packages.find(
      (candidate) => `${candidate.packageId}@${candidate.version}` === identity,
    );
    if (!entry) throw new Error("Choose a package from this feed.");
    setHostedStatus("Verifying package");
    const packageUrl = resolveSameOriginPackageUrl(nextFeed.url, entry.packageUrl);
    const response = await fetchBoundedText(packageUrl);
    if (requestGeneration !== hostedRequestGeneration.current) return;
    const digest = await sha256Hex(response.bytes);
    if (requestGeneration !== hostedRequestGeneration.current) return;
    const pack = verifyHostedPackage(response.bytes, entry, digest);
    const siteUrl = resolveSameOriginPackageUrl(nextFeed.url, entry.siteUrl).toString();
    const feedUrl = nextFeed.url.toString();
    const key = installedLearningPackKey(feedUrl, entry.packageId, entry.version);
    const stored = localStorage.getItem(key);
    const installedRecord = stored ? parseInstalledLearningPack(stored) : null;
    if (installedRecord && installedRecord.sha256 !== digest) {
      throw new Error("This publisher changed a saved package without changing its version. Verification stopped.");
    }
    if (requestGeneration !== hostedRequestGeneration.current) return;
    setHostedPreview({
      feedUrl,
      pack,
      sha256: digest,
      siteUrl,
    });
    setInstalled(installedRecord?.sha256 === digest);
    setHostedStatus("Verified locally");
  }, []);

  const loadFeed = useCallback(async () => {
    const requestGeneration = ++hostedRequestGeneration.current;
    setHostedStatus("Loading feed");
    setHostedPreview(null);
    setFeed(null);
    setInstalled(false);
    try {
      const requestedUrl = allowedHostedFeedUrl(feedInput, window.location.href);
      const response = await fetchBoundedText(requestedUrl);
      if (requestGeneration !== hostedRequestGeneration.current) return;
      const data = parseLearningFeedJson(response.text);
      const nextFeed = { data, url: response.url };
      const first = data.packages[0];
      const identity = `${first.packageId}@${first.version}`;
      setFeed(nextFeed);
      setSelectedIdentity(identity);
      await previewEntry(nextFeed, identity, requestGeneration);
    } catch (error) {
      if (requestGeneration === hostedRequestGeneration.current) {
        setHostedStatus(error instanceof Error ? error.message : "The hosted pack could not be loaded.");
      }
    }
  }, [feedInput, previewEntry]);

  useEffect(() => {
    const requestGeneration = hostedRequestGeneration.current;
    let cancelled = false;
    const lastKey = localStorage.getItem(LAST_INSTALLED_PACK_KEY);
    if (!lastKey) return;
    const stored = localStorage.getItem(lastKey);
    if (!stored) return;
    const parsed = parseInstalledLearningPack(stored);
    if (!parsed) return;
    void (async () => {
      const digest = await sha256Hex(new TextEncoder().encode(canonicalLearningPackJson(parsed.pack)));
      if (
        cancelled
        || requestGeneration !== hostedRequestGeneration.current
        || digest !== parsed.sha256
      ) return;
      setFeedInput(parsed.feedUrl);
      setHostedPreview({
        feedUrl: parsed.feedUrl,
        pack: parsed.pack,
        sha256: parsed.sha256,
        siteUrl: parsed.siteUrl,
      });
      setInstalled(true);
      setHostedStatus("Saved copy loaded from this device");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const installPreview = useCallback(() => {
    if (!hostedPreview) return;
    const key = installedLearningPackKey(
      hostedPreview.feedUrl,
      hostedPreview.pack.package.id,
      hostedPreview.pack.package.version,
    );
    const existing = localStorage.getItem(key);
    if (existing) {
      const parsed = parseInstalledLearningPack(existing);
      if (parsed && parsed.sha256 !== hostedPreview.sha256) {
        setHostedStatus("This exact package version was previously saved with a different digest. Saving stopped.");
        return;
      }
    }
    const record: InstalledLearningPack = {
      feedUrl: hostedPreview.feedUrl,
      installedAt: new Date().toISOString(),
      pack: hostedPreview.pack,
      sha256: hostedPreview.sha256,
      siteUrl: hostedPreview.siteUrl,
    };
    try {
      localStorage.setItem(key, JSON.stringify(record));
      localStorage.setItem(LAST_INSTALLED_PACK_KEY, key);
      setInstalled(true);
      setHostedStatus("Saved on this device");
    } catch {
      setHostedStatus("This browser could not save the pack.");
    }
  }, [hostedPreview]);

  return (
    <section className={styles.hostedSection} aria-labelledby="hosted-title">
        <header className={styles.sectionIntro}>
          <span className="eyebrow">Learn from any publisher</span>
          <h2 id="hosted-title">Open a hosted lesson feed.</h2>
          <p>Paste a publisher’s HTTPS feed. Latent checks its format, byte count, identity, and SHA-256 digest before rendering anything. Nothing in a community pack can execute code.</p>
        </header>
        <form
          className={styles.feedForm}
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            void loadFeed();
          }}
        >
          <label htmlFor="learning-feed-url">Learning feed URL</label>
          <div>
            <input
              id="learning-feed-url"
              inputMode="url"
              onChange={(event) => setFeedInput(event.target.value)}
              spellCheck={false}
              type="text"
              value={feedInput}
            />
            <button className={styles.primaryButton} type="submit">Verify feed</button>
          </div>
          <small>HTTPS is required except for localhost previews. Cross-origin publishers must allow CORS.</small>
        </form>
        {feed && feed.data.packages.length > 1 ? (
          <div className={styles.packagePicker}>
            <label htmlFor="feed-package">Package in this feed</label>
            <select
              id="feed-package"
              onChange={(event) => {
                const identity = event.target.value;
                const requestGeneration = ++hostedRequestGeneration.current;
                setSelectedIdentity(identity);
                void previewEntry(feed, identity, requestGeneration).catch((error: unknown) => {
                  if (requestGeneration === hostedRequestGeneration.current) {
                    setHostedStatus(error instanceof Error ? error.message : "The package could not be verified.");
                  }
                });
              }}
              value={selectedIdentity}
            >
              {feed.data.packages.map((entry) => (
                <option key={`${entry.packageId}@${entry.version}`} value={`${entry.packageId}@${entry.version}`}>
                  {entry.title} · {entry.version}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className={styles.hostedStatus}>
          <span aria-live="polite" role="status">{hostedStatus}</span>
          {hostedPreview ? (
            <button
              className={styles.installButton}
              disabled={installed}
              onClick={installPreview}
              type="button"
            >
              {installed ? "Saved on this device" : "Save on this device"}
            </button>
          ) : null}
        </div>
        {hostedPreview ? (
          <PortablePackReader
            key={`${hostedPreview.feedUrl}:${hostedPreview.sha256}`}
            preview={hostedPreview}
          />
        ) : null}
    </section>
  );
}
