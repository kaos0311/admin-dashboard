"use client";

import type { ReactNode } from "react";

import { Toaster } from "react-hot-toast";

export default function Providers({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      {children}

      <Toaster
        position="top-right"
        reverseOrder={false}
        gutter={10}
        containerStyle={{
          top: 16,
          right: 16,
        }}
        toastOptions={{
          duration: 4000,

          style: {
            borderRadius: "16px",
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(11, 18, 32, 0.96)",
            color: "#f9fafb",
            padding: "12px 14px",
            fontSize: "14px",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            boxShadow:
              "0 10px 30px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)",
            maxWidth: "420px",
          },

          success: {
            duration: 2500,

            iconTheme: {
              primary: "#22c55e",
              secondary: "#052e16",
            },
          },

          error: {
            duration: 5000,

            iconTheme: {
              primary: "#ef4444",
              secondary: "#450a0a",
            },
          },

          loading: {
            duration: Infinity,
          },
        }}
      />
    </>
  );
}