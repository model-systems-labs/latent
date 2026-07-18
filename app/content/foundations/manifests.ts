import {
  CURRICULUM_MANIFEST_VERSION,
  defineCurriculumManifest,
} from "@latent/course-kit";

export const linearAlgebraManifest = defineCurriculumManifest({
  schemaVersion: CURRICULUM_MANIFEST_VERSION,
  id: "linear-algebra",
  title: "Linear Algebra Basics",
  shortTitle: "Linear Algebra",
  thesis: "Learn the small set of array operations that appears throughout machine learning.",
  outcome: "You'll be able to read shapes, combine vectors, and follow the matrix operations inside a neural network.",
  modules: [
    {
      id: "linear-algebra-basics",
      routeSlug: "linear-algebra",
      order: 1,
      title: "Linear Algebra Basics",
      shortTitle: "Linear Algebra",
      thesis: "Work from array shapes to batched matrix operations using small numbers you can check by hand.",
      outcome: "You'll recognize the vector and matrix calculations used by embeddings, dense layers, and attention.",
      lessons: [
        { lessonId: "arrays-and-shapes", projectPath: "linear-algebra/arrays-and-shapes.py" },
        { lessonId: "vector-operations", projectPath: "linear-algebra/vector-operations.py" },
        { lessonId: "dot-products", projectPath: "linear-algebra/dot-products.py" },
        { lessonId: "matrix-multiplication", projectPath: "linear-algebra/matrix-multiplication.py" },
        { lessonId: "batches-and-broadcasting", projectPath: "linear-algebra/batches-and-broadcasting.py" },
      ],
    },
  ],
} as const);

export const machineLearningBasicsManifest = defineCurriculumManifest({
  schemaVersion: CURRICULUM_MANIFEST_VERSION,
  id: "machine-learning-basics",
  title: "Machine Learning Basics",
  shortTitle: "ML Basics",
  thesis: "Learn how data, predictions, loss, gradients, and simple neural networks fit together.",
  outcome: "You'll be able to read a small training loop and tell what the data, parameters, and evaluation results mean.",
  modules: [
    {
      id: "machine-learning-basics",
      routeSlug: "machine-learning-basics",
      order: 1,
      title: "Machine Learning Basics",
      shortTitle: "ML Basics",
      thesis: "Build the ideas behind training one small model before applying them to language models.",
      outcome: "You'll make predictions, calculate loss and gradients, and run a small neural network forward pass.",
      lessons: [
        { lessonId: "ml-training-data", projectPath: "machine-learning-basics/training-data.py" },
        { lessonId: "ml-linear-regression", projectPath: "machine-learning-basics/linear-regression.py" },
        { lessonId: "ml-gradient-descent", projectPath: "machine-learning-basics/gradient-descent.py" },
        { lessonId: "ml-binary-classification", projectPath: "machine-learning-basics/binary-classification.py" },
        { lessonId: "ml-neural-networks", projectPath: "machine-learning-basics/neural-networks.py" },
      ],
    },
  ],
} as const);
