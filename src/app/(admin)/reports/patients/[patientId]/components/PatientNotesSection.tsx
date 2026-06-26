"use client";

import { buttons, forms, typography } from "@/theme";

function NoteBox({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className={`${typography.bodyMuted} mb-2 block`}>
        {label}
      </label>

      <textarea
        id={id}
        title={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={6}
        className={forms.textarea}
      />
    </div>
  );
}

type Props = {
  notesDraft: string;
  setNotesDraft: (value: string) => void;

  careNotesDraft: string;
  setCareNotesDraft: (value: string) => void;

  equipmentNotesDraft: string;
  setEquipmentNotesDraft: (value: string) => void;

  billingNotesDraft: string;
  setBillingNotesDraft: (value: string) => void;

  savingNotes: boolean;
  saveNotes: () => Promise<void>;
};

export function PatientNotesSection(props: Props) {
  return (
    <>
      <div className="grid gap-4 md:col-span-3 md:grid-cols-2">
        <NoteBox
          id="general-notes"
          label="General Snapshot / Owner Notes"
          value={props.notesDraft}
          onChange={props.setNotesDraft}
        />

        <NoteBox
          id="care-notes"
          label="Care Notes"
          value={props.careNotesDraft}
          onChange={props.setCareNotesDraft}
        />

        <NoteBox
          id="equipment-notes"
          label="Equipment Notes"
          value={props.equipmentNotesDraft}
          onChange={props.setEquipmentNotesDraft}
        />

        <NoteBox
          id="billing-notes"
          label="Billing Notes"
          value={props.billingNotesDraft}
          onChange={props.setBillingNotesDraft}
        />
      </div>

      <div className="md:col-span-3">
        <button
          type="button"
          onClick={() => void props.saveNotes()}
          disabled={props.savingNotes}
          className={buttons.primary}
        >
          {props.savingNotes ? "Saving Notes..." : "Save Notes"}
        </button>
      </div>
    </>
  );
}
