# Latent Question Groups

Question groups are a portable, model-neutral primitive for programming
practice. A person or LLM can author the same declarative JSON, validate it
with Course Kit, and host the file on any static server.

**Status: preview in the unreleased Course Kit v0.2 source tree.**

The candidate format is versioned separately from Learning Pack v1. This keeps
the released lesson and flash-card contract byte-for-byte compatible while
giving practice questions a clean schema of their own.

- [Checked-in candidate JSON Schema](../packages/course-kit/schema/question-group-library.schema.json)
- Planned permanent URL after the v0.2 release:
  `https://model-systems-labs.github.io/latent/question-groups/v1/question-group-library.schema.json`

The planned URL may return `404` before `course-kit-v0.2.0` is tagged. The
candidate schema may change before that release, including changes needed for
authorship, licensing, provenance, learning objectives, and source grounding.
Once the release workflow publishes `/question-groups/v1/`, those exact bytes
become immutable.

## Layering

```text
question-group library (portable JSON)
        ↓
reader adapter (validated data → host-owned contracts)
        ↓
language runtime (isolated learner code)
        ↓
bounded runtime result
        ↓
host source and contract binding
        ↓
practice UI and device-local progress
```

Course Kit owns the first layer only. It has no React, persistence, compiler,
or learner-runtime dependency. A compatible reader decides whether and how to
execute learner code.

Latent's built-in practice site uses the shared CodeMirror editor, Browser Lab
for JavaScript and TypeScript, and a separate practice progress store. It does
not reuse lesson completion, the cumulative course project, or flash-card
ratings.

## What a library can declare

A library contains ordered question groups. Each question declares:

- A stable id, order, title, prompt, difficulty, tags, and constraints.
- JavaScript, TypeScript, or Python as its language.
- A safe relative source path without `.` or `..` segments, and starter source.
- A function or class-method entrypoint.
- Bounded JSON arguments.
- Example and additional check cases.
- Data-only assertions such as deep equality, type, range, length, inclusion,
  regular-expression matching, or an expected exception.

Regular-expression assertions use ECMAScript `RegExp` syntax. Course Kit
rejects invalid patterns during full validation, before a reader sees them.

The format never accepts executable test strings, HTML, components, workers,
iframes, credentials, or publisher-defined runtime hooks. Cases are visible
learning checks, not secret certification tests.

## Validate the complete contract

The candidate JSON Schema checks the versioned document shape, strict fields,
types, and size bounds. It cannot express every cross-field rule in the
portable contract. Full Course Kit validation additionally checks unique ids
and ordering, language-specific paths and non-reserved entrypoint names,
example and check coverage, constructor-argument use, assertion combinations,
and ECMAScript regular-expression syntax.

The validator shown below is available from a checkout of the v0.2 source. The
latest published v0.1.0 package does not include Question Groups yet.
Run the full validator before publishing; JSON Schema success alone is not the
publication gate.

```js
import { readFile } from "node:fs/promises";
import { parseQuestionGroupLibraryJson } from "@latent/course-kit/question-group";

const source = await readFile("question-group-library.json", "utf8");
const result = parseQuestionGroupLibraryJson(source);

if (!result.valid) {
  for (const error of result.errors) {
    console.error(`${error.path}: ${error.message}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Validated ${result.summary.questions} questions.`);
}
```

## Trust boundary

Hosting a library does not grant it execution privileges in another site.
Readers must validate the complete file before use, map the data into their own
host-owned checks, and run learner source outside the page realm.

Latent currently executes its built-in reviewed library. An arbitrary hosted
library may use the checked-in candidate schema, but it does not automatically
gain access to Latent's privileged runtimes. A publisher can build a
compatible standalone player with its own sandbox, or serve the JSON for
another reader.

Python support in the schema describes interoperability; it is not a claim that
every reader provides a hostile-code Python sandbox.

## Small valid library

This complete library passes full Course Kit validation:

```json
{
  "format": "latent-question-group-library",
  "schemaVersion": 1,
  "library": {
    "id": "publisher/topic",
    "version": "1.0.0",
    "title": "Topic practice",
    "description": "A complete description of the practice library."
  },
  "groups": [
    {
      "id": "arithmetic",
      "order": 1,
      "title": "Arithmetic warmups",
      "description": "Practice a small class method with visible, data-only cases.",
      "questions": [
        {
          "id": "add-two-values",
          "order": 1,
          "title": "Add two values",
          "prompt": "Implement the method so it returns the sum of its two numeric arguments.",
          "difficulty": "easy",
          "language": "javascript",
          "path": "add-two-values.js",
          "starterCode": "class Solution {\n  add(left, right) {\n    return 0;\n  }\n}\n",
          "entrypoint": {
            "kind": "class-method",
            "className": "Solution",
            "methodName": "add"
          },
          "constraints": [
            "Both arguments are finite JSON numbers."
          ],
          "cases": [
            {
              "id": "small-values",
              "label": "adds two small values",
              "visibility": "example",
              "args": [2, 3],
              "assertions": [
                {
                  "id": "expected-sum",
                  "label": "returns five",
                  "kind": "deep-equal",
                  "expected": 5
                }
              ]
            },
            {
              "id": "negative-value",
              "label": "adds a negative value",
              "visibility": "check",
              "args": [-3, 8],
              "assertions": [
                {
                  "id": "expected-sum",
                  "label": "returns five",
                  "kind": "deep-equal",
                  "expected": 5
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

## Versioning

During the preview, the candidate schema may change before the v0.2 release.
After v1 is published, publishers must put changed content under a new semantic
library version. A future incompatible schema receives a new
`/question-groups/vN/` path rather than replacing the published v1 bytes.
