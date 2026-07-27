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
