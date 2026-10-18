import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Show Tracker",
  description: "A personal, client-side web application for tracking movies and TV shows",
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
