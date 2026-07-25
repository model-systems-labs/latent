# Latent conformance report: MergeCraft

- Participant type: `agent`
- Participant or run identifier: `tagged-agent-mergecraft-20260725T211751Z`
- Operating system: macOS 26.2 build 25C56, arm64
- Node/npm: `v26.0.0` / `11.12.1`
- Started: `2026-07-25T21:17:51Z`
- Finished: `2026-07-25T21:25:02Z`
- Elapsed: `431 seconds` (`7m 11s`)
- Public tag: `course-kit-v0.2.0`
- Public commit: `57d5b7ca00e36411841d1aeaff32085afead5c7c`
- Generated platform title: MergeCraft
- Generated topic: resolving Git conflicts deliberately
- Preview URL: `http://127.0.0.1:52066/` (temporary loopback URL)

The public repository URL was supplied as the starting pointer. The agent then
used only the tagged repository, its public documentation, and the generated
project. It did not inspect a maintainer checkout, reuse a prior generated
project, push, or deploy.

## Commands

```text
date -u '+%Y-%m-%dT%H:%M:%SZ'
mktemp -d -t latent-v020-conformance.XXXXXX
sw_vers
uname -m
node --version
npm --version
git clone --branch course-kit-v0.2.0 --depth 1 \
  https://github.com/model-systems-labs/latent.git latent
git -C latent rev-parse HEAD
git -C latent describe --tags --exact-match
git -C latent status --short --branch
cd latent
npm ci
# The concurrent install failed with ENOSPC.
test "$(realpath node_modules)" = "/private/var/folders/hr/5lm3jz2d0lb8ggz3_123zjzm0000gn/T/latent-v020-conformance.XXXXXX.OAiyCxsWgO/latent/node_modules" && \
  rm -rf /private/var/folders/hr/5lm3jz2d0lb8ggz3_123zjzm0000gn/T/latent-v020-conformance.XXXXXX.OAiyCxsWgO/latent/node_modules
df -h /private/var/folders
# After installs were serialized:
npm ci
npm run create:platform -- ../mergecraft-git-conflicts \
  --title "MergeCraft" \
  --tagline "Resolve Git conflicts with intent, verify the result, and merge with confidence." \
  --accent "#f97316"
test "$(realpath node_modules)" = "/private/var/folders/hr/5lm3jz2d0lb8ggz3_123zjzm0000gn/T/latent-v020-conformance.XXXXXX.OAiyCxsWgO/latent/node_modules" && \
  rm -rf /private/var/folders/hr/5lm3jz2d0lb8ggz3_123zjzm0000gn/T/latent-v020-conformance.XXXXXX.OAiyCxsWgO/latent/node_modules
df -h /private/var/folders
cd ../mergecraft-git-conflicts
sed -n '1,240p' AGENTS.md
sed -n '1,240p' GUIDE.md
# One unmatched functions.apply_patch made no change. Two successful actions
# deleted and then re-added complete content/learning-pack.json and
# content/question-groups.json replacements. Their complete payloads survive
# only in the run transcript.
npm run validate
# strict:no-firsthand-source failed. A functions.apply_patch action changed the
# official git-merge source from "reference" to "primary".
npm run validate
npm run build
find dist -type f -print | LC_ALL=C sort | \
  xargs shasum -a 256 | shasum -a 256
npm run build
find dist -type f -print | LC_ALL=C sort | \
  xargs shasum -a 256 | shasum -a 256
npm run preview -- --port 0
curl --fail --silent --show-error --output /dev/null \
  --write-out 'homepage status=%{http_code} type=%{content_type} bytes=%{size_download}\n' \
  http://127.0.0.1:52066/
curl --fail --silent --show-error --output /dev/null \
  --write-out 'learning-pack status=%{http_code} type=%{content_type} bytes=%{size_download}\n' \
  http://127.0.0.1:52066/content/learning-pack.json
curl --fail --silent --show-error --output /dev/null \
  --write-out 'question-groups status=%{http_code} type=%{content_type} bytes=%{size_download}\n' \
  http://127.0.0.1:52066/content/question-groups.json
curl --fail --silent --show-error \
  http://127.0.0.1:52066/content/learning-pack.json | \
  jq '{title: .package.title, lesson: .lessons[0].title, deck: .flashcardDecks[0].title, cardCount: (.flashcardDecks[0].cards | length)}'
curl --fail --silent --show-error \
  http://127.0.0.1:52066/content/question-groups.json | \
  jq '{title: .library.title, group: .groups[0].title, question: .groups[0].questions[0].title}'
```

The preview ran in tool session `22799`. It was stopped with the exact
non-shell action
`functions.write_stdin({session_id: 22799, chars: "\u0003"})`, followed by:

```text
if lsof -nP -iTCP:52066 -sTCP:LISTEN; then
  exit 1
else
  echo 'preview stopped: port 52066 has no listener'
fi
find dist -type f -print | LC_ALL=C sort | \
  xargs shasum -a 256 | shasum -a 256
find dist -type f | wc -l | tr -d ' '
trial_start_epoch=$(date -u -j -f '%Y-%m-%dT%H:%M:%SZ' \
  '2026-07-25T21:17:51Z' '+%s')
trial_end_epoch=$(date -u '+%s')
date -u -r "$trial_end_epoch" '+END_UTC=%Y-%m-%dT%H:%M:%SZ'
echo "ELAPSED_SECONDS=$((trial_end_epoch - trial_start_epoch))"
```

## Results

- Creation: Pass; the generator emitted a validated project with all four
  primitives.
- Validation: Pass; 1 lesson, 1 deck, 6 cards, 1 Question Group, 1 practice
  question, and 1 IDE exercise.
- Static build: Pass; two builds and the post-preview build produced the same
  20-file digest,
  `cbfc79bfb64a779d154693835d1b4d35bcc65a66a894c4f9f5050a502a365632`.
- Lesson: Customized as “Resolve the file, then verify the index.”
- Flash-card deck: Replaced with six Git conflict-resolution cards.
- Question Group: Replaced with a JavaScript exercise that detects unresolved
  conflict markers.
- Browser IDE exercise: Present; the generated trusted exercise remained
  unchanged.
- Preview: Pass; the homepage and both portable JSON assets returned HTTP 200.
  The preview stopped cleanly and port 52066 had no remaining listener.

## Problems and fixes

- Environment collision: the initial `npm ci` failed with `ENOSPC` while three
  clean-room installs ran concurrently. Removing only this trial's partial
  `node_modules` and serializing installs allowed the unchanged command to
  succeed. The full seven-minute clock includes that recovery.
- Authoring error: strict validation rejected a source that was not classified
  as first-hand. Classifying the official `git-merge` documentation as the
  primary source corrected the authored data.
- `npm ci` reported 4 moderate and 12 high dependency entries. No dependency
  rewrite was made during an immutable-tag trial.

## Verdict

**Pass — exact tagged-release agent evidence.**

No human developer performed or attested to this run.
