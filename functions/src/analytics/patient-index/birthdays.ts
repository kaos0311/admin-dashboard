import { Timestamp } from "firebase-admin/firestore";

import type { BirthdayFields } from "./types";

import { normalizeIsoDate } from "./utils";


function dateAtLocalNoon(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    12,
    0,
    0,
    0
  );
}
function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function safeBirthdayDate(
  year: number,
  birthMonthIndex: number,
  birthDay: number
): Date {
  const safeDay = Math.min(birthDay, daysInMonth(year, birthMonthIndex));

  return new Date(year, birthMonthIndex, safeDay, 12, 0, 0, 0);
}

export function emptyBirthdayFields(): BirthdayFields {
  return {
    hasBirthday: false,
    birthMonth: 0,
    birthDay: 0,
    birthMonthDay: "",
    age: null,
    nextAge: null,
    nextBirthday: null,
    nextBirthdayIso: "",
    daysUntilBirthday: null,
  };
}

export function buildBirthdayFields(
  dateOfBirth: string,
  now = new Date()
): BirthdayFields {
  const normalizedDob = normalizeIsoDate(dateOfBirth);

  if (!normalizedDob) return emptyBirthdayFields();

  const parsed = new Date(`${normalizedDob}T12:00:00`);

  if (Number.isNaN(parsed.getTime())) return emptyBirthdayFields();

  const today = dateAtLocalNoon(now);

  const birthMonth = parsed.getMonth() + 1;
  const birthDay = parsed.getDate();

  const birthMonthDay = `${String(birthMonth).padStart(2, "0")}-${String(
    birthDay
  ).padStart(2, "0")}`;

  const thisYearBirthday = safeBirthdayDate(
    today.getFullYear(),
    parsed.getMonth(),
    birthDay
  );

  let nextBirthdayDate = thisYearBirthday;

  if (nextBirthdayDate.getTime() < today.getTime()) {
    nextBirthdayDate = safeBirthdayDate(
      today.getFullYear() + 1,
      parsed.getMonth(),
      birthDay
    );
  }

  let age = today.getFullYear() - parsed.getFullYear();

  if (today.getTime() < thisYearBirthday.getTime()) {
    age -= 1;
  }

  const nextAge = nextBirthdayDate.getFullYear() - parsed.getFullYear();

  const daysUntilBirthday = Math.max(
    0,
    Math.ceil(
      (nextBirthdayDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    )
  );

  return {
    hasBirthday: true,
    birthMonth,
    birthDay,
    birthMonthDay,
    age,
    nextAge,
    nextBirthday: Timestamp.fromDate(nextBirthdayDate),
    nextBirthdayIso: normalizeIsoDate(nextBirthdayDate.toISOString()),
    daysUntilBirthday,
  };
}

