"use client";

// This client-only boundary gives Vite a static dependency edge it can
// prebundle, while LessonExperiment still downloads the runtime on consent.
export { pipeline } from "@huggingface/transformers";
