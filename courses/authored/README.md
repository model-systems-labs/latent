# Your portable courses

Use this folder as the in-repository workspace for Learning Packs that you
author and publish yourself. Keep each course in its own directory:

```text
courses/authored/
  my-course/
    learning-pack.json
    site/                 # generated static output
```

Course Kit validates `learning-pack.json` and generates the complete static
site. Publish that generated directory on an HTTPS host you control.

Latent does not automatically upload these files, add them to the bundled
Latent Courses catalog, or synchronize learner progress to a central account.
The source remains yours, the published URL remains yours, and progress remains
on the learner's device.

The complete released workflow is documented in
[`docs/open-learning.md`](../../docs/open-learning.md).
