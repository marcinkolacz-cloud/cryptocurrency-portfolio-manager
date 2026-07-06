import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle, Loader2, LogOut, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

interface BackendUnavailableScreenProps {
  language: "pl" | "en";
  error?: unknown;
  isAuthError?: boolean;
  retryCount?: number;
  onRetry: () => void;
  onLogout: () => void;
}

const MAX_AUTO_RETRIES = 5;
const RETRY_DELAYS = [5, 10, 20, 40, 60]; // seconds

export default function BackendUnavailableScreen({
  language,
  error,
  isAuthError = false,
  retryCount = 0,
  onRetry,
  onLogout,
}: BackendUnavailableScreenProps) {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const errorMessage =
    error instanceof Error ? error.message : String(error || "");

  const text = {
    pl: {
      title: isAuthError ? "Błąd autoryzacji" : "Backend niedostępny",
      description: isAuthError
        ? "Wystąpił problem z autoryzacją. Spróbuj się wylogować i zalogować ponownie."
        : "Nie można połączyć się z backendem. Sprawdź połączenie internetowe i spróbuj ponownie.",
      errorLabel: "Szczegóły błędu:",
      retryButton: "Spróbuj ponownie",
      logoutButton: "Wyloguj się",
      autoRetry: "Automatyczna próba za",
      seconds: "sekund",
      retryAttempt: "Próba",
      of: "z",
    },
    en: {
      title: isAuthError ? "Authorization Error" : "Backend Unavailable",
      description: isAuthError
        ? "There was an authorization problem. Try logging out and logging in again."
        : "Cannot connect to the backend. Check your internet connection and try again.",
      errorLabel: "Error details:",
      retryButton: "Try Again",
      logoutButton: "Logout",
      autoRetry: "Auto retry in",
      seconds: "seconds",
      retryAttempt: "Attempt",
      of: "of",
    },
  };

  const t = text[language];

  // Auto-retry logic with exponential backoff
  useEffect(() => {
    if (isAuthError || retryCount >= MAX_AUTO_RETRIES) {
      return;
    }

    const delaySeconds =
      RETRY_DELAYS[Math.min(retryCount, RETRY_DELAYS.length - 1)];
    setCountdown(delaySeconds);

    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    const retryTimeout = setTimeout(() => {
      console.log(
        `[BackendUnavailable] Auto-retry ${retryCount + 1}/${MAX_AUTO_RETRIES}`,
      );
      setIsRetrying(true);
      onRetry();
    }, delaySeconds * 1000);

    return () => {
      clearInterval(countdownInterval);
      clearTimeout(retryTimeout);
    };
  }, [retryCount, isAuthError, onRetry]);

  const handleManualRetry = () => {
    console.log("[BackendUnavailable] Manual retry requested");
    setIsRetrying(true);
    setCountdown(null);
    onRetry();
  };

  const handleLogout = () => {
    console.log("[BackendUnavailable] Logout requested");
    onLogout();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 px-4">
      <Card className="w-full max-w-md shadow-xl border-destructive/50">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-bold text-destructive">
            {t.title}
          </CardTitle>
          <CardDescription className="text-base">
            {t.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMessage && (
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="font-semibold mb-1">{t.errorLabel}</p>
              <p className="text-muted-foreground break-words">
                {errorMessage}
              </p>
            </div>
          )}

          {!isAuthError &&
            retryCount < MAX_AUTO_RETRIES &&
            countdown !== null && (
              <div className="text-center text-sm text-muted-foreground">
                <p>
                  {t.autoRetry}{" "}
                  <span className="font-bold text-foreground">{countdown}</span>{" "}
                  {t.seconds}
                </p>
                <p className="mt-1">
                  {t.retryAttempt} {retryCount + 1} {t.of} {MAX_AUTO_RETRIES}
                </p>
              </div>
            )}

          <div className="flex flex-col gap-2">
            <Button
              onClick={handleManualRetry}
              disabled={isRetrying}
              className="w-full"
              size="lg"
            >
              {isRetrying ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {t.retryButton}...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-5 w-5" />
                  {t.retryButton}
                </>
              )}
            </Button>

            <Button
              onClick={handleLogout}
              variant="outline"
              className="w-full"
              size="lg"
            >
              <LogOut className="mr-2 h-5 w-5" />
              {t.logoutButton}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
