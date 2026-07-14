export const PYTHON_CHARACTER_RNN_LEARNER_PATH = "models/character-rnn.py" as const;
export const PYTHON_CHARACTER_RNN_TRAINER_PATH = "runtime/host/character-rnn-training.py" as const;

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
            input_vector = np.zeros(vocabulary_size, dtype=np.float64)
            input_vector[input_index] = 1.0
            next_state = np.asarray(rnn_step(input_vector, states[-1], {
                "Wxh": Wxh,
                "Whh": Whh,
                "bias": bh,
            }), dtype=np.float64)
            if next_state.shape != (hidden_size,) or not np.all(np.isfinite(next_state)):
                raise ValueError("rnn_step must return one finite value per hidden unit")
            states.append(next_state)
            distribution = _softmax(Why @ next_state + by)
            probabilities.append(distribution)
            step_loss = float(cross_entropy(distribution, target_index))
            if not np.isfinite(step_loss) or step_loss < 0:
                raise ValueError("cross_entropy must return a finite non-negative loss")
            loss += step_loss

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

        raw_gradients = {"Wxh": dWxh, "Whh": dWhh, "Why": dWhy, "bh": dbh, "by": dby}
        gradients = {}
        for name, raw_gradient in raw_gradients.items():
            clipped = np.asarray(clip_gradients(raw_gradient, gradient_limit), dtype=np.float64)
            if clipped.shape != raw_gradient.shape or not np.all(np.isfinite(clipped)):
                raise ValueError("clip_gradients must preserve each finite gradient tensor shape")
            gradients[name] = clipped
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

/**
 * Host-authored entrypoint synchronized only into the isolated Python worker.
 * It selects the three learner-owned numerical operations and then defines its
 * own trainer, so an edited `train_character_rnn` in the learner file never has
 * artifact authority.
 */
export const characterRnnTrustedTrainingSource = `import runpy as _latent_runpy
import numpy as np

_latent_learner = _latent_runpy.run_path(
    ${JSON.stringify(PYTHON_CHARACTER_RNN_LEARNER_PATH)},
    run_name="latent_character_rnn_learner",
)

def _latent_learner_function(name):
    value = _latent_learner.get(name)
    if not callable(value):
        raise TypeError(f"models/character-rnn.py must define callable {name}")
    return value

rnn_step = _latent_learner_function("rnn_step")
cross_entropy = _latent_learner_function("cross_entropy")
clip_gradients = _latent_learner_function("clip_gradients")
del _latent_learner

${characterRnnTrainingPostlude}`;
