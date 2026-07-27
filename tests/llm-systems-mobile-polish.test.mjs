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

test("the learner family header and Plum atmosphere come from the shared learner UI", async () => {
  const [layout, header, styles, generatedCss, generator, legacyGlobalStyles] = await Promise.all([
    read("app/layout.tsx"),
    read("app/components/LearnerHeader.tsx"),
    read("packages/course-kit/src/learner-ui.ts"),
    read("public/assets/learner-ui.css"),
    read("scripts/generate-learning-platform-learner-ui.mjs"),
    read("app/styles/learning-flow.css"),
  ]);

  assert.doesNotMatch(header, /"use client"|useEffect|useRef|matchMedia/);
  assert.match(header, /data-learner-family-header/);
  assert.match(header, /className="learner-header__inner"/);
  assert.match(header, /className="learner-wordmark"/);
  assert.match(header, /learner-primary-nav--\$\{mobile \? "mobile" : "desktop"\}/);
  assert.match(header, /className="learner-global-nav" aria-label="Learning experiences"/);
  assert.match(header, /className="learner-nav-menu__panel"/);
  assert.doesNotMatch(header, /<details[^>]*\sopen(?:\s|=)/);
  assert.match(header, /label: "Modules"/);
  assert.match(header, /label: "Practice"/);
  assert.match(header, /label: "Review"/);
  assert.match(header, /label: "Project"/);
  assert.match(header, /label: "Reading"/);
  assert.match(header, /<summary>\{suiteMode \? "Explore" : "Menu"\}<\/summary>/);
  assert.match(layout, /href=\{`\$\{learnerUiAssetBasePath\}\/assets\/learner-ui\.css`\}/);
  assert.match(layout, /src=\{`\$\{learnerUiAssetBasePath\}\/assets\/learner-ui\.js`\}/);
  assert.doesNotMatch(layout, /dangerouslySetInnerHTML/);
  assert.match(layout, /learner-ui/);
  assert.match(generator, /resolveLearnerUiTheme\(\{ palette: "plum" \}\)/);
  assert.match(generator, /createLearnerUiCss\(theme, \{ palette: "plum" \}\)/);
  assert.match(generatedCss, /--learner-background-recipe: plum;/);
  assert.match(generatedCss, /circle at 88% 4%/);
  assert.doesNotMatch(
    legacyGlobalStyles,
    /body\s*\{[^}]*background(?:-attachment)?\s*:/,
  );
  assert.match(styles, /\.learner-primary-nav--desktop\s*\{[\s\S]*?margin-left:\s*auto/);
  assert.match(styles, /\.learner-nav-menu > summary\s*\{[^}]*min-height:\s*2\.75rem/);
  assert.match(styles, /@media \(max-width: \$\{LEARNER_UI_BREAKPOINTS\.compact\}px\)[\s\S]*?\.learner-primary-nav--desktop \{ display: none; \}[\s\S]*?\.learner-primary-nav--mobile/);
  assert.match(styles, /\.learner-ui :focus-visible\s*\{[^}]*outline:\s*3px solid var\(--learner-color-focus\)/);
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
  assert.match(workspaceStyles, /\.shell\s*\{[^}]*height:\s*calc\(100dvh - var\(--learner-header-height\)\)/);
  assert.match(workspaceStyles, /\.shell\s*\{[^}]*min-height:\s*0/);
  assert.doesNotMatch(workspaceStyles, /data-learner-family-header|course-header|4\.9rem/);
  assert.match(workspaceStyles, /\.topbar\s*\{[^}]*column-gap:\s*0\.5rem/);
  assert.match(workspaceStyles, /\.topbar > a:first-child\s*\{[^}]*min-height:\s*2\.75rem/);

  assert.match(capstone, /compiled-capstone-shell \$\{styles\.shell\}/);
  assert.match(capstone, /compiled-capstone-runtime \$\{styles\.runtime\}/);
  assert.match(capstone, /capstone-build-gate \$\{styles\.gate\}/);
  assert.match(capstoneStyles, /\.shell\s*\{[^}]*min-height:\s*calc\(100dvh - var\(--learner-header-height\)\)/);
  assert.match(capstoneStyles, /\.runtime\s*\{[^}]*height:\s*calc\(100dvh - var\(--learner-header-height\) - 4\.8rem\)/);
  assert.match(capstoneStyles, /\.gate\s*\{[^}]*min-height:\s*calc\(100dvh - var\(--learner-header-height\) - 4\.8rem\)/);
  assert.match(capstoneStyles, /@media \(max-width: 650px\)[\s\S]*?\.runtime\s*\{[^}]*3\.75rem/);
  assert.match(capstoneStyles, /@media \(max-width: 940px\) and \(max-height: 500px\)[\s\S]*?\.runtime\s*\{[^}]*2\.75rem/);
  assert.doesNotMatch(capstoneStyles, /external-header-height|data-learner-family-header|course-header/);
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
