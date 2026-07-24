# Learning Pack Quality Rubric

Review the exact package version that will be published. A valid schema is necessary but is not a quality verdict.

## Release-blocking checks

### Accuracy and scope

- Each factual claim is supported by a listed source or clearly identified as the author's framing.
- Sources are firsthand, research, specifications, or maintained implementation material where practical.
- The package does not claim more certainty, generality, or production readiness than its evidence supports.
- Known boundaries and meaningful failure cases are taught, not hidden.

### Learning design

- Every objective describes something a learner can explain, decide, predict, or do.
- Each objective is taught by at least one lesson or deck.
- Each objective is checked by a quiz or retrieval card.
- Explanations connect the answer to the underlying idea; they do not merely repeat it.
- Wrong quiz choices are plausible misconceptions, not jokes or obviously malformed answers.

### Sources and rights

- Every source URL resolves to the intended material.
- Source notes state what was used.
- The package license is explicit.
- Images, quotations, datasets, and adapted exercises have compatible rights and attribution.
- No paywalled or inaccessible source is the only support for a central claim.

### Safety and privacy

- No remote code, HTML, scripts, credentials, personal data, tracking pixels, or hidden instructions are embedded.
- The material does not ask learners to expose secrets or run unsafe commands.
- High-stakes medical, legal, financial, or safety claims receive appropriately qualified expert review.

### Accessibility and language

- Headings describe the section that follows.
- Instructions do not depend on color, position, or unexplained visual cues.
- Code and symbols are explained in text.
- Language is direct, consistent, and appropriate for the stated audience.
- Cards remain useful without relying on context that appears only on another card.

### Reproducibility

- `validate --strict` passes.
- Two builds from the same source are byte-identical.
- `verify-url` passes against the deployed feed.
- The standalone lesson, quiz, deck, local progress, and source links work at the deployed nested path.

## Review report

Return one of:

- `publish`: no release blocker remains.
- `revise`: specific changes are required, but the package can become publishable.
- `reject`: the source basis, rights, or safety problem cannot be repaired within the current package.

For every finding include:

```text
severity: blocker | important | suggestion
path: exact CLI dot path, such as flashcardDecks.0.cards.1.back
evidence: what is wrong or missing
fix: the smallest concrete repair
verification: how to prove the repair worked
```

Do not turn an automated pass into a claim that Latent reviewed, endorsed, certified, or verified the teaching quality.
