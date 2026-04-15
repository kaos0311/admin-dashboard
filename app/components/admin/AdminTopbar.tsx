"use client";

import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";

export default function AdminTopbar({
  onMenuClick,
}: {
  onMenuClick: () => void;
}) {
  const router = useRouter();

  async function handleLogout() {
    await signOut(auth);
    router.replace("/login");
  }

  return (
    <header className="flex items-center justify-between border-b border-white/10 p-4">
      <button
        onClick={onMenuClick}
        className="rounded-lg border border-white/10 px-3 py-1 lg:hidden"
      >
        Menu
      </button>

      <h1 className="text-lg font-semibold">Admin Dashboard</h1>

      <button
        onClick={handleLogout}
        className="rounded-lg bg-red-500 px-3 py-1"
      >
        Logout
      </button>
    </header>
  );
}