import {
  combineFlashcardLibraries,
  defineFlashcardGroup,
} from "@/examples/learning-platform/llm-learning/content/flashcard-schema";

const linearArrays = defineFlashcardGroup(
  {
    subjectId: "linear-algebra",
    module: "Linear Algebra Basics",
    lesson: "Arrays and Shapes",
    source: "NumPy Developers, NumPy absolute basics; Zhang et al., Dive into Deep Learning: Linear Algebra (2023).",
  },
  {
    Scalar: {
      definition: "A scalar is one number with no axes, used to represent a single magnitude or setting.",
      details: [
        "A scalar has array rank zero and an empty shape written as ().",
        "Multiplying a vector by a scalar applies the same scale to every coordinate.",
        "Loss values, learning rates, and individual logits are commonly stored as scalars.",
      ],
      example: "The temperature 72 and the learning rate 0.001 are both scalar values.",
    },
    Vector: {
      definition: "A vector is an ordered one-dimensional array whose positions represent specific coordinates or features.",
      details: [
        "Changing coordinate order changes the meaning of the vector, even when the numbers stay the same.",
        "A vector with d coordinates has shape (d,) in the NumPy convention.",
        "Embedding vectors place learned features for one token into a single ordered row.",
      ],
      example: "The vector [18, 0.7, 3] could encode age, click rate, and prior purchases for one user.",
    },
    Matrix: {
      definition: "A matrix is a two-dimensional rectangular array arranged into rows and columns.",
      details: [
        "A matrix with m rows and n columns has shape (m, n) and contains m times n values.",
        "Rows and columns need explicit meanings supplied by the surrounding data and code.",
        "Matrices can store datasets, batches of vectors, or learned linear transformations.",
      ],
      example: "A 5 by 4 matrix can hold five examples, with four feature values in each row.",
    },
    Tensor: {
      definition: "A tensor is an array with any number of axes, generalizing scalars, vectors, and matrices.",
      details: [
        "In software, tensor usually describes the data container rather than a special geometric object.",
        "Each axis needs a declared role such as batch, token, attention head, or feature.",
        "Tensor operations are valid only when their participating axis lengths are compatible.",
      ],
      example: "An activation tensor shaped (8, 128, 768) holds 8 sequences, 128 tokens each, and 768 features per token.",
    },
    Axis: {
      definition: "An axis is one independent direction along which an array is indexed and organized.",
      details: [
        "Axis numbering normally begins at zero, so axis 0 is the first entry in the shape.",
        "Reducing along an axis removes or shortens that dimension while combining its values.",
        "Confusing batch, token, and feature axes is a common source of silent model bugs.",
      ],
      example: "For shape (32, 10, 64), axis 0 can be batch, axis 1 tokens, and axis 2 features.",
    },
    "Array size": {
      definition: "Array size is the total number of stored elements, equal to the product of all axis lengths.",
      details: [
        "A scalar has size one even though it has no axes in its shape.",
        "Any valid reshape must preserve size because it neither creates nor removes values.",
        "Size helps estimate storage cost when it is multiplied by the bytes used per element.",
      ],
      example: "A tensor with shape (2, 3, 4) has size 2 × 3 × 4 = 24 values.",
    },
  },
);

const linearVectorOperations = defineFlashcardGroup(
  {
    subjectId: "linear-algebra",
    module: "Linear Algebra Basics",
    lesson: "Vector Operations",
    source: "Zhang et al., Dive into Deep Learning: Linear Algebra (2023); Deisenroth et al., Mathematics for Machine Learning (2020).",
  },
  {
    Coordinate: {
      definition: "A coordinate is one numbered component of a vector relative to an agreed ordering or basis.",
      details: [
        "The same position must represent the same feature before vectors can be combined meaningfully.",
        "A coordinate value may be positive, negative, or zero without changing the vector shape.",
        "Coordinates change when the basis changes, even if the underlying geometric vector does not.",
      ],
      example: "In [0.2, 1.4, -3], the second coordinate is 1.4 and might represent a learned feature.",
    },
    "Vector addition": {
      definition: "Vector addition combines equal-shaped vectors by adding values at matching coordinates.",
      details: [
        "Equal length is required numerically; meaningful addition also requires the same coordinate system or feature semantics.",
        "Addition is commutative, so swapping the two input vectors leaves the result unchanged.",
        "Geometrically, addition can be pictured by placing one vector at the tip of the other.",
      ],
      example: "Adding [1, 2, -1] and [4, -2, 3] produces [5, 0, 2].",
    },
    "Vector subtraction": {
      definition: "Vector subtraction finds a coordinate-by-coordinate difference between two equal-shaped vectors.",
      details: [
        "The result points from the subtracted vector toward the vector it was subtracted from.",
        "Subtracting a vector from itself always produces the zero vector.",
        "Distances and residual vectors commonly begin with one vector minus another.",
      ],
      example: "The displacement from [2, 1] to [7, 4] is [7, 4] - [2, 1] = [5, 3].",
    },
    "Scalar multiplication": {
      definition: "Scalar multiplication multiplies every vector coordinate by the same single number.",
      details: [
        "A positive scalar preserves direction while changing the vector length proportionally.",
        "A negative scalar reverses direction, and a zero scalar produces the zero vector.",
        "This operation differs from multiplying two vectors coordinate by coordinate.",
      ],
      example: "Multiplying [2, -1, 4] by -3 gives [-6, 3, -12].",
    },
    "Linear combination": {
      definition: "A linear combination adds vectors after multiplying each one by a chosen scalar coefficient.",
      details: [
        "Every result remains in the span of the vectors used to construct it.",
        "It is the general vector construction; a weighted sum is the same calculation viewed as combining named values with weights.",
        "Matrix-vector multiplication forms each output as a linear combination of input coordinates.",
      ],
      example: "Two times [1, 0] plus three times [0, 1] gives the linear combination [2, 3].",
    },
    "Zero vector": {
      definition: "The zero vector has zero in every coordinate and acts as the additive identity for vectors.",
      details: [
        "Adding the zero vector leaves another vector unchanged at every coordinate.",
        "Its norm is zero, so it has no defined direction for cosine similarity.",
        "A zero activation vector can indicate that every unit was suppressed by an activation function.",
      ],
      example: "For three-dimensional vectors, [0, 0, 0] is the zero vector.",
    },
    "L1 norm": {
      definition: "The L1 norm measures vector size by adding the absolute values of all coordinates.",
      details: [
        "Absolute values prevent positive and negative coordinates from cancelling each other.",
        "In two dimensions, L1 geometry produces diamond-shaped equal-distance contours rather than circles.",
        "L1 penalties promote sparse parameters, though exact zeros depend on the full objective and the optimizer or solver.",
      ],
      example: "The L1 norm of [-2, 3, -4] is 2 + 3 + 4 = 9.",
    },
    "Squared L2 norm": {
      definition: "The squared L2 norm adds squared coordinates without taking the final square root.",
      details: [
        "It equals the dot product of a vector with itself.",
        "Removing the square root makes derivatives simpler in many optimization objectives.",
        "It grows quadratically, so large coordinates contribute disproportionately more.",
      ],
      example: "The squared L2 norm of [3, 4] is 3² + 4² = 25.",
    },
    "Unit vector": {
      definition: "A unit vector is any nonzero vector scaled so that its L2 norm equals exactly one.",
      details: [
        "Unit vectors describe direction without carrying the original magnitude.",
        "A unit vector is the resulting object; vector normalization is the operation that produces one.",
        "The zero vector cannot be converted into a unit vector because division by its norm is undefined.",
      ],
      example: "Dividing [3, 4] by 5 produces the unit vector [0.6, 0.8].",
    },
  },
);

const linearGeometry = defineFlashcardGroup(
  {
    subjectId: "linear-algebra",
    module: "Linear Algebra Basics",
    lesson: "Dot Products and Vector Geometry",
    source: "Zhang et al., Dive into Deep Learning: Linear Algebra (2023); Deisenroth et al., Mathematics for Machine Learning (2020).",
  },
  {
    "Vector normalization": {
      definition: "Vector normalization rescales a nonzero vector to unit length while preserving its direction.",
      details: [
        "The usual L2 normalization divides each coordinate by the vector's L2 norm.",
        "Normalization names the operation; the output it creates is a unit vector.",
        "Normalization removes magnitude information, which may or may not be desirable for a task.",
      ],
      example: "Normalizing [0, 5] yields [0, 1], which points the same way with length one.",
    },
    "Euclidean distance": {
      definition: "Euclidean distance is the L2 norm of the difference between two vectors.",
      details: [
        "It measures straight-line separation in the coordinate space.",
        "The result is always non-negative and is zero only for identical vectors.",
        "Feature scales strongly affect the distance unless coordinates are normalized appropriately.",
      ],
      example: "The distance between [1, 1] and [4, 5] is the norm of [3, 4], which is 5.",
    },
    "Vector angle": {
      definition: "The angle between nonzero vectors measures directional separation independently of their lengths.",
      details: [
        "Its cosine equals the dot product divided by the product of both vector norms.",
        "An angle of zero means aligned directions, while 180 degrees means opposite directions.",
        "A right angle gives a zero dot product and indicates orthogonality.",
      ],
      example: "The vectors [1, 0] and [0, 1] form a 90-degree angle.",
    },
    Orthogonality: {
      definition: "Vectors are orthogonal when their dot product is zero; when both are nonzero, this means they meet at a right angle.",
      details: [
        "Orthogonal nonzero vectors carry independent geometric directions.",
        "An orthogonal set is easier to analyze because cross terms disappear in many calculations.",
        "Orthogonality does not require unit length; orthonormal vectors add that requirement.",
      ],
      example: "[2, 0] and [0, -7] are orthogonal because their dot product is zero.",
    },
    "Hadamard product": {
      definition: "The Hadamard product multiplies two equal-shaped arrays element by element.",
      details: [
        "Its output retains the same shape as both inputs.",
        "It is different from a dot product, which sums the coordinate products into one scalar.",
        "Gating mechanisms use elementwise products to scale individual hidden features.",
      ],
      example: "The Hadamard product of [2, 3] and [4, -1] is [8, -3].",
    },
    "Outer product": {
      definition: "The outer product multiplies every coordinate of one vector by every coordinate of another.",
      details: [
        "A length-m vector and length-n vector produce an m-by-n matrix.",
        "Unlike the dot product, the outer product does not require equal vector lengths.",
        "Outer products appear in covariance calculations and rank-one parameter updates.",
      ],
      example: "The outer product of [1, 2] and [3, 4] is [[3, 4], [6, 8]].",
    },
    "Vector projection": {
      definition: "A vector projection extracts the part of one vector that points along another direction.",
      details: [
        "The projection coefficient comes from a dot product divided by the direction's squared norm.",
        "Subtracting the projection leaves a component orthogonal to the chosen direction.",
        "Projection onto a unit vector simplifies to that unit vector times one dot product.",
      ],
      example: "Projecting [3, 4] onto the x-axis [1, 0] produces [3, 0].",
    },
    "Weighted sum": {
      definition: "A weighted sum multiplies each value by a coefficient and adds the resulting products.",
      details: [
        "It is a linear combination described by the roles of its coefficients and values rather than by abstract vectors.",
        "Changing a coefficient changes how strongly its matching value affects the total.",
        "Attention computes weighted sums of value vectors after deriving normalized attention weights.",
      ],
      example: "With values [10, 20] and weights [0.25, 0.75], the weighted sum is 17.5.",
    },
  },
);

const linearVectorSpaces = defineFlashcardGroup(
  {
    subjectId: "linear-algebra",
    module: "Linear Algebra Basics",
    lesson: "Vector Spaces and Bases",
    source: "Deisenroth, Faisal, and Ong, Mathematics for Machine Learning (2020), chapters on vector spaces and analytic geometry.",
  },
  {
    "Vector space": {
      definition: "A vector space is a set equipped with vector addition and scalar multiplication that obey the vector-space axioms.",
      details: [
        "The axioms include closure, associative and commutative addition, a zero vector, and additive inverses.",
        "Scalar multiplication stays in the set and obeys identity, associativity, and distributive laws.",
        "Ordinary coordinate vectors form a vector space, but constrained collections may not.",
      ],
      example: "All real two-coordinate vectors [x, y] form a vector space under ordinary addition and scaling.",
    },
    Subspace: {
      definition: "A subspace is a subset that is itself a vector space under the parent space’s addition and scalar multiplication.",
      details: [
        "It contains the zero vector and is closed under addition and scalar multiplication.",
        "The whole space and {0} are subspaces; a proper subspace is strictly smaller than its parent.",
        "Lines through the origin, column spaces, and null spaces are common subspaces.",
      ],
      example: "All vectors [x, 0] form the x-axis subspace of two-dimensional space.",
    },
    Span: {
      definition: "The span of a set of vectors contains every linear combination that can be built from them.",
      details: [
        "Span describes all directions reachable using the supplied vectors and arbitrary coefficients.",
        "Adding a vector already inside the span does not make the span any larger.",
        "The span is always a subspace, even when the original vector list contains redundancies.",
      ],
      example: "The span of [1, 0] and [0, 1] is every vector [x, y] in the plane.",
    },
    Basis: {
      definition: "A basis is a smallest nonredundant set of directions that can build every vector in a space.",
      details: [
        "Formally, its vectors are linearly independent and span the entire vector space.",
        "Removing a basis vector loses part of the span, while adding another creates dependence.",
        "Different bases can describe the same vector space using different coordinates.",
      ],
      example: "[1, 1] and [1, -1] form a basis for the two-dimensional plane.",
    },
    "Standard basis": {
      definition: "The standard basis uses vectors with one coordinate equal to one and every other coordinate zero.",
      details: [
        "Each standard basis vector isolates one coordinate axis.",
        "A vector's ordinary coordinates are its coefficients in the standard basis.",
        "In d-dimensional space, the standard basis contains exactly d vectors.",
      ],
      example: "The standard basis for two dimensions is e1 = [1, 0] and e2 = [0, 1].",
    },
    "Linear independence": {
      definition: "Vectors are linearly independent when no vector can be reconstructed from the others.",
      details: [
        "The only coefficients producing the zero vector must all be zero.",
        "Independent vectors each add a genuinely new direction to their span.",
        "A set containing the zero vector can never be linearly independent.",
      ],
      example: "[1, 0] and [0, 1] are independent because neither is a scaled copy of the other.",
    },
    "Linear dependence": {
      definition: "Vectors are linearly dependent when at least one is a linear combination of the others.",
      details: [
        "Dependence means the set contains a redundant direction.",
        "A nonzero coefficient combination can produce the zero vector for a dependent set.",
        "More than d vectors in a d-dimensional space must be linearly dependent.",
      ],
      example: "[1, 0], [0, 1], and [1, 1] are dependent because the third is the sum of the first two.",
    },
    "Vector-space dimension": {
      definition: "The dimension of a vector space is the number of vectors in any basis for that space.",
      details: [
        "All valid bases for the same finite-dimensional space have the same number of vectors.",
        "Dimension counts independent directions, not the number of vectors currently listed.",
        "A subspace cannot have greater dimension than the space containing it.",
      ],
      example: "The plane has dimension two because any basis for it contains two independent vectors.",
    },
    "Column space": {
      definition: "A matrix's column space is the span of its columns and contains every possible matrix-vector output.",
      details: [
        "The column space lives in the matrix's output-coordinate space.",
        "Its dimension equals the matrix rank.",
        "A linear system Ax = b has a solution only when b lies in the column space of A.",
      ],
      example: "If both columns of A are multiples of [1, 2], every output Ax lies on that same line.",
    },
    "Null space": {
      definition: "A matrix's null space contains every input vector that the matrix maps to the zero vector.",
      details: [
        "It is also called the kernel of the associated linear transformation.",
        "A nontrivial null space means distinct inputs can produce the same output.",
        "The null-space dimension plus matrix rank equals the input dimension.",
      ],
      example: "For A = [[1, 1]], every vector [t, -t] belongs to the null space because A[t, -t] = 0.",
    },
  },
);

const linearMatrices = defineFlashcardGroup(
  {
    subjectId: "linear-algebra",
    module: "Linear Algebra Basics",
    lesson: "Matrices and Linear Maps",
    source: "NumPy Developers, numpy.matmul specification; Zhang et al., Dive into Deep Learning: Linear Algebra (2023).",
  },
  {
    "Row vector": {
      definition: "A row vector is a one-by-n matrix whose coordinates are arranged horizontally.",
      details: [
        "As a matrix it has shape (1, n), which differs from NumPy's rank-one shape (n,).",
        "Multiplying a row vector by a column vector produces a one-by-one dot product.",
        "Rows of a weight matrix often correspond to separate output features.",
      ],
      example: "[[2, 4, 6]] is a row vector with matrix shape (1, 3).",
    },
    "Column vector": {
      definition: "A column vector is an n-by-one matrix whose coordinates are arranged vertically.",
      details: [
        "As a matrix it has shape (n, 1), not the rank-one array shape (n,).",
        "Multiplying a column by a row forms an outer-product matrix.",
        "Some mathematical formulas assume vectors are columns even when code stores them as rank-one arrays.",
      ],
      example: "[[2], [4], [6]] is a column vector with matrix shape (3, 1).",
    },
    "Matrix-matrix multiplication": {
      definition: "Matrix-matrix multiplication forms each output entry from one row-by-column dot product.",
      details: [
        "An (m, k) matrix times a (k, n) matrix produces an (m, n) matrix.",
        "The operation is generally not commutative, so AB and BA can differ or have incompatible shapes.",
        "Composing many linear operations can be expressed as multiplying their matrices.",
      ],
      example: "A matrix shaped (5, 3) times one shaped (3, 2) produces a result shaped (5, 2).",
    },
    "Inner dimension": {
      definition: "The inner dimension is the shared axis length that must match in a matrix multiplication.",
      details: [
        "For shapes (m, k) and (k, n), the two k dimensions are the inner dimensions.",
        "Each output dot product pairs exactly k coordinates from a row and a column.",
        "A mismatched inner dimension signals that the intended features do not line up.",
      ],
      example: "Shapes (4, 7) and (7, 3) can multiply because their inner dimension is 7.",
    },
    Transpose: {
      definition: "A transpose swaps a matrix's rows and columns, reversing the order of its two axes.",
      details: [
        "An (m, n) matrix becomes an (n, m) matrix after transposition.",
        "Transposing twice returns the original matrix.",
        "X @ W.T is common when weight rows are stored as output-by-input features.",
      ],
      example: "The transpose of [[1, 2, 3], [4, 5, 6]] is [[1, 4], [2, 5], [3, 6]].",
    },
    "Identity matrix": {
      definition: "An identity matrix is square, with ones on its main diagonal and zeros everywhere else.",
      details: [
        "Multiplying by the identity leaves a compatible vector or matrix unchanged.",
        "It plays the same multiplicative role for matrices that the scalar one plays for numbers.",
        "Identity matrices appear in residual paths, regularization, and inverse definitions.",
      ],
      example: "[[1, 0], [0, 1]] times [3, -2] returns [3, -2].",
    },
    "Diagonal matrix": {
      definition: "A diagonal matrix is square and has zero everywhere outside its main diagonal.",
      details: [
        "Multiplying by a diagonal matrix scales coordinates independently without mixing them.",
        "Its determinant is the product of its diagonal entries.",
        "A diagonal matrix is invertible exactly when every diagonal entry is nonzero.",
      ],
      example: "[[2, 0], [0, -1]] maps [3, 4] to [6, -4].",
    },
    "Linear transformation": {
      definition: "A linear transformation preserves vector addition and scalar multiplication and can be represented by a matrix.",
      details: [
        "It must map the zero vector to the zero vector.",
        "Matrix multiplication can rotate, scale, reflect, project, or mix coordinates linearly.",
        "A pure linear transformation cannot add a constant offset on its own.",
      ],
      example: "The matrix [[0, -1], [1, 0]] rotates a two-dimensional vector by 90 degrees.",
    },
    "Affine transformation": {
      definition: "An affine transformation applies a linear map and then adds a fixed translation or bias.",
      details: [
        "Its common form is Wx + b, where W mixes coordinates and b shifts the result.",
        "It preserves straight lines but does not have to map the origin to itself.",
        "Affine transformation names the general map; a neural-network linear layer is one learned use of that map.",
      ],
      example: "The map 2x + 3 scales a one-dimensional input by two and then shifts it by three.",
    },
    "Composition of transformations": {
      definition: "Composition applies one transformation to the output of another in a specified order.",
      details: [
        "For linear maps, composition corresponds to multiplying their matrices in reverse application order.",
        "Transformation order matters because matrix multiplication is generally not commutative.",
        "Several linear maps without nonlinear activations collapse into one linear map.",
      ],
      example: "If A runs first and B runs second, the combined linear transformation is BAx.",
    },
  },
);

const linearBatches = defineFlashcardGroup(
  {
    subjectId: "linear-algebra",
    module: "Linear Algebra Basics",
    lesson: "Batches and Broadcasting",
    source: "NumPy Developers, NumPy broadcasting guide; NumPy Developers, numpy.matmul specification.",
  },
  {
    Batch: {
      definition: "A batch groups multiple examples so the same operation can process them together.",
      details: [
        "The batch axis normally identifies independent examples rather than learned features.",
        "Vectorized batch operations avoid writing a separate host-language loop per example.",
        "For independent per-example operations, batch size does not change one example's result; batch normalization, reductions, contrastive losses, and training gradients can depend on batch composition.",
      ],
      example: "A matrix with shape (32, 768) can hold 32 examples, each with 768 features.",
    },
    "Batch dimension": {
      definition: "The batch dimension is the tensor axis that counts separately processed examples.",
      details: [
        "It is commonly the first axis, but code conventions can place it elsewhere.",
        "Most learned weights are shared rather than repeated independently along this axis.",
        "Reductions over the batch axis combine evidence from different examples.",
      ],
      example: "In shape (16, 128, 512), a convention may use 16 as the batch dimension.",
    },
    "Feature dimension": {
      definition: "The feature dimension is the axis whose positions store attributes or learned coordinates for each item.",
      details: [
        "Linear layers usually transform the feature dimension while preserving batch axes.",
        "A weight matrix's input width must match the incoming feature dimension.",
        "In sequence models, the feature axis is often called hidden size or model dimension.",
      ],
      example: "For token activations shaped (8, 100, 768), the feature dimension has length 768.",
    },
    "Broadcast compatibility": {
      definition: "Shapes are broadcast-compatible when aligned dimensions are equal or one of them has length one.",
      details: [
        "Broadcast rules compare axis lengths from the final dimension moving left.",
        "A missing leading dimension behaves like a dimension of length one during alignment.",
        "Incompatible non-one lengths cause an error instead of silently truncating values.",
      ],
      example: "Shapes (5, 3) and (3,) are compatible, while shapes (5, 3) and (2,) are not.",
    },
    "Singleton dimension": {
      definition: "A singleton dimension is an array axis of length one that can often expand under broadcasting.",
      details: [
        "Keeping a singleton axis can preserve whether values represent rows, columns, or channels.",
        "Squeezing removes length-one axes, while unsqueezing inserts them.",
        "A shape (4, 1) broadcasts down columns differently from a rank-one shape (4,).",
      ],
      example: "A tensor shaped (8, 1, 64) has a singleton middle dimension that can expand across tokens.",
    },
    "Reduction axis": {
      definition: "A reduction axis specifies which dimension is combined by operations such as sum, mean, or maximum.",
      details: [
        "Reducing an axis usually removes it unless the operation requests that dimensions be kept.",
        "Choosing the wrong axis can mix examples when the intent was to combine features.",
        "The remaining axes retain their original ordering after the reduction.",
      ],
      example: "Taking the mean of shape (32, 10) over axis 0 produces ten feature means, shape (10,).",
    },
  },
);

const linearSystemsAndDecompositions = defineFlashcardGroup(
  {
    subjectId: "linear-algebra",
    module: "Linear Algebra for Machine Learning",
    lesson: "Systems, Rank, and Matrix Decompositions",
    source: "Deisenroth, Faisal, and Ong, Mathematics for Machine Learning (2020), chapters on linear systems, decompositions, and PCA.",
  },
  {
    "Linear system": {
      definition: "A linear system is a collection of linear equations commonly written together as Ax = b.",
      details: [
        "The matrix A stores equation coefficients, x stores unknowns, and b stores required outputs.",
        "A system may have one solution, many solutions, or no exact solution.",
        "Solving the system asks which input vectors map to b under the transformation A.",
      ],
      example: "The equations x + y = 3 and x - y = 1 form a linear system with solution x = 2, y = 1.",
    },
    "Matrix rank": {
      definition: "Matrix rank is the number of linearly independent directions represented by its rows or columns.",
      details: [
        "Row rank and column rank are always equal even though they describe different spaces.",
        "Matrix rank counts independent directions; array or tensor rank counts axes.",
        "Rank equals the dimension of the matrix's column space.",
      ],
      example: "[[1, 2], [2, 4]] has rank one because its second row is twice its first.",
    },
    "Full-rank matrix": {
      definition: "A full-rank matrix has the largest rank possible for its particular rectangular shape.",
      details: [
        "An m-by-n matrix is full rank when its rank is min(m, n).",
        "A square full-rank matrix has an inverse and a trivial null space.",
        "Tall full-rank matrices have independent columns; wide full-rank matrices have independent rows.",
      ],
      example: "The 2 by 2 identity matrix has rank two, so it is full rank.",
    },
    "Rank-deficient matrix": {
      definition: "A rank-deficient matrix has fewer independent directions than its shape could support.",
      details: [
        "Dependence among rows or columns creates the missing rank.",
        "A square rank-deficient matrix is singular and cannot have an ordinary inverse.",
        "Redundant features can make a design matrix rank deficient.",
      ],
      example: "A matrix with identical columns is rank deficient because one column adds no new direction.",
    },
    "Square matrix": {
      definition: "A square matrix has the same number of rows and columns and maps a space back to itself.",
      details: [
        "Determinants, ordinary inverses, and eigenvalues are defined most directly for square matrices.",
        "Being square does not guarantee that the matrix is invertible.",
        "A d-by-d square matrix transforms d input coordinates into d output coordinates.",
      ],
      example: "A weight matrix shaped (768, 768) is square because both dimensions are 768.",
    },
    "Rectangular matrix": {
      definition: "A rectangular matrix has different row and column counts and changes coordinate width.",
      details: [
        "A tall matrix has more rows than columns, while a wide matrix has more columns than rows.",
        "Rectangular matrices do not have ordinary two-sided inverses.",
        "Neural-network projections often use rectangular matrices to expand or compress features.",
      ],
      example: "A matrix shaped (3072, 768) expands a 768-value vector into 3072 output coordinates.",
    },
    Determinant: {
      definition: "The determinant is a scalar describing how a square linear transformation scales oriented volume.",
      details: [
        "A zero determinant means the transformation collapses at least one direction.",
        "A negative determinant indicates that orientation is reversed as well as scaled.",
        "The determinant of a product equals the product of the individual determinants.",
      ],
      example: "The diagonal matrix [[2, 0], [0, 3]] has determinant 6 and scales area by a factor of six.",
    },
    "Singular matrix": {
      definition: "A singular matrix is a square matrix that loses information and has no ordinary inverse.",
      details: [
        "Its determinant is zero and its rank is smaller than its dimension.",
        "At least one nonzero input lies in its null space and maps to zero.",
        "A singular linear system cannot have one unique solution for every possible output.",
      ],
      example: "[[1, 2], [2, 4]] is singular because two different input directions collapse onto one output line.",
    },
    "Matrix inverse": {
      definition: "A matrix inverse reverses an invertible square transformation so that A⁻¹A equals the identity.",
      details: [
        "Only square full-rank matrices have ordinary inverses.",
        "Applying the inverse can recover x from Ax when numerical conditioning is adequate.",
        "Software usually solves Ax = b directly instead of explicitly constructing A⁻¹.",
      ],
      example: "The inverse of [[2, 0], [0, 4]] is [[0.5, 0], [0, 0.25]].",
    },
    Pseudoinverse: {
      definition: "The pseudoinverse generalizes matrix inversion to rectangular or rank-deficient matrices.",
      details: [
        "It gives the least-squares solution with minimum norm when exact inversion is impossible.",
        "The Moore-Penrose pseudoinverse can be computed from a singular value decomposition.",
        "For an invertible square matrix, its pseudoinverse equals its ordinary inverse.",
      ],
      example: "For an overdetermined regression system, A⁺b gives the least-squares coefficient vector.",
    },
    "Condition number": {
      definition: "A condition number measures how strongly small input or rounding errors can affect a computed solution.",
      details: [
        "For the L2 norm, it is the largest singular value divided by the smallest singular value.",
        "A zero smallest singular value makes it infinite; a value near one is well conditioned, while a very large value warns of instability.",
        "Rescaling features can improve conditioning and make optimization easier.",
      ],
      example: "A matrix with singular values 1000 and 0.001 has condition number one million.",
    },
    Eigenvector: {
      definition: "An eigenvector is a nonzero direction that a square matrix scales without rotating away from that line.",
      details: [
        "It satisfies Av = λv for some scalar eigenvalue λ.",
        "Any nonzero scalar multiple of an eigenvector represents the same eigendirection.",
        "A matrix can have too few independent eigenvectors to form a complete basis.",
      ],
      example: "For [[2, 0], [0, 3]], the vector [1, 0] is an eigenvector scaled by 2.",
    },
    Eigenvalue: {
      definition: "An eigenvalue is the scalar factor by which a matrix stretches or flips its matching eigenvector.",
      details: [
        "A zero eigenvalue reveals a direction that the matrix collapses to zero.",
        "Negative eigenvalues reverse the matching eigenvector direction while scaling it.",
        "For a symmetric matrix, every eigenvalue is real and eigenvectors can be chosen orthogonal.",
      ],
      example: "The vector [0, 1] is scaled to [0, 3] by a diagonal matrix, so its eigenvalue is 3.",
    },
    Eigendecomposition: {
      definition: "Eigendecomposition expresses a suitable square matrix through its eigenvectors and eigenvalues.",
      details: [
        "A diagonalizable matrix can be written A = VΛV⁻¹.",
        "Columns of V are eigenvectors, while diagonal entries of Λ are their eigenvalues.",
        "The decomposition makes repeated matrix powers and some dynamical systems easier to analyze.",
      ],
      example: "For a diagonal matrix, V can be the identity and Λ is the original diagonal matrix.",
    },
    "Symmetric matrix": {
      definition: "A symmetric matrix equals its transpose, so entries mirror across the main diagonal.",
      details: [
        "Every real symmetric matrix has real eigenvalues.",
        "Its eigenvectors can be chosen as an orthonormal basis.",
        "Covariance and Gram matrices are symmetric by construction.",
      ],
      example: "[[2, -1], [-1, 3]] is symmetric because the off-diagonal entries match.",
    },
    "Positive semidefinite matrix": {
      definition: "A positive semidefinite matrix never produces a negative squared-style measurement in any direction.",
      details: [
        "Formally, it is symmetric and gives xᵀAx at least zero for every vector x.",
        "Covariance matrices and matrices of the form BᵀB are positive semidefinite.",
        "Semidefinite allows flat zero directions, while positive definite requires strictly positive values.",
      ],
      example: "The identity matrix is positive semidefinite because xᵀIx equals the non-negative squared norm of x.",
    },
    "Covariance matrix": {
      definition: "A covariance matrix records how pairs of centered features vary together across examples.",
      details: [
        "Diagonal entries are individual feature variances.",
        "Positive and negative off-diagonal entries indicate features tending to move together or oppositely.",
        "A covariance matrix is symmetric and positive semidefinite.",
      ],
      example: "If height and weight usually rise together, their covariance matrix has a positive off-diagonal entry.",
    },
    "Singular value decomposition": {
      definition: "Singular value decomposition factors any matrix into two orthogonal bases and non-negative scales.",
      details: [
        "The standard form A = UΣVᵀ works for square and rectangular matrices.",
        "Columns of V describe input directions, while columns of U describe output directions.",
        "SVD supports pseudoinverses, compression, rank estimates, and principal component analysis.",
      ],
      example: "A 100 by 20 data matrix can be factored into U, Σ, and Vᵀ even though it is rectangular.",
    },
    "Singular value": {
      definition: "A singular value is a non-negative scale factor showing how strongly a matrix acts along a paired direction.",
      details: [
        "Singular values are the square roots of eigenvalues of AᵀA.",
        "The number of nonzero singular values equals the matrix rank.",
        "Very small singular values identify directions that are nearly collapsed and numerically fragile.",
      ],
      example: "If a matrix stretches one principal direction by 5, then 5 is one of its singular values.",
    },
    "Low-rank approximation": {
      definition: "A low-rank approximation replaces a matrix with a simpler matrix retaining its strongest directions.",
      details: [
        "Truncated SVD keeps only the largest singular values and their singular vectors.",
        "Lower rank reduces storage and computation at the cost of reconstruction error.",
        "Under either the spectral norm or Frobenius norm, the best rank-k approximation keeps the top k singular components.",
      ],
      example: "Keeping 20 singular components can compress a 1000 by 1000 matrix while preserving its dominant structure.",
    },
    "Principal component analysis": {
      definition: "Principal component analysis rotates centered data onto orthogonal directions ordered by explained variance.",
      details: [
        "The first principal component captures the greatest possible variance along one unit direction.",
        "Later components are orthogonal to earlier ones and capture remaining variance.",
        "PCA can be computed from the covariance eigendecomposition or directly with SVD.",
      ],
      example: "PCA can reduce 100 correlated measurements to 10 components that preserve most observed variation.",
    },
  },
);

const mlData = defineFlashcardGroup(
  {
    subjectId: "machine-learning-basics",
    module: "Machine Learning Basics",
    lesson: "Training and Validation Data",
    source: "Google Machine Learning Crash Course, Datasets, generalization, and overfitting; scikit-learn, Cross-validation.",
  },
  {
    Dataset: {
      definition: "A dataset is an organized collection of examples used to train, evaluate, or analyze a model.",
      details: [
        "Each row commonly represents one example, while columns hold features and possibly a target.",
        "Dataset quality, coverage, and measurement choices limit what a model can learn reliably.",
        "Training, validation, and test sets should preserve explicit provenance and split membership.",
      ],
      example: "A house-price dataset might contain 10,000 rows with area, age, location, and sale price.",
    },
    Example: {
      definition: "An example is one individual observation presented to a model, usually containing inputs and an expected output.",
      details: [
        "Examples are often rows in tabular data or sequences in language-model data.",
        "One example must keep its features aligned with the correct target.",
        "Repeated or near-duplicate examples can unintentionally leak information across data splits.",
      ],
      example: "One email together with its spam label is a single supervised-learning example.",
    },
    Feature: {
      definition: "A feature is an input measurement or representation that a model can use when making a prediction.",
      details: [
        "Features may be raw measurements, engineered values, category codes, or learned embeddings.",
        "A feature should be available at the real moment when the prediction is made.",
        "This card defines one input field; the core Features and targets card explains how inputs pair with answers.",
      ],
      example: "Square footage is a feature a house-price model can use before the sale price is known.",
    },
    Target: {
      definition: "A target is the value or class that supervised learning asks a model to predict.",
      details: [
        "Targets are also called labels, outcomes, responses, or ground-truth values.",
        "Every supervised example needs the target that corresponds to its input features.",
        "This card defines the answer field itself; the core Features and targets card explains its relationship to inputs.",
      ],
      example: "For an image classifier, the target might be the class label 'golden retriever'.",
    },
    "Feature vector": {
      definition: "A feature vector stores all input feature values for one example in a fixed coordinate order.",
      details: [
        "Its length equals the number of model input features for that representation.",
        "Every example must use the same coordinate meaning at each position.",
        "Categorical information may require encoding before it can enter a numeric feature vector.",
      ],
      example: "[1800, 3, 12] could encode square feet, bedrooms, and building age for one home.",
    },
    "Feature matrix": {
      definition: "A feature matrix, conventionally named X, stacks one feature vector per example into rows.",
      details: [
        "With n examples and d features, X normally has shape (n, d).",
        "Row order must remain aligned with the matching entries in the target vector.",
        "Batch operations can process multiple rows of X with one vectorized calculation.",
      ],
      example: "A dataset with 500 examples and 12 features produces a feature matrix shaped (500, 12).",
    },
    "Target vector": {
      definition: "A target vector, conventionally named y, stores one expected output for every supervised example.",
      details: [
        "For n examples with scalar targets, y normally has shape (n,).",
        "Its row ordering must exactly match the examples in the feature matrix X.",
        "Multidimensional outputs may require a target matrix or a higher-rank target tensor instead.",
      ],
      example: "For four binary examples, the target vector could be y = [0, 1, 1, 0].",
    },
    "Supervised learning": {
      definition: "Supervised learning fits a mapping from inputs to known targets using labeled examples.",
      details: [
        "A loss function measures disagreement between model predictions and supplied targets.",
        "Regression predicts numeric values, while classification predicts categories or class probabilities.",
        "Evaluation uses held-out labeled examples to estimate performance on unseen data.",
      ],
      example: "Training on customer records paired with known churn outcomes is supervised learning.",
    },
    "Unsupervised learning": {
      definition: "Unsupervised learning seeks useful structure in inputs without a supplied target for each example.",
      details: [
        "Common goals include clustering, dimensionality reduction, and density estimation.",
        "Success criteria are often less direct than accuracy against known labels.",
        "Learned representations can later become features for a supervised task.",
      ],
      example: "Grouping news articles by content without predefined topic labels is unsupervised learning.",
    },
    "Training set": {
      definition: "The training set contains examples allowed to influence learned model parameters.",
      details: [
        "Optimization repeatedly computes predictions and gradients from training examples.",
        "Training metrics alone do not show whether the model generalizes to unseen data.",
        "This card covers the fitting set itself; Training-validation split covers the boundary between the two sets.",
      ],
      example: "A model may update its weights from 80,000 designated training rows.",
    },
    "Validation set": {
      definition: "The validation set is held out from parameter updates and used to guide model-development choices.",
      details: [
        "It can compare architectures, hyperparameters, checkpoints, and stopping times.",
        "Repeated decisions based on one validation set can gradually overfit that set.",
        "This card covers the decision set itself; Training-validation split covers the boundary between the two sets.",
      ],
      example: "Ten thousand untouched rows can identify which learning rate performs best during development.",
    },
    "Test set": {
      definition: "The test set is a final held-out sample used for an unbiased evaluation after development decisions are finished.",
      details: [
        "It must not guide parameter updates, hyperparameter tuning, or feature engineering.",
        "Looking repeatedly at test results turns the test set into another validation set.",
        "Its distribution should represent the real population the reported result claims to cover.",
      ],
      example: "A team evaluates the chosen frozen model once on 10,000 previously unseen test examples.",
    },
  },
);

const mlGeneralization = defineFlashcardGroup(
  {
    subjectId: "machine-learning-basics",
    module: "Machine Learning Basics",
    lesson: "Generalization and Data Quality",
    source: "Google Machine Learning Crash Course, Datasets, generalization, and overfitting; scikit-learn, Cross-validation; NumPy Developers, Boolean array indexing; Deisenroth et al., Mathematics for Machine Learning, empirical risk and generalization.",
  },
  {
    "Holdout set": {
      definition: "A holdout set is data reserved from fitting so it can estimate performance on examples the model did not train on.",
      details: [
        "Validation and test sets are both forms of holdout data with different development roles.",
        "Whole examples must be assigned to one split rather than copied across splits.",
        "Grouped or time-dependent data may require more careful splitting than random row selection.",
      ],
      example: "Reserving the final 20 percent of a time series creates a chronological holdout set.",
    },
    "Boolean mask": {
      definition: "A Boolean mask is an array of true-or-false selectors used to keep or exclude matching rows.",
      details: [
        "The mask length must match the array axis being selected.",
        "Complementing a validation mask can produce the corresponding training mask.",
        "Masks preserve row alignment when applied consistently to features and targets.",
      ],
      example: "The mask [true, false, true] selects the first and third rows of a three-row table.",
    },
    "Cross-validation": {
      definition: "Cross-validation repeats training and evaluation across several data splits to estimate performance stability.",
      details: [
        "In k-fold cross-validation, each fold serves as validation once while the others train the model.",
        "Reported scores can include both a mean and variation across folds.",
        "All preprocessing and model fitting must occur separately inside each training fold.",
      ],
      example: "Five-fold cross-validation trains five models, each evaluated on a different fifth of the data.",
    },
    Generalization: {
      definition: "Generalization is a model's ability to perform well on relevant examples it did not see during training.",
      details: [
        "A small training loss does not guarantee a small loss on unseen data.",
        "Generalization depends on data coverage, model capacity, regularization, and the deployment distribution.",
        "Held-out evaluation supplies an estimate rather than a certainty about future performance.",
      ],
      example: "A sentiment model generalizes when it correctly handles newly written reviews from real users.",
    },
    Overfitting: {
      definition: "Overfitting occurs when a model learns training-specific patterns that do not transfer to unseen data.",
      details: [
        "Training performance may continue improving while validation performance gets worse.",
        "High capacity, limited data, leakage, and excessive tuning can all contribute.",
        "Regularization, more representative data, or earlier stopping can reduce overfitting.",
      ],
      example: "A classifier memorizes every training ID but fails on customers with new IDs.",
    },
    Underfitting: {
      definition: "Underfitting occurs when a model is too limited or insufficiently trained to capture important patterns.",
      details: [
        "Both training and validation performance are usually poor.",
        "The cause may be weak features, excessive regularization, low model capacity, or too little training.",
        "Increasing useful capacity does not help if the target cannot be predicted from the inputs.",
      ],
      example: "A straight line underfits data generated by a strong U-shaped relationship.",
    },
    "Data leakage": {
      definition: "Data leakage occurs when information crosses an intended training-evaluation boundary or when a feature uses information unavailable at the real prediction time.",
      details: [
        "Leakage produces evaluation scores that are unrealistically optimistic.",
        "It can enter through overlapping examples, future information, target-derived features, or global preprocessing.",
        "A pipeline audit must trace when every feature and statistic becomes available.",
      ],
      example: "Using the final diagnosis as an input feature leaks the answer into a disease-prediction model.",
    },
    "IID assumption": {
      definition: "IID means independent and identically distributed: each example has the same distribution, and observing one does not change the distribution of another.",
      details: [
        "Independence means the joint distribution factorizes across examples; it is stronger than merely saying one does not determine another.",
        "Identically distributed means training and evaluation examples follow the same underlying process.",
        "Time series, repeated users, and network data often violate simple IID splitting assumptions.",
      ],
      example: "Randomly sampled coin flips from one unchanged coin are commonly modeled as IID observations.",
    },
    "Data-generating distribution": {
      definition: "The data-generating distribution is the underlying process that produces examples and their frequencies.",
      details: [
        "A finite dataset is only one sample from this broader process.",
        "Expected real-world risk is defined over the deployment distribution, not just stored rows.",
        "Selection mechanisms can make a collected dataset differ from the population of interest.",
      ],
      example: "A support-chat dataset reflects which users seek help, what they ask, and when they contact the company.",
    },
    "Distribution shift": {
      definition: "Distribution shift occurs when the data encountered after deployment differs from the data used for training.",
      details: [
        "Feature frequencies, label frequencies, or the relationship between features and targets can change.",
        "A model can degrade even when its code and stored parameters remain unchanged.",
        "Monitoring should track input drift and outcome quality rather than assuming a fixed environment.",
      ],
      example: "A fraud model trained before a new payment method may face shifted transaction patterns afterward.",
    },
    "Sampling bias": {
      definition: "Sampling bias occurs when collected examples systematically misrepresent the population a model should serve.",
      details: [
        "More data does not remove bias if the sampling mechanism remains skewed.",
        "Convenience samples often overrepresent people or situations that are easiest to observe.",
        "Evaluation should describe the population and selection process behind its sample.",
      ],
      example: "A survey sent only through a smartphone app underrepresents people without smartphones.",
    },
    "Class imbalance": {
      definition: "Class imbalance means some target classes occur much less often than others in a dataset.",
      details: [
        "High overall accuracy can hide complete failure on a rare but important class.",
        "Stratified splits help preserve class proportions across training and evaluation data.",
        "Class weighting, resampling, and threshold choice can change minority-class behavior.",
      ],
      example: "If only 1 in 1,000 transactions is fraudulent, a fraud dataset is strongly imbalanced.",
    },
    "Bias-variance tradeoff": {
      definition: "The bias-variance tradeoff describes tension between systematic model error and sensitivity to training-sample noise.",
      details: [
        "High bias often appears as underfitting because the model cannot express the needed relationship.",
        "High variance often appears as overfitting because results change greatly with the sampled data.",
        "Data size, regularization, and model capacity move the balance rather than eliminating all error.",
      ],
      example: "A rigid straight line may have high bias, while a degree-30 polynomial on ten points may have high variance.",
    },
    "Inductive bias": {
      definition: "An inductive bias is a built-in assumption that guides which explanation a learner prefers when the data allows several.",
      details: [
        "Every learning method needs some bias because finite training data cannot uniquely determine behavior everywhere.",
        "Architecture, regularization, feature choices, and optimization can all create useful preferences.",
        "A helpful bias improves generalization on the intended problem but can hurt when its assumption is wrong.",
      ],
      example: "Linear regression prefers straight-line relationships even though many curved functions could fit two observed points.",
    },
  },
);

const mlRegressionAndLoss = defineFlashcardGroup(
  {
    subjectId: "machine-learning-basics",
    module: "Machine Learning Basics",
    lesson: "Linear Regression and Loss",
    source: "Google Machine Learning Crash Course, Linear regression; Goodfellow, Bengio, and Courville, Deep Learning, Machine Learning Basics (2016); scikit-learn, Glossary of Common Terms and API Elements.",
  },
  {
    Model: {
      definition: "A model is a fitted rule or structure that maps inputs to predictions.",
      details: [
        "The model family or structure determines which relationships it can represent.",
        "Fitting chooses the learned state the model needs, while inference applies the resulting rule.",
        "A model should be evaluated together with its preprocessing and decision policy.",
      ],
      example: "A linear model maps house features to a price using learned coefficients and an intercept.",
    },
    Estimator: {
      definition: "An estimator is a learning procedure that fits a model or statistic from observed data.",
      details: [
        "In scikit-learn terminology, an estimator exposes a fit operation and stores learned state.",
        "Different samples can make the same estimator produce different fitted parameters.",
        "Estimator evaluation must keep its fitting step inside each training split.",
      ],
      example: "A linear-regression estimator uses training rows to estimate coefficients for a fitted predictor.",
    },
    Parameter: {
      definition: "A parameter is a model value learned from training data and retained for later predictions.",
      details: [
        "Weights and biases are parameters because optimization changes them to reduce loss.",
        "Parameter count helps describe model capacity and memory requirements.",
        "Inference normally uses parameters without continuing to update them.",
      ],
      example: "The coefficient 2.7 learned for square footage is one parameter of a house-price model.",
    },
    Hyperparameter: {
      definition: "A hyperparameter is a setting chosen outside ordinary parameter fitting that controls training or model structure.",
      details: [
        "Learning rate, regularization strength, depth, and batch size are common hyperparameters.",
        "Validation data can compare hyperparameter choices without updating model weights directly.",
        "Extensive tuning can overfit the validation set even though it is not used for gradients.",
      ],
      example: "Choosing a learning rate of 0.001 before training sets a hyperparameter rather than a learned weight.",
    },
    "Linear regression": {
      definition: "Linear regression predicts a continuous target as a weighted sum of features plus an intercept.",
      details: [
        "Each coefficient gives a constant change in prediction per unit feature change when others stay fixed.",
        "Ordinary least squares chooses coefficients that minimize summed squared residuals.",
        "This card covers the fitted model family; Linear prediction works through one evaluation of its formula.",
      ],
      example: "A rent model may predict 900 + 1.5 × square feet + 200 × bedroom count.",
    },
    Prediction: {
      definition: "A prediction is the output a fitted model produces for a particular input before the true outcome is considered.",
      details: [
        "Regression predictions are numeric, while classifiers may output scores, probabilities, or labels.",
        "The common notation ŷ distinguishes a prediction from the observed target y.",
        "A prediction is not automatically a calibrated probability or a final product decision.",
      ],
      example: "For one application, a model outputs a predicted approval probability of 0.72.",
    },
    Weight: {
      definition: "A weight is a learned coefficient that controls how strongly one input or hidden value affects an output.",
      details: [
        "Positive and negative weights push a linear score in opposite directions.",
        "Weight magnitude is interpretable only relative to feature scaling and surrounding operations.",
        "Neural networks organize many weights into matrices connecting layer coordinates.",
      ],
      example: "A weight of -0.8 multiplies one feature, so increasing that feature lowers the score by 0.8 per unit.",
    },
    "Bias term": {
      definition: "A bias term is a learned additive offset that lets a model shift its output independently of input values.",
      details: [
        "In regression the scalar bias is also commonly called the intercept.",
        "A dense layer usually has one bias value for every output unit.",
        "With all-zero input features, an affine model returns its bias values.",
      ],
      example: "For ŷ = 2x + 3, the bias term is 3 and gives the prediction when x equals zero.",
    },
    Residual: {
      definition: "A residual is the signed difference between a model prediction and the observed target for one example.",
      details: [
        "This course uses prediction minus target, though some fields use the opposite sign convention.",
        "Residual patterns can reveal missing nonlinearities, unequal variance, or biased predictions.",
        "Squaring residuals prevents positive and negative errors from cancelling in a loss.",
      ],
      example: "If the prediction is 8 and the target is 10, prediction minus target gives a residual of -2.",
    },
    "Squared error": {
      definition: "Squared error is one residual multiplied by itself, producing a non-negative penalty for a prediction mistake.",
      details: [
        "A residual twice as large contributes four times as much squared error.",
        "Its smooth derivative makes it convenient for gradient-based regression.",
        "Outliers can dominate an average because very large residuals are squared.",
      ],
      example: "A prediction of 7 for a target of 10 has residual -3 and squared error 9.",
    },
    "Loss function": {
      definition: "A loss function converts model predictions and targets into a scalar training objective to minimize.",
      details: [
        "The chosen loss defines which kinds of mistakes receive the strongest penalties.",
        "A differentiable loss supplies gradients that connect observed errors to parameter updates.",
        "The training loss can differ from the human-facing metric used to report product quality.",
      ],
      example: "A regression model may train with squared error even when reports also show absolute error in dollars.",
    },
    "Empirical risk": {
      definition: "Empirical risk is the average loss measured over a finite observed dataset rather than the full population.",
      details: [
        "Training commonly minimizes empirical risk because the true data distribution is not directly available.",
        "Low empirical risk can coexist with poor generalization when the sample is unrepresentative or overfit.",
        "Regularized objectives add a parameter penalty to the empirical loss.",
      ],
      example: "Averaging cross-entropy over 10,000 training examples produces the model's training empirical risk.",
    },
  },
);

const mlOptimization = defineFlashcardGroup(
  {
    subjectId: "machine-learning-basics",
    module: "Machine Learning Basics",
    lesson: "Gradient Descent and Optimization",
    source: "Google Machine Learning Crash Course, Gradient descent; Goodfellow, Bengio, and Courville, Deep Learning, chapters 7–8 on regularization and optimization (2016).",
  },
  {
    Optimization: {
      definition: "Optimization is the process of searching for parameter values that make a chosen objective smaller.",
      details: [
        "Training objectives are often high-dimensional and nonconvex for neural networks.",
        "An optimizer uses local information to choose a sequence of parameter updates.",
        "A low training objective does not by itself guarantee useful generalization.",
      ],
      example: "Training adjusts millions of weights to reduce average next-token loss over many batches.",
    },
    "Partial derivative": {
      definition: "A partial derivative measures how a function changes with one input while the other inputs are held fixed.",
      details: [
        "A model with many parameters has one partial derivative of loss for each parameter.",
        "All parameter partial derivatives together form the gradient vector.",
        "The derivative is local, so its value changes as the parameters move.",
      ],
      example: "∂L/∂w describes the nearby change in loss caused by changing weight w alone.",
    },
    "Chain rule": {
      definition: "The chain rule computes derivatives through composed functions by multiplying their local derivatives.",
      details: [
        "Neural networks are long compositions of linear operations and activation functions.",
        "Backpropagation applies the chain rule efficiently from the loss back through the graph.",
        "A near-zero local derivative can shrink gradients reaching much earlier layers.",
      ],
      example: "If y = f(g(x)), then dy/dx equals f'(g(x)) multiplied by g'(x).",
    },
    "Learning rate": {
      definition: "The learning rate is a hyperparameter controlling the scale of each optimizer update.",
      details: [
        "A rate that is too small can make useful progress extremely slow.",
        "A rate that is too large can overshoot low-loss regions or make training diverge.",
        "Schedules often lower the learning rate as training progresses.",
      ],
      example: "With gradient 4 and learning rate 0.01, basic gradient descent changes the parameter by -0.04.",
    },
    "Mini-batch": {
      definition: "A mini-batch is a subset of training examples used together to estimate one parameter update.",
      details: [
        "It produces a cheaper but noisier gradient estimate than using the entire training set.",
        "Vectorized hardware can process mini-batch examples in parallel.",
        "Examples should be sampled carefully when rows are grouped, imbalanced, or time dependent.",
      ],
      example: "A mini-batch of 64 sequences contributes one loss and one optimizer update.",
    },
    "Batch size": {
      definition: "Batch size is the number of training examples included in one gradient estimate or update.",
      details: [
        "Larger batches require more activation memory but reduce sampling noise in the gradient.",
        "Changing batch size can require adjusting the learning rate or accumulation strategy.",
        "Batch size counts examples, while sequence length counts tokens within each sequence example.",
      ],
      example: "With batch size 32, each optimizer step uses 32 training examples.",
    },
    Epoch: {
      definition: "An epoch is one complete pass through all training examples, usually divided into mini-batches.",
      details: [
        "One epoch contains dataset size divided by batch size optimizer steps, with rounding as needed.",
        "Examples are often shuffled between epochs to change mini-batch composition.",
        "Large language-model runs may be described by token counts rather than whole epochs.",
      ],
      example: "A dataset of 1,000 examples trained in batches of 100 takes ten steps per epoch.",
    },
    "Training iteration": {
      definition: "A training iteration is one repeated cycle of forward computation, loss calculation, gradient computation, and update.",
      details: [
        "Iteration and step are often used interchangeably in training logs.",
        "Many iterations occur inside a single epoch when training uses mini-batches.",
        "Logging every iteration can expose spikes, divergence, or data-dependent instability.",
      ],
      example: "Iteration 500 processes a mini-batch, computes its gradients, and applies the 500th update.",
    },
    "Stochastic gradient descent": {
      definition: "Stochastic gradient descent updates parameters using a randomly sampled example or mini-batch gradient.",
      details: [
        "Its gradient is an estimate of the full-dataset gradient rather than an exact average.",
        "Sampling noise can help exploration but also makes the loss curve fluctuate.",
        "In common usage, SGD often means mini-batch gradient descent without adaptive scaling.",
      ],
      example: "SGD may update a model from 128 sampled rows instead of recomputing loss over ten million rows.",
    },
    Optimizer: {
      definition: "An optimizer is the algorithm that converts gradients and stored state into parameter updates.",
      details: [
        "Different optimizers use momentum, adaptive scaling, or other state beyond the current gradient.",
        "Optimizer state can consume memory comparable to or larger than the model parameters.",
        "Optimizer choice and hyperparameters affect training dynamics but do not change the inference graph directly.",
      ],
      example: "Adam stores moving averages for each weight and uses them when choosing the next update.",
    },
    Momentum: {
      definition: "Momentum accumulates a moving direction from past gradients so updates continue through consistent slopes.",
      details: [
        "It can reduce zig-zag motion when one direction has rapidly changing gradients.",
        "A momentum coefficient controls how much previous update history remains.",
        "Momentum introduces optimizer state that must be saved to resume training exactly.",
      ],
      example: "Several gradients pointing right build velocity, so one small opposing gradient may not reverse the update immediately.",
    },
    Adam: {
      definition: "Adam is an optimizer that combines momentum-like gradient averages with adaptive per-parameter scaling.",
      details: [
        "It tracks moving averages of both gradients and squared gradients.",
        "Bias correction compensates for moving averages that begin at zero.",
        "Its extra optimizer states increase training memory beyond the weights and gradients.",
      ],
      example: "Adam can give a frequently large-gradient parameter a different effective step size from a quiet parameter.",
    },
    Convergence: {
      definition: "Convergence means an optimization process approaches a stable region where further updates bring little improvement.",
      details: [
        "Training loss, gradient norms, and validation metrics provide different evidence about convergence.",
        "A converged training objective may still correspond to a poor local solution or weak generalization.",
        "Noisy mini-batch updates can keep parameters moving even when average progress has leveled off.",
      ],
      example: "Loss changing from 0.421 to 0.420 over many epochs may indicate the run is nearing convergence.",
    },
    "Global-norm clipping": {
      definition: "Global-norm clipping rescales an entire gradient when its combined norm exceeds a chosen threshold.",
      details: [
        "All components receive one shared scale factor, preserving the gradient direction.",
        "Gradients below the threshold remain unchanged rather than being enlarged.",
        "Clipping can stabilize training but does not identify the underlying cause of exploding gradients.",
      ],
      example: "A gradient with norm 100 can be rescaled to norm 1 before the optimizer uses it.",
    },
    Regularization: {
      definition: "Regularization changes training to discourage models from fitting unstable or unnecessarily complex patterns.",
      details: [
        "Weight decay penalizes large parameters, while dropout randomly removes activations during training.",
        "Regularization may raise training loss while improving validation performance.",
        "Its strength is a hyperparameter selected using held-out evidence.",
      ],
      example: "Adding 0.001 times the squared weight norm to the loss applies L2-style regularization.",
    },
  },
);

const mlClassification = defineFlashcardGroup(
  {
    subjectId: "machine-learning-basics",
    module: "Machine Learning Basics",
    lesson: "Classification and Probability",
    source: "Google Machine Learning Crash Course, Sigmoid and classification; Goodfellow, Bengio, and Courville, Deep Feedforward Networks (2016).",
  },
  {
    Classification: {
      definition: "Classification assigns an input to one or more discrete categories rather than predicting an unrestricted number.",
      details: [
        "A classifier may output raw scores, class probabilities, or final labels.",
        "The loss trains class scores, while a decision rule converts them into actions.",
        "Evaluation should reflect error costs and class frequencies, not only overall accuracy.",
      ],
      example: "An email classifier assigns each message to spam or not-spam categories.",
    },
    "Binary classification": {
      definition: "Binary classification chooses between two mutually exclusive outcomes, commonly encoded as zero and one.",
      details: [
        "A model often produces one logit that sigmoid converts into the probability of the positive class.",
        "A threshold turns the probability or score into a predicted class label.",
        "Positive and negative are naming conventions, not judgments about which outcome is desirable.",
      ],
      example: "A transaction model predicts fraud as class 1 and legitimate activity as class 0.",
    },
    "Multiclass classification": {
      definition: "Multiclass classification chooses one class from three or more mutually exclusive alternatives.",
      details: [
        "The model normally produces one logit for every candidate class.",
        "Softmax converts the logits into probabilities that sum to one.",
        "Language modeling is multiclass classification over the token vocabulary at each prediction position.",
      ],
      example: "A digit classifier chooses one of ten classes numbered 0 through 9 for each image.",
    },
    Logit: {
      definition: "A logit is an unrestricted real-valued class score produced before normalization into probabilities.",
      details: [
        "A logit can be positive, negative, or zero and is not itself bounded like a probability.",
        "For binary logistic regression, the logit represents log-odds of the positive class.",
        "This card isolates the raw score; Logit and sigmoid explains how that score becomes a binary probability.",
      ],
      example: "A binary logit of 2 becomes a positive-class probability of about 0.881 after sigmoid.",
    },
    Sigmoid: {
      definition: "Sigmoid is an S-shaped function that maps any finite real score to a value strictly between zero and one.",
      details: [
        "A zero input maps to 0.5, while large positive and negative inputs approach one and zero.",
        "Its binary-classification output can be interpreted as a probability under the model.",
        "This card isolates the function; Logit and sigmoid explains its role after a binary logit.",
      ],
      example: "sigmoid(0) = 0.5, while sigmoid(2) is approximately 0.881.",
    },
    Probability: {
      definition: "A probability is a number from zero to one representing modeled uncertainty about an event.",
      details: [
        "Mutually exclusive class probabilities should sum to one when exactly one class must occur.",
        "A probability describes uncertainty under assumptions and data, not a guaranteed frequency for one event.",
        "Calibration checks whether events assigned probability p occur about p of the time.",
      ],
      example: "Among many predictions near 0.8, a calibrated model should be correct roughly 80 percent of the time.",
    },
    "Odds and log-odds": {
      definition: "Odds compare an event's probability with its non-occurrence, while log-odds take the logarithm of that ratio.",
      details: [
        "For probability p, odds equal p divided by 1 - p.",
        "Log-odds range over all real numbers and equal zero when probability is one half.",
        "Sigmoid converts log-odds back into probability.",
      ],
      example: "A probability of 0.8 has odds 4 to 1 and log-odds ln(4), about 1.386.",
    },
    "Decision threshold": {
      definition: "A decision threshold is the cutoff used to turn a score or probability into a discrete class action.",
      details: [
        "The common 0.5 threshold is a convention, not a universal optimum.",
        "Lowering the positive threshold usually increases recall while creating more false positives.",
        "Threshold selection should use validation data and the real costs of each error type.",
      ],
      example: "A safety screen may flag probabilities above 0.2 because missing a true case is especially costly.",
    },
    Softmax: {
      definition: "Softmax turns a vector of logits into positive class probabilities that sum to one.",
      details: [
        "It exponentiates shifted logits and divides each result by their shared sum.",
        "Subtracting the largest logit before exponentiation improves numerical stability without changing probabilities.",
        "Adding the same constant to every logit leaves the softmax distribution unchanged.",
      ],
      example: "Softmax can turn logits [2, 1, 0] into probabilities of about [0.665, 0.245, 0.090].",
    },
    "Categorical cross-entropy": {
      definition: "Categorical cross-entropy measures how much probability a multiclass model assigned to the observed target class.",
      details: [
        "Assigning high probability to the observed target produces a small loss.",
        "Assigning probability near zero to the target produces a very large penalty.",
        "With one-hot targets and softmax probabilities, it equals target negative log-likelihood.",
      ],
      example: "Assigning target probability 0.8 gives loss -ln(0.8), approximately 0.223.",
    },
    "One-hot encoding": {
      definition: "One-hot encoding represents one category with a vector containing one at its class position and zero elsewhere.",
      details: [
        "The vector length equals the total number of possible classes.",
        "Class positions are identifiers and do not imply numerical order or distance.",
        "Sparse integer class IDs can often replace explicit one-hot vectors in loss implementations.",
      ],
      example: "For classes cat, dog, and bird, the dog label can be encoded as [0, 1, 0].",
    },
    "Confusion matrix": {
      definition: "A confusion matrix counts predicted classes against actual classes to expose specific error types.",
      details: [
        "For binary classification it contains true positives, true negatives, false positives, and false negatives.",
        "Rows and columns vary by convention, so their labels must be checked before interpretation.",
        "Its counts support metrics such as accuracy, precision, recall, and specificity.",
      ],
      example: "A matrix may show 90 true positives, 10 false positives, 20 false negatives, and 880 true negatives.",
    },
    Accuracy: {
      definition: "Accuracy is the fraction of evaluated examples whose final predicted class exactly matches the target.",
      details: [
        "It weights every example equally and does not distinguish different error costs.",
        "Accuracy can be misleading when one class greatly outnumbers another.",
        "Its denominator must include all evaluated examples, including every error type.",
      ],
      example: "If 92 of 100 labels are correct, classification accuracy is 92 percent.",
    },
    Precision: {
      definition: "Precision is the fraction of predicted-positive examples that are truly positive.",
      details: [
        "It equals true positives divided by true positives plus false positives.",
        "High precision means positive alerts are rarely false alarms.",
        "Precision depends on the decision threshold and the prevalence of the positive class.",
      ],
      example: "With 80 true positives and 20 false positives, precision is 80 / 100 = 0.8.",
    },
    Recall: {
      definition: "Recall is the fraction of all actual-positive examples that the classifier successfully identifies.",
      details: [
        "It equals true positives divided by true positives plus false negatives.",
        "High recall means few real positive cases are missed.",
        "Increasing recall by lowering a threshold often reduces precision.",
      ],
      example: "With 80 detected positives and 20 missed positives, recall is 80 / 100 = 0.8.",
    },
  },
);

const mlNeuralNetworks = defineFlashcardGroup(
  {
    subjectId: "machine-learning-basics",
    module: "Machine Learning Basics",
    lesson: "Neural Networks",
    source: "Google Machine Learning Crash Course, Neural networks; Goodfellow, Bengio, and Courville, Deep Feedforward Networks (2016).",
  },
  {
    "Multilayer perceptron": {
      definition: "A multilayer perceptron is a feed-forward neural network that alternates affine layers with nonlinear activations.",
      details: [
        "Information moves from inputs through hidden layers to outputs without recurrent state.",
        "At least one nonlinear hidden layer lets it represent relationships beyond a single affine map.",
        "Transformer feed-forward blocks reuse this dense-activation-dense pattern at each token position.",
      ],
      example: "A two-layer multilayer perceptron can compute input → dense → ReLU → dense → output score.",
    },
    Neuron: {
      definition: "A neuron is one output unit that computes a weighted input sum, adds a bias, and often applies an activation.",
      details: [
        "Its incoming weights determine how each input coordinate affects the unit.",
        "Many neurons evaluated together form the output vector of a layer.",
        "Modern code usually computes whole layers with matrix operations rather than individual neuron loops.",
      ],
      example: "One neuron can compute ReLU(0.5x1 - 2x2 + 0.1) from two input features.",
    },
    "Hidden layer": {
      definition: "A hidden layer produces an internal representation between the model input and final output.",
      details: [
        "Its values are learned intermediate features rather than supplied labels.",
        "Hidden width is the number of units or coordinates in that layer.",
        "Multiple hidden layers allow successive transformations to build more complex representations.",
      ],
      example: "A network can map 20 input features into a hidden layer of 64 learned activations.",
    },
    "Output layer": {
      definition: "The output layer maps the final hidden representation into the scores or values required by the task.",
      details: [
        "Regression may use one unrestricted output, while classification uses one or more class logits.",
        "Its width and activation must match the target representation and training loss.",
        "The output layer is learned jointly with the hidden layers through backpropagation.",
      ],
      example: "A ten-class digit network ends with ten output logits, one score for each digit.",
    },
    "Pre-activation": {
      definition: "A pre-activation is the affine layer output computed immediately before an activation function is applied.",
      details: [
        "For a dense layer it is commonly written z = Wx + b.",
        "The activation function transforms z into the layer's activated output h.",
        "Inspecting pre-activations can reveal saturation, extreme scale, or many values below a ReLU threshold.",
      ],
      example: "If Wx + b produces [-2, 0.5], that vector is the pre-activation before ReLU returns [0, 0.5].",
    },
    "Activation function": {
      definition: "An activation function transforms a layer's pre-activation values before they enter the next layer.",
      details: [
        "Nonlinear activations prevent stacked affine layers from collapsing into one affine transformation.",
        "ReLU, sigmoid, and tanh differ in their output ranges and derivative behavior; other nonlinear activations make different tradeoffs.",
        "The chosen activation affects gradient flow and which input-output patterns are easy to represent.",
      ],
      example: "Applying tanh to a pre-activation maps every coordinate into the interval from -1 to 1.",
    },
    "Forward pass": {
      definition: "A forward pass applies model operations from inputs to outputs using the current parameter values.",
      details: [
        "During training it produces predictions and intermediate activations needed to compute loss and gradients.",
        "During inference the same forward computation runs without a subsequent parameter update.",
        "Tensor shapes must line up at every operation along the forward path.",
      ],
      example: "One forward pass maps a batch of 32 feature rows through two layers into 32 output logits.",
    },
    "Computational graph": {
      definition: "A computational graph represents values as nodes and mathematical operations as connected dependencies.",
      details: [
        "The graph records how the final loss depends on parameters and intermediate values.",
        "Automatic differentiation traverses it backward to apply the chain rule.",
        "Dynamic frameworks can build a new graph from the operations executed during each forward pass.",
      ],
      example: "For loss(square(Wx - y)), graph edges connect W and x to prediction, residual, square, and loss.",
    },
    Backpropagation: {
      definition: "Backpropagation efficiently computes loss derivatives by moving backward through a computational graph.",
      details: [
        "It reuses intermediate derivatives rather than recomputing every parameter path independently.",
        "Each operation receives an upstream gradient and passes gradients to its own inputs.",
        "Backpropagation computes gradients; a separate optimizer decides how parameters are updated.",
      ],
      example: "After a forward loss, backpropagation computes gradients for W2 before propagating through ReLU to W1.",
    },
    "Parameter initialization": {
      definition: "Parameter initialization chooses starting weight and bias values before any training updates occur.",
      details: [
        "Identical initialization can keep supposedly different hidden units learning the same feature.",
        "Variance-aware schemes help keep activations and gradients from growing or shrinking rapidly across layers.",
        "Random seeds make an initialization reproducible but do not guarantee identical results across all hardware.",
      ],
      example: "Xavier initialization scales random weights according to the layer's input and output widths.",
    },
    "Vanishing gradient": {
      definition: "A vanishing gradient becomes extremely small as derivatives propagate toward earlier network layers.",
      details: [
        "Repeated multiplication by derivatives smaller than one can shrink the learning signal exponentially.",
        "Early layers then update very slowly even when the model loss remains high.",
        "Activation choice, initialization, normalization, and residual connections can reduce the problem.",
      ],
      example: "Multiplying a backward signal by 0.1 across ten layers shrinks it by a factor of ten billion.",
    },
    "Exploding gradient": {
      definition: "An exploding gradient grows extremely large during backpropagation and can destabilize parameter updates.",
      details: [
        "Repeated multiplication by large derivatives or poorly scaled weights can cause the growth.",
        "Symptoms include sudden loss spikes, infinities, not-a-number (NaN) values, and huge gradient norms.",
        "Gradient clipping limits the gradient passed to the optimizer, while initialization and architecture address deeper causes.",
      ],
      example: "A gradient norm jumping from 2 to one million can make a single optimizer step destroy learned weights.",
    },
    "Network depth and width": {
      definition: "Network depth counts successive layers, while width counts the units or features within a layer.",
      details: [
        "Increasing either can raise capacity, computation, and parameter count in different ways.",
        "Greater depth composes more transformations, while greater width carries more parallel features.",
        "Useful sizes depend on the task, data, optimization behavior, and resource budget.",
      ],
      example: "A model with four hidden layers of 256 units has hidden depth four and width 256.",
    },
  },
);

export const foundationExpansionLibrary = combineFlashcardLibraries(
  linearArrays,
  linearVectorOperations,
  linearGeometry,
  linearVectorSpaces,
  linearMatrices,
  linearBatches,
  linearSystemsAndDecompositions,
  mlData,
  mlGeneralization,
  mlRegressionAndLoss,
  mlOptimization,
  mlClassification,
  mlNeuralNetworks,
);
