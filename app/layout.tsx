import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "@/app/globals.css";
import { SkipLink } from "@/app/components/SkipLink";

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

const isLlmSystemsCourseExport = process.env.LATENT_COURSE_HOME === "llm-systems";
const llmSystemsCourseCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' blob: https://cdn.jsdelivr.net https://huggingface.co https://*.huggingface.co https://*.hf.co",
  "media-src 'self' blob:",
  "frame-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

export async function generateMetadata(): Promise<Metadata> {
  const staticExportOrigin = process.env.LATENT_STATIC_EXPORT_ORIGIN?.trim();
  let metadataBase: URL;
  if (staticExportOrigin) {
    metadataBase = new URL(staticExportOrigin.endsWith("/") ? staticExportOrigin : `${staticExportOrigin}/`);
  } else {
    const requestHeaders = await headers();
    const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3001";
    const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    metadataBase = new URL(`${protocol}://${host}`);
  }
  const basePath = process.env.__NEXT_ROUTER_BASEPATH ?? "";
  const defaultSocialImage = new URL("/og.png", metadataBase).toString();
  const socialImage = basePath
    ? new URL(`${basePath}/og.png`, metadataBase).toString()
    : defaultSocialImage;
  const title = isLlmSystemsCourseExport
    ? "Build an LLM System · Interactive browser course"
    : "Latent Courses · Learn LLM systems in your browser";
  const description = isLlmSystemsCourseExport
    ? "Build model foundations, an inference runtime, reliable serving, and a streaming React chatbot through 14 browser-based lessons."
    : "Four interactive, browser-native courses in linear algebra, machine learning, harness engineering, and LLM systems, with runnable exercises, flash cards, and coding practice.";

  return {
    metadataBase,
    title,
    description,
    robots: staticExportOrigin
      ? { index: true, follow: true }
      : {
          index: false,
          follow: false,
          nocache: true,
        },
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: socialImage, width: 1731, height: 909 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [socialImage],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      {isLlmSystemsCourseExport ? (
        <head>
          <meta httpEquiv="Content-Security-Policy" content={llmSystemsCourseCsp} />
        </head>
      ) : null}
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <SkipLink />
        {children}
      </body>
    </html>
  );
}
