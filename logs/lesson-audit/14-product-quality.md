# Lesson 14 — Product Quality

## Naive learner review

The original lesson named good product concerns but did not connect them into one observable request. Its diagram was the generic sequence `Persist → Operate → Announce → Recover`, and its experiment claimed a 16-check desktop/mobile audit while rendering only six pure checks. A new learner could not distinguish what the browser had actually proved from what still required a keyboard, screen reader, or phone.

The revised lesson follows one send through the complete product boundary:

- Enter creates a queued request; loading, prefill, streaming, complete, cancelled, and error are exact lifecycle phases.
- The visible label and programmatic status expose the same phase rather than inferring vague loading copy.
- Parsed token events are rendered and announced in bounded semantic batches, not one live-region mutation per token.
- Cancellation and retry reject late events, release transport and render resources, preserve honest terminal state, and return focus to the composer.
- Reload admits only one exact versioned record containing bounded terminal messages. It never resurrects streaming state.

The copy now states the automation boundary directly. Pure contract checks verify mappings, guards, serialization, bounds, lifecycle rules, accessibility metadata, and responsive requirements. They do not prove actual focus order, screen-reader speech, touch ergonomics, or viewport layout.

## Practice and wrong-answer debugging

`validConversationRecord` now implements the same canonical v1 storage boundary used by the capstone template and preview host. It accepts exactly `version`, `id`, and `messages` at the top level. One record has a non-empty id of at most 128 characters and at most 200 messages. Every message is a plain object containing exactly:

- required `id`, `role`, `backend`, `content`, and terminal `status`;
- optional `attemptId` and `parentUserId` with the same non-empty bounded identity rule;
- role `user` or `assistant`;
- backend `student` or `local`;
- status `complete`, `cancelled`, or `error`;
- at most 20,000 characters per message and 200,000 across the record.

Eleven host-owned cases accept a complete safe record and reject nested secret fields, top-level extras, streaming messages, unsupported domain values, blank ids, invalid optional ids, oversized content, more than 200 messages, an oversized total payload, and non-record input. The old shallow `version / id / messages / no top-level apiKey` implementation now fails first on the nested secret case with an exact-field direction.

`generationStatusLabel` now has eight host-owned cases. It must map queued, loading, prefill, streaming, complete, cancelled, and error to exact honest labels. Unknown phases return `Status unavailable`; they are never described as `Ready`. The contract suite is now `llm-systems-contracts-v14`, so earlier shallow verification does not carry forward.

## Capstone compatibility

The canonical Browser Chat now serializes only the exact safe fields and strips the reducer-only `createdAt` field before validation. Restoration reintroduces deterministic `createdAt: 0` values for the UI. Streaming messages remain excluded.

The preview host validates the same payload, record, identity, message-count, content-size, role, backend, terminal-status, and optional ancestry boundaries before writing to the LMS-owned conversation repository. Unknown nested fields such as `apiKey`, `providerKey`, or any future caller-only field fail closed.

The canonical UI now exposes phase text through an atomic polite status region and returns focus to the composer after cancellation or a terminal generation phase.

## UX and worked diagram

The diagram is now a flat end-to-end trace rather than four generic boxes. It shows Send, Wait, Generate, Recover, and Reload, followed by parallel visual and programmatic state surfaces, exact cancellation cleanup, the v1 safe record, and the explicit `16 automated / 3 manual groups` verification boundary. At narrow widths each stage and evidence row collapses to one readable column.

The experiment now renders all 16 deterministic checks in four visible groups of four:

1. Input and focus
2. Persistence and context
3. Lifecycle and recovery
4. Accessibility and responsive contract

Every check includes its own concrete evidence. A separate manual section lists keyboard/focus testing, VoiceOver or NVDA testing, and 320/390 px mobile and touch testing. The interface explicitly says these checks are not automated and that a 16/16 contract result does not pass them.

## Validation

- TypeScript typecheck: passed
- ESLint: passed without warnings
- Focused product-quality, curriculum, typed-contract, canonical template, and rendered-HTML suite: 53 passed
- Production build: passed
- Full workspace package suite: 18 passed
- Full application suite: 104 passed
- Diff whitespace check: passed

Delegated agents cannot access the shared in-app browser backend. Parent Playwright verification is pending for desktop/mobile diagram readability, staged wrong-answer feedback, both authored references, all 16 live check rows, and the three manual verification groups.

## Parent Playwright verification

- The live summary followed one send through queued, loading, prefill, streaming, recovery, and safe reload, with separate visual/programmatic state, explicit cleanup, exact v1 persistence bounds, and a clear `16 automated / 3 manual groups` boundary.
- The old shallow storage validator now failed on a nested `providerKey` and directed the learner to enforce exact message keys. A phase map without `complete` failed with terminal-phase guidance; after adding `complete`, the false `Ready` fallback failed with explicit unknown-state guidance.
- The authored storage validator passed all 11 host-owned cases and the authored phase map passed all 8.
- The live audit reported 16/16 with four visible 4/4 groups: input and focus, persistence and context, lifecycle and recovery, and accessibility and responsive contract. All 16 named rows included check-specific evidence.
- The manual boundary was visible and explicitly marked `not automated`; it listed real keyboard/focus, VoiceOver or NVDA, and 320/390 px mobile/touch verification without treating the automated contract result as a substitute.
