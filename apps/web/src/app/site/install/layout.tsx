import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Before Your Session — One OS",
  description:
    "Quick prep before your 1:1 AI install session. Create a few free accounts and save your tokens — we handle the rest together.",
};

export default function InstallLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
