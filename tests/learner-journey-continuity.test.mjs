import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the project course resumes returning learners without an introductory demo", async () => {
  const [course, projectCourse, courseResume, curriculum] = await Promise.all([
    readFile(new URL("../app/course/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/courses/llm-systems/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/CourseResume.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/CourseCurriculum.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(projectCourse, /<CourseResume \/>/);
  assert.match(projectCourse, /<CourseGuide/);
  assert.match(projectCourse, /<section className="course-track-grid"/);
  assert.doesNotMatch(projectCourse, /FirstRunExperience|Introductory JavaScript RNN|Train and generate/);
  assert.match(courseResume, /Promise\.all\(\[initializeLearnerPersistence\(\), initializeProjectPersistence\(\)\]\)\.finally/);
  assert.match(courseResume, /if \(!hydrated\) return null/);
  assert.doesNotMatch(courseResume, /Restoring your place|styles\.loading/);
  assert.match(courseResume, /if \(startedLessons\.length === 0 && !projectStarted\) return null/);
  assert.match(courseResume, /Resume lesson/);
  assert.match(courseResume, /Resume project/);
  assert.match(courseResume, /Progress and code are saved in this browser/);
  assert.doesNotMatch(courseResume, /Introductory JavaScript RNN|Train and generate|saveCharacterRnnArtifact/);
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

test("project continuity distinguishes the live import graph from standalone lesson contracts", async () => {
  const [structure, timeline] = await Promise.all([
    readFile(new URL("../app/components/ProjectStructureMap.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/ProjectTimeline.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(structure, /The React app imports real TypeScript modules/);
  assert.match(structure, /standalone Python files implement the same host-owned contracts/);
  assert.match(structure, /models\/character-rnn\.py can also produce the checkpoint/);
  assert.match(structure, /BrowserChat\.tsx imports the browser adapters it uses/);
  assert.match(structure, /full build records the whole source tree and its evidence/);
  assert.match(structure, /main\.tsx → BrowserChat\.tsx → browser adapters/);
  assert.match(structure, /standalone \.py files → host-owned checks/);
  assert.match(structure, /character-rnn\.py → checkpoint → Student RNN/);
  assert.match(structure, /\*\.config\.js → host-parsed configuration/);
  assert.match(structure, /Saved in this browser\. You can save an optional backup/);
  assert.match(structure, /portfolioReadiness/);
  assert.match(structure, /activeBuildIsCurrent/);
  assert.match(structure, /\/lessons\/\$\{nextLesson\.lessonId\}#implementation/);
  assert.match(timeline, /full file tree is scaffolded from the start/);
  assert.match(timeline, /Scaffolded placeholder/);
  assert.match(timeline, /Lesson work replaces placeholder/);
  assert.doesNotMatch(timeline, /joins the project|File added here|No lesson files yet/);
});
