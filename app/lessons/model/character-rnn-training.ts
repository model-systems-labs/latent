export const PYTHON_CHARACTER_RNN_LEARNER_PATH = "models/character-rnn.py" as const;
export const PYTHON_CHARACTER_RNN_TRAINER_PATH = "runtime/host/character-rnn-training.py" as const;

/** Provided trainer added after the numerical operations the learner owns. */
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


def _make_parameters(random, hidden_size, vocabulary_size):
    return {
        "input": random.normal(0.0, 0.018, (hidden_size, vocabulary_size)),
        "recurrent": random.normal(0.0, 0.04, (hidden_size, hidden_size)),
        "output": random.normal(0.0, 0.018, (vocabulary_size, hidden_size)),
        "hidden_bias": np.zeros(hidden_size, dtype=np.float64),
        "output_bias": np.zeros(vocabulary_size, dtype=np.float64),
    }


def _run_window(start, length, token_to_index, parameters):
    input_ids = [token_to_index[token] for token in CORPUS[start:start + length]]
    target_ids = [token_to_index[token] for token in CORPUS[start + 1:start + length + 1]]
    states = [np.zeros(parameters["hidden_bias"].shape, dtype=np.float64)]
    distributions = []
    loss = 0.0

    for input_id, target_id in zip(input_ids, target_ids):
        input_vector = np.zeros(parameters["input"].shape[1], dtype=np.float64)
        input_vector[input_id] = 1.0
        state = np.asarray(rnn_step(input_vector, states[-1], {
            "Wxh": parameters["input"],
            "Whh": parameters["recurrent"],
            "bias": parameters["hidden_bias"],
        }), dtype=np.float64)
        if state.shape != parameters["hidden_bias"].shape or not np.all(np.isfinite(state)):
            raise ValueError("rnn_step must return one finite value per hidden unit")
        distribution = _softmax(parameters["output"] @ state + parameters["output_bias"])
        step_loss = float(cross_entropy(distribution, target_id))
        if not np.isfinite(step_loss) or step_loss < 0:
            raise ValueError("cross_entropy must return a finite non-negative loss")
        states.append(state)
        distributions.append(distribution)
        loss += step_loss

    return input_ids, target_ids, states, distributions, loss / length


def _differentiate_window(input_ids, target_ids, states, distributions, parameters):
    gradients = {name: np.zeros_like(values) for name, values in parameters.items()}
    state_signal = np.zeros_like(parameters["hidden_bias"])

    for time in range(len(input_ids) - 1, -1, -1):
        token_error = distributions[time].copy()
        token_error[target_ids[time]] -= 1.0
        gradients["output"] += np.outer(token_error, states[time + 1])
        gradients["output_bias"] += token_error

        combined_signal = parameters["output"].T @ token_error + state_signal
        transition_signal = combined_signal * (1.0 - states[time + 1] ** 2)
        gradients["hidden_bias"] += transition_signal
        gradients["input"][:, input_ids[time]] += transition_signal
        gradients["recurrent"] += np.outer(transition_signal, states[time])
        state_signal = parameters["recurrent"].T @ transition_signal

    return gradients


def train_character_rnn(steps=180):
    """Train a small deterministic RNN and return a checkpoint other runtimes can use."""
    steps = int(steps)
    if steps < 1 or steps > 2000:
        raise ValueError("steps must be between 1 and 2000")

    vocabulary = sorted(set(CORPUS))
    token_to_index = {token: index for index, token in enumerate(vocabulary)}
    vocabulary_size = len(vocabulary)
    hidden_size = 12
    sequence_length = 32
    learning_rate = 0.012
    gradient_limit = 5.0
    random = np.random.default_rng(19)
    parameters = _make_parameters(random, hidden_size, vocabulary_size)
    first_moment = {name: np.zeros_like(values) for name, values in parameters.items()}
    second_moment = {name: np.zeros_like(values) for name, values in parameters.items()}
    beta_one = 0.9
    beta_two = 0.999
    maximum_start = len(CORPUS) - sequence_length - 1
    losses = []

    for update_number in range(1, steps + 1):
        start = ((update_number - 1) * 37) % (maximum_start + 1)
        input_ids, target_ids, states, distributions, loss = _run_window(
            start,
            sequence_length,
            token_to_index,
            parameters,
        )
        raw_gradients = _differentiate_window(
            input_ids,
            target_ids,
            states,
            distributions,
            parameters,
        )

        for name, raw_values in raw_gradients.items():
            clipped = np.asarray(clip_gradients(raw_values, gradient_limit), dtype=np.float64)
            if clipped.shape != raw_values.shape or not np.all(np.isfinite(clipped)):
                raise ValueError("clip_gradients must keep each finite gradient tensor shape")
            first_moment[name] = beta_one * first_moment[name] + (1.0 - beta_one) * clipped
            second_moment[name] = beta_two * second_moment[name] + (1.0 - beta_two) * clipped * clipped
            corrected_first = first_moment[name] / (1.0 - beta_one ** update_number)
            corrected_second = second_moment[name] / (1.0 - beta_two ** update_number)
            parameters[name] -= learning_rate * corrected_first / (np.sqrt(corrected_second) + 1e-8)

        losses.append(loss)

    tail = min(12, len(losses))
    final_loss = float(np.mean(losses[-tail:]))
    checkpoint = {
        "version": 1,
        "vocabulary": vocabulary,
        "hiddenSize": hidden_size,
        "Wxh": parameters["input"].tolist(),
        "Whh": parameters["recurrent"].tolist(),
        "Why": parameters["output"].tolist(),
        "bh": parameters["hidden_bias"].tolist(),
        "by": parameters["output_bias"].tolist(),
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
 * This host-owned entry point is copied only into the isolated Python worker.
 * It picks the three numerical operations the learner owns, then defines its
 * own trainer. That means editing `train_character_rnn` in the learner file
 * can't take control of the artifact.
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
