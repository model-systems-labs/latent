# Visual and learning contract

Use this reference while designing or reviewing a trusted lesson interactive.
The interaction should feel native to the lesson while making the underlying
system easier to reason about.

## Learning shape

Build a short evidence loop:

1. Orient the learner with one question and one concrete starting state.
2. Let one control change a causally relevant input.
3. Show the resulting state transition, timing, identity, or resource change.
4. Invite a controlled comparison against an explicit invariant.
5. State what the observation supports and what it cannot establish.
6. Request completion only after the learner produces the named evidence.

Use real labels and internally consistent values across lesson prose, diagrams,
datasets, contracts, and the interactive. Prefer a worked trace over a generic
feature inventory. If the system has success, error, cancellation, retry,
cleanup, or late-event paths, expose the relevant paths rather than implying
the happy path is the whole model.

State is part of the lesson. Make time, identity, ownership, cleanup, and
replacement visible when they explain the behavior. Restore saved state before
controls become active, preserve the learner's last meaningful observation,
offer an explicit reset, and reject results that belong to an earlier run.

## Visual grammar

The host injects semantic learner tokens derived from Course Kit's Paper
palette and the lesson's reviewed accent. Use `--latent-canvas`,
`--latent-surface`, `--latent-surface-muted`, `--latent-ink`,
`--latent-muted`, `--latent-border`, the accent and outcome variants,
`--latent-focus`, and `--latent-lesson-accent` instead of copying raw colors:

| Role | Use |
| --- | --- |
| canvas and surface | Quiet editorial background and primary working plane |
| surface-muted | Secondary tracks, inactive regions, or code gutters |
| ink and muted | Primary explanation and supporting labels |
| border | Hairlines, axes, partitions, and group boundaries |
| accent, accent-strong, accent-soft | Selected state and the lesson's causal thread |
| success, warning, danger | Outcomes only; never decoration |
| focus | A high-contrast visible keyboard indicator |

Use the shared sans face for controls and compact labels, the reading serif for
short explanatory passages, and the mono face for code, identifiers, numbers,
and traces. Their variables are `--latent-font-sans`,
`--latent-font-reading`, and `--latent-font-mono`; spacing runs from
`--latent-space-1` through `--latent-space-8`. Start with small radii,
one-pixel hairlines, and restrained shadows. Keep reading copy near a 45 rem
measure; allow a visualization to use the wider content plane when the model
needs it.

Favor one flat, border-led surface with whitespace and clear partitions.
Nested cards weaken hierarchy. Do not reproduce the page header, lesson
navigation, atmosphere, or progress chrome inside the frame. Reuse
`.latent-stage`, `.latent-control-row`, `.latent-segments`, `.latent-metric`,
`.latent-status`, and `.latent-code` when they match the mechanism; custom
layout remains welcome.

At or below the compact breakpoint (760 px), stack panes, preserve document
order, avoid clipped controls, and make intentionally wide tables or traces
horizontally scrollable with a visible focus state. Keep interactive targets at
least 44 px tall or wide where practical, compact labels at least 11 px, body
copy comfortably readable, and focus outlines visibly distinct. Do not rely on
color alone.

Animation must explain a transition. Honor `prefers-reduced-motion`; remove
nonessential movement while preserving every state change. Keep forced-colors
and print output intelligible.

## Evidence and completion

Use a checkpoint that demonstrates the objective, such as completing a
comparison, correctly ordering a trace, reaching and explaining a terminal
state, or observing two controlled runs. Never complete on mount, first click,
elapsed time, or an unverified frame claim.

Send concise structured evidence that the host can validate. Treat the host's
acknowledgement as authoritative. Display whether evidence was accepted, and
keep assessment feedback distinct from ambient interaction telemetry. Add the
matching executable validator to the host registry; use saved state and
host-owned trusted-interaction transitions rather than `events.record`, whose
bounded records are visit-local diagnostics only.

## Review checklist

- The manipulated variable, invariant, observed result, and inference limit are
  explicit.
- Values agree with the lesson and all terminal paths behave coherently.
- Refresh restores a usable state; reset is complete; late work cannot corrupt
  the new run.
- Keyboard order follows the visual model; labels and live status are exposed
  to assistive technology.
- The interaction works at 390 px, 760 px, and its intended wide layout.
- Reduced motion, high contrast, failure feedback, and empty states remain
  understandable.
- Automated checks and manual browser observations are reported separately.
