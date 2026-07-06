import { Toaster } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider as NextThemeProvider } from "next-themes";
import { useEffect, useState } from "react";
import BackendUnavailableScreen from "./components/BackendUnavailableScreen";
import ErrorBoundary from "./components/ErrorBoundary";
import Footer from "./components/Footer";
import Header from "./components/Header";
import LoadingScreen from "./components/LoadingScreen";
import LoginScreen from "./components/LoginScreen";
import PortfolioManager from "./components/PortfolioManager";
import ProfileSetupDialog from "./components/ProfileSetupDialog";
import { ThemeProvider as ColorSchemeProvider } from "./contexts/ThemeContext";
import { useActor } from "./hooks/useActor";
import { useInternetIdentity } from "./hooks/useInternetIdentity";
import { useGetCallerUserProfile } from "./hooks/useQueries";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 60000,
      refetchOnWindowFocus: false,
    },
  },
});

function AppContent() {
  const {
    identity,
    isInitializing: authInitializing,
    clear,
  } = useInternetIdentity();
  const { actor, isFetching: actorFetching } = useActor();

  const {
    data: userProfile,
    isLoading: profileLoading,
    isFetched: profileFetched,
    error: profileError,
  } = useGetCallerUserProfile();

  const [language, setLanguage] = useState<"pl" | "en">("pl");
  const [retryCount, setRetryCount] = useState(0);
  const [actorInitTimeout, setActorInitTimeout] = useState(false);

  const isAuthenticated = !!identity;

  // Determine if we're in a loading state
  const isActorReady = !!actor && !actorFetching;
  const isLoading =
    authInitializing ||
    (isAuthenticated && !isActorReady && !actorInitTimeout) ||
    (isAuthenticated && isActorReady && profileLoading);

  // Update language when profile loads
  useEffect(() => {
    if (userProfile?.language) {
      setLanguage(userProfile.language as "pl" | "en");
    }
  }, [userProfile]);

  // Set timeout for actor initialization
  useEffect(() => {
    if (isAuthenticated && !isActorReady && !actorFetching) {
      const timeout = setTimeout(() => {
        console.log("[App] Actor initialization timeout");
        setActorInitTimeout(true);
      }, 15000); // 15 second timeout

      return () => clearTimeout(timeout);
    }
    if (isActorReady) {
      setActorInitTimeout(false);
    }
  }, [isAuthenticated, isActorReady, actorFetching]);

  // Log state changes for debugging
  useEffect(() => {
    console.log("[App] State:", {
      authInitializing,
      isAuthenticated,
      actorFetching,
      isActorReady,
      profileLoading,
      profileFetched,
      hasProfile: !!userProfile,
      isLoading,
      actorInitTimeout,
    });
  }, [
    authInitializing,
    isAuthenticated,
    actorFetching,
    isActorReady,
    profileLoading,
    profileFetched,
    userProfile,
    isLoading,
    actorInitTimeout,
  ]);

  const handleRetry = async () => {
    console.log("[App] Manual retry requested");
    setRetryCount((prev) => prev + 1);
    setActorInitTimeout(false);

    // Clear queries and reload
    queryClient.clear();
    window.location.reload();
  };

  const handleLogout = async () => {
    console.log("[App] Logout requested");
    try {
      await clear();
      queryClient.clear();
    } catch (error) {
      console.error("[App] Logout error:", error);
    }
  };

  // Show loading screen during initialization
  if (isLoading) {
    let message = "Ładowanie... / Loading...";

    if (authInitializing) {
      message =
        "Inicjalizacja uwierzytelniania... / Initializing authentication...";
    } else if (isAuthenticated && !isActorReady) {
      message = "Łączenie z backendem... / Connecting to backend...";
    } else if (isAuthenticated && isActorReady && profileLoading) {
      message = "Ładowanie profilu... / Loading profile...";
    }

    return <LoadingScreen message={message} />;
  }

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  // Show backend unavailable screen if actor failed to initialize after authentication
  if (actorInitTimeout || (isAuthenticated && !actor && !actorFetching)) {
    const errorMessage =
      profileError instanceof Error
        ? profileError.message
        : String(profileError || "");
    const isAuthError =
      errorMessage.includes("Unauthorized") ||
      errorMessage.includes("permission") ||
      errorMessage.includes("Authorization");

    return (
      <BackendUnavailableScreen
        language={language}
        error={profileError || new Error("Backend connection timeout")}
        isAuthError={isAuthError}
        retryCount={retryCount}
        onRetry={handleRetry}
        onLogout={handleLogout}
      />
    );
  }

  // Show profile setup if user doesn't have a profile yet
  const showProfileSetup =
    isAuthenticated &&
    isActorReady &&
    !profileLoading &&
    profileFetched &&
    userProfile === null;

  if (showProfileSetup) {
    return (
      <div className="min-h-screen bg-background">
        <ProfileSetupDialog language={language} />
      </div>
    );
  }

  // Show main application
  return (
    <div className="min-h-screen bg-background">
      <Header language={language} />
      <main className="pb-8">
        <ErrorBoundary>
          <PortfolioManager language={language} />
        </ErrorBoundary>
      </main>
      <Footer language={language} />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <NextThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <ColorSchemeProvider>
            <AppContent />
            <Toaster />
          </ColorSchemeProvider>
        </NextThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
