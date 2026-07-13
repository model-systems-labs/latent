# @latent/training-replay

`@latent/training-replay` turns recorded model-training checkpoints into
validated, content-addressed learning artifacts. It is model-neutral and has no
dependency on React, lesson manifests, browser workers, or application code.

The package owns four things:

1. A strict portable recording schema for metrics, traces, outputs, and state.
2. Scenario validation that proves a recording satisfies its presentation.
3. Artifact materialization with deterministic checkpoint lineage.
4. A lazy registry and UI-neutral checkpoint view model.

The consuming application owns model trainers, datasets, course placement,
recorded JSON files, and React presentation.

## Registration

```ts
import { RecordedTrainingRegistry } from "@latent/training-replay/registry";

const registry = new RecordedTrainingRegistry().register({
  scenario,
  presentation,
  loadRecording: async () => (await import("./recorded-run.json")).default,
});

const replay = await registry.materializeForLesson("optimization", artifactStore);
```

Recordings are loaded only when their lesson needs them. A registration fails
before materialization if its identifiers or presentation are malformed; the
loaded document then undergoes structural, numeric, chronology, metric, trace,
and output validation.

## Honesty boundary

A recorded replay does not claim to train inside the learner's browser. Its
metrics, outputs, and state must originate from the named producer. The browser
replays checkpoint progression and preserves the actual values as downloadable
artifacts.

## Development

```sh
npm run validate --workspace @latent/training-replay
```
