import type { Metadata } from "next";
import { LearnerHeader } from "@/app/components/LearnerHeader";
import { WorkspaceShell } from "@/app/components/WorkspaceShell";

export const metadata: Metadata = {
  title: "Project IDE · Build an LLM System",
  description: "Edit, test, and build the browser chatbot you put together in the Latent LLM Systems course.",
};

export default function WorkspacePage() {
  return (
    <>
      <LearnerHeader current="practice" experience="llm-systems" />
      <WorkspaceShell />
    </>
  );
}
