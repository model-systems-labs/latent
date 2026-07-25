# Latent conformance report: Layout Rescue Lab

- Participant type: `agent`
- Participant or run identifier: `tagged-agent-layout-rescue-20260725T213123Z`
- Operating system: macOS 26.2 build 25C56, Darwin 25.2.0 arm64
- Node/npm: `v26.0.0` / `11.12.1`
- Started: `2026-07-25T21:31:23Z`
- Finished: `2026-07-25T21:34:01Z`
- Elapsed: `158 seconds` (`2m 38s`)
- Public tag: `course-kit-v0.2.0`
- Public commit: `57d5b7ca00e36411841d1aeaff32085afead5c7c`
- Generated platform title: Layout Rescue Lab
- Generated topic: evidence-led CSS Grid and Flexbox debugging
- Preview URL: `http://127.0.0.1:52894/` (temporary loopback URL)

The public repository URL was supplied as the starting pointer. The passing
trial began in a new empty directory after the shared harness serialized
dependency installs. The agent then used only the tagged repository, its public
documentation, and the generated project. It did not inspect a maintainer
checkout, reuse a prior generated project, push, or deploy.

## Commands

```text
uname -a
sw_vers
node --version
npm --version
date -u '+PASS_START_UTC=%Y-%m-%dT%H:%M:%SZ'
date '+PASS_START_LOCAL=%Y-%m-%dT%H:%M:%S%z'
mktemp -d /tmp/latent-css-pass.XXXXXX
git clone --branch course-kit-v0.2.0 --depth 1 \
  https://github.com/model-systems-labs/latent.git source
cd source
git status --short
git rev-parse HEAD
git rev-parse course-kit-v0.2.0^{}
git describe --tags --exact-match
sed -n '1,110p' docs/getting-started.md
npm ci
npm run create:platform -- ../layout-rescue-lab \
  --title "Layout Rescue Lab" \
  --tagline "Debug CSS Grid and Flexbox layouts with evidence, not guesswork." \
  --accent "#fb7185"
cd ../layout-rescue-lab
sed -n '1,260p' AGENTS.md
sed -n '1,320p' GUIDE.md
# Four functions.apply_patch actions deleted and then added complete replacements
# for content/learning-pack.json and content/question-groups.json. Their full
# payloads survive in the run transcript; no separate patch file was written.
npm run validate
npm run build
find dist -type f -print0 | sort -z | \
  xargs -0 shasum -a 256 | shasum -a 256
npm run build
find dist -type f -print0 | sort -z | \
  xargs -0 shasum -a 256 | shasum -a 256
sed -n '1,260p' dist/build-report.json
shasum -a 256 \
  dist/content/learning-pack.json \
  dist/content/question-groups.json \
  dist/index.html
npm run preview -- --port 0
curl --fail --silent --show-error --output /dev/null \
  --write-out 'GET / status=%{http_code} type=%{content_type} bytes=%{size_download}\n' \
  http://127.0.0.1:52894/
curl --fail --silent --show-error --output /dev/null \
  --write-out 'GET /content/learning-pack.json status=%{http_code} type=%{content_type} bytes=%{size_download}\n' \
  http://127.0.0.1:52894/content/learning-pack.json
curl --fail --silent --show-error --output /dev/null \
  --write-out 'GET /content/question-groups.json status=%{http_code} type=%{content_type} bytes=%{size_download}\n' \
  http://127.0.0.1:52894/content/question-groups.json
curl --fail --silent --show-error http://127.0.0.1:52894/ | shasum -a 256
curl --fail --silent --show-error \
  http://127.0.0.1:52894/content/learning-pack.json | shasum -a 256
curl --fail --silent --show-error \
  http://127.0.0.1:52894/content/question-groups.json | shasum -a 256
```

The preview ran in tool session `17539`. It was stopped with the exact
non-shell action
`functions.write_stdin({session_id: 17539, chars: "\u0003"})`, followed by:

```text
curl --silent --show-error --max-time 1 \
  http://127.0.0.1:52894/ >/dev/null
probe_exit=$?
printf 'POST_STOP_CURL_EXIT=%s\n' "$probe_exit"
find dist -type f -print0 | sort -z | \
  xargs -0 shasum -a 256 | shasum -a 256
rg -n 'javascript-array-methods|Array method|array method|Latent Project Contributors' \
  content || true
git -C /tmp/latent-css-pass.7xjuTU/source status --short
du -sh /tmp/latent-css-pass.7xjuTU/source/node_modules
du -sh /tmp/latent-css-pass.7xjuTU
rm -rf /tmp/latent-css-pass.7xjuTU/source/node_modules
du -sh /tmp/latent-css-pass.7xjuTU
df -h /System/Volumes/Data
date -u '+PASS_END_UTC=%Y-%m-%dT%H:%M:%SZ'
date '+PASS_END_LOCAL=%Y-%m-%dT%H:%M:%S%z'
node -e 'const start=Date.parse("2026-07-25T21:31:23Z"); const end=Date.now(); console.log(`ELAPSED_SECONDS=${Math.floor((end-start)/1000)}`)'
```

## Results

- Creation: Pass; the generator emitted a validated project with all four
  primitives.
- Validation: Pass; 1 lesson, 1 deck, 6 cards, 1 Question Group, 1 practice
  question, and 1 IDE exercise.
- Static build: Pass; both builds and the preview-triggered build produced
  digest
  `b368ea7352201c93f3df312983b34ff97d184abd21ae98b7ed91e75e3191c624`.
- Lesson: Replaced with “Follow the layout algorithm.”
- Flash-card deck: Replaced with six CSS layout retrieval cards.
- Question Group: Replaced with `recommendNextCheck(report)` and four data-only
  cases.
- Browser IDE exercise: Present; the generated trusted exercise remained
  unchanged.
- Preview: Pass; the homepage and both portable JSON assets returned HTTP 200,
  and response digests matched the built files. After Control-C, curl exit 7
  confirmed that the server was no longer listening.

## Problems and fixes

- A separate earlier harness attempt at
  `/tmp/latent-css-conformance.ltOs5f` failed `npm ci` with `ENOSPC` during
  concurrent installs and then waited for coordination. That environment
  failure was excluded rather than hiding or resetting its elapsed clock.
  The failed command and cleanup were:

  ```text
  npm ci
  df -h /tmp /Users/charlie /Users/charlie/Documents /Users/charlie/dev
  du -sh /tmp/latent-css-conformance.ltOs5f 2>/dev/null
  rm -rf /tmp/latent-css-conformance.ltOs5f/source/node_modules
  df -h /System/Volumes/Data
  ```

- The reported pass started from a second, genuinely empty directory after
  installs were serialized and completed continuously in 2m 38s.
- The environment commands were recorded on the same uninterrupted host about
  fourteen minutes before the passing clock; they were not rerun inside that
  clock. Start and end timestamps have whole-second precision.
- `npm ci` reported 4 moderate and 12 high dependency entries. No dependency
  rewrite was made during an immutable-tag trial.

## Verdict

**Pass — exact tagged-release agent evidence.**

No human developer performed or attested to this run.
