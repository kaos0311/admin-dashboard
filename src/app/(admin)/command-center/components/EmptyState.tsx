import { glass } from "@/theme";

type EmptyStateProps = {
  text: string;
};

export function EmptyState({ text }: EmptyStateProps) {
  return <div className={glass.emptyState}>{text}</div>;
}
