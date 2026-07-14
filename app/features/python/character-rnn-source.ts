import { characterRnnsLesson } from "../../lessons/model/character-rnns";
import { lessonBlockComment, lessonImplementationSource } from "../../lessons/implementation-source";

/** The character-RNN lesson and trainable project artifact share one source. */
export const PYTHON_CHARACTER_RNN_PATH = "models/character-rnn.py" as const;

export const PYTHON_CHARACTER_RNN_SOURCE = lessonImplementationSource(
  characterRnnsLesson,
  characterRnnsLesson.implementation.codeBlocks.map((block, index) => (
    `${lessonBlockComment(characterRnnsLesson, index, block.label)}\n${block.code}`
  )),
);
