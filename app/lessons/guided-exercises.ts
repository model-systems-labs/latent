import type { CourseLesson } from "@latent/course-kit";

type GuidedEdit = {
  solution: string;
  prompt: string;
};

const guidedEdits: Record<string, GuidedEdit> = {
  // Machine Learning Basics
  "ml-training-data/features-targets": {
    solution: `    return {
        "features": table[:, :-1].tolist(),
        "targets": table[:, -1].tolist(),
    }`,
    prompt: "separate the feature columns from the final target column, then return both arrays.",
  },
  "ml-training-data/holdout-split": {
    solution: `    validation_mask = np.zeros(target_values.size, dtype=bool)
    validation_mask[list(validation_indices)] = True
    training_mask = ~validation_mask

    return {
        "train_features": feature_table[training_mask].tolist(),
        "train_targets": target_values[training_mask].tolist(),
        "validation_features": feature_table[validation_mask].tolist(),
        "validation_targets": target_values[validation_mask].tolist(),
    }`,
    prompt: "build complementary training and validation masks, then use them to split both arrays.",
  },
  "ml-linear-regression/linear-prediction": {
    solution: "    return float(x @ w + bias_value)",
    prompt: "compute the weighted sum and add the bias.",
  },
  "ml-linear-regression/mean-squared-error": {
    solution: `    residuals = predicted - expected
    return float(np.mean(residuals ** 2))`,
    prompt: "compute each residual, square it, and return the batch mean.",
  },
  "ml-gradient-descent/mse-gradients": {
    solution: `    predictions = inputs * weight_value + bias_value
    errors = predictions - expected
    return {
        "weight": float(2 * np.mean(errors * inputs)),
        "bias": float(2 * np.mean(errors)),
    }`,
    prompt: "derive the mean-squared-error gradients for the scalar weight and bias.",
  },
  "ml-gradient-descent/gradient-step": {
    solution: `    return {
        "weight": weight_value - rate * weight_gradient,
        "bias": bias_value - rate * bias_gradient,
    }`,
    prompt: "subtract learning-rate-scaled gradients from both parameters.",
  },
  "ml-binary-classification/sigmoid": {
    solution: `    if value >= 0:
        return float(1 / (1 + np.exp(-value)))

    exp_value = np.exp(value)
    return float(exp_value / (1 + exp_value))`,
    prompt: "implement the numerically stable positive and negative sigmoid branches.",
  },
  "ml-binary-classification/binary-cross-entropy": {
    solution: `    epsilon = 1e-12
    safe = np.clip(predicted, epsilon, 1 - epsilon)
    losses = -(expected * np.log(safe) + (1 - expected) * np.log(1 - safe))
    return float(np.mean(losses))`,
    prompt: "clamp the probabilities and average the binary cross-entropy terms.",
  },
  "ml-neural-networks/relu": {
    solution: "    return np.maximum(vector, 0).tolist()",
    prompt: "replace negative coordinates with zero and return a plain list.",
  },
  "ml-neural-networks/two-layer-network": {
    solution: `    hidden = np.maximum(W1 @ x + b1, 0)
    return float(W2 @ hidden + b2)`,
    prompt: "run the hidden linear layer, apply ReLU, and project to the output logit.",
  },

  // Harness Engineering
  "agent-loop/parse-model-response": {
    solution: `    if has_final == has_tool_call:
        raise ValueError("response must contain exactly one final or tool_call")`,
    prompt: "reject responses that contain both action forms or neither one.",
  },
  "agent-loop/append-tool-result": {
    solution: `    for message in copied:
        if type(message) is not dict:
            continue
        if message.get("role") == "assistant" and type(message.get("tool_call")) is dict:
            if message["tool_call"].get("id") == call_id:
                matching_calls.append(message)
        if message.get("role") == "tool" and message.get("call_id") == call_id:
            resolved.add(call_id)`,
    prompt: "find the matching assistant call and detect whether it already has a tool result.",
  },
  "tool-contracts/validate-tool-arguments": {
    solution: `    missing = [name for name in required if name not in arguments]
    if missing:
        raise ValueError("missing required argument: " + missing[0])
    if not allow_extra:
        extra = [name for name in arguments if name not in declared]
        if extra:
            raise ValueError("unexpected argument: " + extra[0])`,
    prompt: "reject the first missing required field and any field outside a closed schema.",
  },
  "tool-contracts/page-tool-results": {
    solution: `    page = items[offset:offset + limit]
    end = offset + len(page)
    return {
        "items": page,
        "returned": len(page),
        "total": len(items),
        "next_offset": end if end < len(items) else None,
    }`,
    prompt: "slice one page and return a next offset only when more results remain.",
  },
  "context-selection/select-context": {
    solution: `    optional.sort(key=lambda pair: (-pair[1]["priority"], pair[0]))
    for _, item in optional:
        if used + item["tokens"] <= budget:
            selected.append(item["id"])
            used += item["tokens"]`,
    prompt: "admit optional context in stable priority order without exceeding the budget.",
  },
  "context-selection/compact-tool-outputs": {
    solution: `    for index in eligible:
        message = compacted[index]
        content = message.get("content")
        if type(content) is str and len(content) > preview_chars:
            omitted = len(content) - preview_chars
            message["content"] = content[:preview_chars] + f"... [{omitted} chars omitted]"
            message["compacted"] = True`,
    prompt: "replace eligible long tool outputs with a preview and an omission count.",
  },
  "permissions-and-sandboxes/normalize-workspace-path": {
    solution: `    root = posixpath.normpath(workspace_root)
    resolved = posixpath.normpath(posixpath.join(root, requested))
    if posixpath.commonpath([root, resolved]) != root:
        raise ValueError("requested path is outside the workspace")
    return resolved`,
    prompt: "normalize the joined path and reject any path that escapes the workspace root.",
  },
  "permissions-and-sandboxes/permission-decision": {
    solution: `        if rule_kind in (kind, "*") and target_matches:
            matches.append((precedence[decision], len(prefix), -index, rule))`,
    prompt: "collect matching rules with the precedence information needed for deterministic selection.",
  },
  "state-and-recovery/apply-run-event": {
    solution: `    if event_id in seen:
        return next_state`,
    prompt: "make replay idempotent by returning unchanged state for an event already applied.",
  },
  "state-and-recovery/resume-run": {
    solution: `    return {
        "status": status,
        "checkpoint": checkpoint,
        "completed": [call_id for call_id in planned_call_ids if call_id in completed],
        "pending": [call_id for call_id in planned_call_ids if call_id not in completed],
    }`,
    prompt: "project replayed state back into ordered completed and pending call lists.",
  },
  "agent-evaluations/grade-outcome": {
    solution: `        if field not in outcome:
            passed = False
        else:
            actual = outcome[field]
            try:
                if operation == "eq":
                    if type(actual) is bool or type(expected) is bool:
                        passed = type(actual) is type(expected) and actual == expected
                    else:
                        passed = actual == expected
                elif operation == "gte":
                    passed = actual >= expected
                elif operation == "lte":
                    passed = actual <= expected
                else:
                    passed = expected in actual
            except (TypeError, ValueError):
                passed = False
        if not passed:
            failed.append(field)`,
    prompt: "evaluate the supported requirement operations and collect fields that fail safely.",
  },
  "agent-evaluations/trial-metrics": {
    solution: `    return {
        "pass_rate": correct / total,
        "pass_at_k": 1 - (math.comb(total - correct, k) / combinations if total - correct >= k else 0),
        "pass_k": math.comb(correct, k) / combinations if correct >= k else 0,
    }`,
    prompt: "compute pass rate, finite-sample pass@k, and consistent pass^k.",
  },
  "task-orchestration/parallel-batches": {
    solution: `    while remaining:
        ready = [
            task_id for task_id in ordered_ids
            if task_id in remaining and dependencies[task_id] <= completed
        ]
        if not ready:
            raise ValueError("task graph contains a cycle")
        batches.append(ready)
        completed.update(ready)
        remaining.difference_update(ready)`,
    prompt: "repeatedly schedule every ready task as one parallel batch and detect cycles.",
  },
  "task-orchestration/collect-worker-results": {
    solution: `    missing = [task_id for task_id in task_ids if task_id not in by_id]
    if missing:
        raise ValueError("missing worker result: " + missing[0])
    return [by_id[task_id] for task_id in task_ids]`,
    prompt: "require every expected result and restore the original task order.",
  },
  "integrated-harness/run-harness": {
    solution: `        policy = permission_decision({"kind": tool.kind, "target": target}, rules)
        events.append({"kind": "policy_decision", "call_id": call_id, **policy})

        if policy["decision"] == "confirm":
            return {"status": "approval_required", "final": None, "turns": turn, "tool_calls": dispatched, "pending_call": call_id, "messages": history, "events": events}

        is_error = policy["decision"] == "deny"
        if is_error:
            content = "permission denied"
            events.append({"kind": "tool_denied", "call_id": call_id})
        else:
            content = tool.execute(call_id, arguments)
            dispatched += 1
            events.append({"kind": "tool_completed", "call_id": call_id})
        history = append_tool_result(history, call_id, content, is_error)`,
    prompt: "enforce the permission decision, dispatch allowed tools, and record the resulting observation.",
  },
  "integrated-harness/audit-harness-run": {
    solution: `    status = run.get("status")
    if status == "completed":
        if not final_positions or final_positions[-1] != len(run["messages"]) - 1:
            issues.append("a completed run must end with final assistant text")
        unresolved = sorted(calls - resolved)
        if unresolved:
            issues.append("completed run has unresolved calls: " + ", ".join(unresolved))
    elif status == "approval_required":
        pending = run.get("pending_call")
        if pending not in calls or pending in resolved:
            issues.append("approval_required needs one unresolved pending call")
    elif status not in ("budget_exceeded", "model_exhausted"):
        issues.append("unknown run status")`,
    prompt: "check the message invariants that correspond to each terminal run status.",
  },

  // LLM Systems: model foundations
  "character-rnns/rnn-step": {
    solution: `    input_projection = Wxh @ np.asarray(input_vector, dtype=float)
    state_projection = Whh @ np.asarray(previous, dtype=float)
    return np.tanh(input_projection + state_projection + bias).tolist()`,
    prompt: "combine the input and previous-state projections, then apply tanh.",
  },
  "character-rnns/cross-entropy": {
    solution: `    probability = max(float(values[target_index]), 1e-12)
    return float(-np.log(probability))`,
    prompt: "read the target probability with a numerical floor and return its negative log.",
  },
  "character-rnns/gradient-clipping": {
    solution: "    return np.clip(np.asarray(gradients, dtype=float), -limit, limit).tolist()",
    prompt: "clip every gradient symmetrically to the allowed range.",
  },
  "neural-language-models/stable-softmax": {
    solution: `    shifted = values - np.max(values)
    weights = np.exp(shifted)
    return (weights / weights.sum()).tolist()`,
    prompt: "shift the logits for stability, exponentiate them, and normalize the weights.",
  },
  "neural-language-models/context-embedding": {
    solution: `    selected = table[np.asarray(indices, dtype=int)]
    return selected.mean(axis=0).tolist()`,
    prompt: "look up the context rows and average them feature by feature.",
  },
  "neural-language-models/negative-log-likelihood": {
    solution: `    probability = max(float(values[target_index]), 1e-12)
    return float(-np.log(probability))`,
    prompt: "turn the target word's safe probability into negative log-likelihood.",
  },
  "subword-tokenization/pair-counts": {
    solution: `            pair = json.dumps(
                [symbols[index], symbols[index + 1]],
                separators=(",", ":"),
            )
            counts[pair] = counts.get(pair, 0) + 1`,
    prompt: "serialize each neighboring symbol pair and increment its count.",
  },
  "subword-tokenization/merge-pair": {
    solution: `        if index + 1 < len(symbols) and symbols[index] == left and symbols[index + 1] == right:
            output.append(left + right)
            index += 2
        else:
            output.append(symbols[index])
            index += 1`,
    prompt: "merge matching neighbors while copying every unmatched symbol in order.",
  },
  "subword-tokenization/encode-word": {
    solution: `            if symbols[index] == left and symbols[index + 1] == right:
                symbols[index:index + 2] = [left + right]
            else:
                index += 1`,
    prompt: "apply each learned merge wherever its two symbols are adjacent.",
  },
  "additive-attention/additive-score": {
    solution: `    query_term = Wq @ np.asarray(query, dtype=float)
    key_term = Wk @ np.asarray(key, dtype=float)
    hidden = np.tanh(query_term + key_term + bias)
    return float(v @ hidden)`,
    prompt: "combine the projected query and key through tanh, then score the hidden vector.",
  },
  "additive-attention/attention-softmax": {
    solution: `    shifted = values - np.max(values)
    weights = np.exp(shifted)
    return (weights / weights.sum()).tolist()`,
    prompt: "convert the attention scores into stable normalized weights.",
  },
  "additive-attention/context-vector": {
    solution: "    return (alpha @ matrix).tolist()",
    prompt: "take the weighted sum of the encoder states.",
  },
  "transformers/causal-mask": {
    solution: `    future_rows, future_columns = np.triu_indices(masked.shape[0], k=1)
    masked[future_rows, future_columns] = -np.inf`,
    prompt: "locate every position above the diagonal and mask it with negative infinity.",
  },
  "transformers/scaled-attention": {
    solution: `    scale = np.sqrt(query_vector.size)
    scores = (key_matrix @ query_vector) / scale
    shifted = scores - np.max(scores)
    probabilities = np.exp(shifted)
    probabilities /= probabilities.sum()
    return (probabilities @ value_matrix).tolist()`,
    prompt: "scale the dot products, normalize them with softmax, and mix the value vectors.",
  },
  "transformers/layer-norm": {
    solution: `    mean = values.mean()
    variance = np.mean((values - mean) ** 2)
    return ((values - mean) / np.sqrt(variance + epsilon)).tolist()`,
    prompt: "compute feature mean and variance, then standardize with epsilon inside the square root.",
  },
  "in-context-learning/format-demonstrations": {
    solution: `    records = [
        f"Input: {example['input'].strip()}\\nLabel: {example['label'].strip()}"
        for example in examples
    ]
    return "\\n\\n".join(records)`,
    prompt: "format every labeled example consistently and separate demonstrations with blank lines.",
  },
  "in-context-learning/build-prompt": {
    solution: `    sections = [instruction]
    if demonstrations:
        sections.append(demonstrations)
    sections.append(f"Input: {query}\\nLabel:")
    return "\\n\\n".join(sections)`,
    prompt: "assemble instruction, optional demonstrations, and the unanswered query in order.",
  },
  "in-context-learning/exact-match": {
    solution: `            if (
                not is_word(before)
                and not is_word(after)
                and (match is None or index < match["index"])
            ):
                match = {"index": index, "label": label}`,
    prompt: "accept only whole-label matches and keep the earliest valid one.",
  },

  // LLM Systems: runtime, serving, and product integration
  "inference-runtime/inference-phases": {
    solution: `    generated_tokens = max(0, max_new_tokens)
    decode_forwards = max(0, generated_tokens - 1)`,
    prompt: "count requested output tokens and the later decode forwards after the first sample.",
  },
  "inference-runtime/kv-bytes": {
    solution: "    return 2 * layers * kv_heads * tokens * head_dimension * bytes_per_value",
    prompt: "multiply keys and values by every cache dimension and the bytes per value.",
  },
  "scheduling-memory/page-allocation": {
    solution: `    pages = (tokens + page_size - 1) // page_size
    capacity = pages * page_size`,
    prompt: "round the token count up to whole pages and compute their total capacity.",
  },
  "scheduling-memory/batch-step": {
    solution: `        advanced = {
            **request,
            "remaining": request["remaining"] - 1,
            "generated": request["generated"] + 1,
        }

        if advanced["remaining"] == 0:
            completed.append(advanced)
        else:
            active.append(advanced)`,
    prompt: "advance each live request by one token and move newly finished requests to completed.",
  },
  "streaming-transport/encode-sse": {
    solution: `    serialized = json.dumps(data, separators=(",", ":"), ensure_ascii=False)
    return f"event: {event}\\ndata: {serialized}\\n\\n"`,
    prompt: "serialize compact JSON and frame it as a complete server-sent event.",
  },
  "streaming-transport/parse-sse": {
    solution: `        for line in re.split(r"\\r?\\n", frame):
            if not line or line.startswith(":"):
                continue
            colon = line.find(":")
            field = line if colon == -1 else line[:colon]
            value = "" if colon == -1 else line[colon + 1:]
            if value.startswith(" "):
                value = value[1:]
            if field == "event" and value:
                event = value
            if field == "data":
                data_lines.append(value)`,
    prompt: "parse the event and data fields from one complete SSE frame.",
  },
  "reliability-observability/retry-policy": {
    solution: "    return transient and tokens_emitted == 0 and attempt + 1 < max_attempts",
    prompt: "retry only transient pre-stream failures while another attempt is available.",
  },
  "reliability-observability/terminal-guard": {
    solution: `    return (
        request["status"] in active
        and request["attemptId"] == event["attemptId"]
        and request["requestId"] == event["requestId"]
    )`,
    prompt: "accept events only for the same active request attempt.",
  },
  "conversation-state/create-message": {
    solution: `    return {
        "id": options["id"],
        "role": options["role"],
        "content": options.get("content", ""),
        "status": options.get("status", "complete"),
        "attemptId": options.get("attemptId"),
        "requestId": options.get("requestId"),
        "createdAt": 0,
    }`,
    prompt: "create the normalized message record with stable defaults and request identity fields.",
  },
  "conversation-state/append-delta": {
    solution: `        if matches_active_stream:
            next_messages.append({
                **message,
                "content": message["content"] + event["delta"],
            })
        else:
            next_messages.append(message)`,
    prompt: "append the delta only to the matching active stream and preserve every other message.",
  },
  "streaming-react/delta-buffer": {
    solution: "    return {\"text\": \"\".join(pending), \"remaining\": []}",
    prompt: "join every pending token into one text update and empty the buffer.",
  },
  "streaming-react/scroll-policy": {
    solution: "    return not user_scrolled_up and distance_from_bottom <= threshold",
    prompt: "follow output only when the user has not opted out and remains near the bottom.",
  },
  "chat-actions-context/context-budget": {
    solution: `    selected_turns = []
    used = sum(message["tokens"] for message in required_system) + active_user["tokens"]
    overflow = used > budget
    if not overflow:
        for turn in reversed(turns):
            turn_tokens = sum(message["tokens"] for message in turn)
            if used + turn_tokens <= budget:
                selected_turns.insert(0, turn)
                used += turn_tokens`,
    prompt: "reserve required context, then admit the newest complete turns that fit the remaining budget.",
  },
  "chat-actions-context/regenerate-branch": {
    solution: `    return {
        "messageId": options["messageId"],
        "parentUserId": options["parentUserId"],
        "attemptId": options["attemptId"],
        "requestId": options["requestId"],
        "role": "assistant",
        "content": "",
        "status": "queued",
    }`,
    prompt: "create a queued assistant branch with fresh attempt and request identities.",
  },
  "chat-product-quality/storage-validation": {
    solution: `    if not all(valid_message(message) for message in record["messages"]):
        return False
    if sum(len(message["content"]) for message in record["messages"]) > 200000:
        return False
    try:
        return type(json.dumps(record)) is str
    except (TypeError, ValueError):
        return False`,
    prompt: "validate every message, enforce the aggregate content limit, and require JSON serialization.",
  },
  "chat-product-quality/phase-label": {
    solution: "    return labels.get(phase, \"Status unavailable\")",
    prompt: "look up the user-facing phase label with a safe fallback.",
  },
};

function starterFromEdit(
  lessonId: string,
  label: string,
  code: string,
  edit: GuidedEdit,
): string {
  const parts = code.split(edit.solution);
  if (parts.length !== 2) {
    throw new Error(
      `Guided exercise ${lessonId} must match its reference solution exactly once; found ${parts.length - 1}`,
    );
  }
  const indentation = edit.solution.match(/^[ \t]*/)?.[0] ?? "";
  const placeholder = [
    `${indentation}# TODO: ${edit.prompt}`,
    `${indentation}raise NotImplementedError(${JSON.stringify(`Implement ${label}.`)})`,
  ].join("\n");
  return `${parts[0]}${placeholder}${parts[1]}`;
}

/**
 * Replaces only the lesson's explicitly selected core algorithm with one TODO.
 * Reference implementations remain untouched for contracts and verification.
 */
export function withGuidedExercises<T extends Pick<CourseLesson, "id" | "implementation">>(lesson: T): T {
  const codeBlocks = lesson.implementation.codeBlocks.map((block) => {
    if (block.starterCode) return block;
    const exerciseId = `${lesson.id}/${block.id}`;
    const edit = guidedEdits[exerciseId];
    if (!edit) return block;
    return {
      ...block,
      starterCode: starterFromEdit(exerciseId, block.label, block.code, edit),
    };
  });
  return {
    ...lesson,
    implementation: { ...lesson.implementation, codeBlocks },
  };
}

export const guidedExerciseIds = Object.freeze(Object.keys(guidedEdits));
