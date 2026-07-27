(() => {
  "use strict";
  const solutionNote = "Compare the control flow and boundary cases with your draft. Opening this reference does not replace your work or update progress.";
  const componentText = (value, label, maximum) => {
    if (
      typeof value !== "string"
      || value.trim().length === 0
      || value.length > maximum
      || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
    ) {
      throw new Error(label + " must be non-empty trusted text no longer than " + maximum + " characters.");
    }
    return value;
  };
  const createSolutionDisclosure = ({ source, title, label = "View example solution" }) => {
    const trustedSource = componentText(source, "Example solution source", 50000);
    const trustedTitle = componentText(title, "Example solution title", 200).trim();
    const trustedLabel = componentText(label, "Example solution label", 80).trim();
    const details = document.createElement("details");
    details.className = "learner-solution";
    const summary = document.createElement("summary");
    summary.textContent = trustedLabel;
    summary.setAttribute("aria-label", trustedLabel + " for " + trustedTitle);
    const note = document.createElement("p");
    note.className = "learner-summary";
    note.textContent = solutionNote;
    const sourceFrame = document.createElement("pre");
    sourceFrame.className = "learner-solution__code";
    sourceFrame.tabIndex = 0;
    sourceFrame.setAttribute("aria-label", trustedTitle + " example solution");
    const code = document.createElement("code");
    code.textContent = trustedSource;
    sourceFrame.append(code);
    details.append(summary, note, sourceFrame);
    return details;
  };
  if (globalThis.LearnerUiComponents === undefined) {
    Object.defineProperty(globalThis, "LearnerUiComponents", {
      configurable: false,
      enumerable: false,
      value: Object.freeze({ createSolutionDisclosure }),
      writable: false,
    });
  }
  const compact = globalThis.matchMedia("(max-width: 760px), (max-height: 500px)");
  const stacked = globalThis.matchMedia("(max-width: 980px)");
  const reducedMotion = globalThis.matchMedia("(prefers-reduced-motion: reduce)");
  const traceInterval = 1.45;
  const traceFadeWidth = 0.92;
  const disclosureSelector = ".learner-nav-menu, .learner-mobile-panel";
  const prepared = new WeakSet();
  const preparedSkipLinks = new WeakSet();
  let atmosphereFrame = null;
  const traceOpacity = (phase, index, count) => {
    const directDistance = Math.abs(phase - index);
    const wrappedDistance = Math.min(directDistance, count - directDistance);
    if (wrappedDistance >= traceFadeWidth) return 0;
    return (Math.cos((wrappedDistance / traceFadeWidth) * Math.PI) + 1) / 2;
  };
  const updateAtmospheres = () => {
    atmosphereFrame = null;
    const viewportHeight = Math.max(globalThis.innerHeight, 1);
    const scrollY = Math.max(globalThis.scrollY, 0);
    const fadeDistance = viewportHeight * 0.7;
    const traceStart = viewportHeight * 0.55;
    const traceScroll = Math.max(scrollY - traceStart, 0);
    const traceIntroduction = Math.min(1, traceScroll / (viewportHeight * 0.45));
    document.querySelectorAll("[data-learner-atmosphere]").forEach((atmosphere) => {
      const intro = atmosphere.querySelector("[data-learner-atmosphere-intro]");
      const traces = Array.from(atmosphere.querySelectorAll("[data-learner-atmosphere-trace]"));
      if (!intro || traces.length === 0) return;
      const introOpacity = reducedMotion.matches
        ? 0
        : Math.max(0, 1 - (scrollY / fadeDistance));
      const tracePhase = (traceScroll / (viewportHeight * traceInterval)) % traces.length;
      intro.style.opacity = String(introOpacity);
      traces.forEach((trace, index) => {
        const opacity = reducedMotion.matches
          ? 0
          : traceOpacity(tracePhase, index, traces.length) * traceIntroduction;
        trace.style.opacity = String(opacity);
      });
    });
  };
  const scheduleAtmospheres = () => {
    if (atmosphereFrame === null) {
      atmosphereFrame = globalThis.requestAnimationFrame(updateAtmospheres);
    }
  };
  const synchronize = (disclosure) => {
    if (disclosure.dataset.learnerCollapseAt === "always") return;
    const breakpoint = disclosure.dataset.learnerCollapseAt === "stacked"
      ? stacked
      : compact;
    const viewport = breakpoint.matches ? "compact" : "wide";
    if (disclosure.dataset.learnerViewport === viewport) return;
    disclosure.dataset.learnerViewport = viewport;
    if (breakpoint.matches) disclosure.removeAttribute("open");
    else disclosure.setAttribute("open", "");
  };
  const prepare = (disclosure) => {
    if (prepared.has(disclosure)) return;
    prepared.add(disclosure);
    const summary = disclosure.querySelector(":scope > summary");
    if (disclosure.matches(".learner-nav-menu")) {
      disclosure.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => disclosure.removeAttribute("open"));
      });
    }
    disclosure.addEventListener("keydown", (event) => {
      const isNavigationMenu = disclosure.matches(".learner-nav-menu");
      const isAlwaysCollapsible = disclosure.dataset.learnerCollapseAt === "always";
      const breakpoint = disclosure.dataset.learnerCollapseAt === "stacked"
        ? stacked
        : compact;
      if (
        event.key !== "Escape"
        || !disclosure.open
        || (!isNavigationMenu && !isAlwaysCollapsible && !breakpoint.matches)
      ) return;
      disclosure.removeAttribute("open");
      summary?.focus();
    });
    if (disclosure.matches(".learner-mobile-panel")) synchronize(disclosure);
  };
  const prepareWithin = (root) => {
    if (root instanceof Element && root.matches(disclosureSelector)) prepare(root);
    root.querySelectorAll?.(disclosureSelector).forEach(prepare);
    const prepareSkipLink = (link) => {
      if (preparedSkipLinks.has(link)) return;
      preparedSkipLinks.add(link);
      link.addEventListener("click", () => {
        const target = document.getElementById(link.hash.slice(1));
        target?.focus();
      });
    };
    if (root instanceof Element && root.matches(".learner-skip-link")) prepareSkipLink(root);
    root.querySelectorAll?.(".learner-skip-link").forEach(prepareSkipLink);
  };
  prepareWithin(document);
  scheduleAtmospheres();
  new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (node instanceof Element) prepareWithin(node);
      });
    }
    scheduleAtmospheres();
  }).observe(document.documentElement, { childList: true, subtree: true });
  globalThis.addEventListener("scroll", scheduleAtmospheres, { passive: true });
  globalThis.addEventListener("resize", scheduleAtmospheres);
  reducedMotion.addEventListener("change", scheduleAtmospheres);
  compact.addEventListener("change", () => {
    document.querySelectorAll(".learner-nav-menu").forEach((menu) => menu.removeAttribute("open"));
    document.querySelectorAll(".learner-mobile-panel:not([data-learner-collapse-at='stacked'])").forEach(synchronize);
  });
  stacked.addEventListener("change", () => {
    document.querySelectorAll('[data-learner-collapse-at="stacked"]').forEach(synchronize);
  });
  document.addEventListener("click", (event) => {
    for (const menu of document.querySelectorAll(".learner-nav-menu[open]")) {
      if (!menu.contains(event.target)) menu.removeAttribute("open");
    }
  });
})();
