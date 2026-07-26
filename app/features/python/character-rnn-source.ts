import { characterRnnsLesson } from "../../../products/courses/reference-curriculum/lessons/model/character-rnns";
import { PYTHON_CHARACTER_RNN_LEARNER_PATH } from "../../../products/courses/reference-curriculum/lessons/model/character-rnn-training";
import { lessonBlockComment, lessonImplementationSource } from "../../../products/courses/reference-curriculum/lessons/implementation-source";

/** The trusted trainer reads its three learner-owned operations from this editable file. */
export const PYTHON_CHARACTER_RNN_PATH = PYTHON_CHARACTER_RNN_LEARNER_PATH;

export const PYTHON_CHARACTER_RNN_SOURCE = lessonImplementationSource(
  characterRnnsLesson,
  characterRnnsLesson.implementation.codeBlocks.map((block, index) => (
    `${lessonBlockComment(characterRnnsLesson, index, block.label)}\n${block.code}`
  )),
);
