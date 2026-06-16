import {
  FieldValue,
  getFirestore
} from "firebase-admin/firestore";

import {
  INDEX_VERSION,
  MAX_BIRTHDAY_PATIENT_SCAN_ROWS
} from "./constants";

import type {
  BirthdayAnalyticsItem,
  CpapInfo,
  InsuranceSnapshot
} from "./types";

import {
  buildBirthdayFields
} from "./birthdays";

import {
  normalizeString
} from "./utils";

const db = getFirestore();

function sortBirthdayItems(items: BirthdayAnalyticsItem[]): BirthdayAnalyticsItem[] {
  return [...items].sort((a, b) => {
    if (a.daysUntilBirthday !== b.daysUntilBirthday) {
      return a.daysUntilBirthday - b.daysUntilBirthday;
    }

    return a.fullName.localeCompare(b.fullName);
  });
}

export async function rebuildBirthdayAnalyticsFromPatients(): Promise<void> {
  const snapshot = await db
    .collection("patients_index")
    .limit(MAX_BIRTHDAY_PATIENT_SCAN_ROWS)
    .get();

  const items: BirthdayAnalyticsItem[] = snapshot.docs
    .map((docSnap) => {
      const data = docSnap.data();
      const dateOfDeath =
        normalizeString(data.dateOfDeath) || normalizeString(data.dod);

      if (dateOfDeath) return null;

      const dateOfBirth =
        normalizeString(data.dateOfBirth) || normalizeString(data.dob);
      const birthday = buildBirthdayFields(dateOfBirth);

      if (!birthday.hasBirthday || birthday.daysUntilBirthday === null) {
        return null;
      }

      const daysUntilBirthday =
        typeof data.daysUntilBirthday === "number"
          ? data.daysUntilBirthday
          : birthday.daysUntilBirthday;

      return {
        id: docSnap.id,
        patientId: docSnap.id,
        fullName:
          normalizeString(data.fullName) || normalizeString(data.patientName),
        firstName: normalizeString(data.firstName),
        lastName: normalizeString(data.lastName),
        dateOfBirth,
        birthMonth:
          typeof data.birthMonth === "number" ? data.birthMonth : birthday.birthMonth,
        birthDay:
          typeof data.birthDay === "number" ? data.birthDay : birthday.birthDay,
        birthMonthDay:
          normalizeString(data.birthMonthDay) || birthday.birthMonthDay,
        age: typeof data.age === "number" ? data.age : birthday.age,
        nextAge:
          typeof data.nextAge === "number" ? data.nextAge : birthday.nextAge,
        nextBirthdayIso:
          normalizeString(data.nextBirthdayIso) || birthday.nextBirthdayIso,
        daysUntilBirthday,
        phone: normalizeString(data.phone),
        city: normalizeString(data.city),
        state: normalizeString(data.state),
        primaryInsurance: normalizeString(
          (data.insurance as InsuranceSnapshot | undefined)?.primaryInsurance ||
            (data.insurance as InsuranceSnapshot | undefined)?.payor ||
            ""
        ),
        cpapOnRecord: Boolean((data.cpap as CpapInfo | undefined)?.onRecord),
        hospice: data.hospice === true,
      };
    })
    .filter((item): item is BirthdayAnalyticsItem => item !== null);

  const sorted = sortBirthdayItems(items);
  const now = new Date();
  const currentMonth = now.getMonth() + 1;

  const today = sorted.filter((item) => item.daysUntilBirthday === 0);
  const next7Days = sorted.filter((item) => item.daysUntilBirthday <= 7);
  const next30Days = sorted.filter((item) => item.daysUntilBirthday <= 30);
  const thisMonth = sorted
    .filter((item) => item.birthMonth === currentMonth)
    .sort((a, b) => a.birthDay - b.birthDay || a.fullName.localeCompare(b.fullName));

  await db.doc("analytics/birthdays").set(
    {
      upcoming: sorted.slice(0, 25),
      today: today.slice(0, 25),
      next7Days: next7Days.slice(0, 25),
      next30Days: next30Days.slice(0, 50),
      thisMonth: thisMonth.slice(0, 50),

      upcomingCount: sorted.length,
      todayCount: today.length,
      next7DaysCount: next7Days.length,
      next30DaysCount: next30Days.length,
      thisMonthCount: thisMonth.length,

      indexVersion: `${INDEX_VERSION}-birthdays`,
      lastUpdatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}
