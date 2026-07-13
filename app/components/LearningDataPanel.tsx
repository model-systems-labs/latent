"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  clearLearningAnalytics,
  learningAnalyticsBlob,
  loadLearningAnalytics,
  type LearningEvent,
} from "../lib/learning-analytics";
import { downloadBrowserBlob } from "../lib/browser-download";

export function LearningDataPanel() {
  const [events, setEvents] = useState<LearningEvent[]>([]);
  const [ready, setReady] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const refresh = async () => {
    try {
      setEvents((await loadLearningAnalytics()).events);
    } finally {
      setReady(true);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const summary = useMemo(() => ({
    runs: events.filter((event) => event.name === "first_run_completed").length,
    checks: events.filter((event) => event.name === "cell_check_completed").length,
    predictions: events.filter((event) => event.name === "knowledge_check_completed").length,
    checkpoints: events.filter((event) => event.name === "module_checkpoint_completed").length,
  }), [events]);

  const download = async () => {
    downloadBrowserBlob(await learningAnalyticsBlob(), `latent-learning-events-${new Date().toISOString().slice(0, 10)}.json`);
  };

  const clear = async () => {
    if (!confirmClear) return setConfirmClear(true);
    await clearLearningAnalytics();
    setConfirmClear(false);
    await refresh();
  };

  return (
    <section className="learning-data-panel" aria-labelledby="learning-data-title">
      <header><div><span>Privacy and learning evidence</span><h2 id="learning-data-title">Your activity stays on this device.</h2></div><p>Latent records bounded event names and pass/fail outcomes. It never places source code, prompts, chat content, API keys, or free-form answers in this event log.</p></header>
      <dl aria-label="Device-local learning event summary">
        <div><dt>First runs</dt><dd>{ready ? summary.runs : "—"}</dd></div>
        <div><dt>Code checks</dt><dd>{ready ? summary.checks : "—"}</dd></div>
        <div><dt>Predictions</dt><dd>{ready ? summary.predictions : "—"}</dd></div>
        <div><dt>Checkpoints</dt><dd>{ready ? summary.checkpoints : "—"}</dd></div>
      </dl>
      <footer><p>{events.length} of at most 500 local events stored. No analytics endpoint is configured.</p><div><Link href="/sources">Review sources and licenses</Link><button type="button" onClick={() => void download()} disabled={!events.length}>Export events</button><button type="button" onClick={() => void clear()} disabled={!events.length}>{confirmClear ? "Confirm delete" : "Delete events"}</button></div></footer>
    </section>
  );
}
