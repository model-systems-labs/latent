import Link from "next/link";
import type { ComponentProps } from "react";

export function LearnerActionLink({
  style,
  ...props
}: ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      style={{
        alignItems: "center",
        display: "inline-flex",
        minHeight: "2.75rem",
        ...style,
      }}
    />
  );
}
