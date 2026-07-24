# Latent roadmap

Latent's floor is an open, model-neutral framework that lets people create,
inspect, export, and host their own lessons or flash cards. A managed platform
can make those jobs easier, but it must not become a gate around the format or a
learner's content.

This roadmap expresses direction, not a delivery promise.

## Product principles

- **Local first:** authoring and validation work without an account.
- **Host anywhere:** a static host and a URL are enough to publish.
- **Export always:** hosted projects remain downloadable as standard Learning
  Packs and static sites.
- **Model neutral:** people and arbitrary LLMs use the same documented
  contracts.
- **Declarative community content:** remote packs do not gain executable
  privileges.
- **Optional center:** discovery, identity, review, and certification may be
  centralized services; reading and self-hosting may not.

## Foundation: v0.1

- Publish Course Kit, the schemas, CLI, reader, browser studio, and LLM
  workflows as open source.
- Make the repository, package provenance, contribution process, and security
  policy independently inspectable.
- Prove that unrelated people and LLMs can build valid lesson-only,
  flash-card-only, and combined packs.
- Keep the first-party browser courses as demanding real-world consumers of
  the framework.

## Interoperability

- Add Anki import and export for flash cards.
- Add 1EdTech QTI assessment adapters.
- Explore Common Cartridge and safe H5P import for content representable by
  the declarative format.
- Add xAPI or cmi5 event export without requiring a central analytics service.
- Add accessible publisher-managed media with integrity metadata and explicit
  rights.

## Optional managed platform

The initial hosted product should target an approximately $10/month creator
tier and provide operational convenience:

- browser project storage and version history;
- one-click static publishing and rollback;
- a Latent subdomain with optional custom domains;
- media storage and delivery;
- basic privacy-respecting learner analytics;
- an optional public directory entry; and
- capped hosted AI assistance or bring-your-own model credentials.

The hosted service must consume the same public Course Kit and produce the same
exportable artifacts as local tools. Deleting an account must not invalidate a
previously exported static course.

## Teams and trust

Later organization plans may add:

- private registries and access controls;
- team review and approval workflows;
- verified publisher identities;
- signed attestations for exact immutable versions;
- SSO, audit history, and retention controls; and
- independent editorial review or certification against a published rubric.

Integrity, identity, editorial review, and platform certification will remain
separate claims.

## Explicit non-goals

- Requiring a Latent account to create, read, or self-host a Learning Pack.
- Locking a course into a private format.
- Executing arbitrary remote plugins inside the learner application.
- Making one model provider mandatory.
- Treating automatic validation as proof of accuracy or teaching quality.

## Where contributions help most

Near-term community work is especially useful in interoperability fixtures,
accessibility, adversarial format tests, package examples from independent
publishers, and documentation tested by someone who did not build the system.
