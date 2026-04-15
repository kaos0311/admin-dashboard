import "./globals.css";
import type { Metadata } from "next";
import AuthGuard from "./components/AuthGuard";

export const metadata: Metadata = {
  title: "Advanced Home Medical Admin",
  description: "Admin dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  );
}