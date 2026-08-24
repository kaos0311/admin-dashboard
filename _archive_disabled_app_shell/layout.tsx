import { requireUser } from "@/lib/auth/require-user";
import { MobileNav } from "@/components/app-shell/mobile-nav";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="min-h-screen bg-slate-100">
      <MobileNav />

      <div className="flex">
        <Sidebar />

        <div className="min-w-0 flex-1">
          <Topbar user={user} />

          <main className="p-4 sm:p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
