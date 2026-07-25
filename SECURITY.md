# Security policy

## Supported versions

Security fixes are applied to the default branch and the latest published
Course Kit release. Older commits and unpublished development branches are not
supported release lines.

| Version | Supported |
| --- | --- |
| `main` | Yes |
| Latest Course Kit release | Yes |
| Older releases | No |

## Report a vulnerability privately

Do not open a public issue for a suspected vulnerability.

Use GitHub's private vulnerability-reporting form:

https://github.com/model-systems-labs/latent/security/advisories/new

Include:

- the affected commit, release, route, package, or Learning Pack;
- a minimal reproduction or proof of concept;
- the security impact and required preconditions;
- whether the issue has been disclosed anywhere else; and
- a safe way to contact you for follow-up.

Reports involving credential exposure should identify the credential's owner
and location without placing the secret itself in an issue, screenshot, or
sample pack.

Maintainers aim to acknowledge a complete report within three business days and
provide an initial assessment within seven business days. Complex fixes may
take longer. We will coordinate disclosure and credit with the reporter when
practical.

## Security boundaries worth reporting

Examples include:

- community content escaping text-only rendering or executing active content;
- feed, canonicalization, byte-limit, origin, redirect, or SHA-256 verification
  bypasses;
- path traversal, symlink following, or unsafe replacement in CLI build and
  serve commands;
- cross-publisher saved-state or progress collisions;
- learner-code or model-worker escapes into the application realm;
- unauthorized access to private learning data, source, conversations, or
  credentials; and
- dependency or build-chain compromise with a concrete effect on Latent.

Format-valid but inaccurate course content, ordinary broken links, feature
requests, and quality disagreements are not security vulnerabilities. Report
those through the normal issue tracker.

## Portable-content threat model

Learning Packs are untrusted declarative data. They must not execute authored
JavaScript, HTML, CSS, MDX, React, Python, workers, iframes, packages, or tests.
Built-in Latent courses have separate privileged browser runtimes and do not
grant those capabilities to a hosted community pack. See
[docs/open-learning.md](./docs/open-learning.md) for the full integrity and
runtime contract.

Question Group libraries are also untrusted declarative data even though they
contain learner starter source, entrypoint metadata, cases, and assertions.
Hosting a library does not grant it execution privileges in an unrelated
Latent deployment. The central/reference deployment executes only its reviewed,
bundled library through an application-owned adapter and host-owned behavioral
contracts. A publisher may explicitly validate and package its own library
with the v0.2 self-hosted practice player; that deliberate build creates a new
host boundary, rather than remotely activating content inside the reference
deployment. See
[docs/question-groups.md](./docs/question-groups.md).

JavaScript and TypeScript learner source runs outside the page realm in
QuickJS with bounded host capabilities. Python learner source runs in a
dedicated Pyodide worker with layered guardrails, but Python Lab is not a
hostile-code security sandbox. Arbitrary hosted Python practice must not be
routed into it.

## Trusted platform extensions

IDE integrations, executable checks, runtime adapters, React UI, and
persistence changes are trusted repository source. Code written by a person or
agent becomes trusted only after review, validation, and compilation; it is
never activated because a remote document requests it.

The complete decision is
[ADR-0001: Portable content and trusted executable extensions](./docs/decisions/0001-portable-content-and-trusted-extensions.md).
