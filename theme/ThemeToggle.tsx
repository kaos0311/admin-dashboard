"use client";

import { Moon, Sun } from "lucide-react";

import { useTheme } from "./ThemeProvider";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={
        isDark
          ? "Switch to light mode"
          : "Switch to dark mode"
      }
      title={
        isDark
          ? "Switch to light mode"
          : "Switch to dark mode"
      }
      className="
        inline-flex
        h-10
        w-10
        min-w-0
        shrink-0
        items-center
        justify-center
        rounded-2xl
        border
        border-white/10
        bg-white/[0.08]
        text-white
        shadow-lg
        shadow-black/20
        backdrop-blur-xl
        transition-colors
        duration-200
        hover:bg-white/[0.14]
        focus:outline-none
        focus:ring-2
        focus:ring-cyan-300/40
        active:scale-[0.98]

        light:border-slate-200
        light:bg-white/70
        light:text-slate-900
        light:shadow-slate-300/40
      "
    >
      {isDark ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </button>
  );
}