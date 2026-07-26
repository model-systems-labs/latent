import { frameworkMetadata } from "@/products/framework/metadata";

export const metadata = frameworkMetadata;

export default function OpenLearningLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
