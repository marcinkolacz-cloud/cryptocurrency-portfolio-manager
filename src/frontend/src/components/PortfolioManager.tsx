import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  Download,
  Loader2,
  Moon,
  RefreshCw,
  Sun,
  Upload,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import {
  useGetCallerUserProfile,
  useGetMarketData,
  useGetPortfolioTrackedAssets,
  useGetPortfolios,
  useGetPriorityAssets,
  useSaveCallerUserProfile,
} from "../hooks/useQueries";
import AssetList from "./AssetList";
import ExportPortfolioModal from "./ExportPortfolioModal";
import ImportPortfolioModal from "./ImportPortfolioModal";
import MarketDataStatusPanel from "./MarketDataStatusPanel";
import PortfolioSelector from "./PortfolioSelector";

interface PortfolioManagerProps {
  language: "pl" | "en";
}

const translations = {
  pl: {
    exportPortfolios: "Eksportuj portfele",
    importPortfolios: "Importuj portfele",
    refreshMarketData: "Odśwież dane rynkowe",
    refreshing: "Odświeżanie...",
    marketDataUpdated: "Dane rynkowe zaktualizowane",
    marketDataError: "Błąd aktualizacji danych rynkowych",
    loadingMarketData: "Ładowanie danych rynkowych...",
    marketDataLoaded: "Załadowano dane dla aktywów",
    errorTitle: "Wystąpił błąd",
    errorDescription: "Nie udało się załadować portfeli. Spróbuj ponownie.",
    retry: "Spróbuj ponownie",
    logout: "Wyloguj się",
    loadingPortfolios: "Ładowanie portfeli...",
    portfoliosLoadError: "Błąd ładowania portfeli",
    trackedAssets: "śledzonych aktywów",
    noTrackedAssets: "Brak śledzonych aktywów w portfelu",
    welcome: "Witaj w Menedżerze Portfeli",
    getStarted: "Utwórz swój pierwszy portfel, aby rozpocząć",
    lightMode: "Tryb jasny",
    darkMode: "Tryb ciemny",
  },
  en: {
    exportPortfolios: "Export portfolios",
    importPortfolios: "Import portfolios",
    refreshMarketData: "Refresh market data",
    refreshing: "Refreshing...",
    marketDataUpdated: "Market data updated",
    marketDataError: "Error updating market data",
    loadingMarketData: "Loading market data...",
    marketDataLoaded: "Loaded data for assets",
    errorTitle: "An error occurred",
    errorDescription: "Failed to load portfolios. Please try again.",
    retry: "Try again",
    logout: "Logout",
    loadingPortfolios: "Loading portfolios...",
    portfoliosLoadError: "Portfolio loading error",
    trackedAssets: "tracked assets",
    noTrackedAssets: "No tracked assets in portfolio",
    welcome: "Welcome to Portfolio Manager",
    getStarted: "Create your first portfolio to get started",
    lightMode: "Light mode",
    darkMode: "Dark mode",
  },
};

export default function PortfolioManager({ language }: PortfolioManagerProps) {
  const { setTheme, resolvedTheme } = useTheme();
  const { data: userProfile } = useGetCallerUserProfile();
  const saveProfile = useSaveCallerUserProfile();
  const [mounted, setMounted] = useState(false);
  const {
    data: portfolios,
    isLoading,
    error: portfoliosError,
    refetch: refetchPortfolios,
  } = useGetPortfolios();
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<bigint | null>(
    null,
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { clear } = useInternetIdentity();
  const queryClient = useQueryClient();
  const t = translations[language];

  // Get tracked assets for the selected portfolio
  const { data: trackedAssets = [], isLoading: trackedAssetsLoading } =
    useGetPortfolioTrackedAssets(selectedPortfolioId);

  // Fetch market data and priority assets from backend
  const {
    data: marketData,
    isLoading: marketDataLoading,
    error: marketDataError,
    refetch,
  } = useGetMarketData();
  const { data: priorityAssets } = useGetPriorityAssets();

  // Auto-select first portfolio when portfolios load
  useEffect(() => {
    if (
      portfolios &&
      Array.isArray(portfolios) &&
      portfolios.length > 0 &&
      !selectedPortfolioId
    ) {
      console.log(
        "[PortfolioManager] Auto-selecting first portfolio:",
        portfolios[0]?.id,
      );
      setSelectedPortfolioId(portfolios[0]?.id || null);
    }
  }, [portfolios, selectedPortfolioId]);

  // Log errors for debugging
  useEffect(() => {
    if (portfoliosError) {
      const errorMessage =
        portfoliosError instanceof Error
          ? portfoliosError.message
          : String(portfoliosError);
      console.error("[PortfolioManager] Portfolios error:", {
        error: portfoliosError,
        message: errorMessage,
        type: typeof portfoliosError,
      });
    }
    if (marketDataError) {
      console.error("[PortfolioManager] Market data error:", marketDataError);
    }
  }, [portfoliosError, marketDataError]);

  // Update last updated timestamp when market data finishes loading
  useEffect(() => {
    if (!marketDataLoading && !isRefreshing && marketData) {
      setLastUpdated(new Date());
    }
  }, [marketDataLoading, isRefreshing, marketData]);

  // next-themes hydration guard — resolvedTheme is undefined before mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleThemeToggle = async () => {
    const newTheme = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(newTheme);

    // Persist theme preference to user profile (same pattern as Header.tsx)
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

  const handleRefreshMarketData = async () => {
    setIsRefreshing(true);
    try {
      console.log("[PortfolioManager] Refreshing market data...");
      // Refetch tracked assets first to ensure we have the latest list
      await queryClient.invalidateQueries({
        queryKey: ["portfolioTrackedAssets"],
      });
      // Invalidate market data and priority assets; priority assets auto-refetch
      await queryClient.invalidateQueries({ queryKey: ["marketData"] });
      await queryClient.invalidateQueries({ queryKey: ["priorityAssets"] });
      // Refetch market data via useGetMarketData's refetch
      await refetch();
      await refetchPortfolios();
      setLastUpdated(new Date());
      toast.success(t.marketDataUpdated);
    } catch (error) {
      console.error("[PortfolioManager] Fetch market data error:", error);
      toast.error(t.marketDataError);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRetry = async () => {
    try {
      console.log("[PortfolioManager] Retrying portfolio fetch...");
      await refetchPortfolios();
    } catch (error) {
      console.error("[PortfolioManager] Retry error:", error);
    }
  };

  const handleLogout = async () => {
    try {
      console.log("[PortfolioManager] Logging out...");
      await clear();
      queryClient.clear();
    } catch (error) {
      console.error("[PortfolioManager] Logout error:", error);
    }
  };

  // Callback to refresh portfolio data after dialog actions
  const handleImportComplete = async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      await queryClient.invalidateQueries({
        queryKey: ["portfolioTrackedAssets"],
      });
      await queryClient.invalidateQueries({ queryKey: ["marketData"] });
      await queryClient.invalidateQueries({ queryKey: ["priorityAssets"] });
      setLastUpdated(new Date());
    } catch (error) {
      console.error("[PortfolioManager] Error refreshing after import:", error);
    }
  };

  const handleDialogActionComplete = async () => {
    console.log(
      "[PortfolioManager] Dialog action completed, refreshing portfolio data...",
    );
    try {
      await queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      await queryClient.invalidateQueries({
        queryKey: ["portfolioTrackedAssets"],
      });
      await queryClient.invalidateQueries({ queryKey: ["marketData"] });
      await queryClient.invalidateQueries({ queryKey: ["priorityAssets"] });
      setLastUpdated(new Date());
    } catch (error) {
      console.error(
        "[PortfolioManager] Error refreshing after dialog action:",
        error,
      );
    }
  };

  const selectedPortfolio =
    portfolios?.find((p) => p?.id === selectedPortfolioId) || null;

  // Calculate calculation quality (simple heuristic based on data availability)
  const calculationQuality =
    trackedAssets.length > 0 && marketData && marketData.length > 0
      ? Math.min(
          100,
          Math.round((marketData.length / trackedAssets.length) * 100),
        )
      : 0;

  // Show error screen if portfolios failed to load
  if (portfoliosError && !isLoading) {
    const errorMessage =
      portfoliosError instanceof Error
        ? portfoliosError.message
        : String(portfoliosError);
    const isUnauthorized =
      errorMessage.includes("Unauthorized") ||
      errorMessage.includes("permission");

    return (
      <div className="container mx-auto max-w-[1600px] py-8 px-4">
        <div className="flex min-h-[60vh] items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle>
                {isUnauthorized
                  ? language === "pl"
                    ? "Błąd autoryzacji"
                    : "Authorization Error"
                  : t.errorTitle}
              </CardTitle>
              <CardDescription>
                {isUnauthorized
                  ? language === "pl"
                    ? "Brak uprawnień do dostępu do portfeli. Spróbuj zalogować się ponownie."
                    : "No permission to access portfolios. Try logging in again."
                  : t.errorDescription}
              </CardDescription>
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                  {language === "pl" ? "Szczegóły błędu" : "Error details"}
                </summary>
                <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted p-2 text-xs">
                  {errorMessage}
                </pre>
              </details>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                onClick={handleRetry}
                className="w-full"
                variant="default"
              >
                {t.retry}
              </Button>
              <Button
                onClick={handleLogout}
                className="w-full"
                variant="outline"
              >
                {t.logout}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show loading screen while portfolios are loading
  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">{t.loadingPortfolios}</p>
        </div>
      </div>
    );
  }

  // Show welcome message if no portfolios exist
  if (!portfolios || portfolios.length === 0) {
    return (
      <div className="container mx-auto max-w-[1600px] py-8 px-4">
        <div className="flex min-h-[60vh] items-center justify-center">
          <Card className="w-full max-w-md text-center">
            <CardHeader>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <span className="text-3xl">📊</span>
              </div>
              <CardTitle>{t.welcome}</CardTitle>
              <CardDescription>{t.getStarted}</CardDescription>
            </CardHeader>
            <CardContent>
              <PortfolioSelector
                portfolios={[]}
                selectedPortfolioId={null}
                onSelectPortfolio={setSelectedPortfolioId}
                language={language}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-[1600px] py-8 px-4">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PortfolioSelector
          portfolios={portfolios || []}
          selectedPortfolioId={selectedPortfolioId}
          onSelectPortfolio={setSelectedPortfolioId}
          language={language}
        />
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowExportModal(true)}
            disabled={!portfolios || portfolios.length === 0}
            title={t.exportPortfolios}
            data-ocid="portfolio.export_button"
            className="rounded-terminal border-terminal bg-terminal-card font-terminal text-terminal hover:bg-terminal-hover hover:text-terminal-green"
          >
            <Download className="mr-2 h-4 w-4" />
            {t.exportPortfolios}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowImportModal(true)}
            title={t.importPortfolios}
            data-ocid="portfolio.import_button"
            className="rounded-terminal border-terminal bg-terminal-card font-terminal text-terminal hover:bg-terminal-hover hover:text-terminal-green"
          >
            <Upload className="mr-2 h-4 w-4" />
            {t.importPortfolios}
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefreshMarketData}
          disabled={isRefreshing || marketDataLoading || trackedAssetsLoading}
          className="rounded-terminal border-terminal bg-terminal-card font-terminal text-terminal hover:bg-terminal-hover hover:text-terminal-green"
        >
          {isRefreshing || marketDataLoading || trackedAssetsLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t.refreshing}
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t.refreshMarketData}
            </>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleThemeToggle}
          disabled={!mounted}
          title={resolvedTheme === "dark" ? t.lightMode : t.darkMode}
          aria-label={resolvedTheme === "dark" ? t.lightMode : t.darkMode}
          data-ocid="portfolio.theme_toggle"
          className="rounded-terminal border-terminal bg-terminal-card font-terminal text-terminal hover:bg-terminal-hover hover:text-terminal-green"
        >
          {mounted && resolvedTheme === "light" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>
      </div>

      <MarketDataStatusPanel
        language={language}
        isLoading={isRefreshing || marketDataLoading || trackedAssetsLoading}
        trackedAssetsCount={trackedAssets.length}
        lastUpdated={lastUpdated}
        calculationQuality={calculationQuality}
      />

      {marketDataError && !marketDataLoading && !isRefreshing && (
        <Alert className="mb-6 border-yellow-500/20 bg-yellow-500/5">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-600 dark:text-yellow-400">
            {language === "pl" ? "Ostrzeżenie" : "Warning"}
          </AlertTitle>
          <AlertDescription className="text-yellow-600 dark:text-yellow-400">
            {t.marketDataError}
          </AlertDescription>
        </Alert>
      )}

      {selectedPortfolio && (
        <AssetList
          portfolio={selectedPortfolio}
          language={language}
          marketData={marketData || []}
          priorityAssets={priorityAssets || []}
          onDialogActionComplete={handleDialogActionComplete}
        />
      )}

      <ExportPortfolioModal
        portfolios={portfolios || []}
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        language={language}
      />

      <ImportPortfolioModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={handleImportComplete}
        language={language}
        portfolios={portfolios || []}
      />
    </div>
  );
}
