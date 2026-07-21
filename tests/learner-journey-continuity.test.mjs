import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the course restores a returning learner before choosing first-run or resume", async () => {
  const [course, firstRun, curriculum] = await Promise.all([
    readFile(new URL("../app/course/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/FirstRunExperience.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/CourseCurriculum.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(firstRun, /Promise\.all\(\[initializeLearnerPersistence\(\), initializeProjectPersistence\(\)\]\)\.finally/);
  assert.match(firstRun, /if \(!hydrated\)/);
  assert.match(firstRun, /course-resume-loading/);
  assert.match(firstRun, /latestStartedLesson/);
  assert.match(firstRun, /sort\(\(left, right\) => \(learner\.lessons\[right\.id\]\?\.updatedAt \?\? 0\) - \(learner\.lessons\[left\.id\]\?\.updatedAt \?\? 0\)\)/);
  assert.match(firstRun, /!isComplete\(latestStartedLesson\)[\s\S]*?latestStartedLesson/);
  assert.match(firstRun, /slice\(courseLessons\.indexOf\(latestStartedLesson\) \+ 1\)[\s\S]*?firstIncompleteLesson/);
  assert.match(firstRun, /Resume lesson/);
  assert.match(firstRun, /workspace\?file=/);
  assert.match(firstRun, /projectStarted/);
  assert.match(firstRun, /Resume project/);
  assert.match(firstRun, /Progress and code are saved in this browser/);
  assert.match(firstRun, /optional backup from the IDE/);
  assert.match(firstRun, /Introductory JavaScript RNN/);
  assert.match(firstRun, /not a capstone checkpoint/);
  assert.doesNotMatch(firstRun, /saveCharacterRnnArtifact/);
  assert.doesNotMatch(course, /Run the first model/);
  assert.match(curriculum, /useLearnerStateHydrated/);
  assert.match(curriculum, /Restoring progress…/);
  assert.match(curriculum, /Module lessons complete/);
  assert.doesNotMatch(curriculum, /Continue to the module checkpoint/);
});

test("the IDE synchronizes passing lesson files without skipping experiment or check", async () => {
  const workbench = await readFile(new URL("../app/components/ProjectWorkbench.tsx", import.meta.url), "utf8");

  assert.match(workbench, /lessonImplementationBlockSources/);
  assert.match(workbench, /saveLessonPracticeAndVerification/);
  assert.match(workbench, /The lesson’s Code step is complete; return to its experiment and check/);
  assert.match(workbench, /selectedLessonComplete/);
  assert.match(workbench, /lessonIsComplete/);
  assert.doesNotMatch(workbench, /selectedLessonChecksPass/);
  assert.match(workbench, /Open the capstone →/);
});

test("project continuity treats every file as scaffolded and gates capstone on the current build", async () => {
  const [structure, timeline] = await Promise.all([
    readFile(new URL("../app/components/ProjectStructureMap.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/ProjectTimeline.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(structure, /The full project is scaffolded now\. Your verified lesson implementations progressively replace its placeholders\./);
  assert.match(structure, /Lesson checks prove one file/);
  assert.match(structure, /Python checkpoint stores trained weights/);
  assert.match(structure, /Saved in this browser\. You can save an optional backup/);
  assert.match(structure, /portfolioReadiness/);
  assert.match(structure, /activeBuildIsCurrent/);
  assert.match(structure, /\/lessons\/\$\{nextLesson\.lessonId\}#implementation/);
  assert.match(timeline, /full file tree is scaffolded from the start/);
  assert.match(timeline, /Scaffolded placeholder/);
  assert.match(timeline, /Lesson work replaces placeholder/);
  assert.doesNotMatch(timeline, /joins the project|File added here|No lesson files yet/);
});
