# Course Kit

Course Kit owns the framework-neutral lesson types, curriculum manifest schema,
and strict curriculum compiler used by the Latent LMS. It has no React,
persistence, learner-sandbox, or course-content dependencies.

The website supplies authored lessons and a manifest. `deriveCurriculum`
validates complete coverage, stable virtual-project paths, module ordering, and
test counts before routes or learner progress consume the curriculum.
