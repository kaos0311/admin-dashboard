import { tiles } from "@/theme";

type MiniCardProps = {
  title: string;
  value: number;
};

export function MiniCard({
  title,
  value,
}: MiniCardProps) {
  return (
    <div className={`${tiles.base} ${tiles.compact} ${tiles.hover}`}>
      <div className="min-w-0">
        <p className={tiles.label}>{title}</p>

        <p className="mt-2 min-w-0 break-words text-2xl font-black leading-none tracking-tight text-white">
          {value}
        </p>
      </div>
    </div>
  );
}


