"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Prediction, TinyCharacterRNN } from "./rnn";

const DEFAULT_CORPUS = `the room was quiet enough to hear the rain thinking.
the little machine watched each character arrive. it remembered a little, forgot a little, and guessed what might come next.

when the moon moved behind the clouds, the window became a dark mirror. the machine wrote: the night is a pattern that has not finished yet.

we gave it no dictionary and no grammar book. we only gave it letters, one after another. from repetition it found words. from words it found rhythm. from rhythm it found a voice.

the cat slept beside the warm computer. somewhere inside the network, thirty-six small numbers changed with every character. those numbers were its memory.

at first its language was noise. then spaces appeared. small words followed. much later, sentences began to lean toward meaning. learning was not a sudden spark. it was a slow rearrangement of probabilities.

the room was quiet. the model made another prediction. the rain continued.`;

const INITIAL_SAMPLE = "Your model’s first words will appear here.";

function displayCharacter(character: string) {
  if (character === " ") return "space";
  if (character === "\n") return "return";
  if (character === "\t") return "tab";
  return character;
}

export default function Home() {
  const modelRef = useRef<TinyCharacterRNN | null>(null);
  const initializedRef = useRef(false);
  const [corpus, setCorpus] = useState(DEFAULT_CORPUS);
  const [isRunning, setIsRunning] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [loss, setLoss] = useState(0);
  const [step, setStep] = useState(0);
  const [sample, setSample] = useState(INITIAL_SAMPLE);
  const [temperature, setTemperature] = useState(0.72);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [lossHistory, setLossHistory] = useState<number[]>([]);
  const [modelDetails, setModelDetails] = useState({ vocabulary: 0, parameters: 0 });
  const [corpusMessage, setCorpusMessage] = useState("Ready to learn from your text.");

  const refreshReadout = useCallback((model: TinyCharacterRNN, currentTemperature: number) => {
    setLoss(model.loss);
    setStep(model.step);
    setSample(model.sample(300, currentTemperature, "the "));
    setPredictions(model.topPredictions("the room was ", currentTemperature));
  }, []);

  const resetModel = useCallback(
    (text: string) => {
      const cleaned = text.trim();
      if (cleaned.length < 140) {
        setCorpusMessage("Add at least 140 characters so the model has a pattern to study.");
        return false;
      }
      const model = new TinyCharacterRNN(cleaned, 36, 32);
      modelRef.current = model;
      setIsRunning(false);
      setIsReady(true);
      setLossHistory([model.loss]);
      setModelDetails({
        vocabulary: model.vocabulary.length,
        parameters: model.parameterCount,
      });
      setCorpusMessage("Fresh weights. The model knows nothing yet.");
      refreshReadout(model, temperature);
      return true;
    },
    [refreshReadout, temperature],
  );

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    resetModel(DEFAULT_CORPUS);
  }, [resetModel]);

  useEffect(() => {
    if (!isRunning) return;
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
        setLossHistory((history) => [...history.slice(-35), snapshot.loss]);
        setSample(model.sample(300, temperature, "the "));
        setPredictions(model.topPredictions("the room was ", temperature));
      }
      animationFrame = window.requestAnimationFrame(train);
    };

    animationFrame = window.requestAnimationFrame(train);
    return () => {
      active = false;
      window.cancelAnimationFrame(animationFrame);
    };
  }, [isRunning, temperature]);

  const sampleAgain = () => {
    const model = modelRef.current;
    if (!model) return;
    setSample(model.sample(300, temperature, "the "));
    setPredictions(model.topPredictions("the room was ", temperature));
  };

  const maximumLoss = Math.max(...lossHistory, 0.01);
  const minimumLoss = Math.min(...lossHistory, maximumLoss);
  const lossRange = Math.max(0.05, maximumLoss - minimumLoss);

  return (
    <main>
      <div className="ambient" aria-hidden="true" />

      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Latent home">
          <span className="wordmark-dot" />
          latent
        </a>
        <nav aria-label="Lesson navigation">
          <a href="#intuition">Intuition</a>
          <a href="#implementation">Implementation</a>
          <a href="#lab">Train the model</a>
        </nav>
        <span className="lesson-index">01 / 30</span>
      </header>

      <section className="hero section-shell" id="top">
        <div className="hero-copy">
          <p className="eyebrow">Lesson 01 · Sequence models</p>
          <h1>
            Teach a machine to <em>dream</em> in characters.
          </h1>
          <p className="hero-intro">
            A quiet introduction to Karpathy’s “Unreasonable Effectiveness” — and a tiny recurrent
            language model you can train, inspect, and sample without leaving this page.
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="#intuition">
              Begin the lesson <span aria-hidden="true">↓</span>
            </a>
            <span>About 18 minutes · no setup</span>
          </div>
        </div>

        <div className="hero-signal" aria-label="A recurrent network carries memory through a sequence">
          <div className="signal-caption">one thought, carried forward</div>
          <div className="signal-line" aria-hidden="true">
            <span className="signal-node node-one">t</span>
            <span className="signal-node node-two">h</span>
            <span className="signal-node node-three">e</span>
            <span className="signal-memory">h<sub>t</sub></span>
          </div>
          <p>
            input <span>x<sub>t</sub></span>
            <i />
            memory <span>h<sub>t−1</sub></span>
            <i />
            prediction <span>p<sub>t+1</sub></span>
          </p>
        </div>
      </section>

      <section className="lesson-section section-shell" id="intuition">
        <div className="section-number">01</div>
        <div className="section-content">
          <p className="eyebrow">Karpathy’s experiment</p>
          <h2>One job: predict the next character.</h2>
          <div className="two-column-copy">
            <p className="lead">
              Karpathy fed the same small model Shakespeare, Linux source, Wikipedia, and LaTeX.
              It was never told what a word—or a bracket—was.
            </p>
            <p>
              The training objective stayed almost absurdly simple: look at the characters so far
              and predict the next one. Yet each dataset pulled a different structure out of the
              network. Shakespeare produced dialogue and stage-like rhythm; code produced indents,
              braces, and local syntax; LaTeX produced commands that looked uncannily at home.
            </p>
          </div>

          <div className="essay-examples" aria-label="Structures learned from different datasets">
            <article><span>Shakespeare</span><b>voice · dialogue · rhythm</b></article>
            <article><span>Linux</span><b>indentation · braces · syntax</b></article>
            <article><span>Wikipedia</span><b>headings · citations · prose</b></article>
            <article><span>LaTeX</span><b>commands · proofs · notation</b></article>
          </div>

          <div className="prediction-question" aria-label="Example next-character prediction">
            <div>
              <span className="mini-label">The context</span>
              <code>the model lear</code>
            </div>
            <div className="question-mark">?</div>
            <div className="candidate-list">
              <span style={{ "--probability": "82%" } as React.CSSProperties}><b>n</b> 82%</span>
              <span style={{ "--probability": "11%" } as React.CSSProperties}><b>r</b> 11%</span>
              <span style={{ "--probability": "4%" } as React.CSSProperties}><b>i</b> 4%</span>
            </div>
          </div>
        </div>
      </section>

      <section className="lesson-section section-shell" id="implementation">
        <div className="section-number">02</div>
        <div className="section-content">
          <p className="eyebrow">The recurrence</p>
          <h2>Give the model one small memory.</h2>
          <p className="lead compact">
            A hidden state carries the useful past forward. Each new character rewrites it; each
            prediction tests whether it remembered the right things.
          </p>

          <div className="unrolled-network" aria-label="An RNN unrolled across four characters">
            {[
              ["t", "h₁"],
              ["h", "h₂"],
              ["e", "h₃"],
              [" ", "h₄"],
            ].map(([character, hidden], index) => (
              <div className="time-step" key={hidden}>
                <span className="time-label">t = {index + 1}</span>
                <span className="input-character">{character === " " ? "␠" : character}</span>
                <span className="transfer" aria-hidden="true">→</span>
                <span className="hidden-state">{hidden}</span>
              </div>
            ))}
          </div>

          <div className="code-box">
            <div className="code-header">
              <span>tiny-rnn.js</span>
              <span>forward pass</span>
            </div>
            <pre><code><span className="code-muted">// fold the present into the past</span>{"\n"}<span className="code-keyword">const</span> h = tanh(Wxh · x + Whh · hPrev + bh);{"\n\n"}<span className="code-muted">// turn memory into a distribution</span>{"\n"}<span className="code-keyword">const</span> p = softmax(Why · h + by);{"\n\n"}<span className="code-muted">// make the true next character less surprising</span>{"\n"}loss = -log(p[target]);</code></pre>
            <div className="code-notes">
              <span><b>x</b> current character</span>
              <span><b>h</b> living memory</span>
              <span><b>p</b> next-character probabilities</span>
              <span><b>W</b> learned connections</span>
            </div>
          </div>

          <aside className="subtle-note">
            <span>One useful distinction</span>
            <p>
              This is a real language model, but a tiny one—not a modern billion-parameter LLM.
              The learning loop is the point: forward pass, loss, gradients, update, sample. Larger
              models elaborate on this same rhythm.
            </p>
          </aside>
        </div>
      </section>

      <section className="lab-section" id="lab">
        <div className="lab-shell section-shell">
          <div className="lab-heading">
            <div>
              <p className="eyebrow">The training room</p>
              <h2>Now make it learn.</h2>
            </div>
            <p>
              Every update below is real backpropagation through time, calculated in JavaScript on
              your device. Edit the text, reset the weights, and watch probability become prose.
            </p>
          </div>

          <div className="lab-grid">
            <div className="corpus-panel">
              <div className="panel-label">
                <span>01 · Training text</span>
                <span>{corpus.length.toLocaleString()} characters</span>
              </div>
              <textarea
                aria-label="Training text"
                value={corpus}
                onChange={(event) => setCorpus(event.target.value)}
                spellCheck="false"
              />
              <div className="corpus-actions">
                <button type="button" className="secondary-button" onClick={() => resetModel(corpus)}>
                  Reset with this text
                </button>
                <span>{corpusMessage}</span>
              </div>
            </div>

            <div className="training-panel">
              <div className="panel-label">
                <span>02 · Live training</span>
                <span className={isRunning ? "status running" : "status"}>
                  {isRunning ? "learning" : "paused"}
                </span>
              </div>

              <div className="metric-row">
                <div>
                  <span className="metric-label">loss</span>
                  <strong>{loss ? loss.toFixed(3) : "—"}</strong>
                  <small>lower is less surprised</small>
                </div>
                <div>
                  <span className="metric-label">updates</span>
                  <strong>{step.toLocaleString()}</strong>
                  <small>32 characters each</small>
                </div>
              </div>

              <div className="loss-chart" aria-label="Recent loss history">
                {lossHistory.map((value, index) => {
                  const normalized = (value - minimumLoss) / lossRange;
                  return (
                    <span
                      key={`${index}-${value}`}
                      style={{ height: `${18 + normalized * 72}%` }}
                      title={value.toFixed(3)}
                    />
                  );
                })}
              </div>

              <button
                type="button"
                className="train-button"
                onClick={() => setIsRunning((running) => !running)}
                disabled={!isReady}
              >
                <span>{isRunning ? "Pause training" : step ? "Continue training" : "Start training"}</span>
                <span aria-hidden="true">{isRunning ? "Ⅱ" : "→"}</span>
              </button>

              <div className="model-footnote">
                <span>{modelDetails.parameters.toLocaleString()} parameters</span>
                <span>{modelDetails.vocabulary} character vocabulary</span>
                <span>36 hidden units</span>
              </div>
            </div>
          </div>

          <div className="output-panel">
            <div className="output-toolbar">
              <div className="panel-label">
                <span>03 · What it writes</span>
                <span>sampled from the current model</span>
              </div>
              <div className="temperature-control">
                <label htmlFor="temperature">temperature <b>{temperature.toFixed(2)}</b></label>
                <input
                  id="temperature"
                  type="range"
                  min="0.25"
                  max="1.35"
                  step="0.01"
                  value={temperature}
                  onChange={(event) => setTemperature(Number(event.target.value))}
                />
                <button type="button" onClick={sampleAgain}>sample again</button>
              </div>
            </div>

            <div className="generated-grid">
              <pre aria-live="polite">{sample}</pre>
              <div className="probability-panel">
                <span className="mini-label">After “the room was ”</span>
                <h3>What comes next?</h3>
                <div className="live-predictions">
                  {predictions.map((prediction) => (
                    <div key={prediction.character}>
                      <span>{displayCharacter(prediction.character)}</span>
                      <i><b style={{ width: `${Math.max(2, prediction.probability * 100)}%` }} /></i>
                      <em>{Math.round(prediction.probability * 100)}%</em>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="closing-section section-shell">
        <p className="eyebrow">What to notice</p>
        <h2>Competence arrives in layers.</h2>
        <div className="learning-stages">
          <article>
            <span>first</span>
            <h3>Shape</h3>
            <p>Spaces, line lengths, and common characters begin to look plausible.</p>
          </article>
          <article>
            <span>then</span>
            <h3>Local pattern</h3>
            <p>Short words, punctuation, and familiar fragments start to hold together.</p>
          </article>
          <article>
            <span>eventually</span>
            <h3>Voice</h3>
            <p>The model imitates rhythm and style without ever being given their rules.</p>
          </article>
        </div>
        <blockquote>
          The wonder is not that the network memorizes text. It is that prediction pressures it to
          discover the structure beneath the text.
        </blockquote>
      </section>

      <footer className="site-footer section-shell">
        <div>
          <span className="wordmark"><span className="wordmark-dot" />latent</span>
          <p>A visual path through the ideas that made language models possible.</p>
        </div>
        <a href="https://karpathy.github.io/2015/05/21/rnn-effectiveness/" target="_blank" rel="noreferrer">
          Read Karpathy’s original essay <span aria-hidden="true">↗</span>
        </a>
        <span>Next · Understanding LSTMs</span>
      </footer>
    </main>
  );
}
