# Licensing map

Latent separates the software license from the license for original teaching
material. This file defines that boundary. A more specific notice next to a
file or item takes precedence.

## Software: Apache License 2.0

Except where a local notice says otherwise, the repository's software is
licensed under the [Apache License 2.0](./LICENSE). This includes:

- application and package source code;
- command-line tools, schemas, tests, scripts, styles, configuration, and
  generated runtime assets;
- code examples intended to be copied, compiled, or executed as software;
- the structure and software implementation of lessons, exercises, checks,
  flash-card readers, and learning-pack tooling; and
- course-authored synthetic fixtures labeled `Not separately licensed` when
  they are distributed as part of this software.

`Not separately licensed` means that a fixture has no additional dataset
license such as CC0 or an Open Data Commons license. It does not change the
license of the source file that contains it, and the Creative Commons grant
below does not turn that fixture into a separately licensed dataset.

## Original educational material: CC BY 4.0

To the extent the contributors have the right to license it, Latent's original
educational material is also available under the
[Creative Commons Attribution 4.0 International license](./LICENSES/CC-BY-4.0.txt).
That grant covers the copyrightable teaching material authored for this
project, including:

- lesson explanations, instructional prompts, quiz wording, worked
  explanations, and flash-card text under
  `examples/learning-platform/llm-learning/lessons/` and
  `examples/learning-platform/llm-learning/content/`;
- original educational diagrams under `public/lesson-diagrams/`;
- original explanatory material in `docs/`, excluding JSON Schemas and other
  material that is primarily software or a technical interface; and
- original prose and teaching content in `examples/open-learning/`, subject to
  the explicit license declared by each Learning Pack.

Files can contain both software and teaching material. In a TypeScript lesson,
for example, executable code and data structures remain available under
Apache-2.0, while the original explanatory prose is additionally available
under CC BY 4.0. You may rely on the Apache-2.0 license for the entire software
work or use CC BY 4.0 when reusing the covered teaching material on its own.

For CC BY 4.0 attribution, a reasonable notice is:

> Adapted from Latent by the Latent contributors,
> https://github.com/model-systems-labs/latent, licensed CC BY 4.0. Changes
> were made.

Keep any more specific author, source, and modification notices supplied with
the material.

## Learning Packs published by other people

The framework license does not relicense a third-party Learning Pack. Each pack
declares its own license in `learning-pack.json`, and its publisher is
responsible for having the rights to its lessons, cards, media, quotations, and
data. Format validity is not a rights review or an endorsement by Latent.

## Material not relicensed here

The Apache-2.0 and CC BY 4.0 grants apply only to rights held by Latent
contributors. They do not relicense:

- cited papers, standards, books, websites, repositories, or other source
  material;
- third-party dependencies, models, fonts, datasets, or adapted material,
  which remain under their own licenses and notices;
- names, logos, trademarks, service marks, or trade dress, except for the
  limited uses allowed by the applicable license; or
- personal information, publicity rights, patent rights not granted by
  Apache-2.0, or any other right a contributor does not control.

See [CONTENT_PROVENANCE.md](./CONTENT_PROVENANCE.md) and the in-product
Further Reading page for the source and third-party-license record. This
licensing map is not legal advice.
