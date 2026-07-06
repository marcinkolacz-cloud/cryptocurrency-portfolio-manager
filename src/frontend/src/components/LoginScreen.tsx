import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { useInternetIdentity } from "../hooks/useInternetIdentity";

export default function LoginScreen() {
  const { login, loginStatus, loginError, clear } = useInternetIdentity();

  const handleLogin = async () => {
    try {
      console.log("[LoginScreen] Login initiated");
      await login();
    } catch (error: any) {
      console.error("[LoginScreen] Login error:", error);

      if (error.message === "User is already authenticated") {
        console.log(
          "[LoginScreen] User already authenticated, clearing and retrying",
        );
        await clear();
        setTimeout(() => login(), 300);
      } else {
        toast.error("Błąd logowania / Login error", {
          description: error.message || "Spróbuj ponownie / Please try again",
        });
      }
    }
  };

  // Show error toast if login fails
  useEffect(() => {
    if (loginStatus === "loginError" && loginError) {
      console.error("[LoginScreen] Login failed:", loginError);
      toast.error("Błąd logowania / Login error", {
        description:
          loginError.message || "Spróbuj ponownie / Please try again",
      });
    }
  }, [loginStatus, loginError]);

  const isLoggingIn = loginStatus === "logging-in";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 px-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/60 shadow-lg">
            <span className="text-3xl font-bold text-primary-foreground">
              ₿
            </span>
          </div>
          <CardTitle className="text-2xl font-bold">
            Menedżer Portfeli Kryptowalut
          </CardTitle>
          <CardDescription className="text-base">
            Zarządzaj swoimi portfelami kryptowalut w jednym miejscu
            <br />
            <span className="text-xs">
              Manage your crypto portfolios in one place
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="w-full"
            size="lg"
          >
            {isLoggingIn ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Logowanie... / Logging in...
              </>
            ) : (
              <>Zaloguj się / Login</>
            )}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Bezpieczne logowanie przez Internet Identity
            <br />
            Secure login via Internet Identity
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
