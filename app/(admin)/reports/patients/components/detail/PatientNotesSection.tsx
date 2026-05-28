"use client";

import { NotebookPen } from "lucide-react";

import { NoteBox, Section } from "../PatientUI";
import type { PatientDetailProps } from "./patient-detail-types";

export function PatientNotesSection({
  selected,
  savingNotes,
  notesDraft,
  careNotesDraft,
  equipmentNotesDraft,
  billingNotesDraft,
  setNotesDraft,
  setCareNotesDraft,
  setEquipmentNotesDraft,
  setBillingNotesDraft,
  saveNotes,
}: Pick<
  PatientDetailProps,
  | "selected"
  | "savingNotes"
  | "notesDraft"
  | "careNotesDraft"
  | "equipmentNotesDraft"
  | "billingNotesDraft"
  | "setNotesDraft"
  | "setCareNotesDraft"
  | "setEquipmentNotesDraft"
  | "setBillingNotesDraft"
  | "saveNotes"
>) {
  return (
    <Section
      title="Internal Notes"
      icon={<NotebookPen className="h-5 w-5" aria-hidden="true" />}
    >
      <div className="grid gap-4 md:col-span-3 md:grid-cols-2">
        <NoteBox
          id="general-notes"
          label="General Snapshot / Owner Notes"
          value={notesDraft}
          onChange={setNotesDraft}
        />

        <NoteBox
          id="care-notes"
          label="Care Notes"
          value={careNotesDraft}
          onChange={setCareNotesDraft}
        />

        <NoteBox
          id="equipment-notes"
          label="Equipment Notes"
          value={equipmentNotesDraft}
          onChange={setEquipmentNotesDraft}
        />

        <NoteBox
          id="billing-notes"
          label="Billing Notes"
          value={billingNotesDraft}
          onChange={setBillingNotesDraft}
        />
      </div>

      <div className="md:col-span-3">
        <button
          type="button"
          onClick={() => void saveNotes(selected)}
          disabled={savingNotes}
          className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100 shadow-[0_12px_30px_rgba(6,182,212,0.12)] transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {savingNotes ? "Saving Notes..." : "Save Notes"}
        </button>
      </div>
    </Section>
  );
}
