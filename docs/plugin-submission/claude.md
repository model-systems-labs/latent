# Claude community plugin submission: Neural Chalk

This document is the source sheet for the Claude plugin submission form. It
does not claim acceptance or marketplace publication.

## Listing

- **Name:** neural-chalk
- **Display name:** Neural Chalk
- **Version:** 1.0.0
- **Category:** Education
- **Repository:** https://github.com/model-systems-labs/latent
- **Plugin path:** `plugins/neural-chalk`
- **Marketplace path:** `.claude-plugin/marketplace.json`
- **Homepage:** https://model-systems-labs.github.io/latent/
- **Support:** https://github.com/model-systems-labs/latent/issues
- **Privacy:** https://model-systems-labs.github.io/latent/open-learning/plugin/privacy.html
- **Terms:** https://model-systems-labs.github.io/latent/open-learning/plugin/terms.html
- **License:** Apache-2.0

## Description

Turn bounded codebases, papers, documentation, or notes into source-grounded,
validated learning material. Neural Chalk includes skills for learning from
sources, authoring portable lessons and flash cards, creating declarative
programming practice, independently reviewing a pack, and publishing a
deterministic static site. It has no hooks, agents, MCP servers, LSP servers,
authentication, telemetry, or hosted model.

## Installation

```text
claude plugin marketplace add model-systems-labs/latent --sparse .claude-plugin plugins/neural-chalk
claude plugin install neural-chalk@neural-chalk
```

Example invocation:

```text
/neural-chalk:learn-from-sources Turn these sources into a 45-minute course for an experienced backend engineer.
```

## Validation evidence

- `claude plugin validate plugins/neural-chalk --strict`
- `claude plugin validate . --strict`
- Installation from a clean isolated `CLAUDE_CONFIG_DIR`
- `npm run plugin:check`

The same five positive and three negative acceptance cases in `openai.md` apply
to the Claude package because both hosts install the same skill bytes and
reference bundle.

## Security and trust statement

The plugin is a self-contained skills directory. It cannot execute merely by
being present: Claude Code applies its ordinary tool permissions to file,
shell, network, and deployment actions. Portable Learning Packs and Question
Groups remain declarative data and cannot select remote scripts, packages,
workers, components, model calls, or executable authored tests.
