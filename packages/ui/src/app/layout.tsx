import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Talos Mission Control",
  description: "The Bronze Automaton · Metis Corp",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen scanlines">
        {children}
      </body>
    </html>
  );
}