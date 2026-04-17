import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MetaADS Tracker",
  description: "Rastreamento de conversões para Meta Ads",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-gray-50">{children}</body>
    </html>
  );
}
