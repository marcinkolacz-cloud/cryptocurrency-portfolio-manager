import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowUpDown,
  History,
  Plus,
  Search,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { Asset, Portfolio } from "../backend";
import { updatePortfolioWithMarketPrices } from "../hooks/useQueries";
import type { CoinGeckoMarketData } from "../hooks/useQueries";
import AssetAllocationChart from "./AssetAllocationChart";
import AssetChartModal from "./AssetChartModal";
import PortfolioChart from "./PortfolioChart";
import TransactionDialog from "./TransactionDialog";
import TransactionHistoryModal from "./TransactionHistoryModal";

interface AssetListProps {
  portfolio: Portfolio;
  language: "pl" | "en";
  marketData: CoinGeckoMarketData[];
  onDialogActionComplete?: () => void;
}

const translations = {
  pl: {
    totalValue: "Całkowita wartość",
    totalProfitLoss: "Całkowity zysk/strata portfolio",
    unrealizedProfitLoss: "Niezrealizowany zysk/strata",
    totalPurchaseValue: "Całkowita wartość zakupu",
    assets: "Aktywa",
    searchAssets: "Szukaj aktywów...",
    addTransaction: "Dodaj transakcję",
    transactionHistory: "Historia transakcji",
    name: "Nazwa",
    symbol: "Symbol",
    price: "Cena $",
    avgPurchasePrice: "Śr. cena zakupu $",
    holdings: "Posiadane",
    value: "Wartość $",
    purchaseValue: "Wartość zakupu $",
    profitLossDollar: "Zysk/Strata ($)",
    profitLossPercent: "Zysk/Strata (%)",
    actions: "Akcje",
    buy: "Kup",
    sell: "Sprzedaj",
    noAssets: "Brak aktywów w portfelu",
    addFirst: "Dodaj swoją pierwszą transakcję, aby rozpocząć",
  },
  en: {
    totalValue: "Total value",
    totalProfitLoss: "Total profit/loss",
    unrealizedProfitLoss: "Unrealized profit/loss",
    totalPurchaseValue: "Total purchase value",
    assets: "Assets",
    searchAssets: "Search assets...",
    addTransaction: "Add transaction",
    transactionHistory: "Transaction history",
    name: "Name",
    symbol: "Symbol",
    price: "Price $",
    avgPurchasePrice: "Avg. purchase price $",
    holdings: "Holdings",
    value: "Value $",
    purchaseValue: "Purchase value $",
    profitLossDollar: "Profit/Loss ($)",
    profitLossPercent: "Profit/Loss (%)",
    actions: "Actions",
    buy: "Buy",
    sell: "Sell",
    noAssets: "No assets in portfolio",
    addFirst: "Add your first transaction to get started",
  },
};

type SortField =
  | "name"
  | "symbol"
  | "price"
  | "avgPurchasePrice"
  | "holdings"
  | "value"
  | "purchaseValue"
  | "profitLossDollar"
  | "profitLossPercent";
type SortDirection = "asc" | "desc";

export default function AssetList({
  portfolio,
  language,
  marketData,
  onDialogActionComplete,
}: AssetListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("value");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [transactionType, setTransactionType] = useState<"buy" | "sell">("buy");
  const [chartModalOpen, setChartModalOpen] = useState(false);
  const [selectedChartAsset, setSelectedChartAsset] = useState<{
    id: string;
    symbol: string;
    name: string;
  } | null>(null);
  const t = translations[language];

  const updatedPortfolio = useMemo(() => {
    return updatePortfolioWithMarketPrices(portfolio, marketData);
  }, [portfolio, marketData]);

  // Helper function to calculate profit/loss percentage for an asset
  const calculateProfitLossPercentage = useCallback((asset: Asset): number => {
    const purchaseValue = asset.purchaseValue || 0;
    const currentValue = asset.currentValue || 0;
    const profitLoss = asset.profitLoss || 0;
    const amount = asset.amount || 0;

    // For assets with nonzero purchase value, calculate percentage based on purchase value
    if (purchaseValue > 0) {
      return (profitLoss / purchaseValue) * 100;
    }

    // For free tokens (purchase value = $0) with positive current value, show 100% profit
    if (purchaseValue === 0 && currentValue > 0 && amount > 0) {
      return 100;
    }

    // For sold assets with realized profit/loss
    if (amount === 0 && profitLoss !== 0) {
      // If we have the original purchase value from backend, use it
      // Otherwise, the profit/loss percentage should already be calculated
      return asset.profitLossPercentage || 0;
    }

    // Default case: no profit/loss
    return 0;
  }, []);

  const formatCurrency = (value: number) => {
    return `$${new Intl.NumberFormat(language === "pl" ? "pl-PL" : "en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)}`;
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat(language === "pl" ? "pl-PL" : "en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? "+" : "";
    const formatted = new Intl.NumberFormat(
      language === "pl" ? "pl-PL" : "en-US",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      },
    ).format(Math.abs(value));
    return `${sign}${formatted}%`;
  };

  const totalValue = useMemo(() => {
    if (!updatedPortfolio?.assets) return 0;
    return updatedPortfolio.assets.reduce((sum, asset) => {
      if (!asset) return sum;
      const amount = asset.amount || 0;
      const currentPrice = asset.currentPrice || 0;
      return sum + amount * currentPrice;
    }, 0);
  }, [updatedPortfolio]);

  const totalProfitLoss = updatedPortfolio?.totalProfitLoss || 0;
  const unrealizedProfitLoss = updatedPortfolio?.unrealizedProfitLoss || 0;
  const totalPurchaseValue = updatedPortfolio?.totalPurchaseValue || 0;

  const filteredAndSortedAssets = useMemo(() => {
    if (!updatedPortfolio?.assets) return [];

    let filtered = [...updatedPortfolio.assets].filter((asset) => {
      if (!asset) return false;
      const amount = asset.amount || 0;
      return amount > 0.00000001;
    });

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (asset) =>
          asset?.symbol?.toLowerCase().includes(term) ||
          asset?.name?.toLowerCase().includes(term),
      );
    }

    filtered.sort((a, b) => {
      if (!a || !b) return 0;

      let comparison = 0;
      switch (sortField) {
        case "name":
          comparison = (a.name || "").localeCompare(b.name || "");
          break;
        case "symbol":
          comparison = (a.symbol || "").localeCompare(b.symbol || "");
          break;
        case "price":
          comparison = (a.currentPrice || 0) - (b.currentPrice || 0);
          break;
        case "avgPurchasePrice":
          comparison =
            (a.averagePurchasePrice || 0) - (b.averagePurchasePrice || 0);
          break;
        case "holdings":
          comparison = (a.amount || 0) - (b.amount || 0);
          break;
        case "value":
          comparison =
            (a.amount || 0) * (a.currentPrice || 0) -
            (b.amount || 0) * (b.currentPrice || 0);
          break;
        case "purchaseValue":
          comparison = (a.purchaseValue || 0) - (b.purchaseValue || 0);
          break;
        case "profitLossDollar":
          comparison = (a.profitLoss || 0) - (b.profitLoss || 0);
          break;
        case "profitLossPercent":
          comparison =
            calculateProfitLossPercentage(a) - calculateProfitLossPercentage(b);
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [
    updatedPortfolio,
    searchTerm,
    sortField,
    sortDirection,
    calculateProfitLossPercentage,
  ]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const handleBuyClick = (asset?: Asset) => {
    setSelectedAsset(asset || null);
    setTransactionType("buy");
    setTransactionDialogOpen(true);
  };

  const handleSellClick = (asset: Asset) => {
    setSelectedAsset(asset);
    setTransactionType("sell");
    setTransactionDialogOpen(true);
  };

  const handleAssetClick = (asset: Asset) => {
    const coinGeckoAsset = marketData?.find(
      (coin) => coin.symbol.toLowerCase() === asset.symbol.toLowerCase(),
    );

    if (coinGeckoAsset) {
      setSelectedChartAsset({
        id: coinGeckoAsset.id,
        symbol: asset.symbol,
        name: asset.name,
      });
      setChartModalOpen(true);
    }
  };

  const handleTransactionDialogClose = () => {
    setTransactionDialogOpen(false);
    setSelectedAsset(null);
    // Trigger portfolio refresh after dialog closes
    if (onDialogActionComplete) {
      onDialogActionComplete();
    }
  };

  const handleHistoryModalClose = () => {
    setHistoryModalOpen(false);
    // Trigger portfolio refresh after dialog closes
    if (onDialogActionComplete) {
      onDialogActionComplete();
    }
  };

  const SortableHeader = ({
    field,
    children,
    className = "",
  }: {
    field: SortField;
    children: React.ReactNode;
    className?: string;
  }) => (
    <TableHead
      className={`cursor-pointer select-none border-r border-border/50 last:border-r-0 text-center ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center justify-center gap-1">
        {children}
        <ArrowUpDown
          className={`h-3 w-3 ${sortField === field ? "opacity-100" : "opacity-50"}`}
        />
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t.totalValue}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalValue)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t.totalProfitLoss}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${totalProfitLoss >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
            >
              {formatCurrency(totalProfitLoss)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t.unrealizedProfitLoss}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${unrealizedProfitLoss >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
            >
              {formatCurrency(unrealizedProfitLoss)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t.totalPurchaseValue}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalPurchaseValue)}
            </div>
          </CardContent>
        </Card>
      </div>

      {updatedPortfolio && (
        <div className="grid gap-6 lg:grid-cols-2">
          <PortfolioChart
            portfolio={updatedPortfolio}
            language={language}
            marketData={marketData}
          />
          <AssetAllocationChart
            portfolio={updatedPortfolio}
            language={language}
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>{t.assets}</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHistoryModalOpen(true)}
              >
                <History className="mr-2 h-4 w-4" />
                {t.transactionHistory}
              </Button>
              <Button size="sm" onClick={() => handleBuyClick()}>
                <Plus className="mr-2 h-4 w-4" />
                {t.addTransaction}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t.searchAssets}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {filteredAndSortedAssets.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-muted-foreground">{t.noAssets}</p>
              <p className="mt-2 text-sm text-muted-foreground">{t.addFirst}</p>
              <Button className="mt-4" onClick={() => handleBuyClick()}>
                <Plus className="mr-2 h-4 w-4" />
                {t.addTransaction}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b-2">
                    <SortableHeader field="name">{t.name}</SortableHeader>
                    <SortableHeader field="symbol">{t.symbol}</SortableHeader>
                    <SortableHeader field="price">{t.price}</SortableHeader>
                    <SortableHeader field="avgPurchasePrice">
                      {t.avgPurchasePrice}
                    </SortableHeader>
                    <SortableHeader field="holdings">
                      {t.holdings}
                    </SortableHeader>
                    <SortableHeader field="value">{t.value}</SortableHeader>
                    <SortableHeader field="purchaseValue">
                      {t.purchaseValue}
                    </SortableHeader>
                    <SortableHeader field="profitLossDollar">
                      {t.profitLossDollar}
                    </SortableHeader>
                    <SortableHeader field="profitLossPercent">
                      {t.profitLossPercent}
                    </SortableHeader>
                    <TableHead className="text-center border-r-0">
                      {t.actions}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedAssets.map((asset) => {
                    if (!asset) return null;

                    const profitLoss = asset.profitLoss || 0;
                    const profitLossPercentage =
                      calculateProfitLossPercentage(asset);
                    const isPositive = profitLoss >= 0;

                    return (
                      <TableRow
                        key={asset.symbol}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleAssetClick(asset)}
                      >
                        <TableCell className="font-medium border-r border-border/50 text-center">
                          {asset.name}
                        </TableCell>
                        <TableCell className="border-r border-border/50 text-center">
                          <div className="flex justify-center">
                            <Badge variant="outline">{asset.symbol}</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-mono border-r border-border/50">
                          {formatCurrency(asset.currentPrice || 0)}
                        </TableCell>
                        <TableCell className="text-center font-mono border-r border-border/50">
                          {formatCurrency(asset.averagePurchasePrice || 0)}
                        </TableCell>
                        <TableCell className="text-center font-mono border-r border-border/50">
                          {formatNumber(asset.amount || 0)}
                        </TableCell>
                        <TableCell className="text-center font-mono font-semibold border-r border-border/50">
                          {formatCurrency(
                            (asset.amount || 0) * (asset.currentPrice || 0),
                          )}
                        </TableCell>
                        <TableCell className="text-center font-mono border-r border-border/50">
                          {formatCurrency(asset.purchaseValue || 0)}
                        </TableCell>
                        <TableCell className="text-center border-r border-border/50">
                          <div
                            className={`flex items-center justify-center gap-1 font-semibold font-mono ${isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                          >
                            {isPositive ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {formatCurrency(Math.abs(profitLoss))}
                          </div>
                        </TableCell>
                        <TableCell className="text-center border-r border-border/50">
                          <div
                            className={`font-medium font-mono ${isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                          >
                            {formatPercent(profitLossPercentage)}
                          </div>
                        </TableCell>
                        <TableCell
                          className="text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleBuyClick(asset)}
                              title={t.buy}
                            >
                              <img
                                src="/assets/generated/buy-icon.dim_24x24.png"
                                alt={t.buy}
                                className="h-5 w-5"
                              />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleSellClick(asset)}
                              title={t.sell}
                            >
                              <img
                                src="/assets/generated/sell-icon.dim_24x24.png"
                                alt={t.sell}
                                className="h-5 w-5"
                              />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {transactionDialogOpen && (
        <TransactionDialog
          portfolioId={portfolio.id}
          onClose={handleTransactionDialogClose}
          language={language}
          initialType={transactionType}
          preselectedAsset={selectedAsset || undefined}
          marketData={marketData}
        />
      )}

      {historyModalOpen && (
        <TransactionHistoryModal
          portfolio={updatedPortfolio || portfolio}
          language={language}
          open={historyModalOpen}
          onClose={handleHistoryModalClose}
          marketData={marketData}
        />
      )}

      {chartModalOpen && selectedChartAsset && (
        <AssetChartModal
          coinId={selectedChartAsset.id}
          symbol={selectedChartAsset.symbol}
          name={selectedChartAsset.name}
          language={language}
          open={chartModalOpen}
          onClose={() => {
            setChartModalOpen(false);
            setSelectedChartAsset(null);
          }}
        />
      )}
    </div>
  );
}
