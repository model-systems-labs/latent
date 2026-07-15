import type { Metadata } from "next";
import { BrowserChatCapstone } from "../components/BrowserChatCapstone";

export const metadata: Metadata = {
  title: "Browser Chat Capstone · Latent",
  description: "A complete React chatbot with a model you train, a local pretrained model, SSE streaming, and system metrics.",
};

export default function CapstonePage() {
  return <BrowserChatCapstone />;
}
