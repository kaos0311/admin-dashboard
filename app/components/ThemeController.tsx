"use client";

import { useEffect } from "react";

import { useAppSettings } from "@/app/hooks/useAppSettings";

type ThemeMode = "light" | "dark" | "system";

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;

  if (theme === "system") {
    root.removeAttribute("data-theme");
    return;
  }

  root.setAttribute("data-theme", theme);
}

export default function ThemeController() {
  const { settings } = useAppSettings(true);

  useEffect(() => {
    const theme =
      settings?.defaultTheme ?? "dark";

    applyTheme(theme as ThemeMode);

    if (theme !== "system") {
      return;
    }

    const mediaQuery = window.matchMedia(
      "(prefers-color-scheme: dark)"
    );

    const handleSystemThemeChange = () => {
      document.documentElement.removeAttribute(
        "data-theme"
      );
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener(
        "change",
        handleSystemThemeChange
      );
    } else {
      mediaQuery.addListener(
        handleSystemThemeChange
      );
    }

    return () => {
      if (
        typeof mediaQuery.removeEventListener ===
        "function"
      ) {
        mediaQuery.removeEventListener(
          "change",
          handleSystemThemeChange
        );
      } else {
        mediaQuery.removeListener(
          handleSystemThemeChange
        );
      }
    };
  }, [settings?.defaultTheme]);

  return null;
}