import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const ThemeContext = createContext(null);
const STORAGE_KEY = "securepatch-theme";
const TRANSITION_MS = 320;

function readTheme() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function syncDocumentTheme(theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
  const favicon = document.querySelector('link[rel="icon"]');
  if (favicon) favicon.href = theme === "light" ? "/favicon-light.svg?v=3" : "/favicon.svg?v=3";
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readTheme);
  const transitionTimer = useRef(null);

  useEffect(() => {
    syncDocumentTheme(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // The theme remains usable when storage is unavailable.
    }
  }, [theme]);

  useEffect(() => () => window.clearTimeout(transitionTimer.current), []);

  const toggleTheme = useCallback(() => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    const root = document.documentElement;
    window.clearTimeout(transitionTimer.current);
    root.classList.add("theme-changing");
    syncDocumentTheme(nextTheme);
    transitionTimer.current = window.setTimeout(() => {
      root.classList.remove("theme-changing");
    }, TRANSITION_MS);
    try {
      window.localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch {
      // Keep the in-memory preference even when storage is unavailable.
    }
    setTheme(nextTheme);
  }, [theme]);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
