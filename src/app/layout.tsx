import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CollabBoard",
  description: "Real-time collaborative whiteboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
