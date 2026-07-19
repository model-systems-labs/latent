import {
  combineFlashcardLibraries,
  defineFlashcardGroup,
} from "../flashcard-schema";

const probabilityAndInformationTheory = defineFlashcardGroup(
  {
    subjectId: "machine-learning-basics",
    module: "Machine Learning Basics",
    lesson: "Probability and Information Theory",
    source: "Deisenroth, Faisal, and Ong, Mathematics for Machine Learning (2020), Probability and Distributions; Cover and Thomas, Elements of Information Theory, 2nd ed. (2006).",
  },
  {
    "Random variable": {
      definition: "A random variable assigns a numerical value to each possible outcome of a random process.",
      details: [
        "The randomness belongs to the outcome-generating process; the assignment rule itself is fixed.",
        "A discrete random variable has countable possible values, while a continuous one can range over an interval.",
        "Its probability distribution says how likely its possible values are before an outcome is observed.",
      ],
      example: "For one die roll, X can equal the number of dots shown, so X belongs to {1, 2, 3, 4, 5, 6}.",
    },
    "Probability distribution": {
      definition: "A probability distribution describes which values a random variable can take and how probability is allocated among them.",
      details: [
        "Discrete probabilities sum to one; a continuous probability density integrates to one over its full range.",
        "A density value is not itself the probability of one exact continuous value; probability comes from an interval's area.",
        "A model may learn distribution parameters, such as class probabilities or a Gaussian mean and variance.",
      ],
      example: "A fair six-sided die assigns probability 1/6 to each value from 1 through 6.",
    },
    "Expected value": {
      definition: "Expected value is the probability-weighted mean of a random variable, when that mean exists.",
      details: [
        "For a discrete variable, multiply each value by its probability and add the products.",
        "The expected value need not be an outcome the variable can actually take.",
        "Expectation is linear, so E[aX + bY] = aE[X] + bE[Y] even when X and Y are dependent.",
      ],
      example: "A fair die has expected value (1 + 2 + 3 + 4 + 5 + 6) / 6 = 3.5, although no roll shows 3.5 dots.",
    },
    Variance: {
      definition: "Variance measures expected squared distance from a random variable's mean.",
      details: [
        "It is defined as E[(X - E[X])²] and is never negative.",
        "Squaring makes large deviations count heavily and gives variance squared units.",
        "The identity Var(X) = E[X²] - E[X]² is often convenient for calculation.",
      ],
      example: "A fair Bernoulli variable that is 0 or 1 has mean 0.5 and variance 0.25.",
    },
    "Standard deviation": {
      definition: "Standard deviation is the square root of variance, expressing typical spread in the random variable's original units.",
      details: [
        "It equals zero only when the variable is constant with probability one.",
        "Multiplying every value by a scales the standard deviation by |a|.",
        "Standard deviation describes spread around the mean; it is not the same as mean absolute distance from the mean.",
      ],
      example: "If prediction errors have variance 9 square degrees, their standard deviation is 3 degrees.",
    },
    "Joint distribution": {
      definition: "A joint distribution describes how probability is assigned to combinations of two or more random variables.",
      details: [
        "For discrete variables, it gives a probability for each value combination; for continuous variables, it may be represented by a joint density.",
        "Its probability masses sum to one, or its density integrates to one, across all combinations.",
        "A joint distribution contains the information needed to derive marginal and conditional distributions.",
      ],
      example: "P(rain and heavy traffic) is one entry in a joint distribution over weather and traffic conditions.",
    },
    "Marginal distribution": {
      definition: "A marginal distribution describes one or more selected variables after all other variables in a joint distribution are summed or integrated out.",
      details: [
        "For discrete variables, add the relevant joint-probability entries across every value being removed.",
        "Marginalization does not condition on the removed variable; it averages over its possible values.",
        "The result is a valid distribution over the variables that remain.",
      ],
      example: "P(rain) equals P(rain and light traffic) plus P(rain and heavy traffic) in a two-traffic-state table.",
    },
    "Conditional probability": {
      definition: "Conditional probability measures an event's chance after another event is known to have occurred.",
      details: [
        "When P(B) is positive, P(A | B) = P(A and B) / P(B).",
        "Conditioning restricts attention to outcomes consistent with the observed event.",
        "A changed conditional probability shows association, not by itself a causal effect.",
      ],
      example: "If 30 of 100 days are rainy and 18 of those rainy days have heavy traffic, P(heavy traffic | rain) = 18/30.",
    },
    "Bayes’ rule": {
      definition: "Bayes’ rule reverses a conditional probability by combining a prior probability with the likelihood of observed evidence.",
      details: [
        "When P(E) > 0, P(H | E) = P(E | H)P(H) / P(E) for hypothesis H and evidence E.",
        "The denominator accounts for every way the evidence could occur, not only the hypothesis of interest.",
        "A rare hypothesis can remain unlikely after a positive signal when false positives are common relative to its base rate.",
      ],
      example: "With a 1% defect rate, 90% detection, and 5% false-positive rate, a flagged item is defective with probability about 15.4%.",
    },
    "Statistical independence": {
      definition: "Two random variables are statistically independent when learning one does not change the probability distribution of the other.",
      details: [
        "For discrete variables, p(x, y) = p_X(x)p_Y(y) for every value pair; continuous densities factor the same way when those densities exist.",
        "Independence implies zero covariance when the needed moments exist, but zero covariance does not generally imply independence.",
        "Pairwise independence among several variables is weaker than mutual independence of the full collection.",
      ],
      example: "The outcomes of two separate fair coin flips are independent because the first result does not change the second flip's probabilities.",
    },
    Entropy: {
      definition: "Entropy measures the average uncertainty, or expected information content, in draws from a probability distribution.",
      details: [
        "For a discrete distribution, H(X) = -Σ p(x) log p(x).",
        "A deterministic variable has entropy zero, while a uniform distribution over a fixed finite set has maximum entropy.",
        "Log base 2 reports bits; the natural logarithm reports nats.",
      ],
      example: "A fair coin has entropy -0.5 log₂(0.5) - 0.5 log₂(0.5) = 1 bit.",
    },
    "Cross-entropy": {
      definition: "Cross-entropy measures the average negative log probability that a model distribution assigns to outcomes drawn from a target distribution.",
      details: [
        "It is H(p, q) = -E under p of log q, where p is the target distribution and q is the model distribution.",
        "Cross-entropy equals the target entropy plus KL divergence from the target to the model.",
        "For a one-hot class target, it reduces to the negative log probability assigned to the correct class.",
      ],
      example: "For p = [0.5, 0.5] and q = [0.75, 0.25], H(p, q) = -0.5 ln(0.75) - 0.5 ln(0.25), about 0.837 nats.",
    },
    "KL divergence": {
      definition: "Kullback–Leibler divergence measures the expected log-probability gap when distribution q is used in place of distribution p.",
      details: [
        "For discrete distributions, KL(p || q) = Σ p(x) log(p(x) / q(x)).",
        "It is non-negative and zero when the distributions agree almost everywhere, but it is not symmetric and is not a distance metric.",
        "It becomes infinite if q assigns zero probability to an outcome that has positive probability under p.",
      ],
      example: "For p = [0.5, 0.5] and q = [0.75, 0.25], KL(p || q) is about 0.144 nats.",
    },
    "Mutual information": {
      definition: "Mutual information measures how much knowing one random variable reduces uncertainty about another.",
      details: [
        "It equals the KL divergence between the joint distribution and the product of the two marginal distributions.",
        "It is symmetric, non-negative, and zero exactly when the variables are independent under the distribution.",
        "Unlike correlation, it can capture nonlinear statistical dependence.",
      ],
      example: "If Y is an exact copy of one fair random bit X, then X and Y share 1 bit of mutual information.",
    },
  },
);

const multivariableCalculus = defineFlashcardGroup(
  {
    subjectId: "machine-learning-basics",
    module: "Machine Learning Basics",
    lesson: "Multivariable Calculus",
    source: "Deisenroth, Faisal, and Ong, Mathematics for Machine Learning (2020), Vector Calculus and Continuous Optimization; MIT OpenCourseWare, 18.02SC Multivariable Calculus; Boyd and Vandenberghe, Convex Optimization (2004).",
  },
  {
    "Total derivative": {
      definition: "The total derivative is the linear map that best approximates how all outputs change when all inputs change slightly.",
      details: [
        "It accounts for several inputs changing together instead of holding all but one fixed.",
        "For a scalar output and small input change dx, the total change is approximately df = ∇f · dx.",
        "For a vector output, the Jacobian represents the total derivative.",
      ],
      example: "For f(x, y) = x²y + 3y at (2, 1), df ≈ 4 dx + 7 dy.",
    },
    "Directional derivative": {
      definition: "A directional derivative measures a function's local rate of change while moving from a point in a specified direction.",
      details: [
        "For a differentiable scalar function and unit direction u, the directional derivative is ∇f · u.",
        "Normalizing the direction separates direction from step size.",
        "The gradient direction gives the largest first-order increase, while its opposite gives the largest decrease.",
      ],
      example: "For f(x, y) = x² + y² at (1, 2), the derivative along u = (3/5, 4/5) is (2, 4) · u = 22/5 = 4.4.",
    },
    Jacobian: {
      definition: "A Jacobian is the matrix of all first partial derivatives of a vector-valued function with respect to its input coordinates.",
      details: [
        "With m outputs and n inputs, the common row-output convention gives an m-by-n Jacobian.",
        "Near one point, the Jacobian is the best first-order linear map from a small input change to the output change.",
        "The multivariable chain rule composes functions by multiplying their Jacobians in dependency order.",
      ],
      example: "For f(x, y) = (x + y, xy), J = [[1, 1], [y, x]], so J(2, 3) = [[1, 1], [3, 2]].",
    },
    Hessian: {
      definition: "A Hessian is the square matrix of second partial derivatives of a scalar-valued function.",
      details: [
        "It describes local curvature and supplies the quadratic term in a second-order approximation.",
        "When mixed partials are continuous, the Hessian is symmetric.",
        "For a twice-differentiable function on an open convex domain, the function is convex exactly when its Hessian is positive semidefinite everywhere.",
      ],
      example: "For f(x, y) = x² + 3xy + 2y², the Hessian is [[2, 3], [3, 4]]; its determinant is -1, so it is indefinite and the function is not convex.",
    },
  },
);

const coreRegularizationAndGeneralization = defineFlashcardGroup(
  {
    subjectId: "machine-learning-basics",
    module: "Machine Learning Basics",
    lesson: "Regularization and Generalization",
    source: "Goodfellow, Bengio, and Courville, Deep Learning, Regularization for Deep Learning (2016).",
  },
  {
    "L1 regularization": {
      definition: "L1 regularization adds a penalty proportional to the sum of the absolute values of selected model parameters.",
      details: [
        "Its coefficient controls the tradeoff between fitting the training data and keeping parameters small.",
        "The corner at zero can promote sparse solutions, but whether exact zeros appear depends on the objective and optimization method.",
        "Feature scaling matters because the same predictive effect can otherwise require very different coefficient sizes.",
      ],
      example: "For weights [-2, 0.5, 0] and λ = 0.1, the L1 penalty added to the loss is 0.1 × (2 + 0.5 + 0) = 0.25.",
    },
    "L2 regularization": {
      definition: "L2 regularization adds a penalty proportional to the sum of squared selected model parameters.",
      details: [
        "Its gradient grows with parameter magnitude, continuously pulling large weights toward zero.",
        "It usually spreads shrinkage across many weights rather than producing the exact zeros commonly associated with L1.",
        "Implementations must state whether biases, embeddings, or normalization parameters are included in the penalty.",
      ],
      example: "Adding λ(w₁² + w₂²) to a regression loss discourages a solution that relies on very large coefficients.",
    },
    "Early stopping": {
      definition: "Early stopping ends training when held-out validation performance stops improving enough to justify further updates.",
      details: [
        "The validation rule, minimum improvement, and patience window should be chosen before inspecting test results.",
        "Training commonly restores the best validation checkpoint rather than keeping the final attempted epoch.",
        "Stopping sooner can act as regularization by limiting how closely parameters fit training-specific noise.",
      ],
      example: "If validation loss reaches its minimum at epoch 18 and worsens for five more epochs, training can restore epoch 18.",
    },
  },
);

const weightDecayRegularization = defineFlashcardGroup(
  {
    subjectId: "machine-learning-basics",
    module: "Machine Learning Basics",
    lesson: "Regularization and Generalization",
    source: "Loshchilov and Hutter, Decoupled Weight Decay Regularization (2019).",
  },
  {
    "Weight decay": {
      definition: "Weight decay directly shrinks selected parameters during each optimizer update.",
      details: [
        "A simple decay step multiplies a weight by a factor slightly below one before or alongside the gradient update.",
        "For plain stochastic gradient descent, weight decay can match an L2 penalty up to coefficient convention.",
        "With adaptive optimizers, decoupled weight decay such as AdamW is generally not equivalent to adding L2 loss.",
      ],
      example: "With learning rate 0.001 and decay coefficient 0.01, AdamW applies a 0.99999 weight multiplier separately from its adaptive gradient calculation.",
    },
  },
);

const dropoutRegularization = defineFlashcardGroup(
  {
    subjectId: "machine-learning-basics",
    module: "Machine Learning Basics",
    lesson: "Regularization and Generalization",
    source: "Srivastava et al., Dropout: A Simple Way to Prevent Neural Networks from Overfitting (2014).",
  },
  {
    Dropout: {
      definition: "Dropout is a training-time regularizer that randomly sets selected activations to zero on each forward pass.",
      details: [
        "Different random masks expose the network to many thinned computation paths during training.",
        "Inverted dropout rescales surviving activations during training so no matching rescale is needed at inference.",
        "Dropout is normally disabled for evaluation and deployment predictions.",
      ],
      example: "With dropout rate 0.2, each eligible hidden activation has a 20% chance of being zeroed on a training pass.",
    },
  },
);

const evaluationMetricsAndCalibration = defineFlashcardGroup(
  {
    subjectId: "machine-learning-basics",
    module: "Machine Learning Basics",
    lesson: "Evaluation and Uncertainty",
    source: "scikit-learn Developers, Model evaluation and Probability calibration guides.",
  },
  {
    "Probability calibration": {
      definition: "Probability calibration asks whether predictions assigned probability p occur about a p fraction of the time among comparable cases.",
      details: [
        "A reliability diagram groups predictions into probability ranges and compares confidence with observed frequency.",
        "Calibration and ranking quality are different: a model can rank cases well while reporting distorted probabilities.",
        "Post-training calibration must be fit on held-out data rather than on the final test set.",
      ],
      example: "Among 1,000 cases predicted near 0.7, a calibrated model should see roughly 700 positive outcomes.",
    },
    "F1 score": {
      definition: "F1 score is the harmonic mean of precision and recall for a chosen positive class and decision rule.",
      details: [
        "Equivalently, F1 = 2TP / (2TP + FP + FN); when the denominator is zero, the software convention must be stated.",
        "Because it ignores true negatives, F1 can hide performance that matters for the negative class.",
        "Changing the classification threshold changes precision, recall, and therefore F1.",
      ],
      example: "Precision 0.75 and recall 0.60 give F1 = 2 × 0.75 × 0.60 / 1.35, about 0.667.",
    },
    Specificity: {
      definition: "Specificity is the fraction of actual negative cases correctly predicted as negative.",
      details: [
        "It is TN / (TN + FP), also called the true-negative rate.",
        "One minus specificity is the false-positive rate used on a ROC curve.",
        "Its meaning depends on which class is designated positive and on the selected decision threshold.",
      ],
      example: "With 90 true negatives and 10 false positives, specificity is 90 / 100 = 0.90.",
    },
    "ROC curve": {
      definition: "A receiver operating characteristic curve plots true-positive rate against false-positive rate as a score threshold changes.",
      details: [
        "Each point corresponds to a particular threshold or an equivalent ordering boundary.",
        "The curve evaluates score ranking across thresholds rather than one deployed operating point.",
        "With a very rare positive class, a small false-positive rate can still produce many false alerts, so precision must also be checked.",
      ],
      example: "Lowering a fraud threshold may move a model from (FPR 0.01, TPR 0.60) to (FPR 0.04, TPR 0.85).",
    },
    "Precision-recall curve": {
      definition: "A precision-recall curve plots precision against recall as a classifier's score threshold changes.",
      details: [
        "It focuses directly on performance for the positive class and is especially useful when positives are rare.",
        "The no-skill precision baseline equals positive-class prevalence for a random ranking in expectation.",
        "A deployed threshold should reflect the real cost of missed positives and false alerts, not only curve shape.",
      ],
      example: "Lowering a disease-screening threshold can raise recall from 0.70 to 0.90 while precision falls from 0.40 to 0.22.",
    },
    "ROC-AUC": {
      definition: "ROC-AUC is the area under a receiver operating characteristic curve and summarizes how well scores rank positive cases above negative cases across thresholds.",
      details: [
        "For scores in a binary-classification task, ROC-AUC is the probability that a randomly chosen positive outranks a randomly chosen negative, with half credit for ties.",
        "A random ranking has expected ROC-AUC 0.5, while perfect separation gives 1.",
        "ROC-AUC can hide weak performance in the false-positive-rate range a product actually uses.",
      ],
      example: "If 80 of 100 positive-negative pairs are correctly ordered and 10 are tied, ROC-AUC is (80 + 0.5 × 10) / 100 = 0.85.",
    },
  },
);

const evaluationUncertainty = defineFlashcardGroup(
  {
    subjectId: "machine-learning-basics",
    module: "Machine Learning Basics",
    lesson: "Evaluation and Uncertainty",
    source: "NIST/SEMATECH, e-Handbook of Statistical Methods.",
  },
  {
    "Standard error": {
      definition: "A statistic's standard error is the standard deviation of its sampling distribution: how much the statistic varies across repeated samples from the same procedure.",
      details: [
        "It describes uncertainty in an estimate, whereas standard deviation describes spread among observed values.",
        "For IID observations with finite variance, the sample mean's standard error is commonly estimated by s / √n.",
        "Dependence, clustering, weighting, and complex sampling require a standard-error method that respects the data design.",
      ],
      example: "If 36 measurements are sampled independently from the same population and have sample standard deviation 12, the mean's estimated standard error is 12 / 6 = 2.",
    },
    "Confidence interval": {
      definition: "A confidence interval is a range produced by a procedure designed to cover the target parameter at a stated long-run rate under its assumptions.",
      details: [
        "A 95% procedure covers the fixed true parameter in about 95% of repeated valid samples; it does not make that parameter random after the interval is observed.",
        "Common intervals combine an estimate, its standard error, and a sampling-distribution multiplier.",
        "Coverage can fail when assumptions, sample size, dependence, or interval construction do not fit the data.",
      ],
      example: "Using estimate 50, standard error 2, and multiplier 1.96 gives the approximate 95% interval [46.08, 53.92].",
    },
  },
);

const bootstrapUncertainty = defineFlashcardGroup(
  {
    subjectId: "machine-learning-basics",
    module: "Machine Learning Basics",
    lesson: "Evaluation and Uncertainty",
    source: "Efron and Tibshirani, An Introduction to the Bootstrap (1993).",
  },
  {
    "Bootstrap resampling": {
      definition: "Bootstrap resampling approximates a statistic's sampling distribution by repeatedly sampling observed cases with replacement.",
      details: [
        "A standard bootstrap replicate draws the original sample size, so some cases repeat and others are absent.",
        "The distribution of replicate statistics can estimate standard errors, bias, or confidence intervals.",
        "Time series, clusters, and other dependent data need a structured bootstrap rather than independent row resampling.",
      ],
      example: "From 500 users, draw 1,000 replacement samples of 500 users each and recompute accuracy to study its uncertainty.",
    },
  },
);

export const mlPrerequisiteFlashcardLibrary = combineFlashcardLibraries(
  probabilityAndInformationTheory,
  multivariableCalculus,
  coreRegularizationAndGeneralization,
  weightDecayRegularization,
  dropoutRegularization,
  evaluationMetricsAndCalibration,
  evaluationUncertainty,
  bootstrapUncertainty,
);
