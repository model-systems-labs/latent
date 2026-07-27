import type { Metadata } from "next";
import { BrowserChatCapstone } from "@/app/components/BrowserChatCapstone";
import { LearnerHeader } from "@/app/components/LearnerHeader";

export const metadata: Metadata = {
  title: "Browser Chat Capstone · Build an LLM System",
  description: "A complete React chatbot with a model you train, a local pretrained model, SSE streaming, and system metrics.",
};

export default function CapstonePage() {
  return (
    <>
      <LearnerHeader current="courses" />
      <BrowserChatCapstone />
    </>
  );
}
