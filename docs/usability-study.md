# Naive-learner usability study

This protocol is the evidence gate for productization requirement 7. Agent
simulations and automated browser checks are useful engineering evidence, but
they do not count as human sessions.

## Participants

- Recruit 5–10 people who have not seen this repository or its implementation.
- Include at least two people who can write basic JavaScript but have not built
  an LLM system, and at least two people with no ML implementation experience.
- Assign anonymous ids such as `P01`; do not record names in repository notes.
- Ask for explicit permission before recording screen, audio, or quotes.

## Session script (45–60 minutes)

The facilitator should avoid teaching unless the participant is blocked for
more than three minutes. Ask the participant to think aloud.

1. Open the homepage in a clean browser profile. Ask: “What do you think you
   will build, and where would you begin?”
2. Run the first model. Ask the participant to explain why the two continuations
   differ and what stayed constant.
3. Start Character RNNs. Let the participant read, make a natural first coding
   attempt, run the cell, and recover from at least one failed check.
4. Answer the prediction question. Ask for the reasoning before revealing the
   explanation.
5. Open the IDE. Ask where the lesson’s code went, run the project tests, edit
   one file, and restore its earlier revision.
6. Reload the browser. Ask the participant to locate and resume their work.
7. Open the Models checkpoint and run the module behavior.
8. Open Project, use the timeline, and export the portfolio ZIP. Ask what they
   would expect to replace when connecting a production backend.

For participants who complete the first module quickly, continue into one
runtime lesson and the browser-chat capstone.

## Evidence to capture

Record observations, not interpretations, during the session:

- time to first model run;
- time to locate the first lesson and the IDE;
- first failed check and whether its message suggested a useful next action;
- prediction answer and explanation in the participant’s own words;
- places where the participant stopped scrolling, backtracked, or asked what a
  control meant;
- whether save/resume, file history, checkpoint, and export behavior matched
  expectations;
- device, viewport, browser name/version, and input method;
- the participant’s top two confusing moments and most valuable moment.

The device-local Learning Data panel may be exported with the participant’s
permission. It contains only bounded event names and outcomes; it does not
contain source code, prompts, chat content, API keys, or free-form answers.

## Per-session note template

```text
Participant: P__
Date:
Experience band:
Browser / device / viewport:
Recording consent: yes / no

Time to first run:
Time to first lesson:
First failed check:
Recovery without facilitator: yes / no
Prediction correct before explanation: yes / no
Save/reload confidence (1–5):
Could locate lesson code in IDE: yes / no
Could explain checkpoint output: yes / no
Could explain exported project boundary: yes / no

Observed friction:
1.
2.
3.

Participant language worth preserving:
-

Candidate product changes:
-
```

## Synthesis and release rule

After five sessions, group repeated friction by task rather than by page. A
problem is release-blocking when at least two participants cannot recover from
it, when it causes data loss, or when it produces an incorrect mental model of
the model/runtime/serving/product boundary. Implement and re-test blocking
findings. Continue to ten sessions when the first five contain conflicting
signals or include fewer than two novice programmers.

