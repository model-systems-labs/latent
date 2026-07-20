"use client";

import { useEffect, useRef } from "react";

export function PageAtmosphere() {
  const orbitRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const orbit = orbitRef.current;
    if (!orbit) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame: number | null = null;
    const update = () => {
      frame = null;
      const fadeDistance = Math.max(window.innerHeight * 0.7, 1);
      const opacity = reducedMotion.matches ? 0 : Math.max(0, 1 - (window.scrollY / fadeDistance));
      orbit.style.opacity = String(opacity);
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
      <span className="node node-one" />
      <span className="warm-star" />
    </div>
  );
}
