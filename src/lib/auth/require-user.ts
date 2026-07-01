import { redirect } from "next/navigation";

export async function requireUser() {
  // Temporary guard until full auth is wired in.
  // This keeps protected pages compiling while we stabilize the app.
  return {
    id: "dev-user",
    name: "Development User",
    email: "dev@advancedhomemedical.local",
    role: "ADMIN" as const,
    isActive: true,
  };
}

export async function requireRole(allowedRoles: string[]) {
  const user = await requireUser();

  if (!allowedRoles.includes(user.role)) {
    redirect("/unauthorized");
  }

  return user;
}
