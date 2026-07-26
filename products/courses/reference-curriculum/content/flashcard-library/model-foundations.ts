import {
  combineFlashcardLibraries,
  defineFlashcardGroup,
} from "../flashcard-schema";

const characterRnnCards = defineFlashcardGroup(
  {
    subjectId: "model-foundations",
    module: "Model Foundations",
    lesson: "Character RNNs",
    source:
      "Karpathy, The Unreasonable Effectiveness of Recurrent Neural Networks (2015); Hochreiter and Schmidhuber, Long Short-Term Memory (1997); Gers, Schmidhuber, and Cummins, Learning to Forget (2000).",
  },
  {
    "Sequence model": {
      definition:
        "Some data must be read in order. A sequence model uses that order when mapping one or more positions to predictions.",
      details: [
        "Formally, the input or output is an ordered sequence whose length may vary between examples.",
        "Language, audio, video frames, and time-series measurements are common sequence-model inputs.",
        "A sequence model is not merely a model that receives a fixed vector with shuffled coordinates.",
      ],
      example:
        "Predicting the letter after th requires preserving that t came before h, not just seeing both letters.",
    },
    "Recurrent neural network": {
      definition:
        "A recurrent neural network reads ordered inputs by repeatedly applying one learned step and carrying numeric memory forward.",
      details: [
        "The recurrent step combines the current input vector with the hidden state from the previous position.",
        "The same learned transition parameters are used whether a sequence contains ten positions or one hundred.",
        "Recurrence does not guarantee perfect long-term memory; information can still fade or be overwritten.",
      ],
      example:
        "After reading the characters c, a, and t, the network's state helps it predict what character may follow cat.",
    },
    "Character-level language model": {
      definition:
        "A character-level language model predicts the next character from the characters that appeared earlier in the text.",
      details: [
        "Its vocabulary contains characters such as letters, punctuation marks, spaces, and line-break symbols.",
        "Training creates one next-character target at every usable position in the training sequence.",
        "Learning spelling and formatting patterns does not mean the model understands every generated statement.",
      ],
      example:
        "Given the prefix receiv, the model may assign its highest next-character probability to the letter e.",
    },
    "One-hot character encoding": {
      definition:
        "A one-hot encoding identifies one character with a vector containing one 1 and zeros in every other vocabulary slot.",
      details: [
        "The active coordinate is the integer vocabulary index assigned to the current character.",
        "Every one-hot vector has the same width even though only one coordinate carries the identity.",
        "Distances between one-hot vectors do not express learned similarity between the represented characters.",
      ],
      example:
        "With the vocabulary space, a, b, the character a can be represented by the vector [0, 1, 0].",
    },
    "Recurrent transition": {
      definition:
        "The recurrent transition is the calculation that turns the current input and previous state into the next hidden state.",
      details: [
        "A vanilla transition computes tanh of an input projection, a recurrent projection, and a bias added together.",
        "Both the current symbol and the accumulated past can therefore influence the next numeric memory.",
        "Leaving out the previous-state term produces a feed-forward calculation rather than genuine recurrence.",
      ],
      example:
        "The state after reading h differs depending on whether the earlier character was t or s, even with the same h input.",
    },
    "Parameter sharing through time": {
      definition:
        "The model reuses one set of recurrent weights at every sequence position instead of learning separate weights for each position.",
      details: [
        "Sharing lets the same transition process patterns that occur early or late in a sequence.",
        "Gradients from all unrolled positions contribute to updates of those shared parameter matrices.",
        "The inputs and hidden states change over time, but the shared weights do not change within one forward pass.",
      ],
      example:
        "The same matrix that processes the first letter in signal also processes the final letter in signal.",
    },
    "Hyperbolic tangent activation": {
      definition:
        "This function smoothly squeezes any finite real number strictly between negative one and positive one.",
      details: [
        "Formally, tanh is applied coordinate by coordinate after the recurrent projections and bias are added.",
        "Its nonlinearity lets stacked recurrent steps represent more than one overall linear transformation.",
        "Bounding state values does not by itself prevent gradients from vanishing across many recurrent steps.",
      ],
      example:
        "A pre-activation value of 2 becomes about 0.964 after tanh, while a value of 0 remains 0.",
    },
    "Unrolled recurrent graph": {
      definition:
        "An unrolled graph draws the repeated recurrent calculation as a separate copy at each position so information flow is visible.",
      details: [
        "Each drawn copy has its own input and state values while pointing to the same shared parameters.",
        "The hidden-state edge connects one position's new state to the next position's recurrent calculation.",
        "Unrolling is a way to view the computation; it does not create independently trained recurrent layers.",
      ],
      example:
        "The three inputs c, a, t can be drawn as three columns connected by two hidden-state arrows.",
    },
    "Backpropagation through time": {
      definition:
        "Training sends credit and blame backward across the repeated sequence steps, a procedure called backpropagation through time.",
      details: [
        "Formally, the chain rule differentiates each loss through the unrolled recurrent computation graph.",
        "Because parameters are shared, gradient contributions from different time positions are accumulated together.",
        "This procedure does not mean the model literally reverses the input sequence during its forward pass.",
      ],
      example:
        "An error on the final o in hello can update the transition that processed the earlier h, e, and l characters.",
    },
    "Truncated backpropagation through time": {
      definition:
        "Instead of tracing gradients through an entire long corpus, training can stop the backward path after a fixed number of steps.",
      details: [
        "This bounded procedure is formally called truncated backpropagation through time, or truncated BPTT.",
        "Shorter windows reduce memory and computation costs while limiting how far direct gradient credit can travel.",
        "Truncation does not erase the forward hidden state automatically; it cuts the backward dependency path.",
      ],
      example:
        "A trainer may carry state across a document but differentiate only through the most recent 32 characters.",
    },
    "Temporal credit assignment": {
      definition:
        "The model must determine which earlier events contributed to a later prediction error, even when they are far apart.",
      details: [
        "Temporal credit assignment is the formal name for distributing learning signal across ordered time steps.",
        "Backpropagation through time estimates this credit using derivatives along the recurrent state path.",
        "A large late error does not imply that every earlier input deserves an equally large parameter update.",
      ],
      example:
        "For an unclosed quotation mark, training should credit the earlier opening mark more than an unrelated nearby vowel.",
    },
    "Exploding gradients through time": {
      definition:
        "Exploding gradients through time occur when a recurrent learning signal grows rapidly as it travels backward across many sequence positions.",
      details: [
        "Backpropagation through time repeatedly multiplies hidden-state Jacobians, so factors larger than one can amplify distant contributions.",
        "The problem is specifically about the temporal path through an unrolled recurrent graph, not merely a large gradient in one feed-forward layer.",
        "Shared recurrent weights collect contributions from many positions, allowing one unstable temporal path to distort the eventual parameter update.",
      ],
      example:
        "If one backward component doubles at each of ten recurrent steps, its contribution grows from 1 at the last character to 1,024 at the first.",
    },
    "Vanishing gradients through time": {
      definition:
        "Vanishing gradients through time occur when a recurrent learning signal shrinks toward zero before reaching distant earlier sequence positions.",
      details: [
        "Backpropagation through time repeatedly multiplies derivatives along the hidden-state path, so factors below one can erase distant credit.",
        "The failure is temporal: a model may learn nearby character relationships while receiving almost no update from much earlier evidence.",
        "A tiny backward signal does not mean the forward hidden state is zero; information can exist in activations without receiving useful gradient credit.",
      ],
      example:
        "A closing quote's error multiplied by 0.5 across ten recurrent steps sends less than one thousandth of its signal to the opening quote.",
    },
    "Gradient clipping": {
      definition:
        "Gradient clipping limits an unusually large learning signal before the optimizer uses it to change model parameters.",
      details: [
        "Value clipping caps each component, while norm clipping rescales a complete gradient when its length is too large.",
        "The technique can stabilize recurrent training when occasional backward paths amplify sharply.",
        "Clipping controls update size but does not repair an incorrect loss function or eliminate vanishing gradients.",
      ],
      example:
        "With component clipping at 5, the gradient vector [-12, 2, 20] becomes [-5, 2, 5].",
    },
    "Long Short-Term Memory": {
      definition:
        "An LSTM is a recurrent network that uses learned gates and a cell state to control what information persists over time.",
      details: [
        "Input, forget, and output gates regulate how the cell state is written, retained, and exposed.",
        "The gated path was designed to improve learning dynamics for dependencies that span many recurrent steps.",
        "The browser lesson trains a smaller vanilla RNN, so it does not reproduce the essay's multilayer LSTM results.",
      ],
      example:
        "An LSTM forget gate can preserve an opening delimiter signal until the model reaches its matching close delimiter.",
    },
    "Cell state": {
      definition:
        "The cell state is an LSTM's internal memory value, carried from one sequence position to the next along a gated recurrent path.",
      details: [
        "A candidate update can write new information into the state while a retention term decides how much previous memory remains.",
        "The cell state is distinct from the exposed hidden state, although the output gate uses the cell state to produce that hidden output.",
        "An additive update path can preserve information and gradient credit more effectively than repeatedly replacing all memory with a squashed activation.",
      ],
      example:
        "While reading a quoted sentence, one cell-state coordinate can retain that a quote is open until the closing mark appears.",
    },
    "Input gate": {
      definition:
        "The input gate is an LSTM control that chooses how strongly new candidate information is written into the cell state.",
      details: [
        "A sigmoid produces values between zero and one that multiply the candidate update coordinate by coordinate.",
        "A value near zero protects existing memory from the current input, while a value near one admits most of the candidate.",
        "The gate is learned from the current input and previous hidden state rather than set by a handwritten rule.",
      ],
      example:
        "On an ordinary filler word, an input-gate value of 0.03 can keep a candidate update from overwriting stored subject-number information.",
    },
    "Forget gate": {
      definition:
        "The forget gate is an LSTM control that chooses how much of the previous cell state survives into the next sequence position.",
      details: [
        "A sigmoid retention value multiplies each previous cell-state coordinate, with zero erasing it and one preserving it.",
        "The original 1997 LSTM used a fixed self-connection; the learned forget gate was introduced in the later Learning to Forget extension.",
        "Selective forgetting helps a model reset stale memory at boundaries without discarding every useful long-range signal.",
      ],
      example:
        "At the start of a new document, a forget-gate value near zero can clear a cell coordinate that tracked the prior document's topic.",
    },
    "Output gate": {
      definition:
        "The output gate is an LSTM control that chooses how much of the updated cell state becomes visible as the current hidden state.",
      details: [
        "Its sigmoid values multiply a squashed view of the cell state before that result is passed to predictions and the next recurrent step.",
        "A closed output gate can keep information stored internally even when the model should not expose it at the current position.",
        "Controlling exposure is different from forgetting: hidden output can be suppressed while the underlying cell memory remains.",
      ],
      example:
        "A cell can remember a pending closing delimiter while its output gate stays low until the surrounding syntax makes that memory useful.",
    },
    "Constant error carousel": {
      definition:
        "The constant error carousel is the original LSTM memory-cell path designed to carry state and error through time without repeated shrinkage or growth.",
      details: [
        "Its linear self-connection used a fixed weight of one, so the internal derivative along that path remained one across recurrent steps.",
        "Input and output gates controlled access to the memory while the carousel preserved its internal temporal credit path.",
        "Later forget-gate LSTMs replaced unconditional retention with a learned multiplier, so their memory path is not literally constant at every step.",
      ],
      example:
        "Across twenty quiet time steps, a unit-weight carousel can carry a stored delimiter signal without multiplying it by tanh derivatives twenty times.",
    },
  },
);

const neuralLanguageModelCards = defineFlashcardGroup(
  {
    subjectId: "model-foundations",
    module: "Model Foundations",
    lesson: "Neural Language Models",
    source:
      "Bengio et al., A Neural Probabilistic Language Model (2003); Mikolov et al., Efficient Estimation of Word Representations in Vector Space (2013); Mikolov et al., Distributed Representations of Words and Phrases and their Compositionality (2013).",
  },
  {
    "Neural probabilistic language model": {
      definition:
        "This model uses a neural network to assign probabilities to word sequences while learning useful numeric word representations.",
      details: [
        "It estimates a next-word conditional distribution from a fixed or learned representation of earlier words.",
        "The word vectors and probability function are optimized together from prediction errors in the corpus.",
        "Neural probability estimates still depend on training data and do not make every unseen sentence sensible.",
      ],
      example:
        "Training on the analyst reads can help the model score the researcher reads through similar learned vectors.",
    },
    "Joint sequence probability": {
      definition:
        "The probability of a complete word sequence can be built by multiplying the conditional probability of each word in order.",
      details: [
        "The chain rule writes P(w1 through wn) as a product of each P(wt given the earlier words).",
        "Language-model training usually optimizes the logarithms of these conditional factors for numerical convenience.",
        "A high probability for each isolated word does not determine a high probability for every ordering of those words.",
      ],
      example:
        "A three-word sequence score multiplies P(the), P(signal given the), and P(faded given the signal).",
    },
    "N-gram language model": {
      definition:
        "An n-gram model predicts from an exact short window of earlier items by counting how often those local patterns occur.",
      details: [
        "A trigram next-word estimate uses the two preceding words together with the candidate next word.",
        "Smoothing methods reserve probability for patterns whose exact counts are missing or very small.",
        "Seeing a similar word in another context does not automatically help a plain count table generalize.",
      ],
      example:
        "The count for the quiet signal does not directly supply a count for the silent signal in a basic trigram table.",
    },
    "Data sparsity": {
      definition:
        "Most possible combinations of words never appear in a finite training set, leaving the observed count table mostly empty.",
      details: [
        "Sparsity becomes more severe as the vocabulary grows or the model uses longer exact context windows.",
        "Learned representations share statistical strength between words and contexts that behave similarly.",
        "Sparse observations do not imply that the missing language sequences are all impossible or ungrammatical.",
      ],
      example:
        "A corpus may contain the analyst reads but never the researcher reads even though both are ordinary sentences.",
    },
    "Curse of dimensionality": {
      definition:
        "The number of possible word combinations grows so quickly that available examples cover only a tiny portion of the space.",
      details: [
        "This rapid combinatorial growth is formally called the curse of dimensionality in the Bengio paper.",
        "Distributed word vectors support generalization to nearby combinations rather than requiring every exact sequence.",
        "The phrase does not mean that adding any single feature always makes a model worse.",
      ],
      example:
        "A vocabulary of 10,000 words permits one trillion distinct three-word sequences before considering longer contexts.",
    },
    "Vocabulary ID": {
      definition:
        "A vocabulary ID is the stable integer assigned to one word or token so arrays can index its learned parameters.",
      details: [
        "The mapping from text symbols to integer IDs belongs to the tokenizer and model interface.",
        "An ID selects rows in embedding tables and positions in output probability vectors.",
        "The integer itself has no numeric meaning; token 20 is not inherently twice token 10.",
      ],
      example:
        "If signal has ID 17, the model reads embedding row 17 and its target probability from output slot 17.",
    },
    "Embedding lookup": {
      definition:
        "Embedding lookup retrieves the learned vector stored at the table row named by a token's vocabulary ID.",
      details: [
        "A batch of token IDs selects several rows without multiplying by an explicit one-hot matrix.",
        "Only rows selected by the current examples receive direct gradient contributions from that lookup path.",
        "Lookup returns learned coordinates; it does not search a dictionary definition or external knowledge base.",
      ],
      example:
        "IDs [4, 17] select two embedding rows that can be averaged into one two-word context representation.",
    },
    "Distributed word representation": {
      definition:
        "A word is represented by a pattern spread across many learned coordinates rather than one dedicated meaning coordinate.",
      details: [
        "Different coordinates can jointly support several syntactic and semantic distinctions used by prediction.",
        "Nearby distributed representations let one training sentence inform predictions for related word sequences.",
        "No individual coordinate is guaranteed to have a stable human-readable definition across training runs.",
      ],
      example:
        "Vectors for analyst and researcher may share several predictive coordinates without being identical copies.",
    },
    "Embedding-space geometry": {
      definition:
        "Distances and directions between learned vectors describe the predictive relationships created during training.",
      details: [
        "Nearest neighbors are words whose coordinates are close under a chosen distance or similarity measure.",
        "Geometry can reflect both semantic relationships and grammatical behavior found in the corpus.",
        "A nearby vector is evidence of learned predictive similarity, not proof that two words are synonyms.",
      ],
      example:
        "Reads and writes may become neighbors because they appear after similar subjects and before similar objects.",
    },
    "Continuous Bag-of-Words (CBOW)": {
      definition:
        "Continuous Bag-of-Words is a word2vec training architecture that uses nearby context words to predict the word in the middle.",
      details: [
        "The context embeddings are combined into one representation before the model scores candidate center words.",
        "Bag-of-words means the basic architecture ignores the order of context positions, even though it still uses a bounded window.",
        "CBOW reverses Skip-gram's prediction direction: many surrounding words predict one target rather than one center word predicting its neighbors.",
      ],
      example:
        "Given the context river ___ quietly, CBOW can combine river and quietly to learn that flows is a plausible missing center word.",
    },
    "Skip-gram": {
      definition:
        "Skip-gram is a word2vec training architecture that uses one center word to predict words found near it in the corpus.",
      details: [
        "A context window turns one sentence position into several center-context training pairs at different nearby offsets.",
        "The architecture learns useful embeddings from the prediction task even when those vectors are the desired artifact rather than full language-model probabilities.",
        "Skip-gram specifies which relationships are predicted, while negative sampling or hierarchical softmax specifies how those predictions are trained efficiently.",
      ],
      example:
        "For planets orbit the sun, the center word orbit can create separate positive pairs with planets, the, and sun.",
    },
    "Language-model context window": {
      definition:
        "The context window is the bounded set of earlier tokens that a language model can use for one prediction.",
      details: [
        "The 2003 model uses a fixed number of previous words as the input to its probability function.",
        "A longer useful context can disambiguate predictions that look identical under a shorter local history.",
        "Placing text inside the window does not guarantee that the model will retain or use every detail equally.",
      ],
      example:
        "The next word bank is easier to predict from deposited cash at the than from a one-word window containing only the.",
    },
    "Vocabulary logit": {
      definition:
        "A vocabulary logit is one unrestricted raw score produced for a possible next token before probabilities are normalized.",
      details: [
        "The output projection creates one logit for every item in the model's output vocabulary.",
        "Only differences between logits affect softmax probabilities, so adding the same constant to every vocabulary logit changes nothing.",
        "A logit can be negative or larger than one because it is not itself a probability.",
      ],
      example:
        "Logits [1.2, 0.1, -0.4] can become probabilities near [0.65, 0.22, 0.13] after softmax.",
    },
    "Stable softmax": {
      definition:
        "Stable softmax converts raw scores into probabilities while avoiding unnecessarily huge exponential values.",
      details: [
        "Subtracting the largest logit leaves every softmax probability mathematically unchanged.",
        "Exponentiating the shifted scores and dividing by their sum produces positive values totaling one.",
        "Applying exponentiation directly to very large logits can overflow even when the desired probabilities are ordinary.",
      ],
      example:
        "Scores [1001, 1000, 999] can be shifted to [0, -1, -2] before computing the same probabilities.",
    },
    "Negative log-likelihood": {
      definition:
        "This loss turns the probability assigned to the real target into a penalty using the negative natural logarithm.",
      details: [
        "Formally, one target contributes minus log of P(target), which falls as target probability rises.",
        "A small probability floor prevents taking the logarithm of exact zero in finite-precision code.",
        "The loss must read the known target slot, not whichever token happens to have the largest prediction.",
      ],
      example:
        "Assigning the target probability 0.8 costs about 0.22, while probability 0.1 costs about 2.30.",
    },
    Perplexity: {
      definition:
        "Perplexity converts average next-token log loss into an effective number of equally plausible choices.",
      details: [
        "It is computed as the exponential of average negative log-likelihood under a fixed tokenization.",
        "A uniform prediction across 30 tokens has loss ln 30 and therefore perplexity exactly 30.",
        "Perplexities are not directly comparable when datasets, tokenizers, or evaluation conventions differ.",
      ],
      example:
        "An average negative log-likelihood of 2.53 corresponds to perplexity exp(2.53), or about 12.6.",
    },
    "Full-vocabulary softmax": {
      definition:
        "A full-vocabulary softmax scores and normalizes every possible output token for each training prediction.",
      details: [
        "Its output projection and normalization cost grows with the number of vocabulary entries.",
        "Large-vocabulary models historically used approximations to reduce this repeated computation.",
        "The operation's expense does not mean rare words should simply be deleted from evaluation targets.",
      ],
      example:
        "A 50,000-token vocabulary requires 50,000 logits even when the correct next token is already obvious.",
    },
    "Noise-contrastive estimation": {
      definition:
        "Noise-contrastive estimation learns a probability model by training it to distinguish real data samples from samples drawn from a known noise distribution.",
      details: [
        "Each observed example is contrasted with a limited number of synthetic noise examples, avoiding a full pass over every possible class per update.",
        "The classifier uses the chosen noise distribution and noise-to-data ratio to recover information about the model's data probabilities.",
        "Word2vec negative sampling is a simplified related objective, but its scores should not automatically be read as normalized language-model probabilities.",
      ],
      example:
        "Training can label the observed pair quiet-signal as data and pairs quiet-engine and quiet-banana as noise drawn from a frequency-based distribution.",
    },
    "Hierarchical softmax": {
      definition:
        "Hierarchical softmax places vocabulary words at tree leaves and predicts one path of binary branch decisions instead of scoring every word.",
      details: [
        "A word's probability is the product of the left-or-right decision probabilities along the path from the root to its leaf.",
        "A balanced tree reduces one prediction from work proportional to vocabulary size to work proportional to the tree depth.",
        "The chosen tree determines which words share internal decisions; Huffman trees give frequent words shorter paths in the word2vec implementation.",
      ],
      example:
        "In an eight-word balanced vocabulary tree, selecting river can require three binary decisions rather than eight separate output scores.",
    },
    "Huffman tree": {
      definition:
        "A Huffman tree is a binary tree built so frequent vocabulary items receive shorter root-to-leaf codes than rare items.",
      details: [
        "The construction repeatedly joins the two least frequent remaining nodes, producing a prefix code with no word code inside another.",
        "Word2vec hierarchical softmax places each word at a leaf and learns one binary prediction for every internal node on its path.",
        "A Huffman tree reduces average path length under observed frequencies, but its branches do not necessarily represent semantic categories.",
      ],
      example:
        "If the appears far more often than transducer, the can receive a two-branch code while transducer follows a much longer path.",
    },
    "Negative sampling": {
      definition:
        "Negative sampling trains a word representation against a small set of incorrect pairs instead of scoring the whole vocabulary.",
      details: [
        "Observed word-context pairs provide positive examples and sampled noise pairs provide negative examples.",
        "The method is a simplified objective related to noise-contrastive estimation in the word2vec work.",
        "Its training scores are not automatically calibrated next-word probabilities over the complete vocabulary.",
      ],
      example:
        "For the observed pair quiet and signal, training may contrast signal with sampled words such as banana and engine.",
    },
    "Frequent-word subsampling": {
      definition:
        "Training can randomly discard some occurrences of extremely common words so rarer relationships receive more useful attention.",
      details: [
        "The discard probability rises with token frequency under the word2vec subsampling rule.",
        "Fewer common-token examples reduce computation and can improve the quality of learned word vectors.",
        "Subsampling training occurrences is not the same as removing common words from the tokenizer vocabulary.",
      ],
      example:
        "A corpus may retain only a fraction of its millions of the tokens while keeping nearly every rare technical term.",
    },
    "Phrase embedding": {
      definition:
        "A phrase embedding gives a multiword expression its own learned vector when its meaning is not captured by separate word vectors.",
      details: [
        "The word2vec phrase method first identifies recurring word combinations using corpus statistics.",
        "The resulting phrase token can participate in Skip-gram-style training like an ordinary vocabulary item.",
        "Creating phrase vectors does not make every arbitrary group of adjacent words a meaningful fixed expression.",
      ],
      example:
        "A corpus can give the fictional band name Velvet Circuit its own phrase token instead of treating it as ordinary fabric plus electronics.",
    },
  },
);

const tokenizationCards = defineFlashcardGroup(
  {
    subjectId: "model-foundations",
    module: "Model Foundations",
    lesson: "Subword Tokenization",
    source:
      "Sennrich, Haddow, and Birch, Neural Machine Translation of Rare Words with Subword Units (2016); Kudo and Richardson, SentencePiece (2018).",
  },
  {
    Tokenization: {
      definition:
        "Tokenization converts text into the discrete symbol sequence that a model will read, predict, and later convert back to text.",
      details: [
        "A tokenizer defines both the vocabulary entries and the algorithm that segments incoming text.",
        "Its choices change sequence lengths, token frequencies, embedding size, and the exact training targets.",
        "Tokenization is not a harmless display step that can be replaced after training without compatibility work.",
      ],
      example:
        "The word signaling might become one token, nine character tokens, or the pieces sign, al, and ing.",
    },
    "Tokenizer-model contract": {
      definition:
        "A trained model expects the exact token IDs and segmentation rules supplied by its matching tokenizer artifact.",
      details: [
        "Embedding row 42 and output slot 42 must refer to the same token during training and inference.",
        "Vocabulary size trades shorter encoded sequences against larger embedding and output matrices.",
        "Reusing token spellings with different integer IDs silently sends the model the wrong learned representations.",
      ],
      example:
        "If token 42 meant signal during training, a replacement tokenizer cannot assign 42 to silence at inference.",
    },
    "Word-level tokenization": {
      definition:
        "Word-level tokenization assigns common complete words their own vocabulary entries and usually splits text at word boundaries.",
      details: [
        "Frequent known words produce short sequences because each may occupy only one model position.",
        "A fixed word vocabulary needs a policy for names, new compounds, misspellings, and unseen inflections.",
        "Treating punctuation and whitespace as simple separators can lose information required to reconstruct the original text.",
      ],
      example:
        "The sentence models predict may encode as two word IDs, while an unseen name may collapse to an unknown ID.",
    },
    "Character-level tokenization": {
      definition:
        "Character-level tokenization represents text using individual characters from a comparatively small base vocabulary.",
      details: [
        "Known characters can spell unfamiliar words without requiring a complete-word vocabulary entry.",
        "Common words occupy many more sequence positions than they would under word or subword tokenization.",
        "Character coverage still depends on which writing-system symbols and normalization rules the tokenizer supports.",
      ],
      example:
        "Signal becomes the six successive tokens s, i, g, n, a, and l in a simple character tokenizer.",
    },
    "Subword tokenization": {
      definition:
        "Subword tokenization represents text with reusable pieces that are usually larger than characters and smaller than full words.",
      details: [
        "Frequent patterns can become single tokens while rare words remain constructible from smaller symbols.",
        "The learned vocabulary balances encoded sequence length against embedding and output-layer size.",
        "Subword pieces are statistical units and do not always align with linguistically meaningful morphemes.",
      ],
      example:
        "Modeled may be segmented into model and ed even when the full word never appeared in tokenizer training.",
    },
    "Unknown token": {
      definition:
        "An unknown token is a shared fallback ID used when the tokenizer cannot represent a word or symbol with its vocabulary.",
      details: [
        "Several different unseen inputs can collapse to the same unknown ID and therefore lose their distinctions.",
        "Word-level systems commonly rely on an unknown token when no complete vocabulary entry matches.",
        "An unknown token does not tell the model which letters or bytes appeared in the original missing text.",
      ],
      example:
        "Two unseen surnames may both become the same unknown-token ID, preventing the model from distinguishing their spellings.",
    },
    "Open-vocabulary representation": {
      definition:
        "An open-vocabulary representation can build unfamiliar words from smaller known units instead of mapping every novelty to one fallback.",
      details: [
        "Subword or byte-level bases provide a path for encoding names, compounds, and productive word forms.",
        "Coverage depends on the base symbols actually supported by the tokenizer and its normalization pipeline.",
        "Representing an unfamiliar spelling does not mean the language model has learned its meaning or facts about it.",
      ],
      example:
        "A tokenizer can encode microtransducer as micro, trans, duc, and er even without a whole-word entry.",
    },
    "Rare-word decomposition": {
      definition:
        "Rare-word decomposition splits an infrequent or unseen word into smaller units that were learned from more common patterns.",
      details: [
        "Shared pieces let training evidence transfer between related names, compounds, and inflected word forms.",
        "A useful decomposition reduces unknowns without turning every ordinary word into an unnecessarily long sequence.",
        "The statistically chosen split is not guaranteed to match the decomposition a linguist would prefer.",
      ],
      example:
        "Signaling can reuse the learned pieces sign and ing even if the complete word appeared only once.",
    },
    Morphology: {
      definition:
        "Morphology studies how meaningful word parts combine and how words change form to express grammar or related meanings.",
      details: [
        "Prefixes, roots, suffixes, inflections, and derivations are examples of morphological structure.",
        "Subword units can sometimes reuse these patterns across words such as model, modeled, and modeling.",
        "A tokenizer's frequent merge is not automatically a true morpheme just because its spelling looks familiar.",
      ],
      example:
        "The words signal, signals, signaled, and signaling share a root while their endings express different forms.",
    },
    "BPE merge rule": {
      definition:
        "A BPE merge rule replaces one selected pair of neighboring symbols with their joined symbol throughout the training representation.",
      details: [
        "Training selects a pair using its frequency in the corpus's current tokenized state.",
        "The new joined symbol can participate in later pairs and grow into a larger reusable token.",
        "A merge rule is not a global string replacement across nonadjacent characters or word boundaries by default.",
      ],
      example:
        "The rule [s, i] creates si wherever those two current symbols occur next to each other in the corpus.",
    },
    "Adjacent-pair frequency": {
      definition:
        "BPE counts how often each ordered neighboring symbol pair appears in the tokenizer's current training representation.",
      details: [
        "Each adjacent position contributes a candidate pair, including overlapping candidate positions before a merge.",
        "Counts must be recomputed after a corpus-wide merge because the symbol boundaries have changed.",
        "Joining pair spellings without preserving their two boundaries can make different pairs look identical.",
      ],
      example:
        "Across [s, i, g] and [s, i], the pair [s, i] has frequency two while [i, g] has frequency one.",
    },
    "Non-overlapping BPE replacement": {
      definition:
        "A merge consumes both symbols in each match, so the right symbol from one replacement cannot be reused in an overlapping match.",
      details: [
        "The encoder scans left to right and advances past both consumed symbols after a successful replacement.",
        "Every separate non-overlapping occurrence of the selected pair should still be replaced during that pass.",
        "Replacing only the first occurrence underapplies the rule, while overlapping replacement changes the algorithm.",
      ],
      example:
        "Merging [a, a] in [a, a, a] yields [aa, a], not [aa, aa] and not the unchanged input.",
    },
    "BPE merge budget": {
      definition:
        "The merge budget is the number of pair-merging rounds allowed while training a BPE vocabulary.",
      details: [
        "A larger budget usually creates more vocabulary entries and shorter encoded training sequences.",
        "Each additional token also enlarges embedding and output structures used by the language model.",
        "More merges do not monotonically guarantee better downstream accuracy for every dataset and model size.",
      ],
      example:
        "A budget of two may learn si then sig, while a budget of ten can build several longer corpus-specific pieces.",
    },
    "Word-boundary marker": {
      definition:
        "A word-boundary marker is an explicit symbol that lets a tokenizer distinguish text at a word edge from the same letters inside a word.",
      details: [
        "Boundary information can prevent merges learned at one position from being applied in an incompatible position.",
        "The Sennrich procedure uses word-frequency data with explicit conventions around word boundaries.",
        "Omitting markers simplifies a teaching loop but changes the tokenizer learned by the original paper's setup.",
      ],
      example:
        "A marked start symbol can distinguish the piece play at the beginning of playbook from letters inside replay.",
    },
    "Unigram language-model tokenization": {
      definition:
        "Unigram language-model tokenization scores possible text segmentations using learned probabilities for individual candidate pieces.",
      details: [
        "Training starts with a generously sized piece inventory and repeatedly estimates piece probabilities while pruning candidates that contribute least.",
        "At encoding time, a dynamic-programming search can choose the complete segmentation with the highest product of piece probabilities.",
        "The unigram assumption belongs to the tokenizer objective; it does not claim that words or model tokens are truly independent in natural language.",
      ],
      example:
        "For unhappiness, the tokenizer can compare un + happiness with unhappy + ness and choose the higher-scoring complete piece sequence.",
    },
    SentencePiece: {
      definition:
        "SentencePiece trains a language-independent subword tokenizer from raw sentences and can reconstruct its normalized text from the resulting pieces.",
      details: [
        "It avoids requiring a separate language-specific word tokenizer before subword model training.",
        "The implementation supports both BPE and unigram segmentation models in reproducible tokenizer files.",
        "Detokenization reverses the normalized representation, which may not preserve the input's original Unicode form, spacing, or byte sequence.",
      ],
      example:
        "English and Japanese training text can enter the same raw-sentence pipeline without first applying English-only word splitting.",
    },
  },
);

const additiveAttentionCards = defineFlashcardGroup(
  {
    subjectId: "model-foundations",
    module: "Model Foundations",
    lesson: "Additive Attention",
    source:
      "Bahdanau, Cho, and Bengio, Neural Machine Translation by Jointly Learning to Align and Translate (2014); Luong, Pham, and Manning, Effective Approaches to Attention-based Neural Machine Translation (2015); Xu et al., Show, Attend and Tell (2015).",
  },
  {
    "Sequence transduction": {
      definition:
        "Sequence transduction turns one ordered sequence into another ordered sequence whose length may be different.",
      details: [
        "Machine translation maps source-language tokens to a newly generated target-language token sequence.",
        "Speech recognition and text summarization are other tasks with ordered input-to-output transformations.",
        "The term does not imply a position-by-position copy or require equal input and output lengths.",
      ],
      example:
        "A system can transduce the three French tokens bon après-midi into the two English tokens good afternoon.",
    },
    "Encoder-decoder architecture": {
      definition:
        "An encoder reads the source sequence into representations, and a decoder uses those representations to generate a target sequence.",
      details: [
        "The encoder creates information about the source while the decoder predicts target tokens autoregressively.",
        "Attention gives the decoder changing access to the encoder's position-specific representations.",
        "An encoder-decoder is an architectural pattern, not a guarantee that source meaning is perfectly preserved.",
      ],
      example:
        "An encoder reads 14 March 2026, then a decoder emits 2026, 03, and 14 one token at a time.",
    },
    "Encoder state": {
      definition:
        "An encoder state is the numeric representation left at one source position after the encoder processes the input sequence.",
      details: [
        "Bahdanau attention retains one state h_i for each source position instead of only one final summary.",
        "A state can carry information about its token together with surrounding source context.",
        "An encoder state is not a copy of the original word and cannot be interpreted from one coordinate alone.",
      ],
      example:
        "The state at 2026 can carry year-related information that a decoder query later selects for its first output.",
    },
    "Decoder query": {
      definition:
        "A decoder query is the current numeric state used to ask which source positions are useful for the next output step.",
      details: [
        "The query changes as the decoder advances, so different target steps can seek different source information.",
        "An attention scorer compares the same query with every candidate encoder state for that step.",
        "A query is not a database search string and does not directly contain the final output token.",
      ],
      example:
        "The query for emitting a year can score the 2026 state highly, while the next query favors the March state.",
    },
    "Fixed-length bottleneck": {
      definition:
        "Older encoder-decoder models forced every source detail through one fixed-width summary that stayed unchanged during decoding.",
      details: [
        "Long sequences make it harder for one final encoder vector to preserve every detail needed by later outputs.",
        "Attention eases the bottleneck by retaining all position states and constructing a fresh weighted context.",
        "Fixed width alone is not always harmful; the bottleneck concerns forcing all access through one unchanging summary.",
      ],
      example:
        "A late translation token may need the first source name even after many other details were squeezed into one vector.",
    },
    "Alignment model": {
      definition:
        "An alignment model learns how strongly each target-generation step should connect to each source position.",
      details: [
        "Bahdanau's model scores pairs of decoder state and encoder state with trainable parameters.",
        "Translation loss trains the alignment scorer jointly with the rest of the encoder-decoder network.",
        "Learned alignment is a task mechanism and should not automatically be treated as a faithful causal explanation.",
      ],
      example:
        "While producing 2026, the alignment model can place most weight on the source position containing 2026.",
    },
    "Soft alignment": {
      definition:
        "Soft alignment assigns a positive weight to every candidate source position and combines them in one differentiable calculation.",
      details: [
        "A softmax converts source-position scores into weights that sum to one for the current target step.",
        "Because all positions contribute through ordinary arithmetic, gradient descent can train the scorer end to end.",
        "Soft does not mean uniform; a learned distribution can place almost all its mass on one position.",
      ],
      example:
        "Weights [0.014, 0.035, 0.951] softly combine three date states while strongly favoring the year.",
    },
    "Hard attention": {
      definition:
        "Hard attention chooses a discrete source location rather than blending every source state with continuous weights.",
      details: [
        "The selected location acts like a categorical decision about where the model will look for that step.",
        "Discrete choices may require sampling estimators or other training methods when ordinary gradients cannot pass through.",
        "Hard attention is not inherently more accurate or more interpretable than a well-trained soft alignment.",
      ],
      example:
        "A hard date aligner may choose only the source token March when producing the target token 03.",
    },
    "Alignment energy": {
      definition:
        "An alignment energy is the learned raw match score between one decoder query and one candidate encoder state.",
      details: [
        "Bahdanau additive scoring combines projected query and encoder-state vectors, applies tanh, and reduces the result with a learned vector.",
        "The same scoring parameters evaluate every candidate source position for the current decoding step.",
        "Energy is meaningful only relative to competing source positions; it is not a probability, distance, or calibrated confidence by itself.",
      ],
      example:
        "Energies -1.8, -0.9, and 2.4 rank the third date state as the strongest raw match for the current decoder query.",
    },
    "Attention logit": {
      definition:
        "An attention logit is an alignment energy viewed in its role as one unnormalized input to the attention softmax.",
      details: [
        "Attention logit and alignment energy name the same raw value; logit emphasizes the normalization stage rather than a separate scorer.",
        "The source-axis softmax compares the complete row of logits and converts their relative gaps into weights totaling one.",
        "Before softmax, logits may be negative and need not sum to any fixed value; masking can also remove disallowed positions.",
      ],
      example:
        "The energies [-1.8, -0.9, 2.4] serve as attention logits, then softmax turns them into one normalized alignment-weight row.",
    },
    "Alignment weight": {
      definition:
        "An alignment weight is the normalized share of attention assigned to one source state for one target step.",
      details: [
        "The weights are often written as alpha_(t,i), where t is the target step and i is the source position.",
        "All source-position weights for a fixed target step are nonnegative and sum to one.",
        "A high weight shows use in this computation but does not prove a human-readable reasoning process.",
      ],
      example:
        "An alpha value of 0.951 gives the year state 95.1 percent of the available attention mass.",
    },
    "Source-position softmax": {
      definition:
        "For one decoder step, softmax must normalize the complete row of scores across all candidate source positions.",
      details: [
        "Subtracting the row maximum before exponentiation keeps the normalization numerically stable.",
        "Normalizing on the source axis makes positions compete for the current query's fixed total weight.",
        "Applying a separate softmax to every scalar would incorrectly give every source position weight one.",
      ],
      example:
        "Three date-position scores become one three-value probability row rather than three unrelated probabilities.",
    },
    "Per-step context recomputation": {
      definition:
        "Per-step context recomputation rebuilds the attention summary whenever the decoder advances to a new output position.",
      details: [
        "The new decoder query produces a fresh row of alignment energies, normalized weights, and a new weighted source mixture.",
        "Encoder states remain stored and unchanged while their contribution weights can differ at every target step.",
        "Recomputation removes the one-summary bottleneck without implying that the encoder itself reruns after each generated token.",
      ],
      example:
        "After a year query builds a context dominated by 2026, the month query recomputes one dominated by March.",
    },
    "Global and local attention scope": {
      definition:
        "Attention scope describes whether a query considers every source position or only a chosen neighborhood of positions.",
      details: [
        "Global attention scores the full source sequence, while local attention restricts the candidate region.",
        "A local window can reduce work or encourage locality when the task's alignments are usually nearby.",
        "Restricting scope can miss a relevant distant position, so local attention is not universally superior.",
      ],
      example:
        "A local translator may inspect five source positions around a predicted center instead of a 200-token sentence.",
    },
    "Monotonic local attention (local-m)": {
      definition:
        "Monotonic local attention centers a small source window at the current target position instead of searching the full source sequence.",
      details: [
        "Luong's local-m rule sets the aligned center p_t equal to target step t, assuming source and target positions advance at roughly the same pace.",
        "Attention weights are still learned within the fixed window, so the center rule does not force one exact source token to be selected.",
        "The method is inexpensive and differentiable but can miss translations whose source and target positions are strongly reordered.",
      ],
      example:
        "At target step 12 with window radius two, local-m scores source positions 10 through 14 around the fixed center 12.",
    },
    "Predictive local attention (local-p)": {
      definition:
        "Predictive local attention learns a real-valued source-window center from the current decoder state for each target step.",
      details: [
        "Luong's local-p rule scales a sigmoid prediction by source length, placing the learned center between the beginning and end positions.",
        "A Gaussian factor favors positions near that center while content-based alignment still distinguishes states inside the local window.",
        "Because the center and weighting are differentiable, the model can learn reordered alignments without making a discrete hard-attention choice.",
      ],
      example:
        "For a 20-token source, local-p can predict center 13.4 and softly score a window around positions 11 through 16.",
    },
    "Input feeding": {
      definition:
        "Input feeding passes the previous attentional vector into the decoder's next recurrent step so later alignments can use earlier alignment information.",
      details: [
        "Luong's approach concatenates the prior attentional output with the next target-token input before the decoder updates its hidden state.",
        "The added recurrent connection can help the model track translation coverage rather than making every attention decision independently.",
        "Input feeding carries a learned summary of past alignment behavior; it is not the same as teacher forcing the correct next target token.",
      ],
      example:
        "After attending strongly to the source year, the year-step attentional vector feeds into the month step and informs its next alignment.",
    },
  },
);

const transformerCards = defineFlashcardGroup(
  {
    subjectId: "model-foundations",
    module: "Model Foundations",
    lesson: "Transformers",
    source:
      "Vaswani et al., Attention Is All You Need (2017); Radford et al., Improving Language Understanding by Generative Pre-Training (2018).",
  },
  {
    "Transformer architecture": {
      definition:
        "A Transformer processes token representations with stacked attention and feed-forward blocks instead of recurrent sequence steps.",
      details: [
        "The original architecture contains an encoder stack, a decoder stack, and attention connections between them.",
        "Modern language models often adapt the decoder side into a causally masked, decoder-only stack.",
        "Calling a model a Transformer does not mean attention is its only operation or learned parameter.",
      ],
      example:
        "A decoder-only Transformer repeats masked self-attention, residual updates, normalization, and a multilayer perceptron across many layers.",
    },
    "Decoder-only Transformer": {
      definition:
        "A decoder-only Transformer is a causal token model built from one stack that predicts each next token from the prefix before it.",
      details: [
        "Masked self-attention lets every position read allowed earlier positions while preventing information from later target tokens from leaking backward.",
        "Unlike the original translation Transformer, this architecture has no separate encoder stack or ordinary encoder-decoder cross-attention stage.",
        "Known training positions can run in parallel under the causal mask, but free-running generation remains sequential across newly sampled tokens.",
      ],
      example:
        "A single decoder-only stack reads Question: 2 + 3? Answer: and predicts the answer token 5 from that causal prefix.",
    },
    "Generative pretraining": {
      definition:
        "Generative pretraining first teaches a model to predict upcoming text from a large unlabeled corpus before adapting it to a target task.",
      details: [
        "Radford and colleagues optimize a left-to-right language-model likelihood over contiguous token sequences during this first stage.",
        "The resulting parameters provide a reusable starting representation instead of making every labeled task learn language structure from scratch.",
        "Generative describes the pretraining objective; it does not require the eventual downstream task to produce open-ended text.",
      ],
      example:
        "A Transformer can first predict tokens across thousands of books, then reuse those weights when learning whether two sentences entail each other.",
    },
    "Supervised fine-tuning": {
      definition:
        "Supervised fine-tuning continues training a pretrained model on labeled examples from one target task.",
      details: [
        "The Radford setup adds a small task output layer and updates the pretrained Transformer parameters using the target labels.",
        "Fine-tuning adapts one shared representation to classification, entailment, similarity, or question-answering objectives.",
        "This process changes model weights and therefore differs from in-context learning, which changes behavior only through the current prompt.",
      ],
      example:
        "After language-model pretraining, labeled movie reviews can update the same Transformer and a new output layer for sentiment classification.",
    },
    "Transfer learning": {
      definition:
        "Transfer learning reuses parameters or representations learned in one training setting to improve learning in a different target setting.",
      details: [
        "In generative pretraining, the source setting is next-token prediction on unlabeled text and the targets are labeled language-understanding tasks.",
        "The transferred weights can be fine-tuned rather than frozen, allowing both reuse and task-specific adaptation.",
        "Transfer can weaken when source and target data or objectives differ sharply, so pretraining is not a guarantee of downstream improvement.",
      ],
      example:
        "Weights learned from book text can initialize a question-answering model that has far fewer labeled examples than the pretraining corpus.",
    },
    "Task-aware input transformation": {
      definition:
        "A task-aware input transformation turns a structured target example into an ordered token sequence a pretrained language model can process.",
      details: [
        "Radford's method joins fields with learned start, end, and delimiter tokens instead of building a different model architecture for every task.",
        "Entailment concatenates premise and hypothesis, while multiple-choice question answering pairs the context and question with each candidate answer.",
        "The transformation preserves task structure through sequence layout; it is more than ordinary tokenization of one unstructured sentence.",
      ],
      example:
        "An entailment record can become start + premise + delimiter + hypothesis + end before the shared Transformer predicts its label.",
    },
    "Auxiliary language-model objective": {
      definition:
        "An auxiliary language-model objective keeps a next-token prediction loss alongside the main supervised loss during fine-tuning.",
      details: [
        "The Radford training objective adds the language-model likelihood to the labeled-task objective with a tunable weight lambda.",
        "Their experiments report that the extra signal can improve generalization and speed convergence on some target datasets.",
        "Auxiliary means it supports the primary task loss; it does not replace target labels or create a separate inference-time model.",
      ],
      example:
        "While review labels train a sentiment head, the same fine-tuning batch can also keep teaching the Transformer to predict each review's next tokens.",
    },
    "Parallel sequence processing": {
      definition:
        "During training, attention can compute representations for many sequence positions together instead of visiting positions one by one.",
      details: [
        "Matrix operations form all query-key scores for a layer in parallel when the full training sequence is known.",
        "This parallelism was a major training advantage over recurrent models in the original Transformer paper.",
        "Autoregressive generation still produces new tokens sequentially because future sampled tokens do not yet exist.",
      ],
      example:
        "A training pass can calculate a 512-by-512 attention score matrix at once for a known 512-token example.",
    },
    "Self-attention": {
      definition:
        "Self-attention lets positions in one sequence build new representations by selectively mixing information from that same sequence.",
      details: [
        "Queries, keys, and values are all projected from representations belonging to the same sequence.",
        "Each query position receives its own normalized weights across the allowed key positions.",
        "Self-attention without position information cannot distinguish every reordering of otherwise identical inputs.",
      ],
      example:
        "In the receiver decoded it, the representation for it can mix information from the earlier receiver position.",
    },
    "Cross-attention": {
      definition:
        "Cross-attention lets one sequence query representations that were produced from a different source sequence.",
      details: [
        "Decoder representations supply queries while encoder outputs supply the keys and values.",
        "The operation gives each target position step-specific access to the encoded source sequence.",
        "Decoder-only language models usually omit encoder cross-attention unless another information stream is added.",
      ],
      example:
        "A French decoder query can attend to English encoder states while producing the next translated word.",
    },
    "Query-key-value projections": {
      definition:
        "Learned projections turn each token representation into query, key, and value vectors with different roles in attention.",
      details: [
        "A query describes what the current position seeks, while a key describes how another position can be matched.",
        "A value carries the information that will be mixed after query-key scores become probabilities.",
        "The three vectors can come from one source representation but are not required to contain identical coordinates.",
      ],
      example:
        "One receiver vector is multiplied by WQ, WK, and WV to create three different attention vectors.",
    },
    "Attention score matrix": {
      definition:
        "The attention score matrix contains one raw query-key compatibility value for every query row and key column.",
      details: [
        "Multiplying Q by the transpose of K produces an n-query by n-key matrix in self-attention.",
        "Row i describes which key positions are candidates for the representation at query position i.",
        "The matrix contains logits before masking and softmax, not the final mixed token representations.",
      ],
      example:
        "Three queries and three keys produce a 3-by-3 score matrix with nine pairwise dot products.",
    },
    "Attention scaling factor": {
      definition:
        "Transformer attention divides query-key dot products by the square root of the key-vector width before softmax.",
      details: [
        "The formal scale is √d_k, where d_k is the number of coordinates in each query and key.",
        "Scaling keeps typical score magnitudes from growing merely because the projection width is larger.",
        "The divisor is not the sequence length, number of keys, value width, or number of attention heads.",
      ],
      example:
        "With key width 64, each query-key dot product is divided by 8 before masking and normalization.",
    },
    "Softmax saturation": {
      definition:
        "When score differences are very large, softmax outputs become extremely close to zero or one and change only slightly.",
      details: [
        "This near-one-hot regime is called saturation and can produce very small derivatives for most scores.",
        "Scaled dot products reduce the tendency for attention logits to grow solely with projection width.",
        "A confidently peaked distribution is not always an error; the concern is uncontrolled magnitude and training dynamics.",
      ],
      example:
        "Softmax of [50, 0, -50] is effectively [1, 0, 0], so modest changes barely affect the result.",
    },
    "Future-token leakage": {
      definition:
        "A causal language model must prevent an earlier position from using tokens that occur later in its training sequence.",
      details: [
        "A triangular attention mask replaces future-position logits before row-wise softmax is computed.",
        "Without the guard, training predictions could copy information from the very targets they are meant to predict.",
        "Masking future attention does not remove access to the current position or the allowed earlier prefix.",
      ],
      example:
        "When predicting decoded at position three, the representation must not read the later words quiet signal.",
    },
    "Attention head": {
      definition:
        "An attention head is one complete set of query, key, and value projections followed by scoring and value mixing.",
      details: [
        "Each head operates in its own learned projection spaces and produces a value-width output per query.",
        "Different heads can specialize in different useful interaction patterns during training.",
        "A visible head pattern is not guaranteed to correspond to one clean linguistic rule or human explanation.",
      ],
      example:
        "One head may strongly connect a pronoun to a prior noun while another emphasizes the immediately previous token.",
    },
    "Multi-head attention": {
      definition:
        "Multi-head attention runs several attention heads in parallel and combines their outputs into one representation.",
      details: [
        "Separate learned projections let heads compare tokens in multiple lower-dimensional spaces.",
        "The head results are concatenated and passed through a learned output projection.",
        "Adding heads does not linearly guarantee better quality if model width, data, or training are inadequate.",
      ],
      example:
        "Eight heads can each return 64 features that concatenate to 512 features before the output projection.",
    },
    "Positional encoding": {
      definition:
        "Positional encoding adds information about token order because content-based attention alone does not know where tokens occur.",
      details: [
        "The original Transformer adds fixed sinusoidal position vectors to token embeddings before the first block.",
        "Other Transformer families use learned positions or relative-position mechanisms while serving the same need.",
        "Position information does not force the model to attend only to nearby tokens or preserve every long-range order fact.",
      ],
      example:
        "Dog bites person and person bites dog contain the same words, so position signals help preserve their different order.",
    },
    "Residual connection": {
      definition:
        "A residual connection adds a sublayer's input representation back to the transformation produced by that sublayer.",
      details: [
        "The shortcut provides a direct path for existing information and gradients through a deep stack.",
        "Transformer blocks place residual paths around both attention and position-wise feed-forward sublayers.",
        "Residual addition requires compatible shapes and does not mean the sublayer can never change its input.",
      ],
      example:
        "If attention returns an update u for token state x, the residual path forms x + u before the next stage.",
    },
    "Layer normalization": {
      definition:
        "Layer normalization standardizes one token's feature values and then can apply a learned scale and offset per feature.",
      details: [
        "The non-affine core subtracts the feature mean and divides by the square root of variance plus epsilon.",
        "Full affine layer normalization applies learned gamma and beta after that standardization.",
        "It normalizes across a token's features, not by mixing unrelated examples across the training batch.",
      ],
      example:
        "The vector [1, 2, 3, 4] is centered around zero before learned gamma and beta adjust its coordinates.",
    },
    "Position-wise feed-forward network": {
      definition:
        "This small neural network transforms each token position independently after attention has exchanged information between positions.",
      details: [
        "The same two learned linear transformations and nonlinearity are reused at every sequence position.",
        "Its hidden width is commonly larger than the model width, providing per-token nonlinear computation.",
        "Position-wise means weights are shared across positions, not that neighboring tokens can never influence its input.",
      ],
      example:
        "Every token's 512-feature vector can expand to 2,048 features, pass through a nonlinearity, and return to 512.",
    },
    "Stacked decoder block": {
      definition:
        "A stacked decoder block is one repeated layer that combines causal attention, residual paths, normalization, and a feed-forward network.",
      details: [
        "Each block receives contextual token representations from the block below and passes updated representations to the block above.",
        "A decoder-only Transformer stacks many separately parameterized copies of this block around one causal token stream.",
        "The block names one architectural unit, while Decoder-only Transformer names the complete model arrangement that repeats it.",
      ],
      example:
        "Block seven receives block six's token states, applies its own attention and multilayer-perceptron updates, and sends the result to block eight.",
    },
  },
);

const inContextLearningCards = defineFlashcardGroup(
  {
    subjectId: "model-foundations",
    module: "Model Foundations",
    lesson: "In-Context Learning",
    source:
      "Brown et al., Language Models are Few-Shot Learners (2020); Min et al., Rethinking the Role of Demonstrations (2022); Garg et al., What Can Transformers Learn In-Context? (2022).",
  },
  {
    "In-context learning": {
      definition:
        "A model performs a task from instructions or examples in its current prompt without changing its trained parameter values.",
      details: [
        "The prompt is processed as one causal token sequence whose earlier parts influence later predictions.",
        "The behavior can change at inference time even though no gradient update or optimizer step occurs.",
        "A successful prompt result does not prove the model learned a permanent new skill for future sessions.",
      ],
      example:
        "Four review examples mapping text to K or M can guide a frozen model to label a fifth review.",
    },
    "Prompt conditioning": {
      definition:
        "Prompt conditioning means that earlier prompt tokens change the probability distribution used to predict later tokens.",
      details: [
        "Instructions, demonstrations, separators, and the query all become part of the model's causal prefix.",
        "Their token representations alter hidden activations and cached attention state throughout the forward pass.",
        "Conditioning does not modify model weights or guarantee that the model will obey the supplied instruction.",
      ],
      example:
        "Adding Return only K or M changes the next-token probabilities after the same review sentence.",
    },
    Demonstration: {
      definition:
        "A demonstration is a worked input-output example placed in the prompt to show the model what response pattern is wanted.",
      details: [
        "A classification demonstration commonly contains an input text followed by its expected label.",
        "Several demonstrations can expose a task, output schema, label set, and characteristic input distribution.",
        "An example in the prompt is not a training record that automatically triggers gradient descent.",
      ],
      example:
        "Input: A sharp story followed by Label: K demonstrates both the record format and one allowed answer.",
    },
    "Random-label demonstrations": {
      definition:
        "Random-label demonstrations pair prompt inputs with labels chosen independently of their correct answers while preserving the example format.",
      details: [
        "Min and colleagues sample replacement labels from the allowed label set, deliberately breaking the demonstrations' true input-label relationship.",
        "The intervention keeps useful cues such as input distribution, label space, and sequence format while removing reliable mapping information.",
        "Small average performance drops in their tested classification settings do not prove correct labels are unimportant for every model, dataset, or generation task.",
      ],
      example:
        "A positive review that should end in K can be shown with randomly chosen M while the same Input and Label fields remain in place.",
    },
    "Ground-truth label mapping": {
      definition:
        "A ground-truth label mapping is the correct relationship that pairs each demonstration input with its intended task label.",
      details: [
        "It carries more information than the label space alone because it shows which input properties correspond to which output symbol.",
        "Replacing gold labels with random allowed labels preserves label names but destroys this correct pairing.",
        "Min and colleagues found the mapping had a smaller average effect than expected in their tested settings, not that the mapping is universally irrelevant.",
      ],
      example:
        "If K means positive sentiment, pairing A sharp story with K preserves the mapping, while pairing it with M contradicts it.",
    },
    "Prompt prefix": {
      definition:
        "The prompt prefix is the ordered instruction and example text that appears before the new query the model must answer.",
      details: [
        "Every formatting choice in the prefix corresponds to tokens that can influence the continuation distribution.",
        "The prefix consumes space inside the model's finite context window along with the held-out query.",
        "A longer prefix is not automatically more useful; irrelevant or conflicting examples can reduce performance.",
      ],
      example:
        "An instruction plus four labeled reviews forms the prefix before Input: A dull ending and the final Label prompt.",
    },
    "Task induction": {
      definition:
        "Task induction is the model's inference of the operation or rule implied by prompt instructions and examples.",
      details: [
        "The task can be partially latent when the prompt demonstrates behavior without naming the underlying rule.",
        "Demonstrations may clarify whether the intended operation is classification, translation, extraction, or formatting.",
        "Apparent task induction on a few cases does not show that the inferred rule will generalize reliably.",
      ],
      example:
        "From examples turning positive reviews into K and negative reviews into M, the model infers the concealed sentiment task.",
    },
    "Label-space exposure": {
      definition:
        "Demonstrations can reveal which output labels are allowed even when their mapping to meanings is arbitrary or imperfectly shown.",
      details: [
        "Min and colleagues identify label-space exposure as one driver of in-context classification performance.",
        "Seeing K and M tells the model to choose within that small output set rather than answer with prose.",
        "Knowing the allowed labels does not by itself reveal which label belongs to every possible input.",
      ],
      example:
        "Two prompt records ending in K and M teach the allowed label space even if the label names carry no sentiment meaning.",
    },
    "Input-distribution cue": {
      definition:
        "Prompt examples can show what kinds of inputs are expected, giving the model clues about the current task's data distribution.",
      details: [
        "Examples may reveal typical vocabulary, length, tone, or domain even when their labels are not fully informative.",
        "This cue helps explain why demonstrations can affect performance beyond transmitting a correct label mapping.",
        "A few displayed inputs cannot establish that future queries follow exactly the same real-world distribution.",
      ],
      example:
        "Several short movie reviews signal a review-classification task before the model sees a new review query.",
    },
    "Sequence-format cue": {
      definition:
        "The repeated structure of demonstrations teaches the model how inputs, separators, labels, and answers are arranged in the prompt.",
      details: [
        "Consistent record formatting can make the desired continuation point and answer shape easier to identify.",
        "Min and colleagues found overall sequence format to be useful even when demonstration labels were randomized.",
        "Matching surface format does not prove the model has inferred the intended semantics of the task.",
      ],
      example:
        "Repeating Input on one line and Label on the next encourages the model to complete the final Label field.",
    },
    "Demonstration-order sensitivity": {
      definition:
        "Changing the order of the same prompt examples can change a frozen model's output probabilities and final answer.",
      details: [
        "A Transformer reads an ordered causal prefix, so rearranging examples creates a different token sequence and cache state.",
        "Recent examples may exert different influence from equally relevant examples placed earlier in the context.",
        "Order sensitivity does not mean there is one universally best ordering across all models and tasks.",
      ],
      example:
        "Placing the negative M example last can yield a different prediction than placing the positive K example last.",
    },
    "Controlled prompting comparison": {
      definition:
        "A fair prompt experiment changes one intended factor while holding the other evaluation choices constant.",
      details: [
        "The lesson varies demonstration count while fixing instructions, held-out inputs, decoding, extraction, and scoring.",
        "This controlled design makes output differences attributable to the changed prompt condition more plausibly.",
        "Two held-out examples can reveal sensitivity in one run but cannot establish a general accuracy law.",
      ],
      example:
        "Compare zero, one, and four examples on the same two reviews using the same model and exact-match scorer.",
    },
    "Exact-match evaluation": {
      definition:
        "Exact-match evaluation counts a prediction as correct only when the extracted answer exactly equals the expected answer.",
      details: [
        "The extraction rule should be fixed before inspecting gold labels and applied identically to every condition.",
        "A closed-label task can extract the first standalone allowed label with exact casing from generated text.",
        "Exact match is objective for a specified string target but can reject semantically equivalent free-form answers.",
      ],
      example:
        "The output Label: K. passes when K is expected, while lowercase k fails under a case-sensitive rule.",
    },
    "Test-set prompt tuning": {
      definition:
        "Choosing or revising a prompt after inspecting final test answers quietly uses the test set as development data.",
      details: [
        "Repeatedly selecting the best prompt on the same held-out cases can overfit those particular examples.",
        "A separate validation set supports prompt selection while preserving a final untouched test estimate.",
        "Calling queries held out does not prevent leakage if their results influence later prompt decisions.",
      ],
      example:
        "Trying twenty demonstration orders on two test reviews and reporting only the best order tunes on the test set.",
    },
    "Benchmark contamination": {
      definition:
        "An evaluation is contaminated when benchmark examples or close copies may already be present in a model's training data.",
      details: [
        "Web-scale pretraining makes exact overlap and near-duplicate overlap difficult to rule out completely.",
        "Contamination can make apparent few-shot reasoning partly reflect memorization of benchmark material.",
        "Possible contamination does not prove every correct benchmark answer was memorized from an exact duplicate.",
      ],
      example:
        "A public question copied into many websites before pretraining may later appear again in a model evaluation set.",
    },
    "Function class": {
      definition:
        "A function class is a defined family of input-output rules that share a mathematical form or constraint.",
      details: [
        "Garg and colleagues study classes such as linear functions, sparse linear functions, decision trees, and two-layer neural networks.",
        "Training prompts draw many individual functions from one class, while evaluation asks the model to predict values from a previously unseen member.",
        "Learning one function class in context does not establish that the same learned algorithm works for every possible task family.",
      ],
      example:
        "All rules f(x) = w transposed times x form a linear function class even though each sampled weight vector w defines a different rule.",
    },
    "Prompt distribution": {
      definition:
        "A prompt distribution is the probability process that generates the functions, examples, query inputs, and ordering used in prompt experiments.",
      details: [
        "In Garg's linear setting, a random weight vector chooses the function and Gaussian vectors supply both demonstrations and the query.",
        "A model can perform well on prompts from its training distribution yet degrade when input scale, covariance, noise, or query geometry changes.",
        "The term describes repeated experimental sampling, not the next-token probability distribution produced for one fixed prompt.",
      ],
      example:
        "One prompt distribution samples w and every x from standard Gaussians, then emits pairs x, w·x followed by a new query x.",
    },
    "Minimum-norm least squares": {
      definition:
        "Minimum-norm least squares chooses the smallest-length weight vector among the linear fits that minimize squared error.",
      details: [
        "The Moore-Penrose pseudoinverse computes this solution as X-plus times y when the demonstrations form matrix X and target vector y.",
        "It provides the optimal comparison estimator in Garg's specified noiseless linear-function experiment.",
        "When examples do not uniquely determine every weight coordinate, minimum norm resolves the ambiguity without claiming the hidden true weights are smallest.",
      ],
      example:
        "For the lone constraint w1 + w2 = 2, the minimum-norm exact fit is [1, 1] rather than another valid fit such as [2, 0].",
    },
    "Lasso baseline": {
      definition:
        "The Lasso baseline fits a linear rule while adding an absolute-value (L1) penalty that encourages many learned weights to become exactly zero.",
      details: [
        "Its objective combines squared prediction error with a penalty proportional to the sum of absolute weight values.",
        "Garg and colleagues use Lasso as a task-specific comparison because their sparse linear functions contain only a few nonzero coordinates.",
        "Unlike ordinary closed-form least squares, Lasso normally requires iterative optimization and its result depends on the penalty strength.",
      ],
      example:
        "For a 20-feature prompt generated from only three active features, Lasso can suppress the other 17 weight estimates while fitting the outputs.",
    },
    "In-context distribution shift": {
      definition:
        "Distribution shift means the examples seen in training, the examples in a prompt, or the new query follow different data patterns.",
      details: [
        "Garg and colleagues test shifts between model-training data and prompts and between demonstrations and queries.",
        "Their controlled function tasks compare Transformer predictions with task-specific estimators such as least squares.",
        "Success on simple function classes does not establish equal robustness for arbitrary natural-language tasks.",
      ],
      example:
        "A model trained on small-coordinate linear examples may receive larger-coordinate demonstrations and a shifted query.",
    },
  },
);

const neuralTextDegenerationCards = defineFlashcardGroup(
  {
    subjectId: "model-foundations",
    module: "Model Foundations",
    lesson: "Neural Text Degeneration",
    source:
      "Holtzman, Buys, Du, Forbes, and Choi, The Curious Case of Neural Text Degeneration (2019 preprint; ICLR 2020).",
  },
  {
    "Inference policy": {
      definition:
        "An inference policy is the complete rule used to turn a model's next-token scores into a generated continuation.",
      details: [
        "The policy can include temperature, candidate truncation, random sampling, repetition controls, and stopping rules.",
        "Different policies can produce very different text while using exactly the same trained model weights.",
        "An inference policy chooses among model predictions; it does not add missing knowledge to those predictions.",
      ],
      example:
        "One model can loop under greedy decoding yet produce varied sentences under temperature 0.8 and top-p 0.9.",
    },
    "Open-ended generation": {
      definition:
        "Open-ended generation continues a prompt when many different next sentences could be coherent rather than one answer being uniquely correct.",
      details: [
        "Stories, articles, and conversational continuations are common open-ended generation settings.",
        "Evaluation must consider fluency, coherence, diversity, and task fit instead of only exact string match.",
        "The existence of many acceptable continuations does not make factual or safety requirements optional.",
      ],
      example:
        "After The signal crossed the sky, several descriptions of what happened next could all read naturally.",
    },
    "Training-decoding objective mismatch": {
      definition:
        "Likelihood works well for training a probability model, but maximizing likelihood during generation can still produce poor open-ended text.",
      details: [
        "Training rewards assigning high probability to human tokens observed across many corpus contexts.",
        "Greedy and beam procedures repeatedly select high-likelihood continuations under a different generation-time process.",
        "The mismatch does not show that likelihood training is useless for language understanding or probability estimation.",
      ],
      example:
        "A well-trained model may assign useful probabilities yet repeat the same high-probability sentence under greedy decoding.",
    },
    "Greedy search": {
      definition:
        "Greedy search chooses the single highest-probability token at every generation step and never revisits that choice.",
      details: [
        "The method is deterministic when model scores and tie-breaking behavior are fixed.",
        "Its local choice is inexpensive but can lead into a continuation that becomes repetitive or globally awkward.",
        "Choosing the best token now does not guarantee the highest-probability or best-quality complete sequence.",
      ],
      example:
        "If the has probability 0.42 and a has 0.31, greedy search always selects the at that step.",
    },
    "Beam search": {
      definition:
        "Beam search keeps a limited set of high-scoring partial sequences and expands several alternatives at each step.",
      details: [
        "The beam width controls how many partial hypotheses survive after each round of scoring.",
        "Accumulated log probabilities rank candidates while pruning prevents the search tree from growing without bound.",
        "A wider beam explores more likely sequences but does not guarantee fluent, diverse open-ended writing.",
      ],
      example:
        "With beam width three, the decoder retains the three best partial sentences after scoring every next-token expansion.",
    },
    "Full-distribution sampling": {
      definition:
        "Full-distribution sampling randomly chooses among all next tokens according to the model's normalized probability distribution.",
      details: [
        "High-probability tokens are selected more often, while every token with nonzero probability remains possible.",
        "Random sampling introduces diversity that deterministic maximum-seeking methods cannot produce by themselves.",
        "Keeping the full distribution also exposes generation to a very large set of individually unlikely tail tokens.",
      ],
      example:
        "A token with probability 0.01 will be rare across runs but can still be sampled and redirect the entire continuation.",
    },
    "Unreliable probability tail": {
      definition:
        "The low-probability tail contains many individually unlikely tokens whose combined chance can still be substantial.",
      details: [
        "Holtzman and colleagues describe this tail as less reliable for producing human-like continuations.",
        "One sampled tail token can push later model probabilities toward an incoherent or off-topic trajectory.",
        "Low individual probability does not mean every tail token is always wrong in every possible context.",
      ],
      example:
        "One hundred tokens with probability 0.002 each collectively hold 20 percent of the next-token probability mass.",
    },
    "Trustworthy prediction zone": {
      definition:
        "A trustworthy prediction zone is the context-dependent part of a model's next-token distribution that a decoding rule keeps as plausible candidates.",
      details: [
        "Holtzman and colleagues interpret a truncation boundary as separating a more dependable head from an unreliable low-probability tail.",
        "Top-k fixes the zone by candidate count, while nucleus sampling changes its size to retain a chosen amount of probability mass.",
        "Trustworthy is a decoding hypothesis about fluent continuation, not a guarantee that every retained token is correct or that every removed token is unusable.",
      ],
      example:
        "When three tokens carry 92 percent of the mass, top-p 0.9 can treat those three as the current prediction zone and exclude the long tail.",
    },
    "Neural text degeneration": {
      definition:
        "Neural text degeneration is the collapse of generated language into bland, repetitive, or incoherent text despite a capable model.",
      details: [
        "The paper observes distributional differences between human text and text from common decoding strategies.",
        "Likelihood-maximizing methods often repeat, while unrestricted sampling can wander through the unreliable tail.",
        "Degeneration is a generation behavior and does not imply that every underlying probability estimate is useless.",
      ],
      example:
        "A continuation can repeat the same startup sentence indefinitely even though each individual word is grammatical.",
    },
    "Repetition loop": {
      definition:
        "A repetition loop occurs when generated text returns to the same token or phrase pattern and keeps reinforcing that continuation.",
      details: [
        "Maximum-seeking decoding can repeatedly select a locally probable phrase once the repeated prefix makes it likely again.",
        "Loops can occur at token, phrase, sentence, or structural levels rather than only as consecutive duplicate words.",
        "Removing one repeated phrase after generation does not necessarily prevent the decoding process from entering another loop.",
      ],
      example:
        "The model writes the signal returned, the signal returned, the signal returned without reaching a new event.",
    },
    "Zipf distribution": {
      definition:
        "A Zipf distribution is a rank-frequency pattern in which a few words occur very often and frequency falls roughly as a power of rank.",
      details: [
        "Zipf's law is commonly written as frequency proportional to one over rank raised to a coefficient s.",
        "Holtzman and colleagues compare estimated rank-frequency curves from generated text with the curve from human reference text.",
        "Matching one aggregate vocabulary curve can reveal diversity differences but cannot establish sentence-level coherence or overall generation quality.",
      ],
      example:
        "If the most common word appears 10,000 times, an idealized s-equals-one curve predicts the tenth-ranked word near 1,000 occurrences.",
    },
    "Self-BLEU": {
      definition:
        "Self-BLEU uses the Bilingual Evaluation Understudy (BLEU) overlap score to measure similarity within a generated collection, treating the other generations as references.",
      details: [
        "High Self-BLEU means generations reuse many of the same n-grams, while lower values indicate greater surface-form diversity.",
        "Unlike ordinary BLEU against human references, this setup compares model outputs with one another rather than measuring translation overlap.",
        "A low score can come from diverse but incoherent text, so Self-BLEU must not be treated as a complete quality measure.",
      ],
      example:
        "If ten generated stories repeat nearly identical openings, each story matches the other nine closely and the collection receives high Self-BLEU.",
    },
    "HUSE evaluation": {
      definition:
        "HUSE, or Human Unified with Statistical Evaluation, combines human typicality judgments with model probabilities to compare generated and human text.",
      details: [
        "A discriminator receives only two features—the language model's assigned probability and a human typicality score—and tries to identify text source.",
        "Generation looks more human-like under HUSE when those combined features make human and model samples difficult to distinguish.",
        "Holtzman's truncated decoders required probability smoothing for this evaluation, showing that the reported result depends on a careful measurement procedure.",
      ],
      example:
        "A fluent but repetitive sample may receive a strong typicality rating yet remain distinguishable through its statistical probability feature.",
    },
    "Nucleus sampling": {
      definition:
        "Nucleus sampling keeps the smallest highest-probability token set whose combined probability reaches a chosen threshold p.",
      details: [
        "Candidates are sorted from most likely to least likely before the cumulative threshold is applied.",
        "One token may suffice for a confident distribution, while a flatter distribution retains many candidates.",
        "Top-p changes the candidate set but does not guarantee truth, safety, or an optimal result for every product.",
      ],
      example:
        "For probabilities [0.5, 0.3, 0.15, 0.05], top-p 0.8 retains only the first two tokens.",
    },
    "Cumulative probability mass": {
      definition:
        "Cumulative probability mass is the running total obtained while adding ranked token probabilities from largest to smallest.",
      details: [
        "Nucleus construction stops after including the first token that makes this total reach or exceed p.",
        "The resulting total can exceed the threshold because the final retained token is included whole.",
        "Cumulative mass is not the count of retained tokens and can reach the same threshold with different set sizes.",
      ],
      example:
        "Ranked probabilities 0.42, 0.31, and 0.18 have cumulative masses 0.42, 0.73, and 0.91.",
    },
    "Probability truncation": {
      definition:
        "Probability truncation removes candidate tokens outside a chosen retained region before the decoder draws its random sample.",
      details: [
        "Top-p truncates below an adaptive cumulative-mass boundary, while top-k truncates below a fixed rank boundary.",
        "Removing candidates concentrates the eventual sample on tokens the current distribution considers more plausible.",
        "Truncation can also remove a rare but correct continuation, so more aggressive filtering is not always better.",
      ],
      example:
        "A top-p nucleus may remove fifty tiny-probability tokens before sampling from the five retained candidates.",
    },
    Renormalization: {
      definition:
        "After some tokens are removed, renormalization rescales the retained probabilities so their new total equals one.",
      details: [
        "Each retained probability is divided by the original cumulative mass of the kept candidate set.",
        "The relative probability ratios between retained tokens stay unchanged during this rescaling.",
        "Sampling unnormalized retained values as if they already total one produces an invalid probability distribution.",
      ],
      example:
        "Keeping probabilities 0.5 and 0.3 gives renormalized probabilities 0.625 and 0.375 after division by 0.8.",
    },
    "Top-k sampling": {
      definition:
        "Top-k sampling keeps a fixed number k of the highest-probability tokens and samples only from that set.",
      details: [
        "The retained candidate count stays k whether the original distribution is sharply peaked or nearly flat.",
        "Probabilities of the kept tokens must be renormalized after every lower-ranked candidate is removed.",
        "A fixed k can be too broad in a confident context and too narrow in an honestly ambiguous context.",
      ],
      example:
        "Top-k with k equal to 3 retains exactly the three most likely next tokens before random selection.",
    },
    "Sampling temperature": {
      definition:
        "Temperature changes how sharp or flat the next-token probability distribution becomes before a token is sampled.",
      details: [
        "Dividing logits by a value below one enlarges score gaps and makes high-probability tokens more dominant.",
        "A value above one shrinks score gaps and spreads more mass toward lower-ranked alternatives.",
        "Temperature changes randomness and diversity but does not repair incorrect model knowledge or guarantee creativity.",
      ],
      example:
        "Lowering temperature from 1.0 to 0.5 can turn a moderate preference into a much more conservative distribution.",
    },
    "Decoding heuristic boundary": {
      definition:
        "A decoding heuristic changes how tokens are selected from a model's learned distribution without retraining that distribution or adding knowledge.",
      details: [
        "Top-p, top-k, temperature, greedy search, and beam search all operate after the model has produced its current logits.",
        "A rule can change diversity, repetition, and which probability region is sampled while leaving model parameters untouched.",
        "The most useful settings depend on the model and generation task because the learned distribution changes from one context to the next.",
      ],
      example:
        "Changing top-p from 1.0 to 0.9 removes some candidates before sampling but leaves the model's original logits and weights unchanged.",
    },
  },
);

export const modelFoundationsExpansionLibrary = combineFlashcardLibraries(
  characterRnnCards,
  neuralLanguageModelCards,
  tokenizationCards,
  additiveAttentionCards,
  transformerCards,
  inContextLearningCards,
  neuralTextDegenerationCards,
);
