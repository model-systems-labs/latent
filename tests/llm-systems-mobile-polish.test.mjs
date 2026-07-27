import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("the server-rendered skip link targets content after learner navigation", async () => {
  const [layout, skipLink, course, lesson, workspace, capstone] = await Promise.all([
    read("app/layout.tsx"),
    read("app/components/SkipLink.tsx"),
    read("app/courses/llm-systems/page.tsx"),
    read("app/components/PaperLab.tsx"),
    read("app/components/WorkspaceShell.tsx"),
    read("app/components/BrowserChatCapstone.tsx"),
  ]);

  assert.match(layout, /import \{ SkipLink \} from "@\/app\/components\/SkipLink"/);
  assert.doesNotMatch(layout, /data-main-content-fallback/);
  assert.doesNotMatch(skipLink, /"use client"|document\.|MutationObserver/);
  assert.match(skipLink, /href=\{`#\$\{mainContentId\}`\}/);
  for (const source of [course, lesson, workspace, capstone]) {
    assert.match(source, /id="main-content" tabIndex=\{-1\}/);
  }
  assert.match(course, /<LearnerHeader[\s\S]*?<article[^>]*id="main-content"/);
  assert.match(lesson, /<LearnerHeader[\s\S]*?<article[^>]*id="main-content"/);
});

test("the learner family header has separate truthful desktop and mobile navigation", async () => {
  const [header, styles] = await Promise.all([
    read("app/components/LearnerHeader.tsx"),
    read("app/components/LearnerHeader.module.css"),
  ]);

  assert.match(header, /data-learner-family-header/);
  assert.match(header, /<nav className=\{styles\.desktopNav\} aria-label="Learning experiences">/);
  assert.match(header, /<details className=\{styles\.menu\} ref=\{menuRef\}>/);
  assert.doesNotMatch(header, /<details[^>]*\sopen(?:\s|=)/);
  assert.match(header, /const closeMenu = \(\) => menu\.removeAttribute\("open"\)/);
  assert.match(header, /matchMedia\("\(max-width: 760px\), \(max-height: 500px\)"\)/);
  assert.match(styles, /\.familyHeader > \.desktopNav\s*\{[^}]*display:\s*flex/);
  assert.match(styles, /\.menu\s*\{[^}]*display:\s*none/);
  assert.doesNotMatch(styles, /\.menu:not\(\[open\]\) > nav \{ display: flex; \}/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.familyHeader > \.desktopNav \{ display: none; \}[\s\S]*?\.menu \{ display: block; \}/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.menu:not\(\[open\]\) > nav \{ display: none; \}/);
  assert.match(styles, /\.menu > summary\s*\{[^}]*min-height:\s*2\.75rem/);
  assert.match(header, /aria-label="LLM Systems home" style=\{\{ minHeight: "2\.75rem" \}\}/);
  assert.match(styles, /\.familyHeader :global\(:focus-visible\)\s*\{[^}]*outline:\s*2px solid var\(--violet-deep\)/);
});

test("full-height workspaces account for the family header at every compact breakpoint", async () => {
  const [workspace, workspaceStyles, capstone, capstoneStyles] = await Promise.all([
    read("app/components/WorkspaceShell.tsx"),
    read("app/components/WorkspaceShell.module.css"),
    read("app/components/BrowserChatCapstone.tsx"),
    read("app/components/BrowserChatCapstone.module.css"),
  ]);

  assert.match(workspace, /className=\{`ide-shell \$\{styles\.shell\}`\}/);
  assert.match(workspace, /className=\{`ide-topbar \$\{styles\.topbar\}`\}/);
  assert.match(workspace, /import \{ ProjectWorkbench \} from "@\/app\/components\/ProjectWorkbench"/);
  assert.match(workspace, /<ProjectWorkbench \/>/);
  assert.doesNotMatch(workspace, /lazy|Suspense|WorkspaceLoading/);
  assert.match(workspaceStyles, /@media \(max-width: 760px\)[\s\S]*?:global\(\[data-learner-family-header\]\) \+ \.shell\s*\{[^}]*height:\s*calc\(100dvh - 4rem\)/);
  assert.match(workspaceStyles, /\.topbar\s*\{[^}]*column-gap:\s*0\.5rem/);
  assert.match(workspaceStyles, /\.topbar > a:first-child\s*\{[^}]*min-height:\s*2\.75rem/);

  assert.match(capstone, /compiled-capstone-shell \$\{styles\.shell\}/);
  assert.match(capstone, /compiled-capstone-runtime \$\{styles\.runtime\}/);
  assert.match(capstone, /capstone-build-gate \$\{styles\.gate\}/);
  assert.match(capstoneStyles, /\.shell\s*\{[^}]*--external-header-height:\s*4\.9rem/);
  assert.match(capstoneStyles, /@media \(max-width: 760px\)[\s\S]*?--external-header-height:\s*4rem/);
  assert.match(capstoneStyles, /\.runtime\s*\{[^}]*height:\s*calc\(100dvh - var\(--external-header-height\) - 4\.8rem\)/);
  assert.match(capstoneStyles, /\.gate\s*\{[^}]*min-height:\s*calc\(100dvh - var\(--external-header-height\) - 4\.8rem\)/);
});

test("the transformer matrix is a labelled keyboard-scrollable region", async () => {
  const [paperLab, paperStyles] = await Promise.all([
    read("app/components/PaperLab.tsx"),
    read("app/components/PaperLab.module.css"),
  ]);

  assert.match(paperLab, /id="causal-matrix-heading"/);
  assert.match(paperLab, /className=\{styles\.causalMatrixScroll\} role="region" aria-labelledby="causal-matrix-heading" tabIndex=\{0\}/);
  assert.match(paperStyles, /\.causalMatrixScroll\s*\{[^}]*overflow-x:\s*auto[^}]*overscroll-behavior-x:\s*contain/);
  assert.match(paperStyles, /\.causalMatrixScroll:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--violet-deep\)/);
  assert.match(paperStyles, /\.causalMatrixScroll table\s*\{[^}]*min-width:\s*36rem/);
  assert.match(paperStyles, /\.lessonShell :global\(\.transformer-stages li > div\)\s*\{[^}]*grid-template-columns:\s*1fr/);
});

test("contextual course and checkpoint actions preserve 44px targets", async () => {
  const [resume, actionLink, curriculum, paper, checkpoint] = await Promise.all([
    read("app/components/CourseResume.module.css"),
    read("app/components/LearnerActionLink.tsx"),
    read("app/components/CourseCurriculum.module.css"),
    read("app/components/PaperLab.module.css"),
    read("app/components/ModuleCheckpoint.module.css"),
  ]);

  assert.match(resume, /\.actions a\s*\{[^}]*min-height:\s*2\.75rem/);
  assert.match(actionLink, /minHeight: "2\.75rem"/);
  assert.match(curriculum, /\.nextAction a\s*\{[^}]*min-height:\s*2\.75rem/);
  assert.match(paper, /\.lessonShell :global\(\.paper-footer a\)\s*\{[^}]*min-height:\s*2\.75rem/);
  assert.match(checkpoint, /\.console button,[\s\S]*?\.navigation a\s*\{[^}]*min-height:\s*2\.75rem/);
});
