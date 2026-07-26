import { defineFoundationLesson } from "@/examples/learning-platform/llm-learning/lessons/foundations/define-foundation-lesson";

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
      body: "A scalar holds one number. A vector is one ordered list of numbers. A matrix is a list of equal-length rows. Array libraries can store all three, but their structure can be understood with ordinary Python first.",
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
    intro: "Build shape information from nested lists, then rearrange values by calculating row boundaries yourself.",
    tensorOps: ["Python", "lists", "isinstance", "slicing"],
    codeBlocks: [
      {
        id: "describe-array",
        label: "Describe an array",
        purpose: "Return the rank, shape, and total number of values in an array.",
        concepts: [
          { name: "classify", detail: "A number has no axes, a flat list has one, and a list of equal-length rows has two." },
          { name: "shape", detail: "For a matrix, count the outer rows first and the values in one row second." },
          { name: "size", detail: "Multiply the axis lengths; a scalar is the special one-value case." },
        ],
        starterCode: `def describe_array(values):
    # First decide whether values is a scalar, vector, or matrix.
    if not isinstance(values, (list, tuple)):
        shape = []
    elif not values or not isinstance(values[0], (list, tuple)):
        shape = [len(values)]
    else:
        row_width = len(values[0])
        if any(not isinstance(row, (list, tuple)) or len(row) != row_width for row in values):
            raise ValueError("matrix rows must have the same length")
        shape = [len(values), row_width]

    # TODO: derive rank and size from shape, then return all three fields.
    raise NotImplementedError("Return rank, shape, and size")`,
        code: `def describe_array(values):
    if not isinstance(values, (list, tuple)):
        shape = []
    elif not values or not isinstance(values[0], (list, tuple)):
        shape = [len(values)]
    else:
        row_width = len(values[0])
        if any(not isinstance(row, (list, tuple)) or len(row) != row_width for row in values):
            raise ValueError("matrix rows must have the same length")
        shape = [len(values), row_width]

    size = 1
    for axis_length in shape:
        size *= axis_length
    return {"rank": len(shape), "shape": shape, "size": size}`,
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
          { name: "rows × columns", detail: "The requested two-dimensional shape says how many rows to make and how many values go in each row." },
          { name: "value count", detail: "rows multiplied by columns must equal the number of input values." },
          { name: "slicing", detail: "Row r starts at r × columns and stops columns positions later." },
        ],
        starterCode: `def reshape_array(values, shape):
    if len(shape) != 2 or any(type(length) is not int or length <= 0 for length in shape):
        raise ValueError("shape must be [positive rows, positive columns]")
    rows, columns = shape
    if rows * columns != len(values):
        raise ValueError("shape must preserve the number of values")

    reshaped = []
    for row_index in range(rows):
        start = row_index * columns
        # TODO: append the columns values beginning at start.
        raise NotImplementedError("Build each row from the flat input")
    return reshaped`,
        code: `def reshape_array(values, shape):
    if len(shape) != 2 or any(type(length) is not int or length <= 0 for length in shape):
        raise ValueError("shape must be [positive rows, positive columns]")
    rows, columns = shape
    if rows * columns != len(values):
        raise ValueError("shape must preserve the number of values")

    reshaped = []
    for row_index in range(rows):
        start = row_index * columns
        reshaped.append(list(values[start:start + columns]))
    return reshaped`,
        checkCode: `reshaped = reshape_array([1, 2, 3, 4, 5, 6], [2, 3])
RESULT = {
    "passed": reshaped == [[1, 2, 3], [4, 5, 6]],
    "detail": f"shape = ({len(reshaped)}, {len(reshaped[0])})",
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
    intro: "Use an index to combine matching coordinates, then use an accumulator to measure vector length.",
    tensorOps: ["Python", "lists", "loops", "math.sqrt"],
    codeBlocks: [
      {
        id: "add-vectors",
        label: "Add vectors",
        purpose: "Add two vectors one coordinate at a time.",
        concepts: [
          { name: "same index", detail: "Coordinate i in the result comes from left[i] + right[i]." },
          { name: "length check", detail: "Equal lengths guarantee every coordinate has a matching partner." },
          { name: "result list", detail: "Append one sum during each pass through the loop." },
        ],
        starterCode: `def add_vectors(left, right):
    if len(left) != len(right):
        raise ValueError("vectors must have the same length")

    result = []
    for index in range(len(left)):
        # TODO: add the two coordinates at index and append the sum.
        raise NotImplementedError("Add one pair of coordinates")
    return result`,
        code: `def add_vectors(left, right):
    if len(left) != len(right):
        raise ValueError("vectors must have the same length")

    result = []
    for index in range(len(left)):
        result.append(float(left[index]) + float(right[index]))
    return result`,
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
          { name: "accumulator", detail: "Start at zero and add coordinate × coordinate on every pass." },
          { name: "squares", detail: "Negative and positive coordinates both contribute positive amounts." },
          { name: "square root", detail: "Apply sqrt only after every squared coordinate has been added." },
        ],
        starterCode: `from math import sqrt

def l2_norm(vector):
    squared_total = 0.0
    for coordinate in vector:
        # TODO: add this coordinate's square to squared_total.
        raise NotImplementedError("Accumulate squared coordinates")
    return sqrt(squared_total)`,
        code: `from math import sqrt

def l2_norm(vector):
    squared_total = 0.0
    for coordinate in vector:
        squared_total += float(coordinate) * float(coordinate)
    return sqrt(squared_total)`,
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
    intro: "Write the multiply-then-add loop directly, then reuse the same three accumulators to compare direction.",
    tensorOps: ["Python", "lists", "loops", "math.sqrt"],
    codeBlocks: [
      {
        id: "dot-product",
        label: "Dot product",
        purpose: "Multiply matching coordinates and add them into one number.",
        concepts: [
          { name: "index", detail: "Use one index to read the matching coordinate from both vectors." },
          { name: "product", detail: "At index i, calculate left[i] × right[i]." },
          { name: "running total", detail: "Add each product to one accumulator; after the loop, that scalar is the dot product." },
        ],
        starterCode: `def dot_product(left, right):
    if len(left) != len(right):
        raise ValueError("vectors must have the same length")

    total = 0.0
    for index in range(len(left)):
        # TODO: multiply the matching coordinates and add the product to total.
        raise NotImplementedError("Accumulate one coordinate product")
    return total`,
        code: `def dot_product(left, right):
    if len(left) != len(right):
        raise ValueError("vectors must have the same length")

    total = 0.0
    for index in range(len(left)):
        total += float(left[index]) * float(right[index])
    return total`,
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
          { name: "one pass", detail: "Each coordinate pair contributes to the dot product and to both squared lengths." },
          { name: "denominator", detail: "Take both square roots, then multiply the two lengths." },
          { name: "zero vector", detail: "A vector with no length has no direction, so cosine is undefined." },
        ],
        starterCode: `from math import sqrt

def cosine_similarity(left, right):
    if len(left) != len(right):
        raise ValueError("vectors must have the same length")

    dot = 0.0
    left_squared = 0.0
    right_squared = 0.0
    for index in range(len(left)):
        # TODO: update all three accumulators from this coordinate pair.
        raise NotImplementedError("Accumulate dot product and squared lengths")

    left_length = sqrt(left_squared)
    right_length = sqrt(right_squared)
    if left_length == 0 or right_length == 0:
        raise ValueError("cosine similarity needs nonzero vectors")
    return dot / (left_length * right_length)`,
        code: `from math import sqrt

def cosine_similarity(left, right):
    if len(left) != len(right):
        raise ValueError("vectors must have the same length")

    dot = 0.0
    left_squared = 0.0
    right_squared = 0.0
    for index in range(len(left)):
        left_coordinate = float(left[index])
        right_coordinate = float(right[index])
        dot += left_coordinate * right_coordinate
        left_squared += left_coordinate * left_coordinate
        right_squared += right_coordinate * right_coordinate

    left_length = sqrt(left_squared)
    right_length = sqrt(right_squared)
    if left_length == 0 or right_length == 0:
        raise ValueError("cosine similarity needs nonzero vectors")
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
  sources: [d2lLinearAlgebraSource, mathematicsForMlSource, numpyMatmulSource],
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
    intro: "Treat each matrix row as a vector: multiply matching coordinates, add them, and emit one result per row.",
    tensorOps: ["Python", "nested lists", "nested loops", "accumulators"],
    codeBlocks: [
      {
        id: "matrix-vector-product",
        label: "Matrix-vector product",
        purpose: "Produce one output value from each row of a matrix.",
        concepts: [
          { name: "outer loop", detail: "Visit one matrix row at a time; each row creates one output coordinate." },
          { name: "inner loop", detail: "Multiply row[column] by vector[column] and add it to that row's total." },
          { name: "output", detail: "Append the completed row total before moving to the next row." },
        ],
        starterCode: `def matrix_vector_product(matrix, vector):
    if any(len(row) != len(vector) for row in matrix):
        raise ValueError("matrix columns must match vector length")

    output = []
    for row in matrix:
        row_total = 0.0
        for column in range(len(vector)):
            # TODO: add row[column] * vector[column] to row_total.
            raise NotImplementedError("Accumulate one row's dot product")
        output.append(row_total)
    return output`,
        code: `def matrix_vector_product(matrix, vector):
    if any(len(row) != len(vector) for row in matrix):
        raise ValueError("matrix columns must match vector length")

    output = []
    for row in matrix:
        row_total = 0.0
        for column in range(len(vector)):
            row_total += float(row[column]) * float(vector[column])
        output.append(row_total)
    return output`,
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
          { name: "weight row", detail: "Each row contains all weights used to calculate one output coordinate." },
          { name: "bias", detail: "After finishing a row's dot product, add the bias at the same output index." },
          { name: "Wx + b", detail: "The nested loops calculate Wx explicitly; the final addition supplies b." },
        ],
        starterCode: `def linear_layer(vector, weights, bias):
    if len(weights) != len(bias):
        raise ValueError("bias length must match the number of outputs")
    if any(len(row) != len(vector) for row in weights):
        raise ValueError("weight rows must match vector length")

    output = []
    for output_index, weight_row in enumerate(weights):
        weighted_sum = 0.0
        for input_index in range(len(vector)):
            # TODO: add this input times its weight to weighted_sum.
            raise NotImplementedError("Accumulate the weighted inputs")
        output.append(weighted_sum + float(bias[output_index]))
    return output`,
        code: `def linear_layer(vector, weights, bias):
    if len(weights) != len(bias):
        raise ValueError("bias length must match the number of outputs")
    if any(len(row) != len(vector) for row in weights):
        raise ValueError("weight rows must match vector length")

    output = []
    for output_index, weight_row in enumerate(weights):
        weighted_sum = 0.0
        for input_index in range(len(vector)):
            weighted_sum += float(weight_row[input_index]) * float(vector[input_index])
        output.append(weighted_sum + float(bias[output_index]))
    return output`,
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
  thesis: "A batch applies one learned rule, y = W x + b, to several vectors; broadcasting adds the same output bias to every row.",
  sources: [d2lLinearAlgebraSource, numpyBroadcastingSource, numpyMatmulSource],
  summary: [
    {
      label: "Rows can hold separate vectors.",
      body: "A matrix with shape (5, 4) can represent five vectors with four features each. In an LLM, those five rows might represent five token positions.",
    },
    {
      label: "Bias sets the output baseline.",
      body: "Weights determine how the input values change each output. Bias determines where each output starts. If an input row is all zeros, W x is zero and the layer returns b, so a layer with three outputs needs three learned bias values.",
    },
    {
      label: "The whole layer is shared across the batch.",
      body: "Every row uses the same weight matrix and the same bias vector. A batch of five rows is not five separately learned layers; it is one layer evaluated five times so every example or token follows the same learned rule.",
    },
    {
      label: "Broadcasting reuses that shared bias.",
      body: "After X @ Wᵀ produces a result with shape (5, 3), bias shape (3,) lines up with the three output columns. Adding it to all five rows applies the same three output baselines. Broadcasting is shorthand for that repeated column-by-column addition.",
    },
    {
      label: "Track the output shape.",
      body: "Inputs with shape (batch, input width) and weights with shape (output width, input width) produce (batch, output width). The batch size stays the same while the feature width changes.",
    },
  ],
  diagram: {
    title: "One shared layer, five input rows",
    caption: "Weights decide how inputs affect each output. Bias sets the three output baselines, and broadcasting reuses those baselines for every row.",
    nodes: [
      { label: "Input rows", value: "X shape (5, 4)" },
      { label: "Shared rule", value: "each row uses y = W x + b" },
      { label: "Weighted result", value: "X @ Wᵀ → five rows × three outputs" },
      { label: "Bias purpose", value: "the same b shape (3,) shifts every output row" },
    ],
  },
  dataset: {
    name: "Small vector batches",
    source: "Course-authored synthetic examples",
    license: "Not separately licensed",
    size: "7 fixed batch and bias examples",
    preview: "zero-input baseline · shared weights · one repeated bias",
  },
  implementation: {
    filename: "batches-and-broadcasting.py",
    intro: "First isolate what bias does by adding it to completed output rows. Then rebuild the full layer and reuse the same weights and output baselines across the batch.",
    tensorOps: ["Python", "nested lists", "nested loops", "shared parameters"],
    codeBlocks: [
      {
        id: "add-row-bias",
        label: "Add one shared bias",
        purpose: "Give every output coordinate its learned baseline by adding the same bias vector to every row.",
        concepts: [
          { name: "baseline", detail: "When a weighted row is all zeros, adding bias makes the output equal to the bias vector." },
          { name: "output coordinate", detail: "Add bias[column] to row[column] because each bias value belongs to one output feature." },
          { name: "shared parameter", detail: "Reuse the same bias for every row; the layer does not learn a different bias for each example." },
        ],
        starterCode: `def add_row_bias(rows, bias):
    if any(len(row) != len(bias) for row in rows):
        raise ValueError("bias length must match every row")

    shifted_rows = []
    for row in rows:
        shifted_row = []
        for column in range(len(bias)):
            # TODO: add the bias at this column to the row value.
            raise NotImplementedError("Shift one coordinate")
        shifted_rows.append(shifted_row)
    return shifted_rows`,
        code: `def add_row_bias(rows, bias):
    if any(len(row) != len(bias) for row in rows):
        raise ValueError("bias length must match every row")

    shifted_rows = []
    for row in rows:
        shifted_row = []
        for column in range(len(bias)):
            shifted_row.append(float(row[column]) + float(bias[column]))
        shifted_rows.append(shifted_row)
    return shifted_rows`,
        checkCode: `shifted = add_row_bias([[0, 0], [3, 4]], [10, -1])
RESULT = {
    "passed": shifted == [[10, -1], [13, 3]],
    "detail": f"shifted rows = {shifted}",
}`,
      },
      {
        id: "batch-linear",
        label: "Batched linear layer",
        purpose: "Apply one weight matrix and one bias vector to every input row.",
        concepts: [
          { name: "inputs", detail: "A batch-by-input-width matrix." },
          { name: "transpose view", detail: "Stored weight rows become output columns in X @ Wᵀ; the loop reads one full weight row per output." },
          { name: "three loops", detail: "Choose an input row, choose an output weight row, then combine their matching coordinates." },
          { name: "output", detail: "Append one transformed row per input while reusing the exact same weights and bias." },
        ],
        starterCode: `def batch_linear(inputs, weights, bias):
    if len(weights) != len(bias):
        raise ValueError("bias length must match the number of outputs")
    if any(len(row) != len(weights[0]) for row in inputs):
        raise ValueError("input rows must match the weight input width")

    outputs = []
    for input_row in inputs:
        output_row = []
        for output_index, weight_row in enumerate(weights):
            weighted_sum = 0.0
            for column in range(len(input_row)):
                # TODO: add input_row[column] * weight_row[column].
                raise NotImplementedError("Accumulate one output coordinate")
            output_row.append(weighted_sum + float(bias[output_index]))
        outputs.append(output_row)
    return outputs`,
        code: `def batch_linear(inputs, weights, bias):
    if len(weights) != len(bias):
        raise ValueError("bias length must match the number of outputs")
    input_width = len(weights[0])
    if any(len(row) != input_width for row in inputs):
        raise ValueError("input rows must match the weight input width")
    if any(len(row) != input_width for row in weights):
        raise ValueError("weight rows must have the same input width")

    outputs = []
    for input_row in inputs:
        output_row = []
        for output_index, weight_row in enumerate(weights):
            weighted_sum = 0.0
            for column in range(input_width):
                weighted_sum += float(input_row[column]) * float(weight_row[column])
            output_row.append(weighted_sum + float(bias[output_index]))
        outputs.append(output_row)
    return outputs`,
        checkCode: `output = batch_linear(
    [[1, 0], [0, 1]],
    [[1, 2], [3, 4]],
    [10, 20],
)
RESULT = {
    "passed": output == [[11, 23], [12, 24]],
    "detail": f"output shape = ({len(output)}, {len(output[0])})",
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
