"use client";

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Prediction, TinyCharacterRNN } from "./rnn";

const INITIAL_OUTPUT =
  "Autoregressive output will appear after dataset selection, forward-pass validation, optimization, and sampling-prefix entry.";

const CODE_SCAFFOLD = `function forward(x, hPrev, target) {
  // 1. Compute the new hidden state.

  // 2. Convert the hidden state into logits.

  // 3. Convert logits into probabilities.

  // 4. Compute target negative log-likelihood.

  return { hidden, probabilities, loss };
}`;

const DATASETS = [
  {
    id: "fable",
    title: "The Lantern Wood",
    category: "Narrative prose",
    description: "Repeated names, places, and sentence rhythms make emerging structure easy to hear.",
    seed: "Mara carried",
    text: `Mara carried the lantern into the wood. The lantern made a small circle of gold on the path. Sol followed Mara and counted every owl they heard.

At the river, Mara raised the lantern. The water carried the circle of gold toward the old bridge. Sol said the bridge remembered every traveler.

Mara crossed first. Sol crossed second. Behind them, the wood grew quiet. Ahead of them, one window shone in the empty house.

The house had a blue door and a brass bell. Mara rang the bell once. Sol rang the bell twice. From inside came the soft sound of a chair moving.

An old fox opened the blue door. The fox wore a red scarf and held a silver cup. Welcome, said the fox. I have been waiting for the lantern.

Mara placed the lantern on the table. The circle of gold filled the silver cup. Sol stopped counting owls. Outside, the bridge remembered the light.`
  },
  {
    id: "dialogue",
    title: "Weather Station",
    category: "Dialogue",
    description: "Speaker labels and repeated questions give the model a strong, visible format to imitate.",
    seed: "NOA:",
    text: `NOA: Read the western gauge.
ELI: The western gauge says rain.
NOA: Read the northern gauge.
ELI: The northern gauge says wind.

NOA: What does the glass show?
ELI: A silver line at twenty-three.
NOA: What does the roof show?
ELI: Three crows facing east.

NOA: Record the hour.
ELI: The hour is six and the sky is violet.
NOA: Record the pressure.
ELI: The pressure is falling slowly.

NOA: Will the storm reach the harbor?
ELI: The western gauge says yes.
NOA: Will the boats return before dark?
ELI: The northern gauge says no.

NOA: Read the final gauge.
ELI: The final gauge has no numbers.
NOA: Then what does it measure?
ELI: It measures how long we are willing to wait.`
  },
  {
    id: "javascript",
    title: "Tiny JavaScript",
    category: "Source code",
    description: "Braces, indentation, keywords, and repeated function shapes create crisp local patterns.",
    seed: "function ",
    text: `function add(a, b) {
  return a + b;
}

function subtract(a, b) {
  return a - b;
}

function multiply(a, b) {
  return a * b;
}

function square(value) {
  return multiply(value, value);
}

function average(values) {
  let total = 0;
  for (const value of values) {
    total = add(total, value);
  }
  return total / values.length;
}

function clamp(value, minimum, maximum) {
  if (value < minimum) {
    return minimum;
  }
  if (value > maximum) {
    return maximum;
  }
  return value;
}

function normalize(value, minimum, maximum) {
  const range = subtract(maximum, minimum);
  const offset = subtract(value, minimum);
  return clamp(offset / range, 0, 1);
}`
  },
] as const;

type DatasetId = (typeof DATASETS)[number]["id"];

type SectionProps = {
  id?: string;
  label: string;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
};

function HeaderSection({
  id,
  label,
  title,
  description,
  children,
  size = "large",
}: SectionProps & { size?: "small" | "medium" | "large" }) {
  return (
    <section className={`kit-section header-section header-${size}`} id={id}>
      <p className="section-label">{label}</p>
      <h1>{title}</h1>
      {description ? <div className="header-description">{description}</div> : null}
      {children}
    </section>
  );
}

function ParagraphSection({ id, label, title, description, children }: SectionProps) {
  return (
    <section className="kit-section paragraph-section" id={id}>
      <div className="section-heading">
        <p className="section-label">{label}</p>
        <h2>{title}</h2>
        {description ? <p className="section-description">{description}</p> : null}
      </div>
      <div className="paragraph-body">{children}</div>
    </section>
  );
}

function DiagramSection({ id, label, title, description, children }: SectionProps) {
  return (
    <section className="kit-section diagram-section" id={id}>
      <div className="section-heading compact-heading">
        <p className="section-label">{label}</p>
        <h2>{title}</h2>
        {description ? <p className="section-description">{description}</p> : null}
      </div>
      <div className="diagram-canvas">{children}</div>
    </section>
  );
}

function CodingSection({ id, label, title, description, children }: SectionProps) {
  return (
    <section className="kit-section coding-section" id={id}>
      <div className="section-heading compact-heading">
        <p className="section-label">{label}</p>
        <h2>{title}</h2>
        {description ? <p className="section-description">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function TextBoxSection({ id, label, title, description, children }: SectionProps) {
  return (
    <section className="kit-section textbox-section" id={id}>
      <div className="section-heading">
        <p className="section-label">{label}</p>
        <h2>{title}</h2>
        {description ? <p className="section-description">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function displayCharacter(character: string) {
  if (character === " ") return "space";
  if (character === "\n") return "return";
  if (character === "\t") return "tab";
  return character;
}

export default function Home() {
  const modelRef = useRef<TinyCharacterRNN | null>(null);
  const [selectedDatasetId, setSelectedDatasetId] = useState<DatasetId>("fable");
  const [modelDatasetId, setModelDatasetId] = useState<DatasetId | null>(null);
  const [codeInput, setCodeInput] = useState(CODE_SCAFFOLD);
  const [codeComplete, setCodeComplete] = useState(false);
  const [codeMessage, setCodeMessage] = useState(
    "Complete all four operations, then run your forward pass.",
  );
  const [primer, setPrimer] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [loss, setLoss] = useState(0);
  const [step, setStep] = useState(0);
  const [output, setOutput] = useState(INITIAL_OUTPUT);
  const [temperature, setTemperature] = useState(0.72);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [lossHistory, setLossHistory] = useState<number[]>([]);
  const [modelDetails, setModelDetails] = useState({ vocabulary: 0, parameters: 0 });
  const selectedDataset = DATASETS.find((dataset) => dataset.id === selectedDatasetId) ?? DATASETS[0];
  const isModelCurrent = codeComplete && modelDatasetId === selectedDatasetId;

  const updatePrediction = useCallback(
    (model: TinyCharacterRNN, currentPrimer: string, currentTemperature: number) => {
      const context = currentPrimer || model.text.slice(0, 32);
      setPredictions(model.topPredictions(context, currentTemperature));
      if (currentPrimer.trim()) {
        setOutput(model.sample(420, currentTemperature, currentPrimer));
      }
    },
    [],
  );

  const buildModel = () => {
    const model = new TinyCharacterRNN(selectedDataset.text, 36, 32);
    modelRef.current = model;
    setModelDatasetId(selectedDataset.id);
    setCodeComplete(true);
    setIsRunning(false);
    setLoss(model.loss);
    setStep(0);
    setLossHistory([model.loss]);
    setOutput("Parameters initialized. Run optimization, then enter a sampling prefix below.");
    setPrimer("");
    setModelDetails({
      vocabulary: model.vocabulary.length,
      parameters: model.parameterCount,
    });
    updatePrediction(model, "", temperature);
  };

  const selectDataset = (datasetId: DatasetId) => {
    setSelectedDatasetId(datasetId);
    setModelDatasetId(null);
    setCodeComplete(false);
    setIsRunning(false);
    setLoss(0);
    setStep(0);
    setLossHistory([]);
    setPredictions([]);
    setPrimer("");
    setOutput(INITIAL_OUTPUT);
    setModelDetails({ vocabulary: 0, parameters: 0 });
    setCodeMessage("Dataset selected. Validate the forward pass to initialize model parameters.");
    modelRef.current = null;
  };

  const validateCode = () => {
    const checks = [
      { label: "a recurrent tanh hidden state", matches: /const\s+hidden\s*=\s*tanh\s*\(\s*add\s*\(\s*matmul\s*\(\s*Wxh\s*,\s*x\s*\)\s*,\s*matmul\s*\(\s*Whh\s*,\s*hPrev\s*\)\s*,\s*bh\s*\)\s*\)/ },
      { label: "a logits calculation", matches: /const\s+logits\s*=\s*add\s*\(\s*matmul\s*\(\s*Why\s*,\s*hidden\s*\)\s*,\s*by\s*\)/ },
      { label: "softmax probabilities", matches: /const\s+probabilities\s*=\s*softmax\s*\(\s*logits\s*\)/ },
      { label: "negative log loss", matches: /const\s+loss\s*=\s*-\s*Math\.log\s*\(\s*probabilities\s*\[\s*target\s*\]\s*\)/ },
    ];
    const missing = checks.filter((check) => !check.matches.test(codeInput));
    if (missing.length > 0) {
      setCodeComplete(false);
      setModelDatasetId(null);
      setIsRunning(false);
      setCodeMessage(`Still missing: ${missing.map((check) => check.label).join(", ")}.`);
      return;
    }

    buildModel();
    setCodeMessage(`Forward pass validated. Parameters initialized for “${selectedDataset.title}.”`);
  };

  const handleCodeChange = (value: string) => {
    setCodeInput(value);
    if (codeComplete) {
      setCodeComplete(false);
      setModelDatasetId(null);
      setIsRunning(false);
      setLoss(0);
      setStep(0);
      setLossHistory([]);
      setPredictions([]);
      setOutput(INITIAL_OUTPUT);
      modelRef.current = null;
    }
    setCodeMessage("Code changed. Run the forward pass again when all four operations are present.");
  };

  useEffect(() => {
    if (!isRunning || !isModelCurrent) return;
    let animationFrame = 0;
    let active = true;

    const train = () => {
      const model = modelRef.current;
      if (!active || !model) return;
      let snapshot = model.trainStep();
      snapshot = model.trainStep();

      if (snapshot.step % 6 === 0) {
        setLoss(snapshot.loss);
        setStep(snapshot.step);
        setLossHistory((history) => [...history.slice(-43), snapshot.loss]);
        updatePrediction(model, primer, temperature);
      }
      animationFrame = window.requestAnimationFrame(train);
    };

    animationFrame = window.requestAnimationFrame(train);
    return () => {
      active = false;
      window.cancelAnimationFrame(animationFrame);
    };
  }, [isModelCurrent, isRunning, primer, temperature, updatePrediction]);

  const generate = () => {
    const model = modelRef.current;
    if (!model || !isModelCurrent || step === 0 || !primer.trim()) return;
    updatePrediction(model, primer, temperature);
  };

  const maximumLoss = Math.max(...lossHistory, 0.01);
  const minimumLoss = Math.min(...lossHistory, maximumLoss);
  const lossRange = Math.max(0.05, maximumLoss - minimumLoss);

  return (
    <main>
      <div className="page-atmosphere" aria-hidden="true">
        <span className="atmosphere-line line-a" />
        <span className="atmosphere-line line-b" />
        <span className="atmosphere-line line-c" />
        <span className="atmosphere-node atmosphere-node-a" />
        <span className="atmosphere-node atmosphere-node-b" />
        <span className="atmosphere-glow" />
      </div>

      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Latent home">
          <span className="wordmark-dot" />
          latent
        </a>
        <nav aria-label="Lesson navigation">
          <a href="#idea">Read</a>
          <a href="#mechanism">See</a>
          <a href="#dataset">Data</a>
          <a href="#code">Code</a>
          <a href="#train">Train</a>
        </nav>
        <span className="lesson-index">Lesson 01 / 30</span>
      </header>

      <div className="lesson-page" id="top">
        <HeaderSection
          label="Lesson 01 · Sequence modeling"
          title="Character-Level Recurrent Neural Networks"
          description={
            <p>
              Derive and implement a tanh RNN language model with one-hot character inputs, a shared
              recurrent hidden state, softmax next-character probabilities, cross-entropy loss,
              truncated backpropagation through time, AdaGrad updates, and temperature-scaled
              autoregressive sampling.
            </p>
          }
          size="large"
        >
          <div className="lesson-meta">
            <span>Architecture · tanh RNN</span>
            <span>Hidden width · H = 36</span>
            <span>BPTT window · T = 32</span>
          </div>
        </HeaderSection>

        <ParagraphSection
          id="idea"
          label="1 · Autoregressive objective"
          title="Next-character maximum-likelihood estimation"
          description="Given a character sequence c₀…cₙ, optimize θ to maximize the conditional likelihood of each next character given the preceding context."
        >
          <div className="reading-copy">
            <p>
              Let the vocabulary contain <code>V</code> unique characters. At time <code>t</code>, the
              observed character is encoded as a one-hot vector <code>xₜ ∈ Rⱽ</code>. The network
              produces logits <code>zₜ ∈ Rⱽ</code>, then applies softmax to obtain a categorical
              distribution <code>pₜ = Pθ(cₜ₊₁ | c₀…cₜ)</code> over the next character.
            </p>
            <p>
              For target index <code>yₜ</code>, the per-step negative log-likelihood is
              <code> Lₜ = −log pₜ[yₜ]</code>. The sequence loss sums or averages this quantity over
              the unrolled window. Minimizing cross-entropy is equivalent to maximizing the
              likelihood assigned to observed next characters under the model.
            </p>
            <p>
              The objective contains no explicit word, syntax, or formatting labels. Those
              regularities are learned only when they reduce conditional entropy. Recognizing a
              quote boundary, indentation level, identifier prefix, or recurring phrase improves
              the next-character distribution and therefore lowers the same scalar loss.
            </p>
          </div>
          <div className="technical-spec-grid">
            <div><code>xₜ ∈ Rⱽ</code><span>one-hot input</span></div>
            <div><code>hₜ ∈ Rᴴ</code><span>recurrent state</span></div>
            <div><code>Wₓₕ ∈ Rᴴˣⱽ</code><span>input projection</span></div>
            <div><code>Wₕₕ ∈ Rᴴˣᴴ</code><span>recurrent projection</span></div>
            <div><code>Wₕᵧ ∈ Rⱽˣᴴ</code><span>output projection</span></div>
            <div><code>pₜ ∈ Δⱽ⁻¹</code><span>categorical distribution</span></div>
          </div>
          <aside className="information-note">
            <b>Architecture scope</b>
            <p>
              This lesson implements the recurrent architecture analyzed in Karpathy’s essay. A
              transformer replaces the single recurrent state with attention over token
              representations, but it can use the same autoregressive likelihood objective,
              cross-entropy loss, and sampling procedure.
            </p>
          </aside>
        </ParagraphSection>

        <DiagramSection
          label="2 · Supervised sequence construction"
          title="One-step temporal shift defines the labels"
          description="For a sequence of length T + 1, positions 0…T−1 form the inputs and positions 1…T form the targets. The model receives T supervised next-character predictions per window."
        >
          <div className="shift-diagram">
            <div className="diagram-row">
              <span className="diagram-row-label">input</span>
              {Array.from("the model").map((character, index) => (
                <span className="character-cell" key={`input-${index}`}>{character === " " ? "·" : character}</span>
              ))}
              <span className="character-cell faded">…</span>
            </div>
            <div className="shift-arrows" aria-hidden="true">
              {Array.from({ length: 9 }, (_, index) => <span key={index}>↘</span>)}
            </div>
            <div className="diagram-row">
              <span className="diagram-row-label">target</span>
              {Array.from("he model ").map((character, index) => (
                <span className="character-cell target-cell" key={`target-${index}`}>{character === " " ? "·" : character}</span>
              ))}
              <span className="character-cell faded">…</span>
            </div>
          </div>
          <div className="diagram-caption-grid">
            <p><b>Input tensor</b> has shape T × V after one-hot encoding.</p>
            <p><b>Target tensor</b> stores T integer class indices in [0, V).</p>
            <p><b>Loss reduction</b> averages −log pₜ[yₜ] across the T positions.</p>
          </div>
        </DiagramSection>

        <ParagraphSection
          label="3 · Hidden-state recurrence"
          title="Context compression into a fixed-width state"
          description="The hidden vector hₜ is the only path by which information from earlier positions can affect the prediction at time t."
        >
          <div className="reading-copy two-up-reading">
            <p>
              The recurrence computes <code>hₜ = tanh(Wₓₕxₜ + Wₕₕhₜ₋₁ + bₕ)</code>. The input
              projection maps the V-dimensional one-hot character into H hidden features. The
              recurrent projection transforms the previous H-dimensional state. Their sum passes
              through tanh, bounding each hidden activation to (−1, 1).
            </p>
            <p>
              Because the same matrices are reused at every position, parameter count is independent
              of sequence length. The tradeoff is a fixed-width information bottleneck: any feature
              needed later must survive repeated multiplication by <code>Wₕₕ</code> and repeated
              tanh derivatives. This produces vanishing or exploding gradients over long temporal
              distances.
            </p>
          </div>
        </ParagraphSection>

        <DiagramSection
          id="mechanism"
          label="4 · Unrolled computation graph"
          title="Parameter sharing across time steps"
          description="Unrolling makes the temporal dependencies explicit: each hₜ consumes hₜ₋₁, while the same Wₓₕ, Wₕₕ, Wₕᵧ, bₕ, and bᵧ parameters are reused at every position."
        >
          <div className="recurrent-diagram">
            {[
              ["t", "h₁", "h"],
              ["h", "h₂", "e"],
              ["e", "h₃", "·"],
              ["·", "h₄", "m"],
            ].map(([input, hidden, prediction], index) => (
              <div className="recurrent-step" key={hidden}>
                <span className="step-index">step {index + 1}</span>
                <span className="input-token">{input}</span>
                <span className="vertical-arrow">↓</span>
                <span className="memory-token">{hidden}</span>
                <span className="vertical-arrow">↓</span>
                <span className="prediction-token">predict {prediction}</span>
              </div>
            ))}
          </div>
          <div className="equation-strip">
            <code>hₜ = tanh(Wₓₕxₜ + Wₕₕhₜ₋₁ + bₕ)</code>
            <span>H-dimensional state update with shared parameters and tanh activation</span>
          </div>
        </DiagramSection>

        <TextBoxSection
          id="dataset"
          label="5 · Corpus and vocabulary"
          title="Select the empirical training distribution"
          description="Each fixed corpus induces a different character vocabulary, marginal frequency distribution, transition structure, and sequence-level dependency profile."
        >
          <div className="dataset-grid" role="group" aria-label="Training dataset">
            {DATASETS.map((dataset) => (
              <button
                type="button"
                className={dataset.id === selectedDatasetId ? "dataset-card selected" : "dataset-card"}
                key={dataset.id}
                onClick={() => selectDataset(dataset.id)}
                aria-pressed={dataset.id === selectedDatasetId}
              >
                <span>{dataset.category}</span>
                <h3>{dataset.title}</h3>
                <p>{dataset.description}</p>
                <code>{dataset.text.slice(0, 106).replace(/\s+/g, " ")}…</code>
                <em>{dataset.text.length.toLocaleString()} characters</em>
              </button>
            ))}
          </div>
        </TextBoxSection>

        <CodingSection
          id="code"
          label="6 · Forward-pass implementation"
          title="RNN forward pass: hₜ, zₜ, pₜ, and Lₜ"
          description="Complete the JavaScript computation for hₜ, zₜ, pₜ, and Lₜ. The checker ignores formatting but validates the required operations and parameter dependencies."
        >
          <div className="typing-layout">
            <div className="exercise-brief">
              <p className="section-label">Required operations</p>
              <ol>
                <li><span>01</span><p>Create <code>hidden</code> with <code>tanh</code>, combining <code>Wxh × x</code>, <code>Whh × hPrev</code>, and <code>bh</code>.</p></li>
                <li><span>02</span><p>Create <code>logits</code> with <code>add(matmul(Why, hidden), by)</code>.</p></li>
                <li><span>03</span><p>Create <code>probabilities</code> by applying <code>softmax</code> to the logits.</p></li>
                <li><span>04</span><p>Create <code>loss</code> as the negative log probability of <code>target</code>.</p></li>
              </ol>
              <details>
                <summary>Show the available helpers</summary>
                <p><code>matmul(A, b)</code>, <code>add(...vectors)</code>, <code>tanh(vector)</code>, and <code>softmax(vector)</code>.</p>
              </details>
            </div>
            <div className="code-editor-shell">
              <div className="code-window-header">
                <span>forward.js</span>
                <span>{selectedDataset.title}</span>
              </div>
              <textarea
                className="code-editor"
                aria-label="Type the recurrent neural network forward pass"
                value={codeInput}
                onChange={(event) => handleCodeChange(event.target.value)}
                spellCheck="false"
              />
              <div className="code-editor-footer">
                <p className={codeComplete ? "code-status complete" : "code-status"} aria-live="polite">{codeMessage}</p>
                <button type="button" className="action-button" onClick={validateCode}>Run my forward pass</button>
              </div>
            </div>
          </div>
        </CodingSection>

        <ParagraphSection
          label="7 · Optimization and decoding"
          title="Truncated BPTT, AdaGrad, and temperature scaling"
          description="Optimization differentiates the sequence loss through the unrolled recurrence; decoding repeatedly samples from the model’s temperature-adjusted output distribution."
        >
          <div className="reading-copy two-up-reading">
            <p>
              The implementation unrolls <code>T = 32</code> steps and differentiates the mean
              cross-entropy backward through that finite graph. Truncation bounds computation and
              memory, but prevents the gradient from directly assigning credit across more than 32
              positions. Each scalar gradient is clipped to [−5, 5] before the optimizer update to
              reduce instability from exploding recurrent products.
            </p>
            <p>
              AdaGrad accumulates squared gradients per parameter:
              <code> m ← m + g²</code>, then applies <code>θ ← θ − ηg / √(m + ε)</code>. During
              decoding, logits are divided by temperature τ before softmax. Values τ &lt; 1 sharpen
              the distribution; τ &gt; 1 increase entropy. The sampled index is fed back as the next
              one-hot input, producing an autoregressive sequence.
            </p>
          </div>
          <ol className="training-cycle">
            <li><span>1</span><p><b>Forward</b> compute hₜ, zₜ, pₜ, and cross-entropy for T positions.</p></li>
            <li><span>2</span><p><b>Backward</b> accumulate parameter gradients through the unrolled recurrence.</p></li>
            <li><span>3</span><p><b>Clip</b> each gradient component to the interval [−5, 5].</p></li>
            <li><span>4</span><p><b>Update</b> Wₓₕ, Wₕₕ, Wₕᵧ, bₕ, and bᵧ with AdaGrad.</p></li>
          </ol>
        </ParagraphSection>

        <TextBoxSection
          id="train"
          label="8 · Browser-based optimization"
          title="Optimize the corpus and sample autoregressively"
          description={`The typed implementation initializes a 36-unit tanh RNN for “${selectedDataset.title}.” Forward passes, BPTT, gradient clipping, AdaGrad, and sampling execute locally in JavaScript.`}
        >
          <div className="active-dataset-bar">
            <span>Selected dataset</span>
            <b>{selectedDataset.title}</b>
            <p>{selectedDataset.category} · {selectedDataset.text.length.toLocaleString()} characters · {new Set(Array.from(selectedDataset.text)).size} unique characters</p>
          </div>
          <div className="experiment-steps">
            <article className={`experiment-step ${isModelCurrent ? "" : "step-disabled"}`}>
              <div className="field-heading">
                <div><span>Step 1</span><h3>Run truncated BPTT updates</h3></div>
                <span className={isRunning ? "field-status learning" : "field-status"}>
                  {isRunning ? "training now" : isModelCurrent ? "ready" : "complete the code first"}
                </span>
              </div>
              <p className="field-instruction">
                The displayed loss is an exponential moving average of per-character negative
                log-likelihood. Individual windows vary, but the smoothed value should decrease as
                the model fits the corpus distribution.
              </p>
              <div className="training-readout">
                <div className="metric"><span>loss</span><strong>{loss ? loss.toFixed(3) : "—"}</strong><small>lower is better</small></div>
                <div className="metric"><span>updates</span><strong>{step.toLocaleString()}</strong><small>32 characters each</small></div>
                <div className="metric"><span>parameters</span><strong>{modelDetails.parameters ? modelDetails.parameters.toLocaleString() : "—"}</strong><small>{modelDetails.vocabulary || 0} character vocabulary</small></div>
              </div>
              <div className="loss-plot" aria-label="Recent training loss">
                {lossHistory.map((value, index) => {
                  const normalized = (value - minimumLoss) / lossRange;
                  return <span key={`${index}-${value}`} style={{ height: `${14 + normalized * 76}%` }} title={value.toFixed(3)} />;
                })}
                {lossHistory.length <= 1 ? <p>Loss history appears here while the model trains.</p> : null}
              </div>
              <button
                type="button"
                className="action-button wide-button"
                onClick={() => setIsRunning((running) => !running)}
                disabled={!isModelCurrent}
              >
                {isRunning ? "Pause training" : step ? "Continue training" : "Start training"}
              </button>
            </article>

            <article className={`experiment-step ${step === 0 ? "step-disabled" : ""}`}>
              <div className="field-heading">
                <div><span>Step 2</span><h3>Specify prefix and sampling temperature</h3></div>
                <span className="field-status">temperature {temperature.toFixed(2)}</span>
              </div>
              <p className="field-instruction">
                The prefix initializes the recurrent state before free-running generation. Use only
                characters in the corpus vocabulary. For this corpus, a valid prefix is
                <code>{selectedDataset.seed}</code>.
              </p>
              <textarea
                className="primer-input"
                aria-label="Type an opening phrase for generation"
                placeholder={`Try “${selectedDataset.seed}”`}
                value={primer}
                onChange={(event) => setPrimer(event.target.value)}
                disabled={step === 0}
              />
              <div className="temperature-row">
                <label htmlFor="temperature">Predictable</label>
                <input
                  id="temperature"
                  type="range"
                  min="0.25"
                  max="1.35"
                  step="0.01"
                  value={temperature}
                  onChange={(event) => setTemperature(Number(event.target.value))}
                  disabled={step === 0}
                />
                <label htmlFor="temperature">Varied</label>
              </div>
              <button
                type="button"
                className="action-button wide-button"
                onClick={generate}
                disabled={!isModelCurrent || step === 0 || !primer.trim()}
              >
                Generate a continuation
              </button>
            </article>

            <article className={`experiment-step output-step ${step === 0 ? "step-disabled" : ""}`}>
              <div className="field-heading">
                <div><span>Step 3</span><h3>Inspect probabilities and sampled sequence</h3></div>
                <span className="field-status">generated locally</span>
              </div>
              <textarea className="model-output" aria-label="Generated model output" readOnly value={output} />
              <div className="probability-readout">
                <p>Most likely next characters after your opening phrase</p>
                {predictions.map((prediction) => (
                  <div className="probability-row" key={prediction.character}>
                    <span>{displayCharacter(prediction.character)}</span>
                    <i><b style={{ width: `${Math.max(2, prediction.probability * 100)}%` }} /></i>
                    <em>{Math.round(prediction.probability * 100)}%</em>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </TextBoxSection>

        <ParagraphSection
          label="9 · Diagnostics and failure modes"
          title="Memorization, context decay, and sampling entropy"
          description="A low training loss does not imply semantic understanding. Diagnose what the network fits, what it recombines, and which dependencies its fixed-width state fails to preserve."
        >
          <div className="reading-copy">
            <p>
              At initialization, expected cross-entropy is approximately <code>log V</code> because
              the output distribution is near-uniform. Early optimization fits marginal character
              frequencies and common bigrams. Later updates fit longer local structures such as
              indentation, speaker labels, recurring names, and short phrase templates.
            </p>
            <p>
              Compare samples against the corpus to separate exact memorization from recombination.
              Repeated verbatim spans indicate overfitting; locally plausible but globally
              inconsistent samples indicate context decay. Evaluate multiple temperatures because
              greedy or low-temperature decoding can conceal uncertainty, while high temperature can
              overwhelm learned structure with low-probability transitions.
            </p>
            <p>
              Long-range failures follow from repeated Jacobian products through <code>Wₕₕ</code> and
              tanh. LSTMs add gated additive state updates to improve gradient transport. Attention
              removes the requirement that all prior information be compressed into one state by
              allowing direct, content-dependent access to earlier representations.
            </p>
          </div>
        </ParagraphSection>

        <HeaderSection
          label="Next architecture"
          title="Gated recurrence and attention address context decay"
          description={
            <p>
              This implementation covered the complete character-level RNN pipeline: vocabulary
              construction, one-hot encoding, recurrent state updates, output projection,
              cross-entropy, truncated BPTT, gradient clipping, AdaGrad, and autoregressive sampling.
            </p>
          }
          size="medium"
        >
          <a className="source-link" href="https://karpathy.github.io/2015/05/21/rnn-effectiveness/" target="_blank" rel="noreferrer">
            Read Karpathy’s original essay <span aria-hidden="true">↗</span>
          </a>
        </HeaderSection>
      </div>

      <footer className="site-footer">
        <span className="wordmark"><span className="wordmark-dot" />latent</span>
        <p>A visual, implementation-first path through the ideas that made language models possible.</p>
        <span>Next · Understanding LSTMs</span>
      </footer>
    </main>
  );
}
