import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Calendar as CalendarIcon,
  Check,
  ChevronsUpDown,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Asset, MarketData, PriorityAsset } from "../backend";
import {
  useAddTransaction,
  useGetHistoricalPrice,
  useGetMarketData,
  useGetPriorityAssets,
} from "../hooks/useQueries";

interface TransactionDialogProps {
  portfolioId: bigint;
  onClose: () => void;
  language: "pl" | "en";
  initialType?: "buy" | "sell";
  preselectedAsset?: Asset;
  marketData?: MarketData[];
  priorityAssets?: PriorityAsset[];
}

const translations = {
  pl: {
    titleBuy: "Kup aktywo",
    titleSell: "Sprzedaj aktywo",
    descriptionBuy: "Wprowadź szczegóły zakupu",
    descriptionSell: "Wprowadź szczegóły sprzedaży",
    type: "Typ",
    buy: "Kup",
    sell: "Sprzedaj",
    asset: "Aktywo",
    searchAsset: "Wyszukaj aktywo...",
    noAssetFound: "Nie znaleziono aktywa",
    selectAsset: "Wybierz aktywo",
    amount: "Ilość",
    amountPlaceholder: "0.00",
    price: "Cena ($)",
    pricePlaceholder: "0.00",
    total: "Suma",
    date: "Data transakcji",
    selectDate: "Wybierz datę",
    comment: "Komentarz",
    commentPlaceholder: "Dodaj notatkę do transakcji...",
    cancel: "Anuluj",
    add: "Dodaj",
    adding: "Dodawanie...",
    success: "Transakcja dodana pomyślnie",
    successWithUsdc: "Transakcja dodana pomyślnie. USDC dodany do portfela.",
    error: "Błąd dodawania transakcji",
    fillAll: "Wypełnij wszystkie pola",
    loadingMarketData: "Ładowanie danych rynkowych...",
    insufficientBalance: "Niewystarczająca ilość do sprzedaży",
    insufficientHoldings:
      "Nie posiadasz wystarczającej ilości {symbol} do sprzedaży (masz {held}, próbujesz sprzedać {sell})",
    available: "Dostępne",
    freeTokenNoteMarket: "Cena $0 - użyto aktualnej ceny rynkowej",
    freeTokenNoteHistorical: "Cena $0 - użyto ceny historycznej",
    refreshAssets: "Odśwież listę aktywów",
    assetsLoaded: "Załadowano aktywów",
    close: "Zamknij",
  },
  en: {
    titleBuy: "Buy asset",
    titleSell: "Sell asset",
    descriptionBuy: "Enter purchase details",
    descriptionSell: "Enter sale details",
    type: "Type",
    buy: "Buy",
    sell: "Sell",
    asset: "Asset",
    searchAsset: "Search asset...",
    noAssetFound: "No asset found",
    selectAsset: "Select asset",
    amount: "Amount",
    amountPlaceholder: "0.00",
    price: "Price ($)",
    pricePlaceholder: "0.00",
    total: "Total",
    date: "Transaction date",
    selectDate: "Select date",
    comment: "Comment",
    commentPlaceholder: "Add a note to this transaction...",
    cancel: "Cancel",
    add: "Add",
    adding: "Adding...",
    success: "Transaction added successfully",
    successWithUsdc: "Transaction added successfully. USDC added to portfolio.",
    error: "Error adding transaction",
    fillAll: "Fill all fields",
    loadingMarketData: "Loading market data...",
    insufficientBalance: "Insufficient amount to sell",
    insufficientHoldings:
      "Insufficient {symbol} to sell (you have {held}, attempting to sell {sell})",
    available: "Available",
    freeTokenNoteMarket: "Price $0 - current market price used",
    freeTokenNoteHistorical: "Price $0 - historical price used",
    refreshAssets: "Refresh asset list",
    assetsLoaded: "assets loaded",
    close: "Close",
  },
};

// Normalized shape used by the asset picker
type PickerAsset = {
  id: string;
  symbol: string;
  name: string;
  price: number;
  marketCap: number;
};

export default function TransactionDialog({
  portfolioId,
  onClose,
  language,
  initialType = "buy",
  preselectedAsset,
  marketData: _externalMarketData,
  priorityAssets: _externalPriorityAssets,
}: TransactionDialogProps) {
  const [type, setType] = useState<"buy" | "sell">(initialType);
  const [selectedAsset, setSelectedAsset] = useState<{
    symbol: string;
    name: string;
    price: number;
  } | null>(null);
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [comment, setComment] = useState("");
  const [open, setOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  // Tracks which price source was used for the most recent free-token buy so
  // the freeTokenNote can reflect it accurately. null when not a free token.
  const [freeTokenPriceSource, setFreeTokenPriceSource] = useState<
    "market" | "historical" | null
  >(null);
  const addTransaction = useAddTransaction();
  const {
    data: marketData,
    isLoading: marketDataLoading,
    refetch: refetchMarketData,
    isFetching: marketDataFetching,
  } = useGetMarketData();
  const { data: priorityAssets } = useGetPriorityAssets();
  const getHistoricalPrice = useGetHistoricalPrice();
  const t = translations[language];

  useEffect(() => {
    if (preselectedAsset) {
      setSelectedAsset({
        symbol: preselectedAsset.symbol,
        name: preselectedAsset.name,
        price: preselectedAsset.currentPrice,
      });
      setPrice(preselectedAsset.currentPrice.toString());
    }
  }, [preselectedAsset]);

  // Build a combined, deduplicated asset list for the picker.
  // Priority assets take precedence over marketData for the same symbol.
  const sortedMarketData = useMemo<PickerAsset[]>(() => {
    const marketList: PickerAsset[] = (marketData || []).map((coin) => ({
      id: coin.id.toString(),
      symbol: coin.symbol,
      name: coin.name,
      price: coin.price,
      marketCap: coin.marketCap,
    }));

    const priorityList: PickerAsset[] = (priorityAssets || []).map((coin) => ({
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      price: coin.price,
      marketCap: coin.marketCap,
    }));

    // Merge: priority assets override marketData entries with the same symbol
    const merged = new Map<string, PickerAsset>();
    for (const coin of marketList) {
      merged.set(coin.symbol.toUpperCase(), coin);
    }
    for (const coin of priorityList) {
      merged.set(coin.symbol.toUpperCase(), coin);
    }

    // Sort by marketCap descending (backend MarketData has no market_cap_rank)
    return Array.from(merged.values()).sort(
      (a, b) => (b.marketCap || 0) - (a.marketCap || 0),
    );
  }, [marketData, priorityAssets]);

  const handleAssetSelect = (asset: {
    symbol: string;
    name: string;
    price: number;
  }) => {
    setSelectedAsset(asset);
    setPrice(asset.price.toString());
    setOpen(false);
  };

  const totalValue = useMemo(() => {
    const amountNum = Number.parseFloat(amount) || 0;
    const priceNum = Number.parseFloat(price) || 0;
    return amountNum * priceNum;
  }, [amount, price]);

  const isFreeToken = useMemo(() => {
    return type === "buy" && Number.parseFloat(price) === 0 && selectedAsset;
  }, [type, price, selectedAsset]);

  const handleAdd = async () => {
    if (!selectedAsset || !amount) {
      toast.error(t.fillAll);
      return;
    }

    const amountNum = Number.parseFloat(amount);
    let priceNum = Number.parseFloat(price);

    if (type === "buy" && priceNum === 0 && selectedAsset) {
      // Free-token buy: prefer historical price when the transaction date is
      // not today, falling back to the current market price on any miss.
      // Graceful degradation — never reject the submission.
      const todayMidnight = new Date();
      todayMidnight.setHours(0, 0, 0, 0);
      const txMidnight = new Date(date);
      txMidnight.setHours(0, 0, 0, 0);
      const isHistoricalDate = txMidnight.getTime() !== todayMidnight.getTime();

      let resolvedPrice = 0;
      let source: "market" | "historical" = "market";

      if (isHistoricalDate) {
        const coinGeckoId = (priorityAssets || []).find(
          (coin) =>
            coin.symbol.toUpperCase() === selectedAsset.symbol.toUpperCase(),
        )?.id;

        if (coinGeckoId) {
          try {
            const historical = await getHistoricalPrice(
              coinGeckoId,
              BigInt(txMidnight.getTime() * 1000000),
            );
            if (historical && historical > 0) {
              resolvedPrice = historical;
              source = "historical";
            }
          } catch (error) {
            console.error("Historical price lookup failed:", error);
          }
        }
      }

      if (resolvedPrice === 0) {
        resolvedPrice = selectedAsset.price;
        source = "market";
      }

      priceNum = resolvedPrice;
      setFreeTokenPriceSource(source);

      if (priceNum === 0) {
        toast.error(t.fillAll);
        return;
      }
    } else {
      setFreeTokenPriceSource(null);
    }

    if (Number.isNaN(amountNum) || Number.isNaN(priceNum) || amountNum <= 0) {
      toast.error(t.fillAll);
      return;
    }

    if (
      type === "sell" &&
      preselectedAsset &&
      amountNum > preselectedAsset.amount
    ) {
      toast.error(t.insufficientBalance);
      return;
    }

    try {
      const transactionDate = BigInt(date.getTime() * 1000000);

      await addTransaction.mutateAsync({
        portfolioId,
        transaction: {
          id: BigInt(Date.now()),
          assetSymbol: selectedAsset.symbol.toUpperCase(),
          assetName: selectedAsset.name,
          amount: amountNum,
          price: priceNum,
          type: type,
          date: transactionDate,
          comment: comment.trim(),
        },
      });

      if (type === "sell") {
        const usdcAmount = amountNum * priceNum;
        const usdcPrice = 1.0;

        await addTransaction.mutateAsync({
          portfolioId,
          transaction: {
            id: BigInt(Date.now() + 1),
            assetSymbol: "USDC",
            assetName: "USD Coin",
            amount: usdcAmount,
            price: usdcPrice,
            type: "buy",
            date: transactionDate,
            comment: `Auto-added from ${selectedAsset.symbol} sale`,
          },
        });

        toast.success(t.successWithUsdc);
      } else {
        toast.success(t.success);
      }

      onClose();
    } catch (error) {
      console.error("Add transaction error:", error);
      const message =
        typeof error === "object" && error !== null && "message" in error
          ? String((error as { message?: unknown }).message)
          : String(error);
      const match = message.match(
        /Insufficient holdings: cannot sell (\S+) (\S+) when only (\S+) are held/,
      );
      if (match) {
        const [, sell, symbol, held] = match;
        toast.error(
          t.insufficientHoldings
            .replace("{symbol}", symbol)
            .replace("{held}", held)
            .replace("{sell}", sell),
        );
      } else {
        toast.error(t.error);
      }
    }
  };

  const handleRefreshAssets = async () => {
    try {
      await refetchMarketData();
      toast.success(`${sortedMarketData.length} ${t.assetsLoaded}`);
    } catch (error) {
      console.error("Error refreshing assets:", error);
    }
  };

  const formatCurrency = (value: number) => {
    return `$${new Intl.NumberFormat(language === "pl" ? "pl-PL" : "en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)}`;
  };

  const title = type === "buy" ? t.titleBuy : t.titleSell;
  const description = type === "buy" ? t.descriptionBuy : t.descriptionSell;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{t.type}</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={type === "buy" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setType("buy")}
              >
                {t.buy}
              </Button>
              <Button
                type="button"
                variant={type === "sell" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setType("sell")}
              >
                {t.sell}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t.asset}</Label>
              {!preselectedAsset && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRefreshAssets}
                  disabled={marketDataLoading || marketDataFetching}
                  className="h-7 px-2 text-xs"
                >
                  <RefreshCw
                    className={cn(
                      "h-3 w-3 mr-1",
                      (marketDataLoading || marketDataFetching) &&
                        "animate-spin",
                    )}
                  />
                  {t.refreshAssets}
                </Button>
              )}
            </div>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  aria-expanded={open}
                  className="w-full justify-between"
                  disabled={marketDataLoading || !!preselectedAsset}
                >
                  {marketDataLoading ? (
                    <span className="text-muted-foreground">
                      {t.loadingMarketData}
                    </span>
                  ) : selectedAsset ? (
                    <span>
                      {selectedAsset.symbol.toUpperCase()} -{" "}
                      {selectedAsset.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      {t.selectAsset}{" "}
                      {sortedMarketData.length > 0 &&
                        `(${sortedMarketData.length} ${t.assetsLoaded})`}
                    </span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[calc(100vw-2rem)] sm:w-[460px] p-0"
                align="start"
              >
                <Command>
                  <CommandInput placeholder={t.searchAsset} />
                  <CommandList>
                    <CommandEmpty>{t.noAssetFound}</CommandEmpty>
                    <CommandGroup>
                      {sortedMarketData.map((asset) => (
                        <CommandItem
                          key={asset.id}
                          value={`${asset.symbol} ${asset.name}`}
                          onSelect={() =>
                            handleAssetSelect({
                              symbol: asset.symbol.toUpperCase(),
                              name: asset.name,
                              price: asset.price,
                            })
                          }
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedAsset?.symbol.toLowerCase() ===
                                asset.symbol.toLowerCase()
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                          <div className="flex flex-1 items-center justify-between">
                            <div>
                              <div className="font-semibold">
                                {asset.symbol.toUpperCase()}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {asset.name}
                              </div>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {formatCurrency(asset.price)}
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {type === "sell" && preselectedAsset && (
              <p className="text-xs text-muted-foreground">
                {t.available}: {preselectedAsset.amount.toFixed(8)}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="amount">{t.amount}</Label>
              <Input
                id="amount"
                type="number"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={t.amountPlaceholder}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">{t.price}</Label>
              <Input
                id="price"
                type="number"
                step="any"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={t.pricePlaceholder}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t.date}</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : <span>{t.selectDate}</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(newDate) => {
                    if (newDate) {
                      setDate(newDate);
                      setCalendarOpen(false);
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="comment">{t.comment}</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t.commentPlaceholder}
              rows={3}
            />
          </div>

          {isFreeToken && freeTokenPriceSource && (
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
              <p className="text-xs text-blue-600 dark:text-blue-400">
                {freeTokenPriceSource === "historical"
                  ? t.freeTokenNoteHistorical
                  : t.freeTokenNoteMarket}
                : {formatCurrency(selectedAsset?.price || 0)}
              </p>
            </div>
          )}

          {totalValue > 0 && (
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t.total}</span>
                <span className="text-lg font-bold">
                  {formatCurrency(totalValue)}
                </span>
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            {t.close}
          </Button>
          <Button
            onClick={handleAdd}
            disabled={addTransaction.isPending || !selectedAsset}
            className="w-full sm:w-auto"
          >
            {addTransaction.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t.adding}
              </>
            ) : (
              t.add
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
