"use client";

import { useEffect } from "react";

import { useAppSettings } from "@/app/hooks/useAppSettings";

type ThemeMode = "light" | "dark" | "system";

function setThemeAttribute(theme: Exclude<ThemeMode, "system">) {
  const root = document.documentElement;

  if (root.getAttribute("data-theme") !== theme) {
    root.setAttribute("data-theme", theme);
  }
}

function clearThemeAttribute() {
  document.documentElement.removeAttribute("data-theme");
}

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export default function ThemeController() {
  const { settings } = useAppSettings(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const selectedTheme: ThemeMode =
      settings?.defaultTheme ?? "dark";

    const mediaQuery = window.matchMedia(
      "(prefers-color-scheme: dark)"
    );

    const applyResolvedTheme = () => {
      if (selectedTheme === "system") {
        setThemeAttribute(getSystemTheme());
        return;
      }

      setThemeAttribute(selectedTheme);
    };

    applyResolvedTheme();

    if (selectedTheme !== "system") {
      return;
    }

    const handleThemeChange = () => {
      applyResolvedTheme();
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleThemeChange);
    } else {
      mediaQuery.addListener(handleThemeChange);
    }

    return () => {
      if (
        typeof mediaQuery.removeEventListener === "function"
      ) {
        mediaQuery.removeEventListener(
          "change",
          handleThemeChange
        );
      } else {
        mediaQuery.removeListener(handleThemeChange);
      }
    };
  }, [settings?.defaultTheme]);

  return null;
}