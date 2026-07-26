import {
  CURRICULUM_MANIFEST_VERSION,
  defineCurriculumManifest,
} from "@latent/course-kit";

export const harnessEngineeringManifest = defineCurriculumManifest({
  schemaVersion: CURRICULUM_MANIFEST_VERSION,
  id: "harness-engineering",
  title: "Harness Engineering",
  shortTitle: "Harnesses",
  thesis: "Study the deterministic software that turns model responses into bounded, testable agent behavior.",
  outcome: "You'll be able to implement and test a small model-agnostic agent harness without depending on the Browser Chat project.",
  modules: [
    {
      id: "harness-engineering",
      routeSlug: "harness-engineering",
      order: 1,
      title: "Harness Engineering",
      shortTitle: "Harnesses",
      thesis: "Work through agent loops, tools, context, permissions, durable state, evaluation, coordination, and a composed harness.",
      outcome: "You'll be able to explain and test the execution layer around a language model.",
      lessons: [
        { lessonId: "agent-loop", projectPath: "harness/agent_loop.py" },
        { lessonId: "tool-contracts", projectPath: "harness/tools.py" },
        { lessonId: "context-selection", projectPath: "harness/context.py" },
        { lessonId: "permissions-and-sandboxes", projectPath: "harness/permissions.py" },
        { lessonId: "state-and-recovery", projectPath: "harness/state.py" },
        { lessonId: "agent-evaluations", projectPath: "harness/evaluations.py" },
        { lessonId: "task-orchestration", projectPath: "harness/orchestration.py" },
        { lessonId: "integrated-harness", projectPath: "harness/harness.py" },
      ],
    },
  ],
} as const);
