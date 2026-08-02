---
name: publish-learning-pack
description: Validate, deterministically build, deploy, and verify a Latent Open Learning package on any static host. Use when a user asks to preview, self-host, release, update, or troubleshoot a portable lesson or flash-card feed.
---

# Publish Learning Pack

Publish the builder's exact canonical, validated bytes without making Latent or a central repository a dependency.

## Read the publishing contract

At the repository root, read:

1. `docs/open-learning.md`
2. `docs/learning-pack-quality-rubric.md`
3. `docs/learning-feed.schema.json`
4. the target `learning-pack.json`

Resolve the exact source file, package id, version, intended host, and deployment target before changing external state.

Use this immutable, GitHub-hosted Course Kit release for every public CLI
command in this workflow. Course Kit itself is not published under the
`@latent` npm scope; `npm exec` still resolves its pinned dependencies from the
configured npm registry:

```bash
COURSE_KIT_RELEASE=https://github.com/model-systems-labs/latent/releases/download/course-kit-v0.2.0/latent-course-kit-0.2.0.tgz
```

That immutable release reports standalone `playerVersion: 1` and retains its
legacy view navigation. Repository builds with `playerVersion: 2` use the
sidebar-free continuous checks below. Do not claim the newer presentation for
a v0.2.0 artifact.

## Release workflow

### 1. Establish immutability

If `package.id@package.version` has ever been published, do not change its bytes. Increment the semantic version for any content change.

Check the intended host's current feed, prior release artifacts, and the
publisher's release records. If you cannot establish whether that identity is
unused, do not overwrite it; choose a new version and report the uncertainty.

Do not infer ownership of a hostname, bucket, repository, or site. Use only the target the user placed in scope.

### 2. Run the strict gate

```bash
npm exec --yes --package "$COURSE_KIT_RELEASE" -- \
  latent-learning validate \
  <path>/learning-pack.json \
  --strict \
  --json
```

When intentionally publishing from the Latent monorepo, build the workspace and
use `node packages/course-kit/bin/latent-learning.mjs` as the equivalent local
fallback.

Stop on any error or warning. A user may explicitly accept a quality warning, but document that exception in the release handoff.

An independent `$review-learning-pack` verdict is recommended for public or paid material. Validation alone must not be presented as editorial approval.

### 3. Build into a dedicated directory

```bash
npm exec --yes --package "$COURSE_KIT_RELEASE" -- \
  latent-learning build \
  <path>/learning-pack.json \
  --out-dir <dedicated-output-directory> \
  --json
```

Use an explicit narrow output directory. The builder protects nonempty directories that lack its marker. Do not bypass that protection and do not hand-edit generated files.

Record the package SHA-256, byte count, artifacts, and build report.
The digest covers the generated canonical `learning-pack.json`; it may differ
from the author's source-file digest when key order or whitespace differs.

Build the same source into a second fresh temporary directory and compare the
complete trees:

```bash
second_build="$(mktemp -d)"
npm exec --yes --package "$COURSE_KIT_RELEASE" -- \
  latent-learning build \
  <path>/learning-pack.json \
  --out-dir "$second_build" \
  --json
diff -r <dedicated-output-directory> "$second_build"
```

Publication is blocked if the comparison differs. Remove only the exact
temporary directory you created after recording the result.

### 4. Preview the exact build

```bash
npm exec --yes --package "$COURSE_KIT_RELEASE" -- \
  latent-learning serve \
  <dedicated-output-directory>
```

Check the layout that the build report identifies:

- for `playerVersion: 2` and later, every lesson and deck is present in source order in one scrolling document;
- for `playerVersion: 2` and later, the in-flow contents links reach the corresponding sections without hiding the others;
- for `playerVersion: 2` and later, no side navigation reserves reading space at desktop or small viewports;
- for the immutable v0.2.0 `playerVersion: 1`, the first lesson or deck opens and every legacy navigation item remains reachable;
- quiz feedback and explanations work;
- card reveal and ratings work;
- lesson and card progress survive reload;
- source links point to the intended material;
- the layout works at a small viewport;
- `learning-pack.json` and `learning-feed.json` are reachable.

The preview server returns `Access-Control-Allow-Origin: *` on generated JSON
files so cross-origin access can be rehearsed locally. If an interactive browser
is unavailable, report interaction and viewport checks as unverified; do not
substitute static inspection for those claims.

### 5. Deploy every generated file

Publish the entire generated directory to the chosen static host. Preserve paths and bytes. Do not upload only `index.html`.

For cross-origin readers, configure `Access-Control-Allow-Origin` for the reader origin or `*` on `learning-feed.json` and `learning-pack.json`. Use HTTPS outside loopback preview. Do not forward cookies or credentials.

### 6. Verify the deployed feed

```bash
npm exec --yes --package "$COURSE_KIT_RELEASE" -- \
  latent-learning verify-url \
  https://publisher.example/path/learning-feed.json \
  --json
```

Then open that feed in Latent's `/open-learning/read` reader. Confirm the publisher origin, package id, version, digest, lesson, deck, and explicit save behavior.

If no interactive browser is available, report reader rendering and save
behavior as unverified. A passing `verify-url` result does not prove those
interactions.

If verification reports a byte or digest mismatch, redeploy the untouched build. Do not edit the feed digest by hand to match transformed content.

## Updates and rollback

- Publish a change under a new semantic version.
- Keep prior immutable versions available when practical so learners with saved copies can return.
- A feed can list multiple versions; readers do not silently replace saved content.
- Roll back by restoring a previously verified build and feed, not by reusing a version for different bytes.

## Handoff

Report:

- source package id and version;
- strict validation status and any accepted exception;
- review status as a separate claim;
- local build directory;
- deployed site URL and feed URL;
- SHA-256 and byte count;
- deterministic second-build comparison;
- remote `verify-url` result;
- CORS status for cross-origin readers;
- any unresolved host or cache behavior.

Do not claim a central submission occurred unless the user separately requested it and a real directory accepted the exact feed and digest.
