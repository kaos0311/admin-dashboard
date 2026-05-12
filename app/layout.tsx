import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import Providers from "@/app/providers";
import ThemeController from "@/app/components/ThemeController";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Admin Dashboard",
    template: "%s | Advanced Home Medical",
  },
  description: "Advanced Home Medical Admin System",
  applicationName: "Advanced Home Medical Admin",
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#07090d",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-black text-white antialiased">
        <Providers>
          <ThemeController />
          {children}
        </Providers>
      </body>
    </html>
  );
}