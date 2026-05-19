type MiniCardProps = {
  title: string;
  value: number;
};

export function MiniCard({ title, value }: MiniCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 shadow-lg shadow-black/10 backdrop-blur-2xl">
      <p className="text-sm text-neutral-400">{title}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}