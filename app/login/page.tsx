"use client";

import { Suspense } from "react";
import LoginClient from "./LoginClient";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
          <p className="text-sm text-slate-400">Loading login...</p>
        </main>
      }
    >
      <LoginClient />
    </Suspense>
  );
}