"use client";

import { useEffect, useState } from "react";
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
      <header><span id="learning-data-title">Learning data</span><em>{ready ? `${events.length} saved` : "Loading…"}</em></header>
      <div className="learning-data-body">
        <p>This log contains event names and pass/fail results only. It does not include code, prompts, messages, API keys, or written answers.</p>
        <div><button type="button" onClick={() => void download()} disabled={!events.length}>Export</button><button type="button" onClick={() => void clear()} disabled={!events.length}>{confirmClear ? "Confirm delete" : "Delete"}</button></div>
      </div>
    </section>
  );
}
