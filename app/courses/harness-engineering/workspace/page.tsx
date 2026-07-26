import type { Metadata } from "next";
import { HarnessWorkbench } from "../../../components/HarnessWorkbench";

export const metadata: Metadata = {
  title: "Harness Project · Latent Courses",
  description: "Edit and test the cumulative Python project from the Harness Engineering course.",
};

export default function HarnessWorkspacePage() {
  return <HarnessWorkbench />;
}
