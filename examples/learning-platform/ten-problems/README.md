# Ten Problems

Ten original Python interview-practice problems in one focused workspace.
Choose a problem, read the contract, write code, run the example, and check the
full visible case set. Use **Practice** for the problem path, **Review** for
repeated misses, and **Continue** to resume the next unsolved problem. Progress
stays on the learner's device. The problem list, prompt, editor, actions, and
results follow one centered vertical document instead of separate full-height
panes.

Every problem also has a closed, read-only **View example solution**
disclosure. The reviewed source is a trusted build input and is rendered as
text; it is absent from portable Question Group JSON and does not replace the
draft, run code, or update progress.

```bash
npm run validate
npm run preview
```

The practice content is one portable Question Group library. A reviewed host
adapter runs submitted Python in a fresh browser worker using the same-origin,
version-pinned Pyodide runtime shipped by the build; learner source is never
sent to a server.

Ten Problems uses the same reviewed learner UI foundation as
[Interview Loop Lab](../interview-loop/): shared typography, page shell,
navigation, controls, editor framing, feedback, progress, focus treatment, and
mobile behavior. `packages/course-kit/src/learner-ui.ts` is the source of
truth, `packages/course-kit/src/question-group-site.ts` composes the
coding-practice layout, and `site-config.mjs` explicitly supplies this
product's persistent suite-header contract, local labels, review route,
`cobalt` appearance palette, footer, and favicon at build time. The other
reviewed palette choices are `paper`, `sage`, `plum`, and `graphite`; Cobalt
supplies a distinct cool color atmosphere and a subtle highlight that travels
with each existing scroll-reactive line. Palette selection does not replace
the shared line geometry, layout, typography, controls, or responsive
behavior.
`security-config.mjs` supplies the custom document meta CSP passed to the
builder and the full static-host page/Python-worker header policies for both
standalone and `/practice/` hosting. Supporting hosts may apply `_headers` for
worker isolation and anti-framing as defense in depth; anti-framing depends on
those response headers. The combined local preview mirrors the Python-worker
response CSP during QA. GitHub Pages does not honor `_headers`; the document
meta CSP remains active there and restricts script sources, same-origin
workers/connections, styles, and other assets. The build does not patch
generated HTML, JavaScript, or CSS and does not load a hosted stylesheet,
framework CDN, JavaScript service, or model API.

The page has one persistent learner header: **Learning Studio** identity and
the three sibling experiences. Ten Problems' **Practice** and **Review** links
sit immediately below it in the shared context row, never in another header.
On mobile, the global destinations move into **Experiences** while the local
row stays horizontally available and the problem list remains a specialized
practice control. The current learner UI v2 revision has local
production-build, desktop, mobile, keyboard, Python execution, and persistence
evidence recorded in [AUTHORING.md](./AUTHORING.md). Live evidence is recorded
there only after a deployment has been verified.

Learning Studio is a build-time directory for three independent experiences,
not an account or enrollment dashboard. Each artifact owns its own
exact-content-bound, device-local progress.

Read [GUIDE.md](./GUIDE.md) for the problem map, shared/specialized source
boundaries, and local/Pages routes. Read [AGENTS.md](./AGENTS.md) before asking
a coding agent to change the set. The original problem content is CC-BY-4.0;
see [CONTENT_LICENSE.md](./CONTENT_LICENSE.md).
