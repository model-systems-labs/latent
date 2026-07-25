# Latent Open Learning

Latent Open Learning is a model-neutral format and toolchain for lessons and flash cards. A publisher owns the source and hosts the finished files on any static web host. A learner can use that standalone site directly or give its `learning-feed.json` URL to another compatible reader.

There is no required central upload, account, model provider, database, or application server.

## What ships in version 1

- A strict `latent-learning-pack` JSON format for objectives, sources, lessons, multiple-choice checks, decks, and cards.
- Namespaced `extensions` metadata for experimentation without weakening the core reader.
- A provider-neutral command-line tool for initialization, inspection, validation, deterministic builds, local preview, and remote verification.
- A standalone, responsive learning site generated from the same validated package.
- An HTTPS feed containing exact package identity, version, byte count, and SHA-256 digest.
- A browser studio at `/open-learning` that can validate and build locally without the command line.
- A hosted-feed reader that verifies content before rendering and can retain an immutable version on the learner's device.
- Authoring, independent review, and publishing skills that any capable file-editing LLM can follow.

Version 1 intentionally does not execute community JavaScript, HTML, CSS, Python, React, MDX, workers, iframes, or executable tests. Built-in Latent lessons may use privileged runtimes; hosted community packs cannot.

## Quick start

Use the exact v0.1.0 release from any directory:

```bash
COURSE_KIT_RELEASE=https://github.com/model-systems-labs/latent/releases/download/course-kit-v0.1.0/latent-course-kit-0.1.0.tgz

npm exec --yes --package "$COURSE_KIT_RELEASE" -- \
  latent-learning init my-learning-pack --json
```

The GitHub tarball is the permanent registry-independent install path. Course
Kit is not currently published on npm. After the `@latent` npm scope is
bootstrapped, the matching package version can become an equivalent shorter
pin; do not advertise that pin before it exists.

`init` deliberately writes an incomplete scaffold. Replace every example
identity, source, and content field in `my-learning-pack/learning-pack.json`;
the release validator rejects the starter placeholders. Then run:

```bash
npm exec --yes --package "$COURSE_KIT_RELEASE" -- \
  latent-learning validate \
  my-learning-pack/learning-pack.json \
  --strict \
  --json

npm exec --yes --package "$COURSE_KIT_RELEASE" -- \
  latent-learning build \
  my-learning-pack/learning-pack.json \
  --out-dir my-learning-pack/site \
  --json

npm exec --yes --package "$COURSE_KIT_RELEASE" -- \
  latent-learning serve \
  my-learning-pack/site
```

Open `http://127.0.0.1:4173`. The built directory is the deployable artifact.

The browser workflow is simpler: open `/open-learning`, edit or import `learning-pack.json`, and choose **Download host-ready site**.

When contributing inside the Latent monorepo, the equivalent fallback is:

```bash
npm ci
npm run build --workspace @latent/course-kit
node packages/course-kit/bin/latent-learning.mjs --help
```

Use the `node packages/course-kit/bin/latent-learning.mjs` form only from a
checkout. Published automation should keep the explicit
release tarball pin so a future CLI release cannot silently change a build.

## Generated directory

```text
site/
  .latent-build
  index.html
  learning-pack.json
  learning-feed.json
  build-report.json
  README.txt
  _headers
  assets/
    player.css
    player.js
```

Publish the entire directory without changing `learning-pack.json`. If those bytes change, its feed digest will no longer verify.

The builder refuses to write into a nonempty directory unless it contains the exact Latent build marker. This prevents an accidentally broad output path from overwriting unrelated work.

## Host it anywhere

Any server that can return static files works. Common choices include a project-pages service, an object-storage bucket, or a static-site provider.

Required behavior:

- Serve `index.html`, `learning-pack.json`, `learning-feed.json`, and `assets/` from the same origin.
- Serve JSON without transforming its bytes.
- Use HTTPS outside local preview.
- If learners will open the feed from a different origin, return an `Access-Control-Allow-Origin` header for that reader or for `*`.
- Keep an already-published `package-id@version` immutable. Publish changed content under a new semantic version.

The standalone site does not need CORS. CORS is needed only when a reader on another origin fetches the feed and package.

Verify a deployed feed:

```bash
npm exec --yes --package "$COURSE_KIT_RELEASE" -- \
  latent-learning verify-url \
  https://publisher.example/course/learning-feed.json \
  --json
```

Plain HTTP is accepted only for `localhost`, `127.0.0.1`, or `::1`.

## Authoring contract

The immutable version 1 schema identifiers are:

- [`learning-pack.schema.json`](https://model-systems-labs.github.io/latent/open-learning/v1/learning-pack.schema.json)
- [`learning-feed.schema.json`](https://model-systems-labs.github.io/latent/open-learning/v1/learning-feed.schema.json)

Packaged convenience copies live at
[`schema/learning-pack.schema.json`](../schema/learning-pack.schema.json) and
[`schema/learning-feed.schema.json`](../schema/learning-feed.schema.json). A complete
example lives at
[`examples/open-learning/reliable-llm-changes/learning-pack.json`](https://github.com/model-systems-labs/latent/blob/main/examples/open-learning/reliable-llm-changes/learning-pack.json).
Once published, files under `/open-learning/v1/` are immutable. A future
incompatible schema receives a new versioned path rather than replacing these
bytes.

Every package has:

- A namespaced id such as `publisher/topic` and a semantic version.
- Human-readable ownership, language, license, and publication metadata.
- Observable learning objectives.
- HTTPS sources with a note explaining how each source supports the material.
- At least one lesson or flash-card deck.

Every lesson names the objectives it teaches and the sources it uses. Safe blocks are:

- `paragraph`
- `heading`
- `list`
- `callout`
- `code` for display only
- `quiz`

Every flash card includes an answer, an explanatory connection, objectives, and sources. These extra fields make it harder to produce a large but shallow deck.

Validation rejects unknown core fields, duplicate identities, broken references, missing quiz answers, unfinished placeholders, unsafe executable strings, oversized content, and unsupported versions. Quality warnings identify thin lessons, thin decks, unused sources, unassessed objectives, and missing firsthand sources. `--strict` treats warnings as a failed release gate.

## Extensions

`extensions` is allowed at the package, lesson, deck, and card levels. Keys must be globally namespaced:

```json
{
  "extensions": {
    "org.example/reading-level": {
      "scale": "custom",
      "value": 3
    }
  }
}
```

Core readers ignore extension values they do not understand. Extension metadata cannot load code or expand browser permissions. A broadly useful extension should first prove itself under a namespace, then become a versioned declarative capability through the normal schema process.

Extension values must be bounded JSON data: no executable values, custom object
types, cycles, excessive nesting, or oversized collections. This keeps
canonicalization deterministic and prevents metadata from becoming a hidden
runtime or resource-exhaustion path.

## Identity, saving, and progress

A feed entry identifies immutable bytes with:

```text
packageId + version + bytes + sha256
```

The hosted reader:

1. Fetches with credentials omitted and no referrer.
2. Rejects redirects and unsafe package paths.
3. Streams through a two-megabyte UTF-8 byte limit.
4. Checks the declared byte count and SHA-256 digest.
5. Validates the package and matches its id and version to the feed.
6. Requires canonical JSON.
7. Renders through React text nodes only.

Saving is explicit. A different digest observed for an already-saved publisher
origin and `id@version` is rejected before rendering, not treated as an update.

Saved packages are isolated by publisher origin, package, and version. Progress
also includes the exact digest:

```text
latent.open-learning.install.v1:<publisher-origin>:<publisher>/<package>@<version>
latent.open-learning.progress.v1:<publisher-origin>:<publisher>/<package>@<version>:<sha256>
```

Saving the JSON on a device is not a promise that the application shell itself
is available offline.

## Trust model

Format validity is not editorial approval. A valid community package is labeled **Self-hosted · Not reviewed by Latent**.

Keep these attestations separate:

1. **Integrity:** the bytes match the publisher's feed.
2. **Identity:** the publisher controls a verified name or domain.
3. **Editorial review:** a person reviewed the exact immutable version.
4. **Platform certification:** an optional published rubric was satisfied.

A future directory can index publisher-controlled feed URLs and these independent attestations. It should remain optional; self-hosted packs must continue to work without it.

## Commands and exit codes

```text
latent-learning init <directory> [--json]
latent-learning inspect <learning-pack.json> [--json]
latent-learning validate <learning-pack.json> [--strict] [--json]
latent-learning schema [output.json] [--feed] [--json]
latent-learning build <learning-pack.json> --out-dir <directory> [--json]
latent-learning serve <directory> [--host 127.0.0.1] [--port 4173]
latent-learning verify-url <learning-feed.json URL> [--json]
```

- `0`: success
- `1`: invalid learning content
- `2`: invalid invocation or unsafe local target
- `3`: network or hosting verification failure

Use `--json` in an LLM or CI workflow. Do not infer success from human-readable text when a structured result is available.

`verify-url` checks every package in a feed: same-origin URL, streaming byte
limit, SHA-256 digest, canonical UTF-8 JSON, schema, and matching identity and
metadata.

## Version 1 boundaries and next steps

The first interoperability work should be import and export adapters, not executable plugins:

- Anki card import and export
- 1EdTech QTI assessments
- Common Cartridge course structure
- H5P content import where it can be represented safely
- xAPI or cmi5 event export

Publisher signatures, multi-package directory UX, accessible media assets, formal attestations, and organization-private registries can layer on top without changing the host-anywhere core.
