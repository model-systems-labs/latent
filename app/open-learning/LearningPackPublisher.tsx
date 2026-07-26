"use client";

import {
  buildStandaloneLearningSite,
  canonicalLearningPackJson,
  createStarterLearningPack,
  parseLearningPackJson,
} from "@latent/course-kit";
import { strToU8, zipSync } from "fflate";
import { useCallback, useMemo, useState } from "react";
import { downloadBrowserBlob } from "@/app/lib/browser-download";
import { MAX_HOSTED_LEARNING_BYTES } from "@/app/lib/open-learning";
import styles from "@/app/open-learning/studio.module.css";

const starterSource = canonicalLearningPackJson(createStarterLearningPack());

export function LearningPackPublisher() {
  const [source, setSource] = useState(starterSource);
  const validation = useMemo(() => parseLearningPackJson(source), [source]);
  const [downloadStatus, setDownloadStatus] = useState("");
  const releaseReady = validation.valid && validation.warnings.length === 0;

  const downloadStaticSite = useCallback(async () => {
    if (!validation.valid) {
      setDownloadStatus("Fix validation errors before building.");
      return;
    }
    if (validation.warnings.length) {
      setDownloadStatus("Resolve every quality warning before downloading a host-ready site.");
      return;
    }
    setDownloadStatus("Building static site");
    try {
      const files = await buildStandaloneLearningSite(validation.pack);
      const zipped = zipSync(
        Object.fromEntries(
          Object.entries(files).map(([path, contents]) => [path, strToU8(contents)]),
        ),
        { level: 9 },
      );
      const archive = new Uint8Array(zipped).buffer;
      downloadBrowserBlob(
        new Blob([archive], { type: "application/zip" }),
        `${validation.pack.package.id.replace("/", "-")}-${validation.pack.package.version}.zip`,
      );
      setDownloadStatus("Static site ready");
    } catch (error) {
      setDownloadStatus(error instanceof Error ? error.message : "The static site could not be built.");
    }
  }, [validation]);

  return (
    <section className={styles.authorSection} aria-labelledby="author-title">
      <header className={styles.sectionIntro}>
        <span className="eyebrow">Publish from this browser</span>
        <h2 id="author-title">Make your own lesson or flash-card site.</h2>
        <p>
          Ask any LLM to follow the public schema, or edit the starter directly.
          Validation and the static builder run here on your device. The download
          can go on GitHub Pages, Cloudflare Pages, S3, or any ordinary web server.
        </p>
      </header>
      <div className={styles.authorGrid}>
        <div className={styles.editorPanel}>
          <div className={styles.editorToolbar}>
            <label htmlFor="learning-pack-source">learning-pack.json</label>
            <label className={styles.fileButton}>
              Open JSON
              <input
                accept="application/json,.json"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  if (file.size > MAX_HOSTED_LEARNING_BYTES) {
                    setDownloadStatus("Learning packs may not exceed 2 MB.");
                    return;
                  }
                  void file.text().then(setSource);
                }}
                type="file"
              />
            </label>
          </div>
          <textarea
            aria-describedby="pack-validation-status"
            id="learning-pack-source"
            onChange={(event) => setSource(event.target.value)}
            spellCheck={false}
            value={source}
          />
        </div>
        <aside className={styles.validationPanel}>
          <span className="eyebrow">Local quality gate</span>
          <h3>
            {!validation.valid
              ? `${validation.errors.length} issue${validation.errors.length === 1 ? "" : "s"} to fix`
              : validation.warnings.length
                ? `${validation.warnings.length} quality warning${validation.warnings.length === 1 ? "" : "s"} to fix`
                : "Ready to build"}
          </h3>
          <div id="pack-validation-status" role="status">
            {validation.valid ? (
              <dl className={styles.packSummary}>
                <div><dt>Lessons</dt><dd>{validation.summary.lessons}</dd></div>
                <div><dt>Quizzes</dt><dd>{validation.summary.quizzes}</dd></div>
                <div><dt>Decks</dt><dd>{validation.summary.flashcardDecks}</dd></div>
                <div><dt>Cards</dt><dd>{validation.summary.flashcards}</dd></div>
                <div><dt>Sources</dt><dd>{validation.summary.sources}</dd></div>
                <div><dt>Warnings</dt><dd>{validation.warnings.length}</dd></div>
              </dl>
            ) : (
              <ol className={styles.issueList}>
                {validation.errors.slice(0, 8).map((entry, index) => (
                  <li key={`${entry.path}-${entry.code}-${index}`}>
                    <code>{entry.path}</code>
                    <span>{entry.message}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
          {validation.warnings.length ? (
            <details className={styles.warningList}>
              <summary>
                {validation.warnings.length} quality warning
                {validation.warnings.length === 1 ? "" : "s"}
              </summary>
              <ul>
                {validation.warnings.map((entry, index) => (
                  <li key={`${entry.path}-${index}`}>{entry.message}</li>
                ))}
              </ul>
            </details>
          ) : null}
          <button
            className={styles.primaryButton}
            disabled={!releaseReady}
            onClick={() => void downloadStaticSite()}
            type="button"
          >
            Download host-ready site
          </button>
          <p aria-live="polite" className={styles.downloadStatus} role="status">
            {downloadStatus}
          </p>
        </aside>
      </div>
    </section>
  );
}
