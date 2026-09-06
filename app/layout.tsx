import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Astraworld — The Meadow",
  description:
    "A local, procedural Meadow sandbox. Take your first steps in Astraworld.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
