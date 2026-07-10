import { PaperLab } from "./components/PaperLab";
import { neuralTextDegenerationLesson } from "./lessons/neural-text-degeneration";

export default function Home() {
  return <PaperLab lesson={neuralTextDegenerationLesson} />;
}
