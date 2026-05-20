import { FileText } from "lucide-react";

export function PatientReportSources({
  reportTypes,
}: {
  reportTypes?: string[];
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.055] p-6 shadow-xl shadow-black/20 backdrop-blur-2xl">
      <div className="mb-4 flex items-center gap-2">
        <FileText className="h-5 w-5 text-zinc-300" />
        <h2 className="text-lg font-semibold">Report Sources</h2>
      </div>

      <div className="flex flex-wrap gap-2">
        {reportTypes?.length ? (
          reportTypes.map((type) => (
            <span
              key={type}
              className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-zinc-300"
            >
              {type}
            </span>
          ))
        ) : (
          <span className="text-sm text-zinc-500">
            No report sources listed.
          </span>
        )}
      </div>
    </section>
  );
}