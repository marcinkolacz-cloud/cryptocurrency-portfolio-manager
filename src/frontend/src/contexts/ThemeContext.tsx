import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";
import {
  useGetCallerUserProfile,
  useSaveCallerUserProfile,
} from "../hooks/useQueries";

export type ColorScheme = "default" | "gray" | "navy";

interface ThemeContextType {
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { data: userProfile, isLoading: profileLoading } =
    useGetCallerUserProfile();
  const { mutate: saveProfile } = useSaveCallerUserProfile();
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>("default");
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize color scheme from user profile
  useEffect(() => {
    if (userProfile && !isInitialized) {
      const scheme = (userProfile.colorScheme || "default") as ColorScheme;
      if (["default", "gray", "navy"].includes(scheme)) {
        setColorSchemeState(scheme);
        applyColorScheme(scheme);
      }
      setIsInitialized(true);
    }
  }, [userProfile, isInitialized]);

  // Watch for dark mode changes and reapply color scheme
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === "class") {
          applyColorScheme(colorScheme);
        }
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, [colorScheme]);

  const setColorScheme = (scheme: ColorScheme) => {
    setColorSchemeState(scheme);
    applyColorScheme(scheme);

    // Save to backend
    if (userProfile) {
      saveProfile({
        ...userProfile,
        colorScheme: scheme,
      });
    }
  };

  return (
    <ThemeContext.Provider
      value={{ colorScheme, setColorScheme, isLoading: profileLoading }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useColorScheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useColorScheme must be used within a ThemeProvider");
  }
  return context;
}

// Apply color scheme by updating CSS variables
function applyColorScheme(scheme: ColorScheme) {
  const root = document.documentElement;
  const isDark = root.classList.contains("dark");

  if (scheme === "gray") {
    // Intensified gray scheme with enhanced contrast
    if (isDark) {
      // Dark mode gray - deeper grays with stronger contrast
      root.style.setProperty("--background", "0.10 0.01 240");
      root.style.setProperty("--foreground", "0.97 0.005 240");
      root.style.setProperty("--card", "0.14 0.01 240");
      root.style.setProperty("--card-foreground", "0.97 0.005 240");
      root.style.setProperty("--popover", "0.16 0.01 240");
      root.style.setProperty("--popover-foreground", "0.97 0.005 240");
      root.style.setProperty("--primary", "0.70 0.02 240");
      root.style.setProperty("--primary-foreground", "0.98 0 0");
      root.style.setProperty("--secondary", "0.22 0.01 240");
      root.style.setProperty("--secondary-foreground", "0.97 0.005 240");
      root.style.setProperty("--muted", "0.22 0.01 240");
      root.style.setProperty("--muted-foreground", "0.65 0.01 240");
      root.style.setProperty("--accent", "0.28 0.015 240");
      root.style.setProperty("--accent-foreground", "0.97 0.005 240");
      root.style.setProperty("--border", "0.32 0.015 240");
      root.style.setProperty("--input", "0.32 0.015 240");
      root.style.setProperty("--ring", "0.70 0.02 240");
    } else {
      // Light mode gray - intensified with deeper grays
      root.style.setProperty("--background", "0.92 0.01 240");
      root.style.setProperty("--foreground", "0.12 0.01 240");
      root.style.setProperty("--card", "0.96 0.005 240");
      root.style.setProperty("--card-foreground", "0.12 0.01 240");
      root.style.setProperty("--popover", "0.96 0.005 240");
      root.style.setProperty("--popover-foreground", "0.12 0.01 240");
      root.style.setProperty("--primary", "0.32 0.02 240");
      root.style.setProperty("--primary-foreground", "0.98 0 0");
      root.style.setProperty("--secondary", "0.86 0.01 240");
      root.style.setProperty("--secondary-foreground", "0.12 0.01 240");
      root.style.setProperty("--muted", "0.86 0.01 240");
      root.style.setProperty("--muted-foreground", "0.42 0.01 240");
      root.style.setProperty("--accent", "0.82 0.015 240");
      root.style.setProperty("--accent-foreground", "0.12 0.01 240");
      root.style.setProperty("--border", "0.78 0.015 240");
      root.style.setProperty("--input", "0.78 0.015 240");
      root.style.setProperty("--ring", "0.32 0.02 240");
    }
  } else if (scheme === "navy") {
    // Intensified navy scheme with deeper blues and stronger contrast
    if (isDark) {
      // Dark mode navy - deeper navy with enhanced contrast
      root.style.setProperty("--background", "0.10 0.10 240");
      root.style.setProperty("--foreground", "0.94 0.03 240");
      root.style.setProperty("--card", "0.14 0.10 240");
      root.style.setProperty("--card-foreground", "0.94 0.03 240");
      root.style.setProperty("--popover", "0.16 0.10 240");
      root.style.setProperty("--popover-foreground", "0.94 0.03 240");
      root.style.setProperty("--primary", "0.58 0.20 240");
      root.style.setProperty("--primary-foreground", "0.98 0 0");
      root.style.setProperty("--secondary", "0.20 0.10 240");
      root.style.setProperty("--secondary-foreground", "0.94 0.03 240");
      root.style.setProperty("--muted", "0.20 0.10 240");
      root.style.setProperty("--muted-foreground", "0.60 0.06 240");
      root.style.setProperty("--accent", "0.26 0.12 240");
      root.style.setProperty("--accent-foreground", "0.94 0.03 240");
      root.style.setProperty("--border", "0.30 0.12 240");
      root.style.setProperty("--input", "0.30 0.12 240");
      root.style.setProperty("--ring", "0.58 0.20 240");
    } else {
      // Light mode navy - intensified with deeper blues
      root.style.setProperty("--background", "0.94 0.04 240");
      root.style.setProperty("--foreground", "0.16 0.10 240");
      root.style.setProperty("--card", "0.97 0.02 240");
      root.style.setProperty("--card-foreground", "0.16 0.10 240");
      root.style.setProperty("--popover", "0.97 0.02 240");
      root.style.setProperty("--popover-foreground", "0.16 0.10 240");
      root.style.setProperty("--primary", "0.38 0.18 240");
      root.style.setProperty("--primary-foreground", "0.98 0 0");
      root.style.setProperty("--secondary", "0.88 0.03 240");
      root.style.setProperty("--secondary-foreground", "0.16 0.10 240");
      root.style.setProperty("--muted", "0.88 0.03 240");
      root.style.setProperty("--muted-foreground", "0.46 0.08 240");
      root.style.setProperty("--accent", "0.84 0.04 240");
      root.style.setProperty("--accent-foreground", "0.16 0.10 240");
      root.style.setProperty("--border", "0.80 0.05 240");
      root.style.setProperty("--input", "0.80 0.05 240");
      root.style.setProperty("--ring", "0.38 0.18 240");
    }
  } else {
    // Default scheme - restore original values
    if (isDark) {
      root.style.setProperty("--background", "0.12 0 0");
      root.style.setProperty("--foreground", "0.985 0 0");
      root.style.setProperty("--card", "0.16 0 0");
      root.style.setProperty("--card-foreground", "0.985 0 0");
      root.style.setProperty("--popover", "0.18 0 0");
      root.style.setProperty("--popover-foreground", "0.985 0 0");
      root.style.setProperty("--primary", "0.65 0.24 264");
      root.style.setProperty("--primary-foreground", "0.985 0 0");
      root.style.setProperty("--secondary", "0.22 0 0");
      root.style.setProperty("--secondary-foreground", "0.985 0 0");
      root.style.setProperty("--muted", "0.22 0 0");
      root.style.setProperty("--muted-foreground", "0.65 0 0");
      root.style.setProperty("--accent", "0.28 0 0");
      root.style.setProperty("--accent-foreground", "0.985 0 0");
      root.style.setProperty("--border", "0.28 0 0");
      root.style.setProperty("--input", "0.28 0 0");
      root.style.setProperty("--ring", "0.65 0.24 264");
    } else {
      root.style.setProperty("--background", "0.98 0 0");
      root.style.setProperty("--foreground", "0.145 0 0");
      root.style.setProperty("--card", "1 0 0");
      root.style.setProperty("--card-foreground", "0.145 0 0");
      root.style.setProperty("--popover", "1 0 0");
      root.style.setProperty("--popover-foreground", "0.145 0 0");
      root.style.setProperty("--primary", "0.55 0.22 264");
      root.style.setProperty("--primary-foreground", "0.985 0 0");
      root.style.setProperty("--secondary", "0.96 0 0");
      root.style.setProperty("--secondary-foreground", "0.145 0 0");
      root.style.setProperty("--muted", "0.96 0 0");
      root.style.setProperty("--muted-foreground", "0.5 0 0");
      root.style.setProperty("--accent", "0.94 0 0");
      root.style.setProperty("--accent-foreground", "0.145 0 0");
      root.style.setProperty("--border", "0.92 0 0");
      root.style.setProperty("--input", "0.92 0 0");
      root.style.setProperty("--ring", "0.55 0.22 264");
    }
  }
}
