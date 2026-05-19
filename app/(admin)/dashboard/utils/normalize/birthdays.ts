import type { BirthdayAnalytics, BirthdayItem } from "../../dashboard-types";
import {
  getNullableString,
  getString,
  isRecord,
  safeArray,
  safeNumber,
} from "./core";

function normalizeBirthdayItem(data: unknown): BirthdayItem {
  const source = isRecord(data) ? data : {};

  return {
    id: getString(source, "id"),

    fullName:
      getString(source, "fullName") ||
      getString(source, "patientName") ||
      getString(source, "name") ||
      "Unknown Patient",

    phone: getString(source, "phone") || undefined,
    primaryInsurance: getString(source, "primaryInsurance") || undefined,

    birthday:
      getNullableString(source, "birthday") ||
      getNullableString(source, "dateOfBirth") ||
      undefined,

    age: safeNumber(source.age) || undefined,
  };
}

export function normalizeBirthdayAnalytics(
  data: Partial<BirthdayAnalytics> | undefined
): BirthdayAnalytics {
  const source = isRecord(data) ? data : {};

  const today = safeArray(source.today, normalizeBirthdayItem);
  const next7Days = safeArray(source.next7Days, normalizeBirthdayItem);
  const next30Days = safeArray(source.next30Days, normalizeBirthdayItem);
  const thisMonth = safeArray(source.thisMonth, normalizeBirthdayItem);
  const upcomingBirthdays = safeArray(
    source.upcomingBirthdays,
    normalizeBirthdayItem
  );

  return {
    today,
    next7Days,
    next30Days,
    thisMonth,
    upcomingBirthdays,

    todayCount: safeNumber(source.todayCount) || today.length,
    next7DaysCount: safeNumber(source.next7DaysCount) || next7Days.length,
    next30DaysCount: safeNumber(source.next30DaysCount) || next30Days.length,
    thisMonthCount: safeNumber(source.thisMonthCount) || thisMonth.length,
  };
}