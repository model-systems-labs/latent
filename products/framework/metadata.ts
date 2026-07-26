import type { Metadata } from "next";

const title = "Latent Framework · Learning software that runs in the browser";
const description =
  "Build local-first courses, coding practice, flash cards, and browser IDE lessons with WebAssembly runtimes and agent-ready source.";

export const frameworkMetadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    type: "website",
    images: [{ url: "/og-framework.png", width: 1731, height: 909 }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og-framework.png"],
  },
};
