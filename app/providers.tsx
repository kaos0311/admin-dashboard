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

          className: "custom-toast",

          success: {
            duration: 2500,
            className: "custom-toast custom-toast-success",

            iconTheme: {
              primary: "#22c55e",
              secondary: "#052e16",
            },
          },

          error: {
            duration: 5000,
            className: "custom-toast custom-toast-error",

            iconTheme: {
              primary: "#ef4444",
              secondary: "#450a0a",
            },
          },

          loading: {
            duration: Infinity,
            className: "custom-toast custom-toast-loading",
          },
        }}
      />
    </>
  );
}