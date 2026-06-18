"use client";


import { glass, typography } from "@/theme";
import { Suspense } from "react";
import LoginClient from "./LoginClient";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className={glass.pageCenter}>
          <p className={typography.bodyMuted}>Loading login...</p>
        </main>
      }
    >
      <LoginClient />
    </Suspense>
  );
}





