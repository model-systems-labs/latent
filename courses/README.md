# Course ownership in this repository

Latent keeps two kinds of course source deliberately separate:

| Folder | What it contains | Where it appears |
| --- | --- | --- |
| `products/courses/reference-curriculum/` | Latent's bundled, reviewed curriculum and executable exercise contracts | Compiled into the Latent Courses product |
| `courses/authored/` | Portable Learning Packs that you create and own | Published as independent static sites at URLs you control |

Putting a Learning Pack in `courses/authored/` does not add it to the bundled
Latent Courses catalog. It remains publisher-controlled declarative content
and goes through Course Kit validation and build. The generated static site can
then be hosted independently.

The three storage layers are intentionally separate:

1. **Authoring source** is a `learning-pack.json` file in this repository or
   another folder the publisher owns.
2. **Published course files** live on the publisher's chosen static HTTPS host.
3. **Learner progress** stays in each learner's browser and is not synchronized
   to a Latent account.

This layout makes the ownership boundary visible now while keeping the bundled
course product in the same repository until it is ready for an independent
release and repository.
