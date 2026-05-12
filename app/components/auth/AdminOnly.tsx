"use client";

import type { ReactNode } from "react";
import AuthGuard from "@/app/components/auth/AuthGuard";

export default function AdminOnly({
  children,
}: {
  children: ReactNode;
}) {
  return <AuthGuard allow={["admin"]}>{children}</AuthGuard>;
}