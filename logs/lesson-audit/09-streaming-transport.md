# Lesson 09 — Streaming Transport

## Naive learner review

The original summary named the right systems concepts, but it left the most important boundary implicit: network streams yield bytes, while the practice parser accepted strings. A new learner could reasonably conclude that `parseSseChunk` decoded UTF-8 itself. The summary now follows one concrete path from `Uint8Array` chunks through `TextDecoder.decode(..., { stream: true })`, decoded-text carry, blank-line framing, typed events, and the reducer.

The supported practice subset is now explicit:

- parser input is decoded text, not raw bytes;
- LF and CRLF line endings;
- one optional space after a field colon;
- default `message` event when `event:` is absent;
- all complete frames emitted in order and one incomplete suffix retained;
- JSON payloads in `data:` lines;
- encoder rejection of CR/LF in event names.

Cancellation remains an adapter lifecycle contract, while render buffering remains a presentation policy. The lesson no longer blends either concern into byte parsing.

## Practice and debugging

The encoder contract expanded from one exact example to four staged cases. It now gives a specific first direction for a missing `event:` field, manual rather than JSON payload serialization, a missing final blank line, a hard-coded event type, payload escaping, and newline-injected event names.

The parser contract expanded from two cases to six. It verifies incomplete carry, a carried JSON boundary, a delimiter split between chunks, multiple frames plus a partial remainder, default events with space-optional fields, and CRLF framing.

Focused tests exercise plausible wrong answers before accepting the authored references:

- encoder missing the final blank line;
- encoder concatenating an object payload manually;
- encoder hard-coding `token`;
- parser ignoring the prior remainder;
- parser emitting only the first complete frame;
- parser supporting only LF plus exact `field: value` spacing.

The feedback formatter remains intentionally staged: it reports the first actionable host-owned failure and acknowledges additional failing cases without dumping the whole solution.

## UX and diagram

The former Generator → Encoder → Parser → Reducer inventory is now a worked example. It shows a UTF-8 euro character split as `e2 82 | ac`, explains the streaming decoder's byte carry, traces decoded text into `parseSseChunk(textRemainder, decodedText)`, shows the event/data frame and typed event, and ends at reducer/render buffering. The treatment uses flat rules, typography, and restrained violet accents rather than nested cards.

The experiment now has two explicit policies:

- **Complete stream:** preserves the existing 17 chunks, 14 events, 10 token events, zero-byte remainder, terminal `done`, and resource release.
- **Cancel after 4 tokens:** stops after 8 of 17 chunks, 5 of 14 events, and 4 of 10 tokens; the trace proves adapter abort propagation, reader stop, parser remainder discard, generator stop, zero late events, and resource release.

The complete path also states that a render pause does not pause byte decoding or frame parsing; typed deltas collect in a render buffer and flush without reordering.

## Validation

- TypeScript typecheck: passed
- ESLint: passed
- Production build: passed
- Full package and application suite: 89 passed
- Focused curriculum, typed-contract, and rendered-HTML suite: 36 passed
- Diff whitespace check: passed

Delegated agents cannot access the shared in-app browser backend, so final live interaction and visual verification are left to the parent Playwright pass.

## Parent Playwright verification

- The live summary clearly showed the split UTF-8 byte sequence `e2 82 | ac`, the streaming `TextDecoder`, decoded-text frame buffer, typed event, reducer, and the explicit `parseSseChunk(textRemainder, decodedText)` practice boundary.
- The saved encoder missing its final blank line failed without changing the learner's source and directed the learner to terminate the frame with `\n\n`.
- The saved stateless parser failed at the carried-frame case and directed the learner to prepend the previous remainder.
- The authored encoder and parser passed 4 of 4 and 6 of 6 host-owned cases respectively.
- The complete-stream experiment reported 17 chunks, 14 events, 10 token events, a 0 B remainder, terminal `done`, and released resources.
- The cancel-after-four experiment reported 8 of 17 chunks, 5 of 14 events, 4 of 10 tokens, zero late events, and explicit reader, parser, and generator stop plus resource release.
