import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

export function ThemeToggle({ className = "" }) {
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === "dark" ? "light" : "dark";
  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`}
      onClick={toggleTheme}
      aria-label={`Use ${nextTheme} appearance`}
      aria-pressed={theme === "light"}
      title={`Use ${nextTheme} appearance`}
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
      <span className="sr-only">{theme === "light" ? "Light appearance selected" : "Dark appearance selected"}</span>
    </button>
  );
}
