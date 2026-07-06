import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import { Globe, Moon, Palette, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useColorScheme } from "../contexts/ThemeContext";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import {
  useGetCallerUserProfile,
  useSaveCallerUserProfile,
} from "../hooks/useQueries";

interface HeaderProps {
  language: "pl" | "en";
}

const translations = {
  pl: {
    logout: "Wyloguj",
    loggingOut: "Wylogowywanie...",
    lightMode: "Tryb jasny",
    darkMode: "Tryb ciemny",
    changeLanguage: "Zmień język",
    colorScheme: "Schemat kolorów",
    defaultScheme: "Domyślny",
    grayScheme: "Szary",
    navyScheme: "Granatowy",
  },
  en: {
    logout: "Logout",
    loggingOut: "Logging out...",
    lightMode: "Light mode",
    darkMode: "Dark mode",
    changeLanguage: "Change language",
    colorScheme: "Color Scheme",
    defaultScheme: "Default",
    grayScheme: "Gray",
    navyScheme: "Navy",
  },
};

export default function Header({ language }: HeaderProps) {
  const { setTheme, resolvedTheme } = useTheme();
  const { clear, identity } = useInternetIdentity();
  const { data: userProfile } = useGetCallerUserProfile();
  const saveProfile = useSaveCallerUserProfile();
  const { colorScheme, setColorScheme } = useColorScheme();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const t = translations[language];

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    try {
      await clear();
      queryClient.clear();
      toast.success(
        language === "pl" ? "Wylogowano pomyślnie" : "Logged out successfully",
      );
    } catch (error) {
      console.error("Logout error:", error);
      toast.error(language === "pl" ? "Błąd wylogowania" : "Logout error");
    }
  };

  const handleThemeToggle = async () => {
    const newTheme = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(newTheme);

    // Save theme preference to user profile
    if (userProfile) {
      try {
        await saveProfile.mutateAsync({
          ...userProfile,
          theme: newTheme,
        });
      } catch (error) {
        console.error("Error saving theme preference:", error);
      }
    }
  };

  const handleLanguageToggle = async () => {
    const newLanguage = language === "pl" ? "en" : "pl";

    // Save language preference to user profile
    if (userProfile) {
      try {
        await saveProfile.mutateAsync({
          ...userProfile,
          language: newLanguage,
        });
        toast.success(
          language === "pl" ? "Język zmieniony" : "Language changed",
        );
      } catch (error) {
        console.error("Error saving language preference:", error);
        toast.error(
          language === "pl" ? "Błąd zmiany języka" : "Error changing language",
        );
      }
    }
  };

  const handleColorSchemeChange = (scheme: "default" | "gray" | "navy") => {
    setColorScheme(scheme);
    toast.success(
      language === "pl" ? "Schemat kolorów zmieniony" : "Color scheme changed",
    );
  };

  // Avoid hydration mismatch
  if (!mounted) {
    return (
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/60">
              <span className="text-xl font-bold text-primary-foreground">
                ₿
              </span>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                {language === "pl" ? "Menedżer Portfeli" : "Portfolio Manager"}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" disabled>
              <Globe className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" disabled>
              <Palette className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" disabled>
              <Sun className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/60">
            <span className="text-xl font-bold text-primary-foreground">₿</span>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">
              {language === "pl" ? "Menedżer Portfeli" : "Portfolio Manager"}
            </h1>
            {userProfile && (
              <p className="text-xs text-muted-foreground">
                {userProfile.name}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLanguageToggle}
            title={t.changeLanguage}
          >
            <Globe className="h-5 w-5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" title={t.colorScheme}>
                <Palette className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => handleColorSchemeChange("default")}
              >
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded-full bg-gradient-to-br from-purple-500 to-purple-600" />
                  {t.defaultScheme}
                  {colorScheme === "default" && (
                    <span className="ml-auto">✓</span>
                  )}
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleColorSchemeChange("gray")}>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded-full bg-gradient-to-br from-gray-500 to-gray-600" />
                  {t.grayScheme}
                  {colorScheme === "gray" && <span className="ml-auto">✓</span>}
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleColorSchemeChange("navy")}>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded-full bg-gradient-to-br from-blue-600 to-blue-700" />
                  {t.navyScheme}
                  {colorScheme === "navy" && <span className="ml-auto">✓</span>}
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleThemeToggle}
            title={resolvedTheme === "dark" ? t.lightMode : t.darkMode}
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>

          {identity && (
            <Button variant="outline" onClick={handleLogout}>
              {t.logout}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
