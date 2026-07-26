# Principles

> Historical note: This essay preserves Latent's original motivation. The
> current implementation separates browser learner runtimes from Node-based
> authoring and builds; its optional local Transformer prefers WebGPU with a
> WebAssembly fallback. See the current [architecture](./docs/architecture.md)
> for the released boundaries.

Like everyone, I'm enraptured by the progress of large language models. And as this year went on, gaps in my knowledge started bugging me more and more. How do these things really work? Are they going to reach runaway intelligence—are the gains this year just from harness improvements? They're solving complex math problems—is this just brute force?

I felt like I had a good handle on these systems. I understood that layers of matrices predict the next most likely token in a sequence. I understood that these layers of matrices were connected and that their parameters were updated during training whenever they made the wrong prediction. I understood that they were then trained again after pretraining, including via reinforcement learning, to produce even better responses.

But with the release of ever more capable models, as an engineer, the gaps in my knowledge made me more and more uncomfortable. And I was unsatisfied with what was out there. I spent a fair amount of time trawling through deep learning research papers, and a lot of the terms were hard for me to understand. Luckily, with ChatGPT as a tutor and thesaurus, I was able to make some progress.

So with the release of GPT 5.6 sol, I started building Latent, an LMS where you build a chat-like application in your browser. The intention is for it to become a platform for practicing and developing solutions to LLM problems completely for free in your browser.

The principles this was built under:

0. Creating accounts and paywalls are annoying. Everything here runs in your browser—Python and large language models included, via WebAssembly. What you can do in a browser now is incredible.
1. Real coding practice is the best way for engineers to learn. This is not in place of reading the research papers—but having quick, iterative practice is the best way to go.
2. Flash cards help a lot.
