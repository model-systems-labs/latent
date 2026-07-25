# Latent conformance report: Query Trail SQL Lab

- Participant type: `agent`
- Participant or run identifier: `tagged-agent-query-trail-20260725T211755Z`
- Operating system: macOS 26.2 build 25C56, arm64
- Node/npm: `v26.0.0` / `11.12.1`
- Started: `2026-07-25T21:17:55Z`
- Finished: `2026-07-25T21:27:55Z`
- Elapsed: `600 seconds` (`10m 00s`)
- Public tag: `course-kit-v0.2.0`
- Tag object: `955b273b181dcaa86ee774691f8f9be75a1840f0`
- Public commit: `57d5b7ca00e36411841d1aeaff32085afead5c7c`
- Generated platform title: Query Trail SQL Lab
- Generated topic: tracing rows through SQL filters, grouping, and aggregation
- Preview URL: `http://127.0.0.1:52348/` (temporary loopback URL)

The public repository URL was supplied as the starting pointer. The agent then
used only the tagged repository, its public documentation, and the generated
project. It did not inspect a maintainer checkout, reuse a prior generated
project, push, or deploy.

## Commands

```text
date -u +%Y-%m-%dT%H:%M:%SZ
date +%Y-%m-%dT%H:%M:%S%z
mktemp -d /tmp/latent-v0.2.0-sql-conformance.XXXXXX
sw_vers
uname -m
node --version
npm --version
git --version
git clone --branch course-kit-v0.2.0 --depth 1 \
  https://github.com/model-systems-labs/latent.git repo
cd repo
git rev-parse HEAD
git describe --tags --exact-match
git status --short
npm ci
# The concurrent install failed with ENOSPC.
df -h /tmp /Users/charlie
du -sh /tmp/latent-v0.2.0-sql-conformance.vCRem2 \
  /tmp/latent-v0.2.0-sql-conformance.vCRem2/repo/node_modules 2>/dev/null
ls -la /Volumes
rm -rf /tmp/latent-v0.2.0-sql-conformance.vCRem2/repo/node_modules
df -h /tmp
git status --short
# After installs were serialized:
df -h /tmp
npm ci
npm run create:platform -- ../query-trail-sql-lab \
  --title "Query Trail SQL Lab" \
  --tagline "Trace rows through filters, joins, grouping, and aggregation." \
  --accent "#14b8a6"
rm -rf /tmp/latent-v0.2.0-sql-conformance.vCRem2/repo/node_modules
df -h /tmp
cd ../query-trail-sql-lab
sed -n '1,240p' AGENTS.md
sed -n '1,320p' GUIDE.md
# Three functions.apply_patch actions updated content/learning-pack.json.
# Their complete payloads survive in the run transcript; no separate patch
# file or shell command log was written.
npm run validate

digest_sql_dist() {
  node -e 'const crypto=require("node:crypto"); const fs=require("node:fs"); const path=require("node:path"); const root="dist"; const files=[]; const walk=(dir)=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name); if(entry.isDirectory()) walk(full); else if(entry.isFile()) files.push(path.relative(root,full).split(path.sep).join("/"));}}; walk(root); files.sort(); const hash=crypto.createHash("sha256"); for(const file of files){hash.update(file); hash.update("\0"); hash.update(fs.readFileSync(path.join(root,file))); hash.update("\0");} process.stdout.write(hash.digest("hex"));'
}
npm run build
sql_build_digest_one="$(digest_sql_dist)"
echo "BUILD_DIGEST_1=$sql_build_digest_one"
npm run build
sql_build_digest_two="$(digest_sql_dist)"
echo "BUILD_DIGEST_2=$sql_build_digest_two"
test "$sql_build_digest_one" = "$sql_build_digest_two"
echo "BUILD_DIGEST_MATCH=true"

npm run preview -- --port 0
curl --fail --silent --show-error --output /dev/null \
  --write-out 'HOME url=%{url_effective} status=%{http_code} type=%{content_type} bytes=%{size_download}\n' \
  http://127.0.0.1:52348/
curl --fail --silent --show-error --output /dev/null \
  --write-out 'LEARNING_PACK url=%{url_effective} status=%{http_code} type=%{content_type} bytes=%{size_download}\n' \
  http://127.0.0.1:52348/content/learning-pack.json
curl --fail --silent --show-error --output /dev/null \
  --write-out 'QUESTION_GROUPS url=%{url_effective} status=%{http_code} type=%{content_type} bytes=%{size_download}\n' \
  http://127.0.0.1:52348/content/question-groups.json
```

The preview ran in tool session `65242`. It was stopped with the exact
non-shell action
`functions.write_stdin({session_id: 65242, chars: "\u0003"})`, followed by:

```text
if curl --silent --fail --max-time 2 http://127.0.0.1:52348/ >/dev/null; then
  echo "PREVIEW_STOPPED=false"
  exit 1
else
  echo "PREVIEW_STOPPED=true"
fi
date -u +%Y-%m-%dT%H:%M:%SZ
date +%Y-%m-%dT%H:%M:%S%z
node -e 'const start=Date.parse("2026-07-25T21:17:55Z"); const end=Date.now(); const seconds=Math.floor((end-start)/1000); console.log(`OVERALL_ELAPSED_SECONDS=${seconds}`); console.log(`OVERALL_ELAPSED=${Math.floor(seconds/60)}m${seconds%60}s`);'
```

## Results

- Creation: Pass; the generator emitted a validated project with all four
  primitives.
- Validation: Pass; 1 lesson, 1 deck, 6 cards, 1 Question Group, 1 practice
  question, and 1 IDE exercise.
- Static build: Pass; two complete `dist/` trees produced the same digest,
  `0dd77fb6feef004ba6793995492b268ce64b02c810c2d7577f05a45c6da57668`.
- Lesson: Replaced with “Trace rows before predicting a query.”
- Flash-card deck: Retitled “Data-flow retrieval.” Two cards were replaced with
  `WHERE` and `HAVING`; four generated JavaScript data-flow cards remained.
- Question Group: Present and validated; the generated JavaScript exercise
  remained unchanged.
- Browser IDE exercise: Present; the generated trusted exercise remained
  unchanged.
- Preview: Pass; the homepage and both portable JSON assets returned HTTP 200.
  The preview stopped cleanly and a post-stop probe confirmed no listener.

## Problems and fixes

- Environment collision: the initial `npm ci` failed with `ENOSPC` while three
  clean-room installs ran concurrently. Removing only this trial's partial
  `node_modules` and serializing installs allowed the unchanged command to
  succeed. The full ten-minute clock includes that recovery.
- `npm ci` reported 4 moderate and 12 high dependency entries. No dependency
  rewrite was made during an immutable-tag trial.

## Verdict

**Pass — exact tagged-release agent evidence.**

No human developer performed or attested to this run.
