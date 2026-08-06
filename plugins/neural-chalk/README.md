# Neural Chalk plugin

Turn a bounded source collection into a source-grounded learning path, then
validate, review, build, and publish the result with the released Course Kit
CLI. The plugin operates at authoring and build time. It does not add a model,
remote code, or executable capability to learner content.

## Included skills

- `learn-from-sources`: turn a codebase, paper collection, documentation set,
  or notes into a coherent learning path.
- `author-learning-pack`: create declarative lessons, quizzes, and flash cards.
- `author-question-group`: create declarative programming-practice libraries.
- `review-learning-pack`: independently audit evidence, pedagogy, safety, and
  reproducibility.
- `publish-learning-pack`: deterministically build, deploy, and verify a pack.

## Install in Codex

```text
codex plugin marketplace add model-systems-labs/latent --sparse .agents/plugins plugins/neural-chalk
codex plugin add neural-chalk@neural-chalk
```

Start a new task, then invoke a workflow such as `$learn-from-sources` or
`$author-learning-pack`.

## Install in Claude Code

```text
claude plugin marketplace add model-systems-labs/latent --sparse .claude-plugin plugins/neural-chalk
claude plugin install neural-chalk@neural-chalk
```

Reload plugins, then invoke `/neural-chalk:learn-from-sources` or another
namespaced skill.

## Trust boundary

Portable Learning Packs and Question Groups remain bounded JSON data. The
plugin may edit files and run the published Course Kit CLI under the host
agent's normal sandbox and approval policy. Publishing changes external state
only after the user supplies or confirms the exact destination.

Review the plugin's [privacy notice](https://model-systems-labs.github.io/latent/open-learning/plugin/privacy.html),
[terms](https://model-systems-labs.github.io/latent/open-learning/plugin/terms.html),
and [source code](https://github.com/model-systems-labs/latent) before installing.
