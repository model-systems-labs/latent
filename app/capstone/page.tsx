import type { Metadata } from "next";
import { BrowserChatCapstone } from "../components/BrowserChatCapstone";

export const metadata: Metadata = {
  title: "Browser Chat Capstone · Latent",
  description: "A complete React chatbot with a learner-trained model, local pretrained inference, SSE-compatible streaming, and systems metrics.",
};

export default function CapstonePage() {
  return <BrowserChatCapstone />;
}
