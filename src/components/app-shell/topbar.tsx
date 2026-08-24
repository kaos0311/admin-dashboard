type TopbarProps = {
  user: {
    name?: string | null;
    email?: string | null;
    role: string;
  };
};

export function Topbar({ user }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        <div>
          <p className="text-sm font-medium text-slate-900">
            Operations Dashboard
          </p>
          <p className="text-xs text-slate-500">
            Equipment, service, customers, and maintenance
          </p>
        </div>

        <div className="text-right">
          <p className="text-sm font-medium text-slate-900">
            {user.name ?? user.email}
          </p>
          <p className="text-xs uppercase text-slate-500">{user.role}</p>
        </div>
      </div>
    </header>
  );
}
