"use client";

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Prediction, TinyCharacterRNN } from "./rnn";

const INITIAL_OUTPUT =
  "Your model’s continuation will appear here after you choose a dataset, complete the forward pass, train the model, and give it an opening phrase.";

const CODE_SCAFFOLD = `function forward(x, hPrev, target) {
  // 1. Compute the new hidden state.

  // 2. Convert the hidden state into logits.

  // 3. Convert logits into probabilities.

  // 4. Measure the surprise of the correct target.

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
    setOutput("Fresh weights are ready. Train the model, then type an opening phrase below.");
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
    setCodeMessage("Dataset selected. Run your completed forward pass to build fresh weights.");
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
    setCodeMessage(`Forward pass complete. Fresh weights now use “${selectedDataset.title}.”`);
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
          label="Lesson 01 · The unreasonable effectiveness of recurrent neural networks"
          title="Teach a machine to dream in characters."
          description={
            <p>
              In 2015, Andrej Karpathy showed that a small neural network trained on one humble
              objective—predict the next character—could reproduce the texture of Shakespeare,
              Wikipedia, mathematical writing, and computer code. This lesson explains why, then
              asks you to implement and train the same kind of model on a prepared dataset.
            </p>
          }
          size="large"
        >
          <div className="lesson-meta">
            <span>25 minute lesson</span>
            <span>Real training in JavaScript</span>
            <span>No setup required</span>
          </div>
        </HeaderSection>

        <ParagraphSection
          id="idea"
          label="1 · The central idea"
          title="Prediction turns surprise into a learning signal."
          description="The model is shown a piece of text and asked to predict the character that follows every position. Its error becomes a training signal."
        >
          <div className="reading-copy">
            <p>
              Start with the string <code>hello</code>. The model receives <code>h</code> and should
              predict <code>e</code>. It then receives <code>e</code> and should predict <code>l</code>.
              The process repeats across the entire dataset. Each prediction is a probability
              distribution over the vocabulary: perhaps 42% for <code>l</code>, 18% for a space, 9%
              for <code>a</code>, and smaller probabilities for everything else.
            </p>
            <p>
              When the correct character has low probability, the loss is high. Backpropagation
              measures how every weight contributed to that mistake, and the optimizer nudges the
              weights toward a less surprising prediction next time. Training is simply this loop
              repeated thousands of times: predict, compare, adjust.
            </p>
            <p>
              Nothing in the objective explicitly describes words, quotation marks, indentation,
              or grammar. Those patterns become useful internal structure because they make future
              characters easier to predict. A model that recognizes <code>function</code> can make a
              better guess about what follows than one that only counts isolated letters.
            </p>
          </div>
          <aside className="information-note">
            <b>RNN, not transformer</b>
            <p>
              This first lesson uses a recurrent neural network because that is the model in
              Karpathy’s essay. A transformer stores context with attention instead of a recurrent
              hidden state. The learning contract remains recognizable: text in, next-token
              probabilities out, loss, gradients, weight updates, then generation.
            </p>
          </aside>
        </ParagraphSection>

        <DiagramSection
          label="2 · Constructing the task"
          title="Shift the text by one character."
          description="Every character is both an input and, one step earlier, the answer the model should have predicted. One passage therefore supplies many training examples."
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
            <p><b>Vocabulary</b> is the set of unique characters in the selected dataset.</p>
            <p><b>Context</b> is what the model has already read.</p>
            <p><b>Target</b> is the next character it should assign high probability.</p>
          </div>
        </DiagramSection>

        <ParagraphSection
          label="3 · Why memory matters"
          title="Memory changes the next prediction."
          description="A useful prediction depends on more than the character directly in front of the model."
        >
          <div className="reading-copy two-up-reading">
            <p>
              After <code>q</code>, the letter <code>u</code> is a strong prediction in English. But
              longer patterns matter too. Inside a quotation, a closing quote becomes more likely.
              After a function declaration, an opening brace becomes more likely. To exploit those
              patterns, the model needs a summary of the past.
            </p>
            <p>
              An RNN stores that summary in a hidden state, written as <code>h</code>. At each time
              step, it combines the current character with the previous hidden state and produces a
              new hidden state. The vector is not a sentence or database. It is a learned set of
              features that becomes useful only because it improves prediction.
            </p>
          </div>
        </ParagraphSection>

        <DiagramSection
          id="mechanism"
          label="4 · The recurrent mechanism"
          title="A hidden state travels through the sequence."
          description="Reading left to right, the model rewrites its hidden state before making each prediction. The weights are reused at every position."
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
            <span>new memory = current input + previous memory, transformed</span>
          </div>
        </DiagramSection>

        <TextBoxSection
          id="dataset"
          label="5 · Choose the data"
          title="Choose a dataset."
          description="A prepared dataset makes the experiment reproducible. Each option emphasizes a different kind of character-level structure."
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
          label="6 · Implementation"
          title="Type the forward pass."
          description="Use the equation above to complete the JavaScript yourself. The checker ignores formatting, but requires the hidden state, logits, softmax probabilities, and negative log loss."
        >
          <div className="typing-layout">
            <div className="exercise-brief">
              <p className="section-label">Your task</p>
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
          label="7 · Training and generation"
          title="Training changes probabilities."
          description="Training and generation use the same forward pass for different purposes."
        >
          <div className="reading-copy two-up-reading">
            <p>
              During training, backpropagation through time follows the recurrent connections
              backward across a short sequence. It calculates a gradient for every parameter. This
              lesson uses AdaGrad to update the weights: frequently changing parameters receive
              smaller later updates, while less-used parameters can continue moving more freely.
            </p>
            <p>
              During generation, there is no target. The model samples a character from its own
              probability distribution, feeds that character back as the next input, and repeats.
              Temperature reshapes the distribution: lower values favor the safest character;
              higher values preserve more unlikely possibilities and therefore more variety.
            </p>
          </div>
          <ol className="training-cycle">
            <li><span>1</span><p><b>Predict</b> a probability for every next character.</p></li>
            <li><span>2</span><p><b>Compare</b> the distribution with the true next character.</p></li>
            <li><span>3</span><p><b>Backpropagate</b> responsibility through the unrolled sequence.</p></li>
            <li><span>4</span><p><b>Update</b> the weights, then start another sequence.</p></li>
          </ol>
        </ParagraphSection>

        <TextBoxSection
          id="train"
          label="8 · Run the experiment"
          title="Train the model and generate a continuation."
          description={`Your code initializes fresh weights for “${selectedDataset.title}.” Training and generation happen locally in JavaScript.`}
        >
          <div className="active-dataset-bar">
            <span>Selected dataset</span>
            <b>{selectedDataset.title}</b>
            <p>{selectedDataset.category} · {selectedDataset.text.length.toLocaleString()} characters · {new Set(Array.from(selectedDataset.text)).size} unique characters</p>
          </div>
          <div className="experiment-steps">
            <article className={`experiment-step ${isModelCurrent ? "" : "step-disabled"}`}>
              <div className="field-heading">
                <div><span>Step 1</span><h3>Train fresh weights</h3></div>
                <span className={isRunning ? "field-status learning" : "field-status"}>
                  {isRunning ? "training now" : isModelCurrent ? "ready" : "complete the code first"}
                </span>
              </div>
              <p className="field-instruction">
                Loss measures how surprised the model is by the true next character. It should
                trend downward—not perfectly at every update, but across many updates.
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
                <div><span>Step 2</span><h3>Type an opening phrase</h3></div>
                <span className="field-status">temperature {temperature.toFixed(2)}</span>
              </div>
              <p className="field-instruction">
                Start with characters that occur in the selected dataset. For this dataset, try a
                phrase such as <code>{selectedDataset.seed}</code>, then invent your own.
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
                <div><span>Step 3</span><h3>Read what the model predicts</h3></div>
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
          label="9 · Interpreting the result"
          title="Look for learning, not intelligence."
          description="A model this small will not understand your subject. It can still reveal exactly what the objective rewards."
        >
          <div className="reading-copy">
            <p>
              Early samples are usually close to random. Then the model learns character frequency,
              spaces, and punctuation. With more updates it begins producing familiar fragments and
              repeated local structures. If your dataset has a strong format, that format may appear
              before fluent sentences do.
            </p>
            <p>
              Compare the output with your dataset. Ask what was copied exactly, what was recombined,
              and what remained impossible for the model to maintain. Those failures point directly
              at the limitation of a small recurrent state: information must survive many sequential
              rewrites to influence a distant prediction.
            </p>
            <p>
              That limitation motivates the next part of the history. LSTMs introduce gates that
              control what the recurrent state remembers and forgets. Attention later lets a model
              look back at specific positions rather than compressing the entire past into one
              continuously rewritten vector.
            </p>
          </div>
        </ParagraphSection>

        <HeaderSection
          label="Lesson complete"
          title="You trained a language model from first principles."
          description={
            <p>
              You chose the data, wrote the forward pass, created the vocabulary, optimized real
              weights, and sampled new text from the model’s probability distribution. The scale is
              tiny; the learning loop is real.
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
