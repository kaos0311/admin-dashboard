"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  collection,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  type Unsubscribe,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

import type {
  BirthdayAnalytics,
  BirthdayItem,
  DashboardSummary,
  InventoryAnalytics,
  MovementRow,
  OrderRow,
  ProductRow,
  RentalRow,
  ShopOverview,
  WipEmployeeSummary,
} from "./dashboard-types";

import {
  EMPTY_BIRTHDAYS,
  EMPTY_INVENTORY_ANALYTICS,
  EMPTY_SUMMARY,
  normalizeBirthdayAnalytics,
  normalizeDashboardSummary,
  normalizeInventoryAnalytics,
  normalizeMovement,
  normalizeOrder,
  normalizeProduct,
  normalizeRental,
  normalizeWipEmployee,
} from "./dashboard-utils";

const ORDER_PREVIEW_LIMIT = 15;
const RENTAL_PREVIEW_LIMIT = 15;
const PRODUCT_PREVIEW_LIMIT = 100;
const MOVEMENT_LIMIT = 8;
const WIP_EMPLOYEE_LIMIT = 12;
const IMPORT_SUMMARY_LIMIT = 100;
const BIRTHDAY_PATIENT_SCAN_LIMIT = 10000;

const EMPTY_SHOP_OVERVIEW: ShopOverview = {
  patients: 0,
  hospicePatients: 0,
  physicians: 0,
  referrals: 0,
  rolodexContacts: 0,
  products: 0,
  inventoryLots: 0,
  inventorySerials: 0,
  glDetails: 0,
  costRows: 0,
  importJobs: 0,
  importedReports: 0,
  importedRows: 0,
  importQueueJobs: 0,
  completedQueueJobs: 0,
  deadLetteredQueueJobs: 0,
  importIssues: 0,
};

export type DashboardDataState = {
  summary: DashboardSummary;
  birthdays: BirthdayAnalytics;
  inventoryAnalytics: InventoryAnalytics;
  shopOverview: ShopOverview;

  orders: OrderRow[];
  rentals: RentalRow[];
  products: ProductRow[];
  movements: MovementRow[];
  wipEmployees: WipEmployeeSummary[];

  loading: boolean;
  refreshing: boolean;
  error: string;

  refreshDashboard: () => Promise<void>;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown dashboard error.";
}

function withDocId<T extends Record<string, unknown>>(
  id: string,
  data: T
): T & { id: string } {
  return {
    id,
    ...data,
  };
}

function startOfLocalDay(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
}

function parseDateOfBirth(value: unknown): Date | null {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();

  if (!text) {
    return null;
  }

  const isoMatch = text.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})/
  );

  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const parsed = new Date(
      Number(year),
      Number(month) - 1,
      Number(day)
    );

    return Number.isNaN(parsed.getTime())
      ? null
      : parsed;
  }

  const slashMatch = text.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/
  );

  if (slashMatch) {
    const [, month, day, rawYear] = slashMatch;
    const year =
      rawYear.length === 2
        ? Number(`19${rawYear}`)
        : Number(rawYear);
    const parsed = new Date(
      year,
      Number(month) - 1,
      Number(day)
    );

    return Number.isNaN(parsed.getTime())
      ? null
      : parsed;
  }

  return null;
}

function getBirthdayForYear(
  year: number,
  monthIndex: number,
  day: number
): Date {
  const lastDayOfMonth = new Date(
    year,
    monthIndex + 1,
    0
  ).getDate();

  return new Date(
    year,
    monthIndex,
    Math.min(day, lastDayOfMonth)
  );
}

function getStringField(
  record: Record<string, unknown>,
  keys: string[]
): string {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function buildBirthdayAnalyticsFromPatients(
  patients: Array<{ id: string; data: Record<string, unknown> }>
): BirthdayAnalytics {
  const now = startOfLocalDay(new Date());
  const currentMonth = now.getMonth();

  const items: BirthdayItem[] = patients.flatMap(
    ({ id, data }) => {
      const dateOfBirthText = getStringField(data, [
        "dateOfBirth",
        "dob",
        "birthDate",
      ]);
      const parsedDob = parseDateOfBirth(dateOfBirthText);

      if (!parsedDob) {
        return [];
      }

      const dateOfDeath = getStringField(data, [
        "dateOfDeath",
        "dod",
      ]);

      if (dateOfDeath) {
        return [];
      }

      const birthMonth = parsedDob.getMonth() + 1;
      const birthDay = parsedDob.getDate();
      let nextBirthday = getBirthdayForYear(
        now.getFullYear(),
        parsedDob.getMonth(),
        birthDay
      );

      if (nextBirthday < now) {
        nextBirthday = getBirthdayForYear(
          now.getFullYear() + 1,
          parsedDob.getMonth(),
          birthDay
        );
      }

      const daysUntilBirthday = Math.round(
        (nextBirthday.getTime() - now.getTime()) /
          86400000
      );
      const fullName =
        getStringField(data, ["fullName", "patientName", "name"]) ||
        "Unknown Patient";
      const patientId =
        getStringField(data, ["patientId", "patientKey"]) || id;
      const age =
        now.getFullYear() - parsedDob.getFullYear();
      const nextAge =
        nextBirthday.getFullYear() -
        parsedDob.getFullYear();

      const item: BirthdayItem = {
        id,
        patientId,
        fullName,
        phone: getStringField(data, ["phone"]),
        primaryInsurance: getStringField(data, [
          "primaryInsurance",
          "payor",
        ]),
        birthday: dateOfBirthText,
        dateOfBirth: dateOfBirthText,
        dateOfDeath,
        dod: dateOfDeath,
        age,
        nextAge,
        birthMonth,
        birthDay,
        daysUntilBirthday,
        nextBirthdayIso:
          nextBirthday.toISOString().slice(0, 10),
      };

      return [item];
    }
  );

  const upcomingBirthdays = [...items].sort(
    (a, b) =>
      (a.daysUntilBirthday ?? 0) -
        (b.daysUntilBirthday ?? 0) ||
      a.fullName.localeCompare(b.fullName)
  );

  const today = upcomingBirthdays.filter(
    (item) => item.daysUntilBirthday === 0
  );
  const next7Days = upcomingBirthdays.filter(
    (item) => (item.daysUntilBirthday ?? 999) <= 7
  );
  const next30Days = upcomingBirthdays.filter(
    (item) => (item.daysUntilBirthday ?? 999) <= 30
  );
  const thisMonth = items
    .filter(
      (item) => (item.birthMonth ?? 0) === currentMonth + 1
    )
    .sort(
      (a, b) =>
        (a.birthDay ?? 0) - (b.birthDay ?? 0) ||
        a.fullName.localeCompare(b.fullName)
    );

  return {
    today,
    next7Days,
    next30Days,
    thisMonth,
    upcomingBirthdays: upcomingBirthdays.slice(0, 100),

    todayCount: today.length,
    next7DaysCount: next7Days.length,
    next30DaysCount: next30Days.length,
    thisMonthCount: thisMonth.length,
  };
}

export function useDashboardData(): DashboardDataState {
  const [summary, setSummary] =
    useState<DashboardSummary>(EMPTY_SUMMARY);

  const [birthdays, setBirthdays] =
    useState<BirthdayAnalytics>(EMPTY_BIRTHDAYS);

  const [inventoryAnalytics, setInventoryAnalytics] =
    useState<InventoryAnalytics>(
      EMPTY_INVENTORY_ANALYTICS
    );

  const [shopOverview, setShopOverview] =
    useState<ShopOverview>(EMPTY_SHOP_OVERVIEW);

  const [orders, setOrders] =
    useState<OrderRow[]>([]);

  const [rentals, setRentals] =
    useState<RentalRow[]>([]);

  const [products, setProducts] =
    useState<ProductRow[]>([]);

  const [movements, setMovements] =
    useState<MovementRow[]>([]);

  const [wipEmployees, setWipEmployees] =
    useState<WipEmployeeSummary[]>([]);

  const [analyticsLoaded, setAnalyticsLoaded] =
    useState(false);

  const [birthdaysLoaded, setBirthdaysLoaded] =
    useState(false);

  const [inventoryLoaded, setInventoryLoaded] =
    useState(false);

  const [previewsLoaded, setPreviewsLoaded] =
    useState(false);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] = useState("");

  const refreshDashboard = useCallback(async () => {
    setRefreshing(true);
    setError("");

    try {
      const [
        wipEmployeesSnap,
        ordersSnap,
        rentalsSnap,
        productsSnap,
        movementsSnap,
        patientsCount,
        hospicePatientsCount,
        physiciansCount,
        referralsCount,
        rolodexContactsCount,
        shopItemsCount,
        lotsCount,
        serialsCount,
        glDetailsCount,
        costRowsCount,
        importJobsCount,
        importedReportsCount,
        importQueueCount,
        completedQueueCount,
        deadLetteredQueueCount,
        importSummarySnap,
        birthdayPatientsSnap,
      ] = await Promise.all([
        getDocs(
          query(
            collection(
              db,
              "analytics",
              "wip",
              "employees"
            ),
            orderBy("open", "desc"),
            limit(WIP_EMPLOYEE_LIMIT)
          )
        ),

        getDocs(
          query(
            collection(db, "orders"),
            orderBy("createdAt", "desc"),
            limit(ORDER_PREVIEW_LIMIT)
          )
        ),

        getDocs(
          query(
            collection(db, "rentals"),
            orderBy("createdAt", "desc"),
            limit(RENTAL_PREVIEW_LIMIT)
          )
        ),

        getDocs(
          query(
            collection(db, "products"),
            orderBy("name", "asc"),
            limit(PRODUCT_PREVIEW_LIMIT)
          )
        ),

        getDocs(
          query(
            collection(db, "stockMovements"),
            orderBy("createdAt", "desc"),
            limit(MOVEMENT_LIMIT)
          )
        ),

        getCountFromServer(collection(db, "patients_index")),
        getCountFromServer(collection(db, "hospicePatients")),
        getCountFromServer(collection(db, "patientPhysicians")),
        getCountFromServer(collection(db, "patientReferrals")),
        getCountFromServer(collection(db, "rolodexContacts")),
        getCountFromServer(collection(db, "shopItems")),
        getCountFromServer(collection(db, "shopInventoryLots")),
        getCountFromServer(collection(db, "shopInventorySerials")),
        getCountFromServer(collection(db, "shopGlDetails")),
        getCountFromServer(collection(db, "shopCostOfGoodsSold")),
        getCountFromServer(collection(db, "importJobs")),
        getCountFromServer(collection(db, "importedReports")),
        getCountFromServer(collection(db, "importQueue")),
        getCountFromServer(
          query(
            collection(db, "importQueue"),
            where("status", "==", "complete")
          )
        ),
        getCountFromServer(
          query(
            collection(db, "importQueue"),
            where("status", "==", "dead_lettered")
          )
        ),
        getDocs(
          query(
            collection(db, "importJobs"),
            orderBy("createdAt", "desc"),
            limit(IMPORT_SUMMARY_LIMIT)
          )
        ),
        getDocs(
          query(
            collection(db, "patients_index"),
            limit(BIRTHDAY_PATIENT_SCAN_LIMIT)
          )
        ),
      ]);

      const nextWipEmployees =
        wipEmployeesSnap.docs.map((docSnap) =>
          normalizeWipEmployee(
            withDocId(
              docSnap.id,
              docSnap.data() as Record<
                string,
                unknown
              >
            )
          )
        );

      const nextOrders = ordersSnap.docs.map(
        (docSnap) =>
          normalizeOrder(
            withDocId(
              docSnap.id,
              docSnap.data() as Record<
                string,
                unknown
              >
            )
          )
      );

      const nextRentals = rentalsSnap.docs.map(
        (docSnap) =>
          normalizeRental(
            withDocId(
              docSnap.id,
              docSnap.data() as Record<
                string,
                unknown
              >
            )
          )
      );

      const nextProducts = productsSnap.docs.map(
        (docSnap) =>
          normalizeProduct(
            withDocId(
              docSnap.id,
              docSnap.data() as Record<
                string,
                unknown
              >
            )
          )
      );

      const nextMovements =
        movementsSnap.docs.map((docSnap) =>
          normalizeMovement(
            withDocId(
              docSnap.id,
              docSnap.data() as Record<
                string,
                unknown
              >
            )
          )
        );

      const importTotals =
        importSummarySnap.docs.reduce(
          (totals, docSnap) => {
            const data = docSnap.data() as Record<
              string,
              unknown
            >;
            const processedRows =
              typeof data.processedRows === "number"
                ? data.processedRows
                : 0;
            const totalRows =
              typeof data.totalRows === "number"
                ? data.totalRows
                : 0;
            const writtenRows =
              typeof data.writtenRows === "number"
                ? data.writtenRows
                : 0;
            const issueCount =
              typeof data.issueCount === "number"
                ? data.issueCount
                : 0;

            totals.rows +=
              processedRows || totalRows || writtenRows;
            totals.issues += issueCount;

            return totals;
          },
          {
            rows: 0,
            issues: 0,
          }
        );

      const nextBirthdays =
        buildBirthdayAnalyticsFromPatients(
          birthdayPatientsSnap.docs.map((docSnap) => ({
            id: docSnap.id,
            data: docSnap.data() as Record<string, unknown>,
          }))
        );

      setWipEmployees(nextWipEmployees);
      setOrders(nextOrders);
      setRentals(nextRentals);
      setProducts(nextProducts);
      setMovements(nextMovements);
      setBirthdays(nextBirthdays);
      setShopOverview({
        patients: patientsCount.data().count,
        hospicePatients: hospicePatientsCount.data().count,
        physicians: physiciansCount.data().count,
        referrals: referralsCount.data().count,
        rolodexContacts: rolodexContactsCount.data().count,
        products: shopItemsCount.data().count,
        inventoryLots: lotsCount.data().count,
        inventorySerials: serialsCount.data().count,
        glDetails: glDetailsCount.data().count,
        costRows: costRowsCount.data().count,
        importJobs: importJobsCount.data().count,
        importedReports: importedReportsCount.data().count,
        importedRows: importTotals.rows,
        importQueueJobs: importQueueCount.data().count,
        completedQueueJobs: completedQueueCount.data().count,
        deadLetteredQueueJobs:
          deadLetteredQueueCount.data().count,
        importIssues: importTotals.issues,
      });

      setPreviewsLoaded(true);
    } catch (loadError) {
      console.warn(
        "Dashboard preview data failed to load.",
        loadError
      );

      setOrders([]);
      setRentals([]);
      setProducts([]);
      setMovements([]);
      setWipEmployees([]);
      setShopOverview(EMPTY_SHOP_OVERVIEW);

      setPreviewsLoaded(true);

      setError(
        `Dashboard preview data could not be loaded. Check Firestore permissions, rules, and required indexes. ${getErrorMessage(
          loadError
        )}`
      );
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribes: Unsubscribe[] = [];

    const dashboardUnsubscribe = onSnapshot(
      doc(db, "analytics", "dashboard"),
      (snapshot) => {
        const nextSummary = snapshot.exists()
          ? normalizeDashboardSummary(
              snapshot.data() as Partial<DashboardSummary>
            )
          : EMPTY_SUMMARY;

        setSummary(nextSummary);
        setAnalyticsLoaded(true);
      },
      (snapshotError) => {
        console.warn(
          "analytics/dashboard listener failed.",
          snapshotError
        );

        setSummary(EMPTY_SUMMARY);
        setAnalyticsLoaded(true);

        setError(
          `Dashboard analytics could not be loaded. Check Firestore rules for analytics/dashboard. ${getErrorMessage(
            snapshotError
          )}`
        );
      }
    );

    const birthdaysUnsubscribe = onSnapshot(
      doc(db, "analytics", "birthdays"),
      (snapshot) => {
        if (!snapshot.exists()) {
          setBirthdaysLoaded(true);
          return;
        }

        const nextBirthdays =
          normalizeBirthdayAnalytics(
            snapshot.data() as Partial<BirthdayAnalytics>
          );

        setBirthdays(nextBirthdays);
        setBirthdaysLoaded(true);
      },
      () => {
        setBirthdays(EMPTY_BIRTHDAYS);
        setBirthdaysLoaded(true);
      }
    );

    const inventoryUnsubscribe = onSnapshot(
      doc(db, "analytics", "inventory"),
      (snapshot) => {
        const nextInventoryAnalytics =
          snapshot.exists()
            ? normalizeInventoryAnalytics(
                snapshot.data() as Partial<InventoryAnalytics>
              )
            : EMPTY_INVENTORY_ANALYTICS;

        setInventoryAnalytics(
          nextInventoryAnalytics
        );

        setInventoryLoaded(true);
      },
      () => {
        setInventoryAnalytics(
          EMPTY_INVENTORY_ANALYTICS
        );

        setInventoryLoaded(true);
      }
    );

    unsubscribes.push(
      dashboardUnsubscribe,
      birthdaysUnsubscribe,
      inventoryUnsubscribe
    );

    void refreshDashboard();

    return () => {
      unsubscribes.forEach((unsubscribe) => {
        unsubscribe();
      });
    };
  }, [refreshDashboard]);

  const loading = useMemo(() => {
    return (
      !analyticsLoaded ||
      !birthdaysLoaded ||
      !inventoryLoaded ||
      !previewsLoaded
    );
  }, [
    analyticsLoaded,
    birthdaysLoaded,
    inventoryLoaded,
    previewsLoaded,
  ]);

  return {
    summary,
    birthdays,
    inventoryAnalytics,
    shopOverview,

    orders,
    rentals,
    products,
    movements,
    wipEmployees,

    loading,
    refreshing,
    error,

    refreshDashboard,
  };
}


