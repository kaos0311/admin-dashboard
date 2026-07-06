"use client";

import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { Clock3 } from "lucide-react";

import { db } from "@/lib/firebase";

type TimelineEntry = {
  id: string;
  type: string;
  title: string;
  body: string;
  actorEmail: string;
  createdAtText: string;
};

function formatDate(value: unknown): string {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toLocaleString();
  }

  return "";
}

export function PatientTimelineSection({ patientId }: { patientId: string }) {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);

  useEffect(() => {
    if (!patientId) return;

    const timelineQuery = query(
      collection(db, "patients", patientId, "timeline"),
      orderBy("createdAt", "desc"),
      limit(25)
    );

    return onSnapshot(timelineQuery, (snapshot) => {
      setEntries(
        snapshot.docs.map((docSnap) => {
          const data = docSnap.data();

          return {
            id: docSnap.id,
            type: String(data.type ?? "event"),
            title: String(data.title ?? "Timeline event"),
            body: String(data.body ?? ""),
            actorEmail: String(data.actorEmail ?? ""),
            createdAtText: formatDate(data.createdAt),
          };
        })
      );
    });
  }, [patientId]);

  if (entries.length === 0) {
    return <p className="text-sm text-zinc-500">No timeline activity yet.</p>;
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="rounded-2xl border border-white/10 bg-white/[0.045] p-4"
        >
          <div className="flex min-w-0 items-start gap-3">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" />
            <div className="min-w-0">
              <p className="break-words text-sm font-semibold text-white">
                {entry.title}
              </p>
              {entry.body ? (
                <p className="mt-1 break-words text-sm leading-6 text-zinc-400">
                  {entry.body}
                </p>
              ) : null}
              <p className="mt-2 text-xs text-zinc-500">
                {entry.createdAtText || "No timestamp"}{" "}
                {entry.actorEmail ? `| ${entry.actorEmail}` : ""}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
