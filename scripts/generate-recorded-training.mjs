import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCharacterRnnRecording } from "#root/scripts/recordings/character-rnn.mjs";

const root = process.cwd();
const directory = resolve(root, "app/features/artifacts/recorded");
await mkdir(directory, { recursive: true });
await writeFile(resolve(directory, "character-rnn-training.json"), `${JSON.stringify(createCharacterRnnRecording(), null, 2)}\n`);
