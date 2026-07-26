# Bundled reference curriculum

This folder contains the reviewed course source compiled into the Latent
Courses product. It is the bundled reference library, not a storage location
for courses published through Open Learning.

- `content/` owns curriculum manifests, learning outcomes, flash cards,
  programming-practice data, project templates, and host-owned exercise
  contracts.
- `lessons/` owns the bundled lesson definitions and catalog composition.

These files are trusted repository source because the reference courses include
browser IDE integrations and executable behavioral checks. Changes pass normal
source review and repository validation before deployment.

Portable courses that a publisher owns belong in `courses/authored/` (or any
publisher-controlled working directory), use the public Learning Pack format,
and are hosted independently. They are never activated as trusted source merely
because their files or URLs are available.

This directory is an intended extraction boundary for a future standalone
Latent Courses repository. Today it still depends on shared application
components, persistence, and reviewed browser runtimes elsewhere in this
repository.
