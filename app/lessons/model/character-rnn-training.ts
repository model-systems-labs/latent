/** Supplied trainer appended after the learner-owned numerical operations. */
export const characterRnnTrainingPostlude = `import json
from pathlib import Path


CORPUS = (
    "the receiver counted one quiet pulse. "
    "the signal crossed the empty sky. "
    "a patient machine recorded every interval. "
    "the pattern returned before the morning. "
    "the receiver counted two quiet pulses. "
    "the signal crossed the silent sky. "
) * 4


def _softmax(logits):
    shifted = logits - np.max(logits)
    weights = np.exp(shifted)
    return weights / np.sum(weights)


def train_character_rnn(steps=180):
    """Train a deterministic compact RNN and return a portable checkpoint."""
    steps = int(steps)
    if steps < 1 or steps > 2000:
        raise ValueError("steps must be between 1 and 2000")

    vocabulary = sorted(set(CORPUS))
    token_to_index = {token: index for index, token in enumerate(vocabulary)}
    vocabulary_size = len(vocabulary)
    hidden_size = 12
    sequence_length = 24
    learning_rate = 0.075
    gradient_limit = 5.0
    random = np.random.default_rng(19)

    Wxh = random.normal(0.0, 0.01, (hidden_size, vocabulary_size))
    Whh = random.normal(0.0, 0.05, (hidden_size, hidden_size))
    Why = random.normal(0.0, 0.01, (vocabulary_size, hidden_size))
    bh = np.zeros(hidden_size, dtype=np.float64)
    by = np.zeros(vocabulary_size, dtype=np.float64)

    memories = {
        "Wxh": np.zeros_like(Wxh),
        "Whh": np.zeros_like(Whh),
        "Why": np.zeros_like(Why),
        "bh": np.zeros_like(bh),
        "by": np.zeros_like(by),
    }
    position = 0
    previous_state = np.zeros(hidden_size, dtype=np.float64)
    losses = []

    for _ in range(steps):
        if position + sequence_length + 1 >= len(CORPUS):
            position = 0
            previous_state = np.zeros(hidden_size, dtype=np.float64)

        inputs = [token_to_index[token] for token in CORPUS[position:position + sequence_length]]
        targets = [token_to_index[token] for token in CORPUS[position + 1:position + sequence_length + 1]]
        states = [previous_state.copy()]
        probabilities = []
        loss = 0.0

        for input_index, target_index in zip(inputs, targets):
            next_state = np.tanh(Wxh[:, input_index] + Whh @ states[-1] + bh)
            states.append(next_state)
            distribution = _softmax(Why @ next_state + by)
            probabilities.append(distribution)
            loss += cross_entropy(distribution, target_index)

        dWxh = np.zeros_like(Wxh)
        dWhh = np.zeros_like(Whh)
        dWhy = np.zeros_like(Why)
        dbh = np.zeros_like(bh)
        dby = np.zeros_like(by)
        next_state_gradient = np.zeros(hidden_size, dtype=np.float64)

        for time in range(sequence_length - 1, -1, -1):
            output_gradient = probabilities[time].copy()
            output_gradient[targets[time]] -= 1.0
            dWhy += np.outer(output_gradient, states[time + 1])
            dby += output_gradient
            hidden_gradient = Why.T @ output_gradient + next_state_gradient
            raw_gradient = hidden_gradient * (1.0 - states[time + 1] ** 2)
            dbh += raw_gradient
            dWxh[:, inputs[time]] += raw_gradient
            dWhh += np.outer(raw_gradient, states[time])
            next_state_gradient = Whh.T @ raw_gradient

        gradients = {
            "Wxh": np.asarray(clip_gradients(dWxh, gradient_limit)),
            "Whh": np.asarray(clip_gradients(dWhh, gradient_limit)),
            "Why": np.asarray(clip_gradients(dWhy, gradient_limit)),
            "bh": np.asarray(clip_gradients(dbh, gradient_limit)),
            "by": np.asarray(clip_gradients(dby, gradient_limit)),
        }
        parameters = {"Wxh": Wxh, "Whh": Whh, "Why": Why, "bh": bh, "by": by}
        for name, values in parameters.items():
            gradient = gradients[name]
            memories[name] += gradient * gradient
            values -= learning_rate * gradient / np.sqrt(memories[name] + 1e-8)

        previous_state = states[-1].copy()
        position += sequence_length
        losses.append(loss / sequence_length)

    tail = min(12, len(losses))
    final_loss = float(np.mean(losses[-tail:]))
    checkpoint = {
        "version": 1,
        "vocabulary": vocabulary,
        "hiddenSize": hidden_size,
        "Wxh": Wxh.tolist(),
        "Whh": Whh.tolist(),
        "Why": Why.tolist(),
        "bh": bh.tolist(),
        "by": by.tolist(),
    }
    parameter_count = (
        hidden_size * vocabulary_size
        + hidden_size * hidden_size
        + vocabulary_size * hidden_size
        + hidden_size
        + vocabulary_size
    )
    return {
        "checkpoint": checkpoint,
        "finalLoss": final_loss,
        "parameters": parameter_count,
        "vocabularySize": vocabulary_size,
    }


RESULT = None
if __name__ == "__main__":
    RESULT = train_character_rnn()
    artifact_path = Path("artifacts/character-rnn.json")
    artifact_path.parent.mkdir(parents=True, exist_ok=True)
    artifact_path.write_text(json.dumps(RESULT, separators=(",", ":")), encoding="utf-8")`;
