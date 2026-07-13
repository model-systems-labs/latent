# Lesson 13 — Actions and Context

## Naive learner review

The original lesson named the right product concepts but left their mechanics implicit. Its diagram was a generic `Prefix → User edit → Attempt → Context` sequence. The experiment rendered one fixed context list and one regeneration object even though its introduction claimed that learners could stop, retry, edit, and regenerate. A new learner could not see which records survive an action, which identity changes, how an edit affects descendants, or why a context selector must keep complete turns together.

The revised explanation separates two related boundaries:

- the conversation is a durable branch graph of message, attempt, and request records;
- a model request is a projection of one active branch under a token budget.

The worked graph starts from system record `s1` and user `m-u3`. Stopping request `r-31` retains assistant `m-a3`, attempt `a-31`, cancelled status, and the visible partial text `Set future logits`. Retry / regenerate retains that history and allocates `m-a4`, `a-32`, and `r-32` from the same user prefix. Editing produces user revision `m-u3-e1`, retains but invalidates the old descendant on that new branch, and allocates `m-a5`, `a-33`, and `r-33`.

Request assembly is now explicit. System instructions and the active user prompt are required request inputs. Historical input is eligible only as complete ordered user-assistant pairs. Pairs are examined newest-first but returned chronologically. An oversized newer pair does not prevent a smaller older pair from being admitted. Exact token use is reported. If required system instructions alone exceed the selector budget, they remain selected and `overflow: true` tells the caller to block or revise the request rather than pretending it is bounded.

The canonical capstone reserves the live user prompt outside historical selection, subtracts its tokens before calling `selectContext`, then appends it to the selected history. It also stops before transport and marks the assistant attempt `error` if required instructions plus the live prompt exceed the 2048-token request budget.

## Practice and wrong-answer debugging

`selectContext` expanded from one shallow case to nine host-owned cases. They cover:

- required system instructions plus the newest complete pair that fits;
- newest-first admission with final chronological order;
- continuing past an oversized newer pair to a smaller older pair;
- refusing to admit only one message from a pair;
- multiple system records and an exact inclusive budget boundary;
- orphan assistant and trailing incomplete-user rejection;
- empty history and zero budget;
- system-only input;
- required-system overflow with exact `used` tokens and `overflow: true`.

Focused regressions reject individual-message selection, oldest-first selection, system omission, stopping after the first oversized pair, and input-order mutation. Every invocation input is deep-frozen before learner code runs, so `reverse`, `sort`, and other mutation shortcuts fail. Staged feedback names the first missing invariant—atomic turns, newest-first selection, required systems, or continuing after a skip—without disclosing later cases.

`createRegeneration` expanded from one case to four. It must preserve multiple supplied identity sets, return the exact stable queued-assistant record, ignore caller-only `requestId` and `renderIndex`, ignore caller attempts to override content or status, and treat ids as opaque. Focused regressions reject hidden constants, caller spreading, wrong defaults, and input mutation. The authored reference returns only `messageId`, `parentUserId`, `attemptId`, `role`, `content`, and `status` and passes every case.

The contract suite is now `llm-systems-contracts-v13`, so an answer verified against the earlier shallow checks is not carried forward.

## UX and worked diagram

The diagram is a flat worked branch rather than a row of abstract boxes. It shows the active prefix, all three action outcomes, a 26-token request assembly, the skipped 20-token newer pair, the admitted 9-token older pair, final chronological order, and the required-prefix overflow policy. Fine rules and typographic hierarchy keep the surface minimal; the mobile layout collapses each branch and ledger into one readable column.

The experiment now exposes exactly the dataset it advertises: three selectable action flows and 29 integer budgets from 14 through 42.

- **Stop:** aborts `r-31`, retains `m-a3 / a-31 / r-31`, partial text, and cancelled status.
- **Retry / regenerate:** keeps the cancelled attempt and creates queued `m-a4 / a-32 / r-32` from parent `m-u3`.
- **Edit prompt:** creates `m-u3-e1`, excludes the original `m-u3 → m-a3` descendant from the edited branch, and creates queued `m-a5 / a-33 / r-33`.

Every flow shows the active branch, descendant policy, retained partial output, exact included message ids, every included or excluded context unit with a token or branch reason, and an exact attempt record containing model `latent-local-135m`, prompt version `chat-v3`, temperature `0.7`, top-p `0.9`, identities, lifecycle status, and included message ids. Moving the budget visibly changes admission while preserving required inputs and complete-turn boundaries.

## Validation

- TypeScript typecheck: passed
- ESLint: passed without warnings
- Focused curriculum, typed-contract, rendered-HTML, and canonical template suite: 47 passed
- Production build: passed
- Full workspace package suite: 18 passed
- Full application suite: 98 passed
- Diff whitespace check: passed

Delegated agents cannot access the shared in-app browser backend. Parent Playwright verification is pending for desktop/mobile diagram readability, staged wrong-answer feedback, both authored references, all three action flows, and budget-driven context changes.

## Parent Playwright verification

- The live summary showed the concrete stop, retry/regenerate, and edit branches with durable message, attempt, and request identities, plus a 26-token request assembly that skipped the oversized newer pair, admitted the compact older pair, and emitted the final request chronologically.
- An individual-message selector failed with guidance to retain required system context and admit complete user-assistant units; a second complete-turn implementation that admitted oldest-first failed with explicit newest-first guidance.
- The authored selector passed all 9 host-owned cases and the exact regeneration constructor passed all 4.
- At the default 26-token budget, Stop retained `m-a3 / a-31 / r-31`, the visible partial text, and cancelled status while assembling `s1 → m-u1 → m-a1 → m-u3` at 21/26.
- Retry/regenerate kept the cancelled attempt and created queued `m-a4 / a-32 / r-32` from the same `m-u3` prefix. Edit created `m-u3-e1` and queued `m-a5 / a-33 / r-33` while explicitly retaining but excluding the old `m-u3 → m-a3` descendant.
- Every live attempt record exposed model `latent-local-135m`, prompt `chat-v3`, temperature `0.7`, top-p `0.9`, lifecycle status, and the exact included message ids.
