"use client";

import { NotebookPen, Save } from "lucide-react";

import { spacing } from "@/theme";

import type { PatientDetailProps } from "./patient-detail-types";

import { ActionButton, NoteBox, Section } from "../PatientUI";

type NotesField = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
};

function getNotesFields({
  notesDraft,
  careNotesDraft,
  equipmentNotesDraft,
  billingNotesDraft,
  setNotesDraft,
  setCareNotesDraft,
  setEquipmentNotesDraft,
  setBillingNotesDraft,
}: Pick<
  PatientDetailProps,
  | "notesDraft"
  | "careNotesDraft"
  | "equipmentNotesDraft"
  | "billingNotesDraft"
  | "setNotesDraft"
  | "setCareNotesDraft"
  | "setEquipmentNotesDraft"
  | "setBillingNotesDraft"
>): NotesField[] {
  return [
    {
      id: "general-notes",
      label: "General Snapshot / Owner Notes",
      value: notesDraft,
      onChange: setNotesDraft,
    },
    {
      id: "care-notes",
      label: "Care Notes",
      value: careNotesDraft,
      onChange: setCareNotesDraft,
    },
    {
      id: "equipment-notes",
      label: "Equipment Notes",
      value: equipmentNotesDraft,
      onChange: setEquipmentNotesDraft,
    },
    {
      id: "billing-notes",
      label: "Billing Notes",
      value: billingNotesDraft,
      onChange: setBillingNotesDraft,
    },
  ];
}

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
  const notesFields = getNotesFields({
    notesDraft,
    careNotesDraft,
    equipmentNotesDraft,
    billingNotesDraft,
    setNotesDraft,
    setCareNotesDraft,
    setEquipmentNotesDraft,
    setBillingNotesDraft,
  });

  return (
    <Section
      title="Internal Notes"
      icon={<NotebookPen className="h-5 w-5" aria-hidden="true" />}
    >
      <div className={spacing.gridCardsTwo}>
        {notesFields.map((field) => (
          <NoteBox
            key={field.id}
            id={field.id}
            label={field.label}
            value={field.value}
            onChange={field.onChange}
          />
        ))}
      </div>

      <div>
        <ActionButton
          tone="green"
          disabled={savingNotes}
          onClick={() => void saveNotes(selected)}
          icon={<Save className="h-4 w-4" aria-hidden="true" />}
          label={savingNotes ? "Saving Notes..." : "Save Notes"}
        />
      </div>
    </Section>
  );
}
