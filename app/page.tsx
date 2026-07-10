"use client";

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Prediction, TinyCharacterRNN } from "./rnn";

const MINIMUM_CORPUS_LENGTH = 180;
const INITIAL_OUTPUT =
  "Your model’s continuation will appear here after you write a dataset, train it, and give it an opening phrase.";

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
  const [corpus, setCorpus] = useState("");
  const [preparedCorpus, setPreparedCorpus] = useState("");
  const [primer, setPrimer] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [loss, setLoss] = useState(0);
  const [step, setStep] = useState(0);
  const [output, setOutput] = useState(INITIAL_OUTPUT);
  const [temperature, setTemperature] = useState(0.72);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [lossHistory, setLossHistory] = useState<number[]>([]);
  const [modelDetails, setModelDetails] = useState({ vocabulary: 0, parameters: 0 });
  const [modelMessage, setModelMessage] = useState(
    `Write at least ${MINIMUM_CORPUS_LENGTH} characters to create a dataset.`,
  );

  const cleanedCorpus = corpus.trim();
  const isModelCurrent = preparedCorpus.length > 0 && preparedCorpus === cleanedCorpus;
  const charactersRemaining = Math.max(0, MINIMUM_CORPUS_LENGTH - cleanedCorpus.length);

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
    if (cleanedCorpus.length < MINIMUM_CORPUS_LENGTH) {
      setModelMessage(`Add ${charactersRemaining} more characters before building the model.`);
      return;
    }

    const model = new TinyCharacterRNN(cleanedCorpus, 36, 32);
    modelRef.current = model;
    setPreparedCorpus(cleanedCorpus);
    setIsRunning(false);
    setLoss(model.loss);
    setStep(0);
    setLossHistory([model.loss]);
    setOutput("Fresh weights are ready. Train the model, then type an opening phrase below.");
    setModelDetails({
      vocabulary: model.vocabulary.length,
      parameters: model.parameterCount,
    });
    setModelMessage("Model built from your text. Its weights are random until you train them.");
    updatePrediction(model, "", temperature);
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

  const handleCorpusChange = (value: string) => {
    setCorpus(value);
    if (isRunning) setIsRunning(false);
    if (preparedCorpus && preparedCorpus !== value.trim()) {
      setModelMessage("Your dataset changed. Rebuild the model so the new text is used.");
    } else if (value.trim().length < MINIMUM_CORPUS_LENGTH) {
      setModelMessage(
        `Keep writing: ${Math.max(0, MINIMUM_CORPUS_LENGTH - value.trim().length)} characters to go.`,
      );
    }
  };

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
          <a href="#code">Code</a>
          <a href="#train">Train</a>
        </nav>
        <span className="lesson-index">Lesson 01 / 30</span>
      </header>

      <div className="lesson-page" id="top">
        <HeaderSection
          label="Lesson 01 · The unreasonable effectiveness of recurrent neural networks"
          title={<>Teach a machine<br />to dream in<br />characters.</>}
          description={
            <p>
              In 2015, Andrej Karpathy showed that a small neural network trained on one humble
              objective—predict the next character—could reproduce the texture of Shakespeare,
              Wikipedia, mathematical writing, and computer code. This lesson explains why, then
              lets you train the same kind of model on text you write yourself.
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
          title="A language model learns by being surprised."
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
          title="The target is the same text, shifted one place."
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
            <p><b>Vocabulary</b> is the set of unique characters in your text.</p>
            <p><b>Context</b> is what the model has already read.</p>
            <p><b>Target</b> is the next character it should assign high probability.</p>
          </div>
        </DiagramSection>

        <ParagraphSection
          label="3 · Why memory matters"
          title="The same character can imply different futures."
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
          title="One memory vector travels through the sequence."
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

        <CodingSection
          id="code"
          label="5 · Implementation"
          title="The forward pass is small enough to read."
          description="This is the essential JavaScript executed for each character. Matrix operations are written compactly here; the live model below implements the same recurrence with typed arrays."
        >
          <div className="code-window">
            <div className="code-window-header">
              <span>tiny-character-rnn.js</span>
              <span>forward pass</span>
            </div>
            <pre><code><span className="code-comment">{"// 1. Encode the current character as a vector."}</span>{"\n"}<span className="code-keyword">const</span> x = oneHot(character, vocabulary);{"\n\n"}<span className="code-comment">{"// 2. Combine the input with the previous memory."}</span>{"\n"}<span className="code-keyword">const</span> h = tanh(add(matmul(Wxh, x), matmul(Whh, hPrev), bh));{"\n\n"}<span className="code-comment">{"// 3. Score every possible next character."}</span>{"\n"}<span className="code-keyword">const</span> logits = add(matmul(Why, h), by);{"\n"}<span className="code-keyword">const</span> probabilities = softmax(logits);{"\n\n"}<span className="code-comment">{"// 4. Penalize surprise at the correct answer."}</span>{"\n"}<span className="code-keyword">const</span> loss = -Math.log(probabilities[target]);</code></pre>
          </div>
          <div className="code-explanation">
            <article><span>01</span><p><b>Encoding</b> converts a character into numbers the network can multiply by weights.</p></article>
            <article><span>02</span><p><b>Recurrence</b> mixes new evidence with information retained from earlier positions.</p></article>
            <article><span>03</span><p><b>Softmax</b> converts raw scores into probabilities that add up to one.</p></article>
            <article><span>04</span><p><b>Loss</b> is large when the true next character was assigned a small probability.</p></article>
          </div>
        </CodingSection>

        <ParagraphSection
          label="6 · Training and generation"
          title="Learning changes probabilities; sampling turns them into text."
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
          label="7 · Your experiment"
          title="Write the world your model will learn."
          description={
            <>
              Type at least {MINIMUM_CORPUS_LENGTH} characters. Use several related sentences and
              repeat names, phrases, or structures you want the model to notice. The model receives
              only this text—nothing is preloaded and nothing is sent away from your browser.
            </>
          }
        >
          <div className="experiment-steps">
            <article className="experiment-step">
              <div className="field-heading">
                <div><span>Step 1</span><h3>Write a tiny dataset</h3></div>
                <span className={charactersRemaining ? "field-status" : "field-status complete"}>
                  {charactersRemaining ? `${charactersRemaining} characters to go` : "enough to train"}
                </span>
              </div>
              <p className="field-instruction">
                Try describing a place, inventing a short dialogue, or writing several lines in a
                repeated format. Consistency gives a small model something it can learn quickly.
              </p>
              <textarea
                className="dataset-input"
                aria-label="Write the training dataset"
                placeholder={'Example direction (write your own):\n\n"Create six short sentences about a lighthouse. Repeat the names Mara and Sol. Give every sentence a similar rhythm."'}
                value={corpus}
                onChange={(event) => handleCorpusChange(event.target.value)}
                spellCheck="true"
              />
              <div className="field-footer">
                <span>{cleanedCorpus.length.toLocaleString()} characters · {new Set(Array.from(cleanedCorpus)).size} unique</span>
                <button type="button" className="action-button" onClick={buildModel} disabled={charactersRemaining > 0}>
                  {preparedCorpus ? "Rebuild from my text" : "Build a model from my text"}
                </button>
              </div>
              <p className="model-message" aria-live="polite">{modelMessage}</p>
            </article>

            <article className={`experiment-step ${isModelCurrent ? "" : "step-disabled"}`}>
              <div className="field-heading">
                <div><span>Step 2</span><h3>Train fresh weights</h3></div>
                <span className={isRunning ? "field-status learning" : "field-status"}>
                  {isRunning ? "training now" : isModelCurrent ? "ready" : "waiting for text"}
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
                <div><span>Step 3</span><h3>Type an opening phrase</h3></div>
                <span className="field-status">temperature {temperature.toFixed(2)}</span>
              </div>
              <p className="field-instruction">
                Begin with characters that occurred in your dataset. The model will continue from
                your phrase one character at a time using only what its weights learned above.
              </p>
              <textarea
                className="primer-input"
                aria-label="Type an opening phrase for generation"
                placeholder="Type the beginning of a sentence…"
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
                <div><span>Step 4</span><h3>Read what the model predicts</h3></div>
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
          label="8 · Interpreting the result"
          title="Look for evidence of learning, not intelligence."
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
              You supplied the data, created the vocabulary, optimized real weights, and sampled new
              text from the model’s probability distribution. The scale is tiny; the learning loop
              is real.
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
