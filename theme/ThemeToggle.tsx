"use client";

import { Moon, Sun } from "lucide-react";

import { buttons } from "@/theme";

import { useTheme } from "./ThemeProvider";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  const isDark = theme === "dark";

  const label = isDark
    ? "Switch to light mode"
    : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      aria-pressed={isDark}
      title={label}
      className={buttons.icon}
    >
      <span className="sr-only">{label}</span>

      {isDark ? (
        <Sun
          className="h-5 w-5 transition-transform duration-200"
          aria-hidden
        />
      ) : (
        <Moon
          className="h-5 w-5 transition-transform duration-200"
          aria-hidden
        />
      )}
    </button>
  );
}
