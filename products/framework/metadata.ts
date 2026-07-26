import type { Metadata } from "next";

const title = "Latent Framework · Build a learning platform you own";
const description =
  "Build browser-native courses, coding lessons, flash cards, and practice sites from reviewed source and portable content.";

export const frameworkMetadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    type: "website",
    images: [{ url: "/og-v0.2.png", width: 1733, height: 908 }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og-v0.2.png"],
  },
};
