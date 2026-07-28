import type { Metadata } from "next";

const title = "Latent Framework · Turn sources into durable understanding";
const description =
  "Turn codebases, research papers, documentation, and notes into source-grounded courses, retrieval, coding practice, and browser IDE lessons.";

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
