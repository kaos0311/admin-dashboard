"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { PhoneCall, Save, UserRound } from "lucide-react";
import toast from "react-hot-toast";

import { db } from "@/lib/firebase";
import { buttons, forms, glass, spacing, typography } from "@/theme";

import type { HospicePatient } from "../hospice-types";
import { HOSPICE_CONTRACT_PAYOR } from "../hospice-utils";

type HospiceNurseAssignmentPanelProps = {
  patients: readonly HospicePatient[];
};

function contactKey(name?: string, phone?: string): string {
  return [name ?? "", phone ?? ""].join("|").toLowerCase();
}

function contactValue(name: string, phone: string): string {
  return `${name}||${phone}`;
}

export function HospiceNurseAssignmentPanel({
  patients,
}: HospiceNurseAssignmentPanelProps) {
  const [patientId, setPatientId] = useState("");
  const [nurseName, setNurseName] = useState("");
  const [nursePhone, setNursePhone] = useState("");
  const [hospiceProvider, setHospiceProvider] = useState("");
  const [selectedNurseContact, setSelectedNurseContact] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.id === patientId),
    [patientId, patients],
  );

  const nurseContacts = useMemo(() => {
    const seen = new Set<string>();

    return patients
      .map((patient) => ({
        name: patient.nurseName ?? "",
        phone: patient.nursePhone ?? "",
      }))
      .filter((contact) => contact.name || contact.phone)
      .filter((contact) => {
        const key = contactKey(contact.name, contact.phone);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [patients]);

  useEffect(() => {
    if (!selectedPatient) return;

    setNurseName(selectedPatient.nurseName ?? "");
    setNursePhone(selectedPatient.nursePhone ?? "");
    setHospiceProvider(selectedPatient.hospiceProvider ?? HOSPICE_CONTRACT_PAYOR);
    setSelectedNurseContact("");
    setNotes(selectedPatient.notes ?? "");
  }, [selectedPatient]);

  function applyKnownContact(value: string) {
    setSelectedNurseContact(value);

    if (value === HOSPICE_CONTRACT_PAYOR) {
      setNurseName(HOSPICE_CONTRACT_PAYOR);
      setNursePhone("");
      setHospiceProvider(HOSPICE_CONTRACT_PAYOR);
      return;
    }

    const [name = "", phone = ""] = value.split("||");
    const contact = nurseContacts.find((item) => (
      item.name === name && item.phone === phone
    ));

    if (!contact) return;

    setNurseName(contact.name);
    setNursePhone(contact.phone);
  }

  async function saveAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedPatient) {
      toast.error("Select a hospice patient first.");
      return;
    }

    const cleanNurseName = nurseName.trim();
    const cleanNursePhone = nursePhone.trim();

    if (!cleanNurseName && !cleanNursePhone) {
      toast.error("Enter a nurse name or phone number.");
      return;
    }

    setSaving(true);

    try {
      const cleanHospiceProvider =
        hospiceProvider.trim() || HOSPICE_CONTRACT_PAYOR;
      const assignment = {
        hospiceKey: selectedPatient.id,
        patientKey: selectedPatient.id,
        patientId: selectedPatient.patientId ?? "",
        patientName: selectedPatient.patientName,
        dob: selectedPatient.dateOfBirth ?? "",
        phone: selectedPatient.phone ?? "",
        payor: HOSPICE_CONTRACT_PAYOR,
        hospiceProvider: cleanHospiceProvider,
        nurseName: cleanNurseName,
        nursePhone: cleanNursePhone,
        notes: notes.trim(),
        active: true,
        status: selectedPatient.status === "unknown" ? "active" : selectedPatient.status,
        hospiceSource: selectedPatient.source ?? "manual_nurse_assignment",
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, "hospicePatients", selectedPatient.id), assignment, {
        merge: true,
      });

      await setDoc(
        doc(db, "patients", selectedPatient.id),
        {
          hospice: true,
          hospiceStatus: "active",
          hospiceProvider: cleanHospiceProvider,
          payor: HOSPICE_CONTRACT_PAYOR,
          insuranceName: HOSPICE_CONTRACT_PAYOR,
          nurseName: cleanNurseName,
          nursePhone: cleanNursePhone,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      toast.success("Hospice nurse assignment saved.");
    } catch (error) {
      console.error("SAVE HOSPICE NURSE ASSIGNMENT ERROR:", error);
      toast.error("Could not save the hospice nurse assignment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={`${glass.panel} relative min-w-0 overflow-visible`}>
      <div className="relative z-10 min-w-0 p-4 sm:p-6">
        <div className="mb-5 flex min-w-0 items-start gap-3">
          <div className={glass.iconBoxSm}>
            <PhoneCall className="h-4 w-4" aria-hidden />
          </div>

          <div className="min-w-0">
            <h2 className={`${typography.sectionTitle} break-words`}>
              Hospice Nurse Contacts
            </h2>
            <p className={`${typography.bodyMuted} mt-1 break-words`}>
              Assign the nurse or case manager to each hospice patient so the
              team knows who to call.
            </p>
          </div>
        </div>

        <form onSubmit={saveAssignment} className={spacing.stackTight}>
          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <label className={forms.field}>
              <span className={forms.label}>Hospice Patient</span>
              <select
                value={patientId}
                onChange={(event) => setPatientId(event.target.value)}
                className={forms.select}
              >
                <option value="">Select patient</option>
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.patientName}
                    {patient.patientId ? ` - ${patient.patientId}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className={forms.field}>
              <span className={forms.label}>Nurse / Agency Dropdown</span>
              <select
                value={selectedNurseContact}
                onChange={(event) => applyKnownContact(event.target.value)}
                className={forms.select}
              >
                <option value="">Manual entry</option>
                <option value={HOSPICE_CONTRACT_PAYOR}>
                  {HOSPICE_CONTRACT_PAYOR}
                </option>
                {nurseContacts.map((contact) => (
                  <option
                    key={contactKey(contact.name, contact.phone)}
                    value={contactValue(contact.name, contact.phone)}
                  >
                    {[contact.name, contact.phone].filter(Boolean).join(" - ")}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid min-w-0 gap-4 md:grid-cols-3">
            <label className={forms.field}>
              <span className={forms.label}>Nurse / Case Manager</span>
              <input
                value={nurseName}
                onChange={(event) => setNurseName(event.target.value)}
                placeholder="Nurse name"
                className={forms.input}
              />
            </label>

            <label className={forms.field}>
              <span className={forms.label}>Contact Phone</span>
              <input
                value={nursePhone}
                onChange={(event) => setNursePhone(event.target.value)}
                placeholder="Phone number"
                className={forms.input}
              />
            </label>

            <label className={forms.field}>
              <span className={forms.label}>Hospice Provider</span>
              <input
                value={hospiceProvider}
                readOnly
                placeholder="Agency or provider"
                className={forms.input}
              />
            </label>
          </div>

          <div className={`${glass.insetPadded} ${typography.bodyMuted}`}>
            Payor is set to {HOSPICE_CONTRACT_PAYOR} for hospice patients under
            contract.
          </div>

          <label className={forms.field}>
            <span className={forms.label}>Contact Notes</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="Call instructions, after-hours contact, or nurse notes"
              className={forms.textarea}
            />
          </label>

          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
            <p className={`${typography.smallMuted} break-words`}>
              {selectedPatient ? (
                <>
                  Assigning contact for{" "}
                  <span className={typography.bodyStrong}>
                    {selectedPatient.patientName}
                  </span>
                </>
              ) : (
                "Choose a patient to start."
              )}
            </p>

            <button type="submit" disabled={saving} className={buttons.primary}>
              {saving ? (
                <UserRound className="h-4 w-4 animate-pulse" aria-hidden />
              ) : (
                <Save className="h-4 w-4" aria-hidden />
              )}
              Save Assignment
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
