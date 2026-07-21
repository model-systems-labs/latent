"use client";

import { useEffect, useRef, type CSSProperties } from "react";

const TRACE_INTERVAL = 1.45;
const TRACE_FADE_WIDTH = 0.92;

const traceStyles: CSSProperties[] = [
  {
    borderRadius: "50%",
    borderTop: "1px solid rgba(107, 91, 133, 0.11)",
    height: "13rem",
    left: "-14rem",
    position: "absolute",
    top: "34vh",
    transform: "rotate(7deg)",
    width: "48rem",
  },
  {
    borderLeft: "1px solid rgba(107, 91, 133, 0.1)",
    borderRadius: "50%",
    height: "42rem",
    position: "absolute",
    right: "-19rem",
    top: "20vh",
    transform: "rotate(12deg)",
    width: "30rem",
  },
  {
    borderRadius: "50%",
    borderTop: "1px solid rgba(184, 135, 94, 0.1)",
    bottom: "7vh",
    height: "11rem",
    left: "18vw",
    position: "absolute",
    transform: "rotate(-5deg)",
    width: "64vw",
  },
];

function traceOpacity(phase: number, index: number, count: number) {
  const directDistance = Math.abs(phase - index);
  const wrappedDistance = Math.min(directDistance, count - directDistance);
  if (wrappedDistance >= TRACE_FADE_WIDTH) return 0;
  return (Math.cos((wrappedDistance / TRACE_FADE_WIDTH) * Math.PI) + 1) / 2;
}

export function PageAtmosphere() {
  const orbitRef = useRef<HTMLSpanElement>(null);
  const traceRefs = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    const orbit = orbitRef.current;
    const traces = traceRefs.current;
    if (!orbit || traces.length !== traceStyles.length || traces.some((trace) => !trace)) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame: number | null = null;
    const update = () => {
      frame = null;
      const viewportHeight = Math.max(window.innerHeight, 1);
      const fadeDistance = viewportHeight * 0.7;
      const traceStart = viewportHeight * 0.55;
      const traceScroll = Math.max(window.scrollY - traceStart, 0);
      const traceIntroduction = Math.min(1, traceScroll / (viewportHeight * 0.45));
      const orbitOpacity = reducedMotion.matches ? 0 : Math.max(0, 1 - (window.scrollY / fadeDistance));
      const tracePhase = (traceScroll / (viewportHeight * TRACE_INTERVAL)) % traces.length;
      orbit.style.opacity = String(orbitOpacity);
      traces.forEach((trace, index) => {
        if (trace) {
          const opacity = reducedMotion.matches
            ? 0
            : traceOpacity(tracePhase, index, traces.length) * traceIntroduction;
          trace.style.opacity = String(opacity);
        }
      });
    };
    const schedule = () => {
      if (frame === null) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    reducedMotion.addEventListener("change", schedule);
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      reducedMotion.removeEventListener("change", schedule);
    };
  }, []);

  return (
    <div className="page-atmosphere" aria-hidden="true">
      <span className="orbit orbit-one" ref={orbitRef} />
      {traceStyles.map((style, index) => (
        <span
          key={index}
          ref={(trace) => { traceRefs.current[index] = trace; }}
          style={{ ...style, opacity: 0, willChange: "opacity" }}
        />
      ))}
      <span className="node node-one" />
      <span className="warm-star" />
    </div>
  );
}
