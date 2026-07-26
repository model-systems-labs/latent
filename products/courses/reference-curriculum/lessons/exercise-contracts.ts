import { foundationExerciseContractCopy } from "./foundations/exercise-contracts";
import { harnessEngineeringExerciseContractCopy } from "./harness-engineering/exercise-contracts";

export type ExerciseContract = {
  signature: string;
  inputs: string;
  output: string;
  rule: string;
  example: string;
};

/**
 * The compact contract a learner needs before writing each isolated function.
 * These stay separate from the reference implementations so the lesson can
 * explain the interface without revealing the solution.
 */
export const exerciseContracts = {
  "character-rnns/rnn-step": {
    signature: "def rnn_step(input_vector, previous, parameters):",
    inputs: "input_vector [vocab], previous [hidden], Wxh [hidden × vocab], Whh [hidden × hidden], bias [hidden]",
    output: "list[float] with shape [hidden]",
    rule: "h_t = tanh(Wxh x_t + Whh h_(t−1) + b)",
    example: "[1, 0], [0, 0], identity Wxh → [0.762, 0]",
  },
  "character-rnns/cross-entropy": {
    signature: "def cross_entropy(probabilities, target_index):",
    inputs: "probabilities [vocab], target_index int",
    output: "non-negative float",
    rule: "loss = −log(max(p[target], 10⁻¹²))",
    example: "[0.1, 0.8, 0.1], target 1 → 0.223",
  },
  "character-rnns/gradient-clipping": {
    signature: "def clip_gradients(gradients, limit=5):",
    inputs: "gradients array-like[float] of any shape, limit float",
    output: "nested list with the input shape",
    rule: "clip every g to max(−limit, min(g, limit))",
    example: "[−8, 2, 9], limit 5 → [−5, 2, 5]",
  },

  "neural-language-models/stable-softmax": {
    signature: "def stable_softmax(logits):",
    inputs: "logits [vocab]",
    output: "list[float] with shape [vocab], summing to 1",
    rule: "p_i = exp(z_i − max(z)) / Σ_j exp(z_j − max(z))",
    example: "[1001, 1000, 999] → [0.665, 0.245, 0.090]",
  },
  "neural-language-models/context-embedding": {
    signature: "def context_embedding(indices, embeddings):",
    inputs: "indices list[int] with length context, embeddings [vocab × width]",
    output: "list[float] with shape [width]",
    rule: "context = mean(embeddings[indices], axis=0)",
    example: "[0, 1], [[2, 0], [0, 4]] → [1, 2]",
  },
  "neural-language-models/negative-log-likelihood": {
    signature: "def negative_log_likelihood(probabilities, target_index):",
    inputs: "probabilities [vocab], target_index int",
    output: "non-negative float",
    rule: "NLL = −log(max(p[target], 10⁻¹²))",
    example: "[0.7, 0.2, 0.1], target 0 → 0.357",
  },

  "subword-tokenization/pair-counts": {
    signature: "def count_pairs(words):",
    inputs: "words list[list[str]]; one symbol list per vocabulary item",
    output: "dict[str, int] keyed by JSON pairs",
    rule: "slide over every adjacent pair and add one to its shared count",
    example: "[[\"s\",\"i\",\"g\"], [\"s\",\"i\"]] → {\"[\\\"s\\\",\\\"i\\\"]\": 2, …}",
  },
  "subword-tokenization/merge-pair": {
    signature: "def merge_pair(symbols, pair):",
    inputs: "symbols list[str], pair list[str] with length 2",
    output: "list[str] in the original order",
    rule: "scan left to right and replace each non-overlapping [left, right] with left + right",
    example: "[\"s\",\"i\",\"g\"], [\"s\",\"i\"] → [\"si\",\"g\"]",
  },
  "subword-tokenization/encode-word": {
    signature: "def encode_word(word, merges):",
    inputs: "word str, merges list[[str, str]] in learned order",
    output: "list[str] tokens",
    rule: "start from characters, then apply every learned merge in order",
    example: "\"signaling\", [[\"s\",\"i\"], [\"si\",\"g\"], [\"sig\",\"n\"], [\"i\",\"n\"], [\"in\",\"g\"]] → [\"sign\",\"a\",\"l\",\"ing\"]",
  },

  "additive-attention/additive-score": {
    signature: "def additive_score(query, key, parameters):",
    inputs: "query [q], key [k], Wq [a × q], Wk [a × k], bias and v [a]",
    output: "finite float compatibility score",
    rule: "e = vᵀ tanh(Wq q + Wk k + b)",
    example: "q=[1,0], k=[0,1], identity projections, v=[0.5,−0.5] → 0",
  },
  "additive-attention/attention-softmax": {
    signature: "def attention_weights(scores):",
    inputs: "scores [source positions]",
    output: "list[float] with the same length, summing to 1",
    rule: "α = softmax(scores − max(scores))",
    example: "[2, 1, 0] → [0.665, 0.245, 0.090]",
  },
  "additive-attention/context-vector": {
    signature: "def context_vector(states, weights):",
    inputs: "states [source positions × width], weights [source positions]",
    output: "list[float] with shape [width]",
    rule: "context = Σ_i α_i state_i",
    example: "[[1,0],[0,1]], [0.75,0.25] → [0.75,0.25]",
  },

  "transformers/causal-mask": {
    signature: "def causal_mask(scores):",
    inputs: "scores square matrix [sequence × sequence]",
    output: "nested list with shape [sequence × sequence]",
    rule: "keep score[i,j] when j ≤ i; otherwise set it to −Infinity",
    example: "[[1,2],[3,4]] → [[1,−Infinity],[3,4]]",
  },
  "transformers/scaled-attention": {
    signature: "def scaled_dot_product_attention(query, keys, values):",
    inputs: "query [d_k], keys [items × d_k], values [items × d_v]",
    output: "list[float] with shape [d_v]",
    rule: "softmax(Kq / √d_k)ᵀ V",
    example: "q=[1,0], K=I, V=[[2,0],[0,2]] → first output coordinate is larger",
  },
  "transformers/layer-norm": {
    signature: "def layer_norm(vector, epsilon=1e-5):",
    inputs: "vector [features], epsilon positive float",
    output: "list[float] with shape [features]",
    rule: "(x − mean(x)) / √(mean((x − mean(x))²) + ε)",
    example: "[1,2,3,4] → a finite vector with mean 0",
  },

  "in-context-learning/format-demonstrations": {
    signature: "def format_demonstrations(examples):",
    inputs: "examples list[{input: str, label: str}]",
    output: "str containing the records in input order",
    rule: "trim each field; format `Input: …\\nLabel: …`; join records with one blank line",
    example: "[{input: \" aa \", label: \"K\"}] → \"Input: aa\\nLabel: K\"",
  },
  "in-context-learning/build-prompt": {
    signature: "def build_prompt(config):",
    inputs: "config {instruction: str, demonstrations: str, query: str}",
    output: "str ending with `Input: query\\nLabel:`",
    rule: "trim sections, omit an empty demonstration section, and separate included sections with a blank line",
    example: "instruction=\"Return K.\", demos=\"\", query=\"Sharp\" → \"Return K.\\n\\nInput: Sharp\\nLabel:\"",
  },
  "in-context-learning/exact-match": {
    signature: "def exact_match_label(output, expected, allowed_labels=(\"K\", \"M\")):",
    inputs: "output str, expected str, allowed_labels tuple[str]",
    output: "{predicted: str | None, passed: bool}",
    rule: "select the earliest allowed label that stands alone, then compare it exactly with expected",
    example: "\"The label is K.\", expected \"K\" → {predicted: \"K\", passed: True}",
  },

  "inference-runtime/inference-phases": {
    signature: "def inference_phases(prompt_tokens, max_new_tokens):",
    inputs: "prompt_tokens int ≥ 0, max_new_tokens int",
    output: "dict[str, int] of prefill, decode, processed, and final counts",
    rule: "generated=max(0,N); decode=max(0,generated−1); final=prompt+generated",
    example: "prompt 96, new 32 → 31 decode forwards and final length 128",
  },
  "inference-runtime/kv-bytes": {
    signature: "def kv_cache_bytes(config):",
    inputs: "config integer fields: layers, kvHeads, headDimension, tokens, optional bytesPerValue",
    output: "int byte count",
    rule: "bytes = 2 × layers × kv_heads × tokens × head_dimension × bytes_per_value",
    example: "4 layers × 8 heads × 100 tokens × 16 width × fp16 → 204,800 bytes",
  },

  "scheduling-memory/page-allocation": {
    signature: "def allocate_kv_pages(tokens, page_size=16):",
    inputs: "tokens int ≥ 0, page_size positive int",
    output: "{pages: int, capacity: int, wastedSlots: int}",
    rule: "pages = ceil(tokens / page_size); capacity = pages × page_size",
    example: "33 tokens, page size 16 → 3 pages, capacity 48, wasted 15",
  },
  "scheduling-memory/batch-step": {
    signature: "def decode_iteration(active_requests):",
    inputs: "list[{id: str, remaining: int, generated: int, …}]",
    output: "{active: list[request], completed: list[request]}",
    rule: "advance each positive request by one token, then partition by remaining == 0",
    example: "remaining [1,3] → completed first request; second remains with 2",
  },

  "streaming-transport/encode-sse": {
    signature: "def encode_sse(event, data):",
    inputs: "event non-empty str without CR/LF, data JSON-serializable value",
    output: "str containing one complete SSE frame",
    rule: "write `event:`, compact JSON `data:`, and terminate the frame with a blank line",
    example: "token + {delta: \"hi\"} → `event: token\\ndata: {\"delta\":\"hi\"}\\n\\n`",
  },
  "streaming-transport/parse-sse": {
    signature: "def parse_sse_chunk(buffer, chunk):",
    inputs: "buffer str from the previous call, chunk newly decoded str",
    output: "{events: list[{event: str, data: JSON}], remainder: str}",
    rule: "join buffer + chunk, emit blank-line-terminated frames, and retain only the unfinished suffix",
    example: "two chunks split inside `{\"delta\":\"hi\"}` → one token event after chunk two",
  },

  "reliability-observability/retry-policy": {
    signature: "def should_retry(options):",
    inputs: "options {transient: bool, tokensEmitted: int, attempt: int, maxAttempts?: int}",
    output: "bool retry decision",
    rule: "transient and tokensEmitted == 0 and attempt + 1 < maxAttempts",
    example: "transient, 0 visible tokens, attempt 0 of 2 → True; 3 visible tokens → False",
  },
  "reliability-observability/terminal-guard": {
    signature: "def accept_event(request, event):",
    inputs: "request and event records with attemptId/requestId; request also has status",
    output: "bool event-acceptance decision",
    rule: "accept only an active status and exact attemptId plus requestId matches",
    example: "status complete with matching ids → False; status streaming with matching ids → True",
  },

  "conversation-state/create-message": {
    signature: "def create_message(options):",
    inputs: "options record with id, role, and optional content/status/attemptId/requestId",
    output: "serializable message dict with the seven canonical fields",
    rule: "copy stable ids; default content to empty, status to complete, missing request ids to None, and createdAt to 0",
    example: "assistant + attempt a1 + request r1 → a streaming record carrying both ids",
  },
  "conversation-state/append-delta": {
    signature: "def append_message_delta(messages, event):",
    inputs: "messages list[dict], event {messageId, attemptId, requestId, delta}",
    output: "new list[dict] with the matching message copied and updated",
    rule: "append only when message, attempt, request, and streaming status all match; never mutate the input",
    example: "active content \"Hel\" + matching delta \"lo\" → \"Hello\"",
  },

  "streaming-react/delta-buffer": {
    signature: "def flush_token_buffer(pending):",
    inputs: "pending list[str] in arrival order",
    output: "{text: str, remaining: []}",
    rule: "concatenate with no separator and return a fresh empty queue",
    example: "[\"Hel\",\"lo\",\" \",\"world\"] → {text: \"Hello world\", remaining: []}",
  },
  "streaming-react/scroll-policy": {
    signature: "def should_follow_stream(options):",
    inputs: "options {distanceFromBottom: number, userScrolledUp: bool, threshold?: number}",
    output: "bool scroll-follow decision",
    rule: "not userScrolledUp and distanceFromBottom ≤ threshold (default 80)",
    example: "24 px from bottom and not scrolled up → True; user scrolled up → False",
  },

  "chat-actions-context/context-budget": {
    signature: "def select_context(options):",
    inputs: "options {system: messages, history: messages, activeUser: message, budget: int}",
    output: "{selected: list[message], used: int, overflow: bool}",
    rule: "always include system + active user; then add newest adjacent complete user/assistant pairs that fit",
    example: "budget 14 with turns u1/a1 and u2/a2 → select system, u2, a2, active user",
  },
  "chat-actions-context/regenerate-branch": {
    signature: "def create_regeneration(options):",
    inputs: "options {messageId, parentUserId, attemptId, requestId}",
    output: "queued assistant message dict",
    rule: "copy the four ids and set role=assistant, content=empty, status=queued",
    example: "m9, parent m4, attempt a2, request r2 → queued branch rooted at m4",
  },

  "chat-product-quality/storage-validation": {
    signature: "def valid_conversation_record(record):",
    inputs: "record dict with version, id, and at most 200 terminal message dicts",
    output: "bool validity decision",
    rule: "accept only schema v1, exact allow-listed keys, bounded ids/content, terminal statuses, and JSON-serializable values",
    example: "a complete local message → True; the same message with apiKey → False",
  },
  "chat-product-quality/phase-label": {
    signature: "def generation_status_label(phase):",
    inputs: "phase str request-state identifier",
    output: "short user-facing str",
    rule: "look up the seven known phases; return `Status unavailable` for anything else",
    example: "\"prefill\" → \"Processing context\"; \"future-state\" → \"Status unavailable\"",
  },
} satisfies Record<string, ExerciseContract>;

export function exerciseContractFor(lessonId: string, blockId: string): ExerciseContract {
  const key = `${lessonId}/${blockId}`;
  const contract = (exerciseContracts as Record<string, ExerciseContract | undefined>)[key]
    ?? foundationExerciseContractCopy[key]
    ?? harnessEngineeringExerciseContractCopy[key];
  if (!contract) throw new Error(`Missing exercise contract for ${lessonId}/${blockId}`);
  return contract;
}
