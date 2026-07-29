"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ReplayTraceItem = {
  label: string;
  detail: string;
  marker?: string;
  tone?: string;
};

export type ReplayStage = {
  label: string;
  value: string;
};

export function useReplaySequence(onComplete: () => void, intervalMs = 620) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const timersRef = useRef<number[]>([]);
  const completeRef = useRef(onComplete);

  useEffect(() => {
    completeRef.current = onComplete;
  }, [onComplete]);

  const clear = useCallback(() => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }, []);

  const start = useCallback((length: number) => {
    clear();
    const finalStep = Math.max(0, length - 1);
    setStarted(true);
    completeRef.current();
    if (length <= 1 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStep(finalStep);
      setPlaying(false);
      return;
    }
    setStep(0);
    setPlaying(true);
    timersRef.current = Array.from({ length: length - 1 }, (_, index) => window.setTimeout(() => {
      setStep(index + 1);
      if (index === length - 2) {
        setPlaying(false);
        timersRef.current = [];
      }
    }, (index + 1) * intervalMs));
  }, [clear, intervalMs]);

  const pause = useCallback(() => {
    clear();
    setPlaying(false);
  }, [clear]);

  const select = useCallback((nextStep: number) => {
    clear();
    setStarted(true);
    setPlaying(false);
    setStep(Math.max(0, nextStep));
  }, [clear]);

  const reset = useCallback(() => {
    clear();
    setStep(0);
    setPlaying(false);
    setStarted(false);
  }, [clear]);

  useEffect(() => clear, [clear]);

  return { step, playing, started, start, pause, select, reset };
}

export function ReplayStages({
  stages,
  current,
  onSelect,
  label,
}: {
  stages: ReplayStage[];
  current: number;
  onSelect: (index: number) => void;
  label: string;
}) {
  return (
    <div className="replay-stage-bar" role="group" aria-label={label}>
      {stages.map((stage, index) => (
        <button
          type="button"
          key={`${stage.label}-${stage.value}`}
          aria-pressed={index === current}
          onClick={() => onSelect(index)}
        >
          <span>{stage.label}</span>
          <small>{stage.value}</small>
        </button>
      ))}
    </div>
  );
}

export function ReplayTrace({
  items,
  current,
  onSelect,
  label,
  className = "",
}: {
  items: ReplayTraceItem[];
  current: number;
  onSelect: (index: number) => void;
  label: string;
  className?: string;
}) {
  return (
    <div className={`trace-list replay-trace ${className}`.trim()} aria-label={label}>
      {items.map((item, index) => {
        const state = index === current ? "active" : index < current ? "complete" : "pending";
        return (
          <button
            type="button"
            className={`${item.tone ?? ""} ${state}`.trim()}
            aria-current={index === current ? "step" : undefined}
            onClick={() => onSelect(index)}
            key={`${item.label}-${item.marker ?? index}`}
          >
            <span>{item.marker ?? index + 1}</span>
            <strong>{item.label}</strong>
            <p>{index <= current ? item.detail : "Waiting in replay…"}</p>
          </button>
        );
      })}
    </div>
  );
}
