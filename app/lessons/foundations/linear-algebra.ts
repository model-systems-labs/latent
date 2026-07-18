import { defineFoundationLesson } from "./define-foundation-lesson";

const numpyBasicsSource = {
  role: "Guide" as const,
  title: "NumPy: the absolute basics for beginners",
  authors: "NumPy Developers",
  year: "Current",
  url: "https://numpy.org/doc/stable/user/absolute_beginners.html",
  relevance: "Introduces arrays, axes, shapes, indexing, and basic array operations.",
};

const d2lLinearAlgebraSource = {
  role: "Guide" as const,
  title: "Dive into Deep Learning: Linear Algebra",
  authors: "Aston Zhang, Zachary C. Lipton, Mu Li, Alexander J. Smola",
  year: "2023",
  url: "https://d2l.ai/chapter_preliminaries/linear-algebra.html",
  relevance: "Connects vectors, dot products, norms, and matrix products to neural networks.",
};

const mathematicsForMlSource = {
  role: "Guide" as const,
  title: "Mathematics for Machine Learning",
  authors: "Marc Peter Deisenroth, A. Aldo Faisal, Cheng Soon Ong",
  year: "2020",
  url: "https://mml-book.github.io/",
  relevance: "Provides a beginner-oriented mathematical foundation for machine learning.",
};

const numpyMatmulSource = {
  role: "Specification" as const,
  title: "numpy.matmul",
  authors: "NumPy Developers",
  year: "Current",
  url: "https://numpy.org/doc/stable/reference/generated/numpy.matmul.html",
  relevance: "Defines NumPy's matrix multiplication behavior and shape rules.",
};

const numpyBroadcastingSource = {
  role: "Guide" as const,
  title: "NumPy broadcasting",
  authors: "NumPy Developers",
  year: "Current",
  url: "https://numpy.org/doc/stable/user/basics.broadcasting.html",
  relevance: "Explains how NumPy combines arrays with compatible shapes.",
};

const foundationIdentity = {
  courseId: "linear-algebra",
  programId: "linear-algebra",
  courseTitle: "Linear Algebra Basics",
  courseNumber: 1,
} as const;

export const arraysAndShapesLesson = defineFoundationLesson({
  ...foundationIdentity,
  id: "arrays-and-shapes",
  number: 1,
  lessonNumber: 1,
  eyebrow: "Arrays · Axes · Shape",
  title: "Arrays and Shapes",
  thesis: "An array is a group of numbers plus a shape that tells you how those numbers are arranged.",
  sources: [numpyBasicsSource, d2lLinearAlgebraSource],
  summary: [
    {
      label: "Arrays store numbers.",
      body: "A scalar holds one number. A vector is one ordered row of numbers. A matrix arranges numbers in rows and columns. NumPy represents all three with arrays.",
    },
    {
      label: "Shape names the axes.",
      body: "The shape (2, 3) means two rows and three columns. An array's rank is the number of axes, so that matrix has rank 2 and contains six values.",
    },
    {
      label: "Axis meaning comes from the data.",
      body: "In an LLM, a matrix might use one row per token and one column per feature. The numbers alone do not tell you that; the surrounding code gives each axis its meaning.",
    },
    {
      label: "Reshape keeps the values.",
      body: "Reshaping changes the arrangement, not the number of entries. Six values can become a 2 by 3 matrix, but they cannot become a 4 by 2 matrix without adding two more values.",
    },
  ],
  diagram: {
    title: "Rank and shape",
    caption: "Rank counts axes. Shape gives the length of each axis in order.",
    nodes: [
      { label: "Scalar", value: "7 → rank 0 · shape ()" },
      { label: "Vector", value: "[7, 2, 4] → rank 1 · shape (3,)" },
      { label: "Matrix", value: "[[1, 2, 3], [4, 5, 6]] → rank 2 · shape (2, 3)" },
      { label: "Token tensor", value: "2 batches × 3 tokens × 4 features → shape (2, 3, 4)" },
    ],
  },
  dataset: {
    name: "Small arrays",
    source: "Course-authored synthetic examples",
    license: "Not separately licensed",
    size: "6 fixed numerical examples",
    preview: "7 · [3, 1, 4] · [[1, 2], [3, 4]]",
  },
  implementation: {
    filename: "arrays-and-shapes.py",
    intro: "Describe an array, then reshape a flat list without changing its values.",
    tensorOps: ["numpy", "np.asarray", "ndim", "shape", "size", "reshape", "tolist"],
    codeBlocks: [
      {
        id: "describe-array",
        label: "Describe an array",
        purpose: "Return the rank, shape, and total number of values in an array.",
        concepts: [
          { name: "ndim", detail: "The number of axes in the array." },
          { name: "shape", detail: "The length of each axis, in order." },
          { name: "size", detail: "The total number of stored values." },
        ],
        code: `import numpy as np

def describe_array(values):
    array = np.asarray(values)
    return {
        "rank": int(array.ndim),
        "shape": [int(length) for length in array.shape],
        "size": int(array.size),
    }`,
        checkCode: `description = describe_array([[1, 2, 3], [4, 5, 6]])
RESULT = {
    "passed": description == {"rank": 2, "shape": [2, 3], "size": 6},
    "detail": f"rank {description['rank']} · shape {description['shape']} · size {description['size']}",
}`,
      },
      {
        id: "reshape-array",
        label: "Reshape an array",
        purpose: "Arrange the same values into a new valid shape.",
        concepts: [
          { name: "requested shape", detail: "A list containing the length of each new axis." },
          { name: "value count", detail: "The old and new shapes must contain the same number of entries." },
          { name: "tolist", detail: "Turns the NumPy result back into regular nested Python lists." },
        ],
        code: `import numpy as np

def reshape_array(values, shape):
    array = np.asarray(values)
    if (
        not isinstance(shape, (list, tuple))
        or not shape
        or any(type(length) is not int or length <= 0 for length in shape)
    ):
        raise ValueError("shape must contain positive integers")
    requested = tuple(shape)
    requested_size = int(np.prod(requested))
    if requested_size != int(array.size):
        raise ValueError("shape must preserve the number of values")
    return array.reshape(requested).tolist()`,
        checkCode: `reshaped = reshape_array([1, 2, 3, 4, 5, 6], [2, 3])
RESULT = {
    "passed": reshaped == [[1, 2, 3], [4, 5, 6]],
    "detail": f"shape = {np.asarray(reshaped).shape}",
}`,
      },
    ],
  },
  experiment: {
    variant: "array-shapes",
    title: "Inspect array shapes",
    intro: "Compare a scalar, vector, matrix, and token tensor by rank, shape, and value count.",
  },
});

export const vectorOperationsLesson = defineFoundationLesson({
  ...foundationIdentity,
  id: "vector-operations",
  number: 2,
  lessonNumber: 2,
  eyebrow: "Vectors · Addition · Length",
  title: "Vector Operations",
  thesis: "A vector is an ordered list of coordinates that can be combined and measured.",
  sources: [d2lLinearAlgebraSource, mathematicsForMlSource],
  summary: [
    {
      label: "Order matters.",
      body: "The vector [2, 5] is different from [5, 2]. Each position represents one feature, and matching positions must refer to the same kind of feature.",
    },
    {
      label: "Addition is coordinate by coordinate.",
      body: "To add [1, 2] and [3, 4], add the first coordinates and then the second coordinates. The result is [4, 6]. Vectors need the same shape for this operation.",
    },
    {
      label: "Scaling changes every coordinate.",
      body: "Multiplying [1, -2] by 3 gives [3, -6]. The direction stays the same when the scale is positive, while the length is multiplied by the absolute value of the scale.",
    },
    {
      label: "The L2 norm measures length.",
      body: "Square every coordinate, add the squares, and take the square root. The vector [3, 4] has length 5 because 3 squared plus 4 squared equals 25.",
    },
  ],
  diagram: {
    title: "Coordinate operations",
    caption: "Vector operations use matching positions, while the norm combines every position into one length.",
    nodes: [
      { label: "Add", value: "[1, 2] + [3, 4] = [4, 6]" },
      { label: "Scale", value: "3 × [1, −2] = [3, −6]" },
      { label: "Square", value: "[3, 4]² = [9, 16]" },
      { label: "Length", value: "√(9 + 16) = 5" },
    ],
  },
  dataset: {
    name: "Two- and three-coordinate vectors",
    source: "Course-authored synthetic examples",
    license: "Not separately licensed",
    size: "8 fixed numerical examples",
    preview: "[1, 2] · [3, 4] · [−2, −3, −6]",
  },
  implementation: {
    filename: "vector-operations.py",
    intro: "Add equal-length vectors and compute the L2 length of a vector.",
    tensorOps: ["numpy", "np.asarray", "np.sum", "np.sqrt", "tolist"],
    codeBlocks: [
      {
        id: "add-vectors",
        label: "Add vectors",
        purpose: "Add two vectors one coordinate at a time.",
        concepts: [
          { name: "left and right", detail: "Two one-dimensional arrays with the same length." },
          { name: "shape check", detail: "Stops the operation when coordinates do not line up." },
          { name: "result", detail: "One sum for every matching pair of coordinates." },
        ],
        code: `import numpy as np

def add_vectors(left, right):
    left_values = np.asarray(left, dtype=float)
    right_values = np.asarray(right, dtype=float)
    if left_values.ndim != 1 or right_values.ndim != 1:
        raise ValueError("add_vectors needs two vectors")
    if left_values.shape != right_values.shape:
        raise ValueError("vectors must have the same shape")
    return (left_values + right_values).tolist()`,
        checkCode: `total = add_vectors([1, 2, 3], [4, -2, 0])
RESULT = {
    "passed": total == [5, 0, 3],
    "detail": f"sum = {total}",
}`,
      },
      {
        id: "l2-norm",
        label: "Vector length",
        purpose: "Compute a vector's L2 norm from the sum of its squared coordinates.",
        concepts: [
          { name: "squares", detail: "Negative and positive coordinates both contribute positive amounts." },
          { name: "sum", detail: "Combines every squared coordinate into one value." },
          { name: "square root", detail: "Turns the sum of squares into the vector's length." },
        ],
        code: `import numpy as np

def l2_norm(vector):
    values = np.asarray(vector, dtype=float)
    if values.ndim != 1:
        raise ValueError("l2_norm needs a vector")
    return float(np.sqrt(np.sum(values * values)))`,
        checkCode: `length = l2_norm([3, 4])
RESULT = {
    "passed": abs(length - 5) < 1e-9,
    "detail": f"length = {length:g}",
}`,
      },
    ],
  },
  experiment: {
    variant: "vector-operations",
    title: "Compare vector lengths",
    intro: "Change two coordinates and see how addition, scaling, and length respond.",
  },
});

export const dotProductsLesson = defineFoundationLesson({
  ...foundationIdentity,
  id: "dot-products",
  number: 3,
  lessonNumber: 3,
  eyebrow: "Dot Product · Norm · Cosine",
  title: "Dot Products",
  thesis: "A dot product turns two equal-length vectors into one number that reflects how their coordinates line up.",
  sources: [d2lLinearAlgebraSource, mathematicsForMlSource],
  summary: [
    {
      label: "Multiply, then add.",
      body: "For [1, 2] and [3, 4], multiply matching coordinates and add the results: 1 times 3 plus 2 times 4 equals 11. The output is one number, not another vector.",
    },
    {
      label: "The sign describes alignment.",
      body: "A positive dot product means the vectors generally point together. Zero means they are perpendicular in the geometric picture. A negative result means they point against each other.",
    },
    {
      label: "Magnitude affects the dot product.",
      body: "A long vector can produce a larger dot product than a short vector even when both point in the same direction. That is useful for weighted sums but inconvenient when you only want to compare direction.",
    },
    {
      label: "Cosine similarity removes length.",
      body: "Divide the dot product by both vector lengths. The result is 1 for the same direction, 0 for perpendicular directions, and -1 for opposite directions. Attention starts from related dot-product comparisons before adding scaling and softmax.",
    },
  ],
  diagram: {
    title: "Dot product and cosine",
    caption: "The dot product combines matching coordinates. Cosine similarity then divides out both lengths.",
    nodes: [
      { label: "Products", value: "[1, 2] · [3, 4] → [1×3, 2×4]" },
      { label: "Sum", value: "3 + 8 = 11" },
      { label: "Normalize", value: "cosine = dot / (length₁ × length₂)" },
      { label: "Range", value: "opposite −1 · perpendicular 0 · aligned 1" },
    ],
  },
  dataset: {
    name: "Vector pairs",
    source: "Course-authored synthetic examples",
    license: "Not separately licensed",
    size: "9 fixed vector pairs",
    preview: "aligned · perpendicular · opposite · unequal lengths",
  },
  implementation: {
    filename: "dot-products.py",
    intro: "Compute a dot product, then normalize it into cosine similarity.",
    tensorOps: ["numpy", "np.asarray", "np.sum", "np.sqrt"],
    codeBlocks: [
      {
        id: "dot-product",
        label: "Dot product",
        purpose: "Multiply matching coordinates and add them into one number.",
        concepts: [
          { name: "matching coordinates", detail: "Both vectors need the same one-dimensional shape." },
          { name: "elementwise product", detail: "Multiplies each coordinate by the coordinate in the same position." },
          { name: "sum", detail: "Combines those products into one scalar." },
        ],
        code: `import numpy as np

def dot_product(left, right):
    left_values = np.asarray(left, dtype=float)
    right_values = np.asarray(right, dtype=float)
    if left_values.ndim != 1 or right_values.ndim != 1:
        raise ValueError("dot_product needs two vectors")
    if left_values.shape != right_values.shape:
        raise ValueError("vectors must have the same shape")
    return float(np.sum(left_values * right_values))`,
        checkCode: `value = dot_product([1, 2, 3], [4, -1, 2])
RESULT = {
    "passed": abs(value - 8) < 1e-9,
    "detail": f"dot product = {value:g}",
}`,
      },
      {
        id: "cosine-similarity",
        label: "Cosine similarity",
        purpose: "Compare vector direction after dividing out both vector lengths.",
        concepts: [
          { name: "numerator", detail: "The dot product of the two vectors." },
          { name: "denominator", detail: "The first length multiplied by the second length." },
          { name: "zero vector", detail: "A vector with no length has no direction, so cosine is undefined." },
        ],
        code: `import numpy as np

def cosine_similarity(left, right):
    left_values = np.asarray(left, dtype=float)
    right_values = np.asarray(right, dtype=float)
    if left_values.ndim != 1 or right_values.ndim != 1:
        raise ValueError("cosine_similarity needs two vectors")
    if left_values.shape != right_values.shape:
        raise ValueError("vectors must have the same shape")
    left_length = float(np.sqrt(np.sum(left_values * left_values)))
    right_length = float(np.sqrt(np.sum(right_values * right_values)))
    if left_length == 0 or right_length == 0:
        raise ValueError("cosine similarity needs nonzero vectors")
    dot = float(np.sum(left_values * right_values))
    return dot / (left_length * right_length)`,
        checkCode: `similarity = cosine_similarity([1, 2], [2, 4])
RESULT = {
    "passed": abs(similarity - 1) < 1e-9,
    "detail": f"cosine = {similarity:.3f}",
}`,
      },
    ],
  },
  experiment: {
    variant: "dot-products",
    title: "Compare vector direction",
    intro: "Rotate and resize two small vectors, then compare their dot product and cosine similarity.",
  },
});

export const matrixMultiplicationLesson = defineFoundationLesson({
  ...foundationIdentity,
  id: "matrix-multiplication",
  number: 4,
  lessonNumber: 4,
  eyebrow: "Matrices · Rows · Linear Layers",
  title: "Matrix Multiplication",
  thesis: "A matrix transforms a vector by taking one dot product for each matrix row.",
  sources: [d2lLinearAlgebraSource, numpyMatmulSource],
  summary: [
    {
      label: "Each row makes one output.",
      body: "Multiply the first matrix row by the vector and add the products to get the first output. Repeat with every row. A matrix with three rows therefore produces a vector with three entries.",
    },
    {
      label: "The inner sizes must match.",
      body: "A matrix with shape (3, 2) can multiply a vector with shape (2,). The shared size 2 supplies the matching coordinates for each row's dot product, and the result has shape (3,).",
    },
    {
      label: "A matrix can change width.",
      body: "The input and output do not need the same number of coordinates. Neural networks use rectangular weight matrices to map one feature width to another.",
    },
    {
      label: "A linear layer adds bias.",
      body: "The common calculation is W times x plus b. The weight matrix mixes input coordinates, and the bias adds one learned offset to each output coordinate.",
    },
  ],
  diagram: {
    title: "One row, one output",
    caption: "The shared inner width lines up the vector with every matrix row.",
    nodes: [
      { label: "Inputs", value: "W shape (3, 2) · x shape (2,)" },
      { label: "First output", value: "row₁ · x" },
      { label: "All outputs", value: "[row₁ · x, row₂ · x, row₃ · x]" },
      { label: "Linear layer", value: "W @ x + b → shape (3,)" },
    ],
  },
  dataset: {
    name: "Small weight matrices",
    source: "Course-authored synthetic examples",
    license: "Not separately licensed",
    size: "8 fixed matrix and vector combinations",
    preview: "identity · rectangular · mixed coordinates · bias",
  },
  implementation: {
    filename: "matrix-multiplication.py",
    intro: "Apply a matrix to one vector, then add the bias used by a linear layer.",
    tensorOps: ["numpy", "np.asarray", "np.matmul", "tolist"],
    codeBlocks: [
      {
        id: "matrix-vector-product",
        label: "Matrix-vector product",
        purpose: "Produce one output value from each row of a matrix.",
        concepts: [
          { name: "matrix", detail: "A two-dimensional array whose rows each match the vector width." },
          { name: "vector", detail: "The one-dimensional input shared by every matrix row." },
          { name: "output", detail: "One dot product for each matrix row." },
        ],
        code: `import numpy as np

def matrix_vector_product(matrix, vector):
    matrix_values = np.asarray(matrix, dtype=float)
    vector_values = np.asarray(vector, dtype=float)
    if matrix_values.ndim != 2 or vector_values.ndim != 1:
        raise ValueError("matrix_vector_product needs a matrix and a vector")
    if matrix_values.shape[1] != vector_values.shape[0]:
        raise ValueError("matrix columns must match vector length")
    return np.matmul(matrix_values, vector_values).tolist()`,
        checkCode: `output = matrix_vector_product([[1, 2], [3, 4], [5, 6]], [2, -1])
RESULT = {
    "passed": output == [0, 2, 4],
    "detail": f"output = {output}",
}`,
      },
      {
        id: "linear-layer",
        label: "Linear layer",
        purpose: "Apply a weight matrix and add one bias value to every output coordinate.",
        concepts: [
          { name: "weights", detail: "An output-by-input matrix that mixes the input coordinates." },
          { name: "bias", detail: "One offset for each output row." },
          { name: "Wx + b", detail: "The basic numerical operation inside a neural-network layer." },
        ],
        code: `import numpy as np

def linear_layer(vector, weights, bias):
    vector_values = np.asarray(vector, dtype=float)
    weight_values = np.asarray(weights, dtype=float)
    bias_values = np.asarray(bias, dtype=float)
    if vector_values.ndim != 1 or weight_values.ndim != 2 or bias_values.ndim != 1:
        raise ValueError("linear_layer needs a vector, weight matrix, and bias vector")
    if weight_values.shape[1] != vector_values.shape[0]:
        raise ValueError("weight input width must match vector length")
    if weight_values.shape[0] != bias_values.shape[0]:
        raise ValueError("bias length must match weight output width")
    return (np.matmul(weight_values, vector_values) + bias_values).tolist()`,
        checkCode: `output = linear_layer([2, -1], [[1, 2], [-3, 0.5]], [0.5, 1])
RESULT = {
    "passed": output == [0.5, -5.5],
    "detail": f"Wx + b = {output}",
}`,
      },
    ],
  },
  experiment: {
    variant: "matrix-multiplication",
    title: "Transform one vector",
    intro: "Change a small matrix and see how each row changes one output coordinate.",
  },
});

export const batchesAndBroadcastingLesson = defineFoundationLesson({
  ...foundationIdentity,
  id: "batches-and-broadcasting",
  number: 5,
  lessonNumber: 5,
  eyebrow: "Batches · Shared Weights · Broadcasting",
  title: "Batches and Broadcasting",
  thesis: "A batch stores several vectors as rows so the same operation can run on all of them at once.",
  sources: [numpyBroadcastingSource, numpyMatmulSource, d2lLinearAlgebraSource],
  summary: [
    {
      label: "Rows can hold separate vectors.",
      body: "A matrix with shape (5, 4) can represent five vectors with four features each. In an LLM, those five rows might represent five token positions.",
    },
    {
      label: "Weights are shared across the batch.",
      body: "A batched linear layer applies the same weight matrix to every input row. The operation is faster and clearer than writing a separate Python loop for each vector.",
    },
    {
      label: "Broadcasting reuses a smaller array.",
      body: "Adding a bias with shape (3,) to a result with shape (5, 3) adds the same three bias values to every row. NumPy performs that repeated addition without making you copy the bias five times.",
    },
    {
      label: "Track the output shape.",
      body: "Inputs with shape (batch, input width) and weights with shape (output width, input width) produce (batch, output width). The batch size stays the same while the feature width changes.",
    },
  ],
  diagram: {
    title: "One transformation across a batch",
    caption: "The input width lines up with the weight width. The bias lines up with the output width.",
    nodes: [
      { label: "Input rows", value: "X shape (5, 4)" },
      { label: "Shared weights", value: "W shape (3, 4)" },
      { label: "Matrix product", value: "X @ Wᵀ → shape (5, 3)" },
      { label: "Broadcast bias", value: "+ b shape (3,) → output shape (5, 3)" },
    ],
  },
  dataset: {
    name: "Small vector batches",
    source: "Course-authored synthetic examples",
    license: "Not separately licensed",
    size: "7 fixed batch and bias examples",
    preview: "two vectors · shared weights · one repeated bias",
  },
  implementation: {
    filename: "batches-and-broadcasting.py",
    intro: "Add one bias to every row, then run a complete batched linear layer.",
    tensorOps: ["numpy", "np.asarray", "np.matmul", "transpose", "tolist"],
    codeBlocks: [
      {
        id: "add-row-bias",
        label: "Broadcast a row bias",
        purpose: "Add the same bias vector to every row in a matrix.",
        concepts: [
          { name: "rows", detail: "A two-dimensional array with one vector per row." },
          { name: "bias", detail: "A one-dimensional array matching the number of columns." },
          { name: "broadcast", detail: "NumPy reuses the bias for every row without changing its stored shape." },
        ],
        code: `import numpy as np

def add_row_bias(rows, bias):
    row_values = np.asarray(rows, dtype=float)
    bias_values = np.asarray(bias, dtype=float)
    if row_values.ndim != 2 or bias_values.ndim != 1:
        raise ValueError("add_row_bias needs a matrix and a vector")
    if row_values.shape[1] != bias_values.shape[0]:
        raise ValueError("bias length must match row width")
    return (row_values + bias_values).tolist()`,
        checkCode: `shifted = add_row_bias([[1, 2], [3, 4]], [10, -1])
RESULT = {
    "passed": shifted == [[11, 1], [13, 3]],
    "detail": f"shifted rows = {shifted}",
}`,
      },
      {
        id: "batch-linear",
        label: "Batched linear layer",
        purpose: "Apply one weight matrix and one bias vector to every input row.",
        concepts: [
          { name: "inputs", detail: "A batch-by-input-width matrix." },
          { name: "weights.T", detail: "Turns output-by-input weights so the inner dimensions line up." },
          { name: "output", detail: "A batch-by-output-width matrix with one transformed row per input." },
        ],
        code: `import numpy as np

def batch_linear(inputs, weights, bias):
    input_values = np.asarray(inputs, dtype=float)
    weight_values = np.asarray(weights, dtype=float)
    bias_values = np.asarray(bias, dtype=float)
    if input_values.ndim != 2 or weight_values.ndim != 2 or bias_values.ndim != 1:
        raise ValueError("batch_linear needs input and weight matrices plus a bias vector")
    if input_values.shape[1] != weight_values.shape[1]:
        raise ValueError("input width must match weight input width")
    if weight_values.shape[0] != bias_values.shape[0]:
        raise ValueError("bias length must match weight output width")
    projected = np.matmul(input_values, weight_values.T)
    return (projected + bias_values).tolist()`,
        checkCode: `output = batch_linear(
    [[1, 0], [0, 1]],
    [[1, 2], [3, 4]],
    [10, 20],
)
RESULT = {
    "passed": output == [[11, 23], [12, 24]],
    "detail": f"output shape = {np.asarray(output).shape}",
}`,
      },
    ],
  },
  experiment: {
    variant: "batches-and-broadcasting",
    title: "Run one layer across a batch",
    intro: "Compare one vector with several rows that all use the same weights and bias.",
  },
});

export const linearAlgebraLessons = [
  arraysAndShapesLesson,
  vectorOperationsLesson,
  dotProductsLesson,
  matrixMultiplicationLesson,
  batchesAndBroadcastingLesson,
] as const;
