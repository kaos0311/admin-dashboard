import "./globals.css";

import { Inter } from "next/font/google";
import type { ReactNode } from "react";

import { ThemeProvider } from "@/theme/ThemeProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
     data-scroll-behavior="smooth">
      <body
        className={`${inter.variable} min-h-screen antialiased`}
      >
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}




