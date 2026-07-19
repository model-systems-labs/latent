# Content provenance

Latent's four courses teach published mechanisms without republishing the
lessons, figures, datasets, or implementation code that introduced them. Papers,
standards, and reference repositories are linked as sources. The course
explanations, diagrams, exercises, reference solutions, tests, and small
synthetic fixtures are written for this project unless a local notice says
otherwise.

## What the sources contribute

The source list establishes prior work and supports technical facts, equations,
protocol fields, API names, and standard terminology. Those functional elements
remain recognizable because changing them would make the lesson inaccurate.
Source prose, tutorial narration, figures, benchmark tables, and implementation
code are not included in the course. A future adaptation must be labeled at the
point of use and must carry the source's required attribution and license notice.

The browser runtime does use third-party packages and an optional pretrained
model. They are dependencies rather than lesson reference code and are listed
with their licenses on the in-product Sources page.

## Course-authored fixtures

Every dataset shown in the lesson index is a small synthetic fixture created for
the course. None is extracted from a paper's evaluation corpus, an author's
tutorial, or a production conversation. These fixtures are currently marked
`Not separately licensed`; the project does not make a CC0 or other open-data
grant on the repository owner's behalf.

## Review record

### LLM Systems

On 2026-07-17, all fourteen lessons were checked against their cited papers,
standards, guides, and implementation repositories. The review covered learner
prose, diagrams, reference solutions, host-owned trainers, tests, experiment
fixtures, and the capstone adapters. It combined normalized phrase matching with
manual comparison of examples, control flow, data structures, and code shape.

Two items were changed during that review:

- The character-RNN trainers had followed the organization of Andrej Karpathy's
  minimal NumPy RNN gist too closely. They were replaced with independently
  structured fixed-window trainers using named parameter groups and Adam.
- The BPE lesson used the paper's recognizable `lower -> low er` worked example.
  It was replaced throughout the lesson and contract tests with an original
  `signaling` example drawn from the course's synthetic morphology fixture.

No other substantive phrase, figure, dataset, or structurally distinctive code
reuse was found. Matches were limited to bibliographic titles and necessary
technical vocabulary. The machine-readable lesson-by-lesson record lives in
`app/lessons/provenance.ts`.

### Linear Algebra and Machine Learning Basics

On 2026-07-18, the ten stand-alone prerequisite lessons were reviewed for the
origin of their prose, diagrams, exercises, reference solutions, and synthetic
fixtures. Their numerical examples, diagrams, code structure, validation, and
small datasets were written for this project. The linked textbooks, guides, and
NumPy documentation support mathematical definitions and API behavior; their
prose, figures, worked examples, and source code are not included.

These lessons do not contribute files or requirements to the Browser Chat
project. Their separate machine-readable record lives in
`app/content/foundations/provenance.ts`, leaving the fourteen-lesson LLM Systems
review inventory unchanged.

### Harness Engineering

The eight Harness Engineering lessons form a separate applied course about the
deterministic execution layer around a language model. Its examples, diagrams,
exercises, reference solutions, and synthetic traces are course-authored. The
linked papers, specifications, and engineering articles support the terminology
and system boundaries discussed in each lesson.

During the flash-card integration review on 2026-07-18, the former Codex
security link was found to have moved to an unrelated scanning product. The
lesson now links the current OpenAI sandboxing and approval documentation. The
review also added direct sources for path traversal, time-of-check/time-of-use
races, evaluation checkpointing, pass@k, and pass^k, and tightened language
around course-specific schemas, context priority, and adapter interchangeability.

Harness Engineering does not add files, artifacts, checkpoints, or completion
requirements to Browser Chat. Its machine-readable review record lives in
`app/content/harness-engineering/provenance.ts`.

### Flash-card review library

On 2026-07-18, the review library was expanded from a short lesson recap into
an atomic technical vocabulary deck. Concept selection was informed by the
course-authored lessons and summaries, the bibliography in
`app/lessons/sources.ts`, and the source lists attached to the two foundation
courses. The pass also checked the primary paper and standard surfaces for
established terms that the lesson prose could not assume a new learner already
understood.

The card definitions, teaching details, and worked examples are original course
prose. They do not quote paper abstracts, reuse source examples, or restate
benchmark results as general guarantees. Each new card group carries a short
`source` trail naming the papers, standards, or official guides that informed
its terminology. Those trails are displayed in the study UI so a learner can
connect unfamiliar vocabulary back to its technical context.

The Harness Engineering release added 120 cards: fifteen for each of the eight
lessons. Its review separates standards from course teaching policies, including
closed-schema validation, context compaction, permission precedence, event-log
replay, finite-sample pass metrics, static dependency batching, and the limits
of the integrated teaching harness. The full library now contains 574 cards
across seven filterable subjects.

The release review replaced a phrase-embedding example that had independently
repeated a distinctive example from the word2vec paper. The deck now uses the
course-authored fictional name `Velvet Circuit`, and a regression check keeps
the paper example out of the library.

## Contribution rule

Before adding or changing lesson content:

1. Record every source that informs the change.
2. Write prose, examples, diagrams, fixtures, and code independently.
3. Do not copy a source's distinctive worked example merely because its license
   might allow reuse; prefer a course-authored example.
4. If direct quotation or adaptation is genuinely necessary, keep it bounded,
   label it, and add the exact license and attribution before merging.
5. Run the content-provenance tests, which guard the reviewed lesson inventory
   and the two remediated similarity patterns.

This engineering audit is not a legal opinion and cannot prove the absence of a
match against every work that exists. It does provide a concrete source trail,
an explicit authoring policy, and regression checks for the course's reviewed
content.
