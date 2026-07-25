# Security exceptions

Latent's normal release policy is to ship with no known production dependency
vulnerabilities. A release may proceed with a narrow, time-bounded exception
only when no compatible upstream fix exists, the reachable product surface has
been reviewed, and the exception is visible here.

## GHSA-f88m-g3jw-g9cj — Sharp / libvips

| Field | Value |
| --- | --- |
| Status | Open, accepted temporarily |
| Severity | High |
| Introduced through | `next@16.2.11` and `@huggingface/transformers@3.8.1` → `sharp@0.34.5` |
| Fixed version | `sharp>=0.35.0` |
| Compatible upstream fix | None as of 2026-07-25 |
| Owner | Latent maintainers |
| Review by | 2026-08-31, or immediately when either upstream permits `sharp>=0.35.0` |

The advisory covers malformed image input processed by libvips. The current
Latent application does not import `next/image`, call Sharp directly, or accept
community-supplied images for server-side transformation. Its Transformers.js
path runs in a learner-triggered browser worker and the first-party experience
uses text models. These boundaries reduce the presently reachable surface, but
they do not remove the vulnerable package from the production tree.

Required controls while this exception is open:

- do not add server-side image uploads or transformations;
- do not pass untrusted image bytes to the Transformers.js preprocessing path;
- run `npm audit --omit=dev` on every release;
- review Next.js and Transformers.js releases for a compatible Sharp update;
- close this exception, update the lockfile, and rerun the full release gates as
  soon as the fixed dependency line is available.

On 2026-07-25, `npm audit --omit=dev` reported three high findings representing
this one transitive advisory (`sharp` and its two direct dependents). Course Kit
has no reported production dependency vulnerability and does not depend on
Sharp.
