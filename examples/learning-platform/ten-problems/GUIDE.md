# Ten Problems

This example is a learner artifact, not a platform tour. It contains one
portable Question Group library with 10 original Python problems and 39
public, data-only cases.

## Problem path

1. First Echo — set lookup
2. Tunnel Gates — stack matching
3. Quietest Window — fixed sliding window
4. Longest Unique Span — variable sliding window
5. Reverse a Linked Chain — nested `{"value": ..., "next": ...}` dictionaries
6. Condense Calendar Windows — sorting and interval merging
7. Disease Spread Clock — multi-source grid breadth-first search
8. Fewest Relay Hops — graph breadth-first search
9. Minimum Climb Energy — dynamic programming
10. Workday Capacity — binary search with greedy feasibility

Every prompt, title, and synthetic case was written for this repository. The
set uses generic algorithms and data structures without copying proprietary
question wording, examples, or hidden tests.

## Run this site alone

From this directory:

```bash
npm run validate
npm run preview
```

The preview listens on `http://127.0.0.1:4174/`. The build uses Course Kit's
reviewed static Question Group player, then adds a reviewed example-local
Python adapter and presentation changes. The first run loads the pinned
interpreter from this site's own static assets; later runs use the browser
cache.

Each submission gets a fresh, bounded Python browser worker. Cases are
declarative and public, while the executable adapter and checks remain trusted
source. Python Lab has capability guardrails but is not a hostile-code security
sandbox. The site saves exact-library progress in IndexedDB and offers a
**Review misses** view after repeated unsuccessful checks.

## Run both learning examples together

From the repository root:

```bash
npm run learning-examples:preview
```

This assembles the same route layout used by GitHub Pages:

- `/` and `/interview-loop/` — Interview Loop Lab
- `/practice/` — Ten Problems
- `/practice/leeches/` — repeated-miss review

GitHub provides one Pages deployment per repository. These are two independent
learner experiences served from separate routes in that deployment.
