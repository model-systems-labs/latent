import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#f2f0e9",
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3001";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);
  const title = "Latent · Learn, make, and host lessons";
  const description =
    "A high-quality self-learning platform with first-party courses and an open format that anyone—or any LLM—can use to create and self-host lessons and flash cards.";

  return {
    metadataBase,
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: new URL("/og-open-learning.png", metadataBase).toString(), width: 1731, height: 909 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [new URL("/og-open-learning.png", metadataBase).toString()],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
