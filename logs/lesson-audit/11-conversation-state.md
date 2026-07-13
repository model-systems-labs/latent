# Lesson 11 — Conversation State

## Naive learner review

The original lesson named normalized state and identity correctly, but its diagram remained a generic Conversation → Message → Attempt → Request inventory. A new learner could not see the shape of normalized state, how those identities relate, or what an immutable token update actually preserves.

The revised explanation works one concrete state:

- conversation `c-17` owns ordered `messageIds: [m-u1, m-a1]`;
- `messagesById` stores one complete user record and one streaming assistant record;
- durable message `m-a1` is distinct from generation attempt `a-17.2` and transport request `r-17.2`;
- a `TOKEN_DELTA` is guarded by active request and streaming message status;
- the transition returns a new state and target record while preserving the untouched user record;
- `canStop: true` and `canRegenerate: false` derive from the resulting records.

The prose now defines `messageIds` versus `messagesById`, the three identity domains, structural sharing, the missing/non-streaming event guards, and derived controls. It does not claim schema validation that the authored `createMessage` reference does not perform.

## Practice and wrong-answer debugging

`createMessage` expanded from one case to four host-owned cases. They cover default content and status, supplied content and streaming status, an exact stable field set that excludes caller-only `renderIndex`, deterministic `createdAt`, serializability, and ids that are independent from render position. Focused regressions reject an implementation that always applies defaults and one that spreads caller-only fields into normalized state. The authored reference passes every case.

`appendMessageDelta` expanded from one shallow value check to four cases. They target a middle streaming record, reject a late delta for a completed record, ignore an unknown id, and handle an empty delta as ordinary concatenation. The staged labels direct the learner to stable id targeting, streaming status, or the no-match guard without revealing the whole solution.

The parent-found mutating implementation could previously pass because a serialized return value does not reveal object identity. Browser Lab now deep-freezes each host-owned invocation argument inside QuickJS immediately before learner code runs. The exact `find` → mutate target → return original array shortcut can no longer produce a passing value. A focused engine test proves nested learner input mutation is stopped.

Direct authored-reference tests prove the identity contract that JSON comparison cannot express:

- every call returns a new array identity;
- the target receives a new object identity;
- preceding and following untargeted objects preserve identity;
- missing ids still return a new array while preserving every record;
- the frozen input remains unchanged.

Plausible wrong implementations that mutate, update the last element rather than the matching id, or append to a completed target are rejected before the reference is accepted.

## UX and worked diagram

The diagram is now a flat worked normalized-state update rather than four labeled boxes. It shows the concrete records, the message → attempt → request chain, the typed delta and guard, then the new and preserved identities plus derived controls. Rules and typography carry the hierarchy; the narrow-screen layout becomes one readable column.

The experiment now honestly exposes the dataset it advertises: one 18-action conversation log with exactly three generation attempts, presented as three selectable six-step flows.

- **Complete · 01–06:** user message, attempt `a-17.1`, request `r-17.1`, two deltas, and completion.
- **Cancel + late · 07–12:** attempt `a-17.2` streams partial text, cancels, then rejects a late delta without advancing the state revision.
- **Edit + regenerate · 13–18:** user record revision 0 → 1, assistant message position retained, new attempt `a-17.3` and request `r-17.3`, two deltas, and completion.

Every step exposes action number, reducer result, message/attempt/request ids, visible content, `canStop`, `canRegenerate`, and immutable revision evidence. The formerly hidden edit, regenerate, cancellation, and late-event claims are now directly selectable.

## Validation

- TypeScript typecheck: passed
- ESLint: passed
- Focused Browser Lab, curriculum, typed-contract, rendered-HTML, and canonical template suite: 52 passed
- Production build: passed
- Full workspace package suite: 18 passed
- Full application suite: 94 passed
- Diff whitespace check: passed

Delegated agents cannot access the shared in-app browser backend. Parent Playwright verification is pending for the diagram at desktop and mobile widths, staged wrong-answer feedback, authored reference runs, and all three experiment flows.

## Parent Playwright verification

- The live summary showed concrete `c-17` normalized state, `messageIds`, `messagesById`, the durable message → generation attempt → transport request identity chain, a guarded delta action, new and preserved object identities, and the derived stop/regenerate controls.
- A message factory that omitted lifecycle fields failed with a direction to return the exact stable record and apply the documented defaults.
- The exact `find` → mutate → return-the-original-array shortcut failed inside the frozen QuickJS boundary; it no longer passes by serializing a mutated host input.
- The authored message factory and immutable delta transition each passed all 4 host-owned cases.
- The experiment exposed all 18 advertised actions as three selectable six-step flows. Action 12 rejected the post-cancel delta, kept revision 11, and preserved all identities.
- Action 14 kept assistant message `m-a1` in place while replacing generation/transport identity with `a-17.3` and `r-17.3`; action 18 derived stop off and regenerate on after resource release.
