import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useAddCustomPriorityAsset,
  useGetCustomPriorityAssets,
  useRemoveCustomPriorityAsset,
  useSearchCoinGeckoTokens,
} from "@/hooks/useQueries";
import type { CoinGeckoSearchResult } from "@/hooks/useQueries";
import { Check, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface AddTokenDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  language: "pl" | "en";
}

const translations = {
  pl: {
    title: "Dodaj token",
    description:
      "Wyszukaj token na CoinGecko i dodaj go do listy priorytetowych aktywów. Nowe tokeny pojawią się w wyborze aktywów transakcji bez przeładowania strony.",
    searchPlaceholder: "Szukaj monety (np. bitcoin, eth, solana)",
    searchButton: "Szukaj",
    searching: "Szukanie...",
    noResults: "Brak wyników",
    searchError: "Błąd wyszukiwania",
    resultsLabel: "Wyniki",
    tickerLabel: "Ticker do użycia",
    tickerPlaceholder: "np. ICP",
    confirmButton: "Potwierdź dodanie",
    adding: "Dodawanie...",
    cancel: "Anuluj",
    added: "Dodano {symbol}",
    addError: "Błąd dodawania",
    customAssetsTitle: "Bieżące niestandardowe tokeny",
    noCustomAssets: "Brak dodanych tokenów",
    loadingCustom: "Ładowanie...",
    selectResultHint: "Wybierz wynik, aby kontynuować.",
    tickerRequired: "Ticker nie może być pusty.",
    remove: "Usuń",
    removeError: "Błąd usuwania tokenu",
  },
  en: {
    title: "Add token",
    description:
      "Search for a token on CoinGecko and add it to the priority asset list. New tokens appear in the transaction asset picker without a page reload.",
    searchPlaceholder: "Search coin (e.g. bitcoin, eth, solana)",
    searchButton: "Search",
    searching: "Searching...",
    noResults: "No results",
    searchError: "Search error",
    resultsLabel: "Results",
    tickerLabel: "Ticker to use",
    tickerPlaceholder: "e.g. ICP",
    confirmButton: "Confirm add",
    adding: "Adding...",
    cancel: "Cancel",
    added: "Added {symbol}",
    addError: "Error adding",
    customAssetsTitle: "Current custom tokens",
    noCustomAssets: "No custom tokens added yet",
    loadingCustom: "Loading...",
    selectResultHint: "Select a result to continue.",
    tickerRequired: "Ticker cannot be empty.",
    remove: "Remove",
    removeError: "Error removing token",
  },
};

export default function AddTokenDialog({
  isOpen,
  onOpenChange,
  language,
}: AddTokenDialogProps) {
  const t = translations[language];

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CoinGeckoSearchResult[]>(
    [],
  );
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedCoin, setSelectedCoin] =
    useState<CoinGeckoSearchResult | null>(null);
  const [ticker, setTicker] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const searchTokensMutation = useSearchCoinGeckoTokens();
  const addAssetMutation = useAddCustomPriorityAsset();
  const removeAssetMutation = useRemoveCustomPriorityAsset();
  const customAssetsQuery = useGetCustomPriorityAssets();

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasSearchedRef = useRef(false);

  const resetState = useCallback(() => {
    setSearchQuery("");
    setSearchResults([]);
    setSearchError(null);
    setSelectedCoin(null);
    setTicker("");
    setAddError(null);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    hasSearchedRef.current = false;
  }, []);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetState();
    }
    onOpenChange(open);
  };

  const runSearch = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearchError(null);
      hasSearchedRef.current = false;
      return;
    }
    setSearchError(null);
    try {
      const response = await searchTokensMutation.mutateAsync(trimmed);
      if (response.error) {
        setSearchError(response.error);
        setSearchResults([]);
      } else {
        setSearchResults(response.results.slice(0, 10));
      }
    } catch (error) {
      console.error("Error searching CoinGecko tokens:", error);
      setSearchError(error instanceof Error ? error.message : t.searchError);
      setSearchResults([]);
    }
    hasSearchedRef.current = true;
  };

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setSelectedCoin(null);
    setTicker("");
    setAddError(null);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      void runSearch(value);
    }, 350);
  };

  const handleSearchSubmit = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    void runSearch(searchQuery);
  };

  const handleSelectResult = (coin: CoinGeckoSearchResult) => {
    setSelectedCoin(coin);
    setTicker(coin.symbol.toUpperCase());
    setAddError(null);
  };

  const handleConfirmAdd = async () => {
    if (!selectedCoin || !ticker.trim()) return;
    setAddError(null);
    try {
      const response = await addAssetMutation.mutateAsync({
        coinGeckoId: selectedCoin.id,
        tickerSymbol: ticker.trim().toUpperCase(),
      });
      if (response.success) {
        toast.success(t.added.replace("{symbol}", ticker.trim().toUpperCase()));
        await customAssetsQuery.refetch();
        handleOpenChange(false);
      } else {
        const message = response.error || t.addError;
        setAddError(message);
        toast.error(message);
      }
    } catch (error) {
      console.error("Error adding custom priority asset:", error);
      const message = error instanceof Error ? error.message : t.addError;
      setAddError(message);
      toast.error(message);
    }
  };

  const handleRemoveAsset = async (coinGeckoId: string) => {
    try {
      const response = await removeAssetMutation.mutateAsync(coinGeckoId);
      if (response.success) {
        await customAssetsQuery.refetch();
      } else {
        const message = response.error || t.removeError;
        toast.error(message);
      }
    } catch (error) {
      console.error("Error removing custom priority asset:", error);
      const message = error instanceof Error ? error.message : t.removeError;
      toast.error(message);
    }
  };

  // Reset state when dialog closes via external trigger (e.g. overlay click handled by Radix)
  useEffect(() => {
    if (!isOpen) {
      resetState();
    }
  }, [isOpen, resetState]);

  const isSearching = searchTokensMutation.isPending;
  const isAdding = addAssetMutation.isPending;
  const canConfirm = !!selectedCoin && ticker.trim().length > 0 && !isAdding;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg" data-ocid="add_token.dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-terminal text-terminal">
            <Plus className="h-5 w-5 text-terminal-green" />
            {t.title}
          </DialogTitle>
          <DialogDescription className="text-terminal-muted">
            {t.description}
          </DialogDescription>
        </DialogHeader>

        {/* Search row */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              type="text"
              value={searchQuery}
              onChange={handleSearchInputChange}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSearchSubmit();
                }
              }}
              placeholder={t.searchPlaceholder}
              disabled={isSearching}
              className="rounded-terminal border-terminal bg-terminal-hover font-terminal text-terminal placeholder:text-terminal-muted focus-visible:ring-terminal-green/40"
              data-ocid="add_token.search_input"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleSearchSubmit}
              disabled={isSearching || !searchQuery.trim()}
              className="shrink-0 rounded-terminal font-terminal"
              data-ocid="add_token.search_button"
            >
              {isSearching ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t.searching}
                </>
              ) : (
                <>
                  <Search className="h-3.5 w-3.5" />
                  {t.searchButton}
                </>
              )}
            </Button>
          </div>

          {/* Search error */}
          {searchError && (
            <p
              className="text-xs text-terminal-red"
              data-ocid="add_token.search_error"
            >
              {searchError}
            </p>
          )}

          {/* Searching state */}
          {isSearching && searchResults.length === 0 && !searchError && (
            <p
              className="text-xs text-terminal-muted"
              data-ocid="add_token.searching_state"
            >
              {t.searching}
            </p>
          )}

          {/* Empty state */}
          {!isSearching &&
            !searchError &&
            searchResults.length === 0 &&
            hasSearchedRef.current &&
            searchQuery.trim() && (
              <p
                className="text-xs text-terminal-muted"
                data-ocid="add_token.empty_state"
              >
                {t.noResults}
              </p>
            )}

          {/* Results list */}
          {searchResults.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold text-terminal-muted">
                {t.resultsLabel}
              </p>
              <div
                className="flex max-h-48 flex-col gap-1 overflow-y-auto"
                data-ocid="add_token.results_list"
              >
                {searchResults.map((coin, index) => {
                  const isSelected = selectedCoin?.id === coin.id;
                  return (
                    <button
                      type="button"
                      key={coin.id}
                      className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-terminal px-2 py-1.5 text-left transition-colors ${
                        isSelected
                          ? "bg-terminal-green/10 border border-terminal-green/30"
                          : "bg-terminal-hover border border-transparent hover:bg-terminal-green/5"
                      }`}
                      onClick={() => handleSelectResult(coin)}
                      data-ocid={`add_token.item.${index + 1}`}
                    >
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-terminal text-terminal">
                          {coin.name} ({coin.symbol.toUpperCase()})
                        </span>
                        <span className="truncate text-xs text-terminal-muted">
                          {coin.id}
                        </span>
                      </div>
                      {isSelected && (
                        <Check className="h-4 w-4 shrink-0 text-terminal-green" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Ticker field */}
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="add-token-ticker"
            className="text-xs font-semibold text-terminal-muted"
          >
            {t.tickerLabel}
          </Label>
          <Input
            id="add-token-ticker"
            type="text"
            value={ticker}
            onChange={(e) => {
              setTicker(e.target.value.toUpperCase());
              setAddError(null);
            }}
            placeholder={t.tickerPlaceholder}
            disabled={isAdding}
            className="rounded-terminal border-terminal bg-terminal-hover font-terminal text-terminal placeholder:text-terminal-muted focus-visible:ring-terminal-green/40"
            data-ocid="add_token.ticker_input"
          />
          {!selectedCoin && (
            <p
              className="text-xs text-terminal-muted"
              data-ocid="add_token.ticker_hint"
            >
              {t.selectResultHint}
            </p>
          )}
          {selectedCoin && ticker.trim().length === 0 && (
            <p
              className="text-xs text-terminal-red"
              data-ocid="add_token.ticker_field_error"
            >
              {t.tickerRequired}
            </p>
          )}
        </div>

        {/* Add error */}
        {addError && (
          <p
            className="text-xs text-terminal-red"
            data-ocid="add_token.add_error_state"
          >
            {addError}
          </p>
        )}

        {/* Current custom tokens list */}
        <div className="border-t border-terminal pt-3">
          <p className="mb-1.5 text-xs font-semibold text-terminal-muted">
            {t.customAssetsTitle}
          </p>
          {customAssetsQuery.isLoading ? (
            <p
              className="text-xs text-terminal-muted"
              data-ocid="add_token.custom_loading_state"
            >
              {t.loadingCustom}
            </p>
          ) : customAssetsQuery.data && customAssetsQuery.data.length > 0 ? (
            <div
              className="flex flex-wrap gap-1.5"
              data-ocid="add_token.custom_assets_list"
            >
              {customAssetsQuery.data.map(([assetId, assetTicker], index) => {
                const isRemoving =
                  removeAssetMutation.isPending &&
                  removeAssetMutation.variables === assetId;
                return (
                  <Badge
                    key={`${assetId}-${assetTicker}`}
                    variant="outline"
                    className="gap-1 rounded-terminal border-terminal-green/20 bg-terminal-green/10 py-1 pl-2 pr-1 font-terminal text-terminal-green"
                    data-ocid={`add_token.custom_asset.item.${index + 1}`}
                  >
                    <span>
                      {assetId} ({assetTicker})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAsset(assetId)}
                      disabled={isRemoving}
                      aria-label={t.remove}
                      title={t.remove}
                      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-terminal text-terminal-muted transition-colors hover:text-terminal-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terminal-red/40 disabled:cursor-not-allowed disabled:opacity-50"
                      data-ocid={`add_token.delete_button.${index + 1}`}
                    >
                      {isRemoving ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </button>
                  </Badge>
                );
              })}
            </div>
          ) : (
            <p
              className="text-xs text-terminal-muted"
              data-ocid="add_token.custom_empty_state"
            >
              {t.noCustomAssets}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenChange(false)}
            disabled={isAdding}
            className="rounded-terminal font-terminal"
            data-ocid="add_token.cancel_button"
          >
            <X className="h-3.5 w-3.5" />
            {t.cancel}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleConfirmAdd}
            disabled={!canConfirm}
            className="rounded-terminal font-terminal"
            data-ocid="add_token.confirm_button"
          >
            {isAdding ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t.adding}
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" />
                {t.confirmButton}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
