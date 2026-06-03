import {
  FieldValue,
  getFirestore
} from "firebase-admin/firestore";

import {
  INDEX_VERSION,
  MAX_BIRTHDAY_ANALYTICS_ROWS
} from "./constants";

import type {
  BirthdayAnalyticsItem,
  CpapInfo,
  InsuranceSnapshot
} from "./types";

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
    .where("hasBirthday", "==", true)
    .where("dateOfDeath", "==", "")
    .orderBy("daysUntilBirthday", "asc")
    .limit(MAX_BIRTHDAY_ANALYTICS_ROWS)
    .get();

  const items: BirthdayAnalyticsItem[] = snapshot.docs
    .map((docSnap) => {
      const data = docSnap.data();

      const daysUntilBirthday =
        typeof data.daysUntilBirthday === "number" ? data.daysUntilBirthday : null;

      if (daysUntilBirthday === null) return null;

      return {
        id: docSnap.id,
        patientId: docSnap.id,
        fullName: normalizeString(data.fullName),
        firstName: normalizeString(data.firstName),
        lastName: normalizeString(data.lastName),
        dateOfBirth: normalizeString(data.dateOfBirth),
        birthMonth: typeof data.birthMonth === "number" ? data.birthMonth : 0,
        birthDay: typeof data.birthDay === "number" ? data.birthDay : 0,
        birthMonthDay: normalizeString(data.birthMonthDay),
        age: typeof data.age === "number" ? data.age : null,
        nextAge: typeof data.nextAge === "number" ? data.nextAge : null,
        nextBirthdayIso: normalizeString(data.nextBirthdayIso),
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
