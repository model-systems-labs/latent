# Authoring record

## Request

> that doesn't seem to really be that useful - it seems more like half showing off the platforms feature. Make three Yeah It doesn't really seem that useful. It seems more like half an advertisement for a platform, but also an example of how it could work. A better example would not really be showing off the platform features at all. The platform should fade into the background of this, and it should more just be like, this is the, like a useful artifact that comes from the platform. So let's actually do this, and let's do another example of just kind of like a LeetCode alternative site. So just have like 10 basic practice problems. Stay clear of copyright things by doing things like linked lists or disease spread in a grid, and make it like a really great example of how this works. So have this example, have this other one hosted in GitHub Pages. And yeah, I think that kind of makes sense for this. Yeah, please do that, and let's get two different GitHub Pages working locally.

## Decisions

- Use only the portable Question Group primitive. Do not include a lesson,
  cards, an IDE showcase, feature navigation, or promotional platform copy.
- Build a progressive set of ten original JavaScript problems with 39 public,
  declarative cases. The path covers sets, stacks, sliding windows, nested
  linked nodes, intervals, grid and graph BFS, dynamic programming, and binary
  search.
- Represent a linked list directly as finite JSON `{ value, next }` data so the
  public portable contract needs no hidden adapter.
- Treat every `check` case as public. This is practice feedback, not a claim of
  secret certification.
- Use Course Kit's reviewed standalone Question Group player for execution,
  integrity-bound loading, atomic device progress, and repeated-miss review.
  Apply only example-local learner-facing labels and presentation changes at
  build time.
- Repair the trusted standalone-player adapter after browser QA showed that
  function entrypoints were receiving the reserved constructor-argument array
  instead of the authored case arguments. Cover the adapter shape with a
  Course Kit regression test; keep the portable library unchanged.
- Keep Interview Loop Lab at the existing Pages root, add a stable
  `/interview-loop/` alias, and publish Ten Problems at `/practice/`.
- Preserve the published schema directories and update both workflows capable
  of replacing the repository's single Pages artifact.

## Counts

- Question Groups: 4
- Problems: 10
- Public cases: 39
- Visible example cases: 10
- Additional check cases: 29
- Learning objectives: 5
- External runtime dependencies at learner time: 0

## Validation evidence

- Strict Question Group validation: 4 groups, 10 problems, 39 cases, zero
  errors, and zero warnings.
- Reference solutions: all 10 implementations pass every authored case.
- Course Kit standalone-player regression suite: 10 of 10 tests pass.
- Combined Pages build: 80 files with `/`, `/interview-loop/`, `/practice/`,
  and `/practice/leeches/`.
- Browser QA: the starter fails visibly; correct set and multi-source BFS
  solutions pass; two solved statuses survive reload; repeated-miss review
  renders; both Interview Loop routes render; and the 390 × 844 layout stacks
  all three practice panels with no horizontal overflow.

## Python revision request

> shouldn't tne problems be able to use python code that should be how it happens

## Python revision decisions

- Convert every learner-facing contract from JavaScript to idiomatic Python:
  `.py` paths, `snake_case` entrypoints, Python starter source, and Python terms
  such as `None`, lists, and dictionaries.
- Advance the immutable portable library from `1.0.0` to `2.0.0` because the
  execution contract changed while leaving all 39 public case vectors intact.
- Declare one exact `python` / `host-managed` / `pyodide@314.0.2` requirement.
  Portable JSON still cannot load an interpreter or executable tests.
- Add a reviewed example-local host adapter that reuses Latent's Python Lab
  worker and host-owned assertion evaluator. Each submission starts a fresh
  worker, initialization is separate from the declared 10-second learner-code
  limit, and timeout disposal is a hard stop.
- Self-host the five npm-locked Pyodide core payloads in the generated site.
  The learner's browser makes no third-party runtime request.
- Keep Interview Loop Lab at `/` and `/interview-loop/`, and keep Ten Problems
  at `/practice/`; this revision changes the practice language, not the route
  contract.

## Python revision counts

- Learner problems: 10 before, 10 after
- JavaScript learner contracts: 10 before, 0 after
- Python learner contracts: 0 before, 10 after
- Public cases: 39 before, 39 after
- Visible example cases: 10 before, 10 after
- Additional check cases: 29 before, 29 after
- Self-hosted interpreter core files: 0 before, 5 after
- Third-party runtime fetches while solving: 0 after

## Python revision evidence

- Strict Question Group validation: 4 groups, 10 questions, 39 cases, 10
  examples, 29 additional checks, zero errors, and zero warnings.
- Real Pyodide reference solutions: all 10 Python implementations pass all 39
  authored cases under the pinned runtime.
- Trusted runtime adapter tests: exact-profile support, example/check mapping,
  adapted-argument transport, failed assertions, and fail-closed incomplete
  results pass; 5 example tests pass in total.
- Example validation and build: `2.0.0` canonical library digest
  `cbf3e5b4c6ea04d734b30c2abc1526d59d83a8a6b5a08ba21d8691064bdad834`;
  20 generated files; no runtime warnings; five hashed same-origin Pyodide core
  payloads totaling 13,544,397 source bytes; and no bundled JavaScript runtime
  claim. The generated report records source and published hashes for the two
  module copies that receive an inert lint directive.
- Combined Pages build: 85 files with `/`, `/interview-loop/`, `/practice/`,
  and `/practice/leeches/`.
- Browser QA: the Python starter fails on its returned value; a syntax error
  reports the Python line; correct set and multi-source BFS implementations
  pass; a non-terminating function hard-stops at 10 seconds and the next worker
  passes; solved state survives reload; old-digest state does not restore;
  repeated misses appear at `/practice/leeches/`; the Interview Loop route
  still renders; and the 390 × 844 layout stacks all three panels at 390 pixels
  with no horizontal overflow. The browser console recorded no warnings or
  errors.
