import { integerInRange, randomMatrix, seededRandom, softmax } from "./shared.js";

const LANGUAGE_SENTENCES = [
  "the analyst reads the report",
  "the engineer reads the message",
  "the researcher reads the paper",
  "the receiver reads the signal",
  "the poet writes the verse",
  "the analyst writes the report",
  "the engineer writes the program",
  "the researcher writes the paper",
  "the model predicts the token",
  "the model predicts the sequence",
  "the system predicts the signal",
  "the system records the message",
  "a careful analyst checks the report",
  "a careful engineer checks the program",
  "a small model learns the pattern",
  "a small system learns the sequence",
  "the quiet receiver records the signal",
  "the patient researcher checks the result",
  "the language model predicts the token",
  "the language system predicts the sequence",
];

export type NeuralLmResult = {
  losses: number[];
  initialValidationLoss: number;
  finalValidationLoss: number;
  predictions: Array<{ word: string; probability: number }>;
  neighbors: Array<{ word: string; similarity: number }>;
  vocabularySize: number;
  parameters: number;
};

export function trainNeuralLanguageModel(steps = 4000): NeuralLmResult {
  integerInRange(steps, "steps", 1, 100_000);
  const tokenized = LANGUAGE_SENTENCES.map((sentence) => sentence.split(" "));
  const vocabulary = [...new Set(tokenized.flat())].sort();
  const toIndex = new Map(vocabulary.map((word, index) => [word, index]));
  const examples = tokenized.flatMap((sentence) =>
    sentence.slice(2).map((target, index) => ({
      context: [toIndex.get(sentence[index]) ?? 0, toIndex.get(sentence[index + 1]) ?? 0],
      target: toIndex.get(target) ?? 0,
    })),
  );
  const training = examples.filter((_, index) => index % 6 !== 0);
  const validation = examples.filter((_, index) => index % 6 === 0);
  const dimension = 8;
  const random = seededRandom(37);
  const embeddings = randomMatrix(vocabulary.length, dimension, random, 0.12);
  const output = randomMatrix(vocabulary.length, dimension, random, 0.08);
  const bias = Array(vocabulary.length).fill(0) as number[];

  const contextVector = (context: number[]) =>
    Array.from({ length: dimension }, (_, column) =>
      context.reduce((sum, index) => sum + embeddings[index][column], 0) / context.length,
    );
  const distributionFor = (context: number[]) => {
    const vector = contextVector(context);
    const logits = output.map((row, index) =>
      row.reduce((sum, weight, column) => sum + weight * vector[column], bias[index]),
    );
    return { vector, probabilities: softmax(logits) };
  };
  const validationLoss = () => validation.reduce((sum, example) => {
    const { probabilities } = distributionFor(example.context);
    return sum - Math.log(Math.max(probabilities[example.target], 1e-12));
  }, 0) / validation.length;

  const initialValidationLoss = validationLoss();
  const losses: number[] = [];
  for (let step = 0; step < steps; step += 1) {
    const example = training[step % training.length];
    const { vector, probabilities } = distributionFor(example.context);
    const outputGradient = probabilities.slice();
    outputGradient[example.target] -= 1;
    const hiddenGradient = Array(dimension).fill(0) as number[];
    for (let row = 0; row < vocabulary.length; row += 1) {
      for (let column = 0; column < dimension; column += 1) {
        hiddenGradient[column] += output[row][column] * outputGradient[row];
      }
    }
    const rate = 0.055;
    for (let row = 0; row < vocabulary.length; row += 1) {
      for (let column = 0; column < dimension; column += 1) {
        output[row][column] -= rate * outputGradient[row] * vector[column];
      }
      bias[row] -= rate * outputGradient[row];
    }
    for (const index of example.context) {
      for (let column = 0; column < dimension; column += 1) {
        embeddings[index][column] -= rate * hiddenGradient[column] / example.context.length;
      }
    }
    if (step % 40 === 0) losses.push(validationLoss());
  }

  const context = [toIndex.get("the") ?? 0, toIndex.get("model") ?? 0];
  const { probabilities } = distributionFor(context);
  const predictions = probabilities
    .map((probability, index) => ({ word: vocabulary[index], probability }))
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 5);

  const modelIndex = toIndex.get("model") ?? 0;
  const cosine = (a: number[], b: number[]) => {
    const dot = a.reduce((sum, value, index) => sum + value * b[index], 0);
    const normA = Math.sqrt(a.reduce((sum, value) => sum + value * value, 0));
    const normB = Math.sqrt(b.reduce((sum, value) => sum + value * value, 0));
    return dot / Math.max(normA * normB, 1e-12);
  };
  const neighbors = embeddings
    .map((embedding, index) => ({ word: vocabulary[index], similarity: cosine(embeddings[modelIndex], embedding) }))
    .filter((item) => item.word !== "model")
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 4);

  return {
    losses,
    initialValidationLoss,
    finalValidationLoss: validationLoss(),
    predictions,
    neighbors,
    vocabularySize: vocabulary.length,
    parameters: vocabulary.length * dimension * 2 + vocabulary.length,
  };
}
