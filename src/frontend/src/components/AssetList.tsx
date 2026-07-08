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
import { useMemo, useState } from "react";
import type { Asset, MarketData, Portfolio, PriorityAsset } from "../backend";
import { updatePortfolioWithMarketPrices } from "../hooks/useQueries";
import AssetAllocationChart from "./AssetAllocationChart";
import AssetChartModal from "./AssetChartModal";
import PortfolioChart from "./PortfolioChart";
import TransactionDialog from "./TransactionDialog";
import TransactionHistoryModal from "./TransactionHistoryModal";

interface AssetListProps {
  portfolio: Portfolio;
  language: "pl" | "en";
  marketData: MarketData[];
  priorityAssets: PriorityAsset[];
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
    profitLossPercent: "Niezrealizowany %",
    realizedProfitLossPercent: "Zrealizowany %",
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
    profitLossPercent: "Unrealized %",
    realizedProfitLossPercent: "Realized %",
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
  | "profitLossPercent"
  | "realizedProfitLossPercent";
type SortDirection = "asc" | "desc";

export default function AssetList({
  portfolio,
  language,
  marketData,
  priorityAssets,
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
    return updatePortfolioWithMarketPrices(
      portfolio,
      marketData,
      priorityAssets,
    );
  }, [portfolio, marketData, priorityAssets]);

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
            (a.profitLossPercentage || 0) - (b.profitLossPercentage || 0);
          break;
        case "realizedProfitLossPercent":
          comparison =
            (a.realizedProfitLossPercentage || 0) -
            (b.realizedProfitLossPercentage || 0);
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [updatedPortfolio, searchTerm, sortField, sortDirection]);

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
    const marketCoin = marketData?.find(
      (coin) => coin.symbol.toLowerCase() === asset.symbol.toLowerCase(),
    );
    const priorityCoin = priorityAssets?.find(
      (coin) => coin.symbol.toLowerCase() === asset.symbol.toLowerCase(),
    );

    // Priority assets take precedence over marketData for the same symbol
    const coinId = priorityCoin?.id || marketCoin?.id.toString();

    if (coinId) {
      setSelectedChartAsset({
        id: coinId,
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
      className={`cursor-pointer select-none border-r border-terminal last:border-r-0 text-center text-terminal-muted ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center justify-center gap-1">
        {children}
        <ArrowUpDown
          className={`h-3 w-3 ${sortField === field ? "opacity-100 text-terminal-green" : "opacity-50"}`}
        />
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-terminal border border-terminal bg-terminal-card p-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 p-2">
            <CardTitle className="text-[11px] font-medium uppercase tracking-wider text-terminal-muted">
              {t.totalValue}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-1">
            <div className="font-terminal text-2xl font-bold text-terminal">
              {formatCurrency(totalValue)}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-terminal border border-terminal bg-terminal-card p-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 p-2">
            <CardTitle className="text-[11px] font-medium uppercase tracking-wider text-terminal-muted">
              {t.totalProfitLoss}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-1">
            <div
              className={`font-terminal text-2xl font-bold ${totalProfitLoss >= 0 ? "text-terminal-green" : "text-terminal-red"}`}
            >
              {formatCurrency(totalProfitLoss)}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-terminal border border-terminal bg-terminal-card p-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 p-2">
            <CardTitle className="text-[11px] font-medium uppercase tracking-wider text-terminal-muted">
              {t.unrealizedProfitLoss}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-1">
            <div
              className={`font-terminal text-2xl font-bold ${unrealizedProfitLoss >= 0 ? "text-terminal-green" : "text-terminal-red"}`}
            >
              {formatCurrency(unrealizedProfitLoss)}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-terminal border border-terminal bg-terminal-card p-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 p-2">
            <CardTitle className="text-[11px] font-medium uppercase tracking-wider text-terminal-muted">
              {t.totalPurchaseValue}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-1">
            <div className="font-terminal text-2xl font-bold text-terminal">
              {formatCurrency(totalPurchaseValue)}
            </div>
          </CardContent>
        </Card>
      </div>

      {updatedPortfolio && (
        <div className="grid gap-3 lg:grid-cols-2">
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

      <Card className="rounded-terminal border border-terminal bg-terminal-card p-2">
        <CardHeader className="p-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base font-bold text-terminal">
              {t.assets}
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHistoryModalOpen(true)}
                className="rounded-terminal font-terminal"
              >
                <History className="mr-2 h-4 w-4" />
                {t.transactionHistory}
              </Button>
              <Button
                size="sm"
                onClick={() => handleBuyClick()}
                className="rounded-terminal font-terminal"
              >
                <Plus className="mr-2 h-4 w-4" />
                {t.addTransaction}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-2">
          <div className="mb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-terminal-muted" />
              <Input
                placeholder={t.searchAssets}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="rounded-terminal border-terminal bg-terminal font-terminal text-terminal placeholder:text-terminal-muted pl-9"
              />
            </div>
          </div>

          {filteredAndSortedAssets.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-terminal-muted font-terminal text-sm">
                {t.noAssets}
              </p>
              <p className="mt-2 font-terminal text-xs text-terminal-muted">
                {t.addFirst}
              </p>
              <Button
                className="mt-4 rounded-terminal font-terminal"
                onClick={() => handleBuyClick()}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t.addTransaction}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-terminal hover:bg-transparent">
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
                    <SortableHeader field="realizedProfitLossPercent">
                      {t.realizedProfitLossPercent}
                    </SortableHeader>
                    <TableHead className="text-center border-r-0 font-terminal text-terminal-muted">
                      {t.actions}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedAssets.map((asset) => {
                    if (!asset) return null;

                    const profitLoss = asset.profitLoss || 0;
                    const profitLossPercentage =
                      asset.profitLossPercentage || 0;
                    const isPositive = profitLoss >= 0;
                    const totalSoldCost = asset.totalSoldCost || 0;
                    const hasSellHistory = totalSoldCost > 0;
                    const realizedPercentage =
                      asset.realizedProfitLossPercentage || 0;
                    const isRealizedPositive = realizedPercentage >= 0;

                    return (
                      <TableRow
                        key={asset.symbol}
                        className="cursor-pointer border-b border-terminal hover:bg-terminal-hover"
                        onClick={() => handleAssetClick(asset)}
                      >
                        <TableCell className="font-medium border-r border-terminal text-center text-terminal py-1 px-2">
                          {asset.name}
                        </TableCell>
                        <TableCell className="border-r border-terminal text-center py-1 px-2">
                          <div className="flex justify-center">
                            <Badge
                              variant="outline"
                              className="rounded-terminal border-terminal text-terminal-muted font-terminal"
                            >
                              {asset.symbol}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-terminal border-r border-terminal text-terminal py-1 px-2">
                          {formatCurrency(asset.currentPrice || 0)}
                        </TableCell>
                        <TableCell className="text-center font-terminal border-r border-terminal text-terminal py-1 px-2">
                          {formatCurrency(asset.averagePurchasePrice || 0)}
                        </TableCell>
                        <TableCell className="text-center font-terminal border-r border-terminal text-terminal py-1 px-2">
                          {formatNumber(asset.amount || 0)}
                        </TableCell>
                        <TableCell className="text-center font-terminal font-semibold border-r border-terminal text-terminal py-1 px-2">
                          {formatCurrency(
                            (asset.amount || 0) * (asset.currentPrice || 0),
                          )}
                        </TableCell>
                        <TableCell className="text-center font-terminal border-r border-terminal text-terminal py-1 px-2">
                          {formatCurrency(asset.purchaseValue || 0)}
                        </TableCell>
                        <TableCell className="text-center border-r border-terminal py-1 px-2">
                          <div
                            className={`flex items-center justify-center gap-1 font-semibold font-terminal ${isPositive ? "text-terminal-green" : "text-terminal-red"}`}
                          >
                            {isPositive ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {formatCurrency(Math.abs(profitLoss))}
                          </div>
                        </TableCell>
                        <TableCell className="text-center border-r border-terminal py-1 px-2">
                          <div
                            className={`font-medium font-terminal ${isPositive ? "text-terminal-green" : "text-terminal-red"}`}
                          >
                            {formatPercent(profitLossPercentage)}
                          </div>
                        </TableCell>
                        <TableCell className="text-center border-r border-terminal py-1 px-2">
                          {hasSellHistory ? (
                            <div
                              className={`font-medium font-terminal ${isRealizedPositive ? "text-terminal-green" : "text-terminal-red"}`}
                            >
                              {formatPercent(realizedPercentage)}
                            </div>
                          ) : (
                            <div className="font-terminal text-terminal-muted">
                              —
                            </div>
                          )}
                        </TableCell>
                        <TableCell
                          className="text-center py-1 px-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-terminal hover:bg-terminal-green/10"
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
                              className="h-8 w-8 rounded-terminal hover:bg-terminal-red/10"
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
          priorityAssets={priorityAssets}
        />
      )}

      {historyModalOpen && (
        <TransactionHistoryModal
          portfolio={updatedPortfolio || portfolio}
          language={language}
          open={historyModalOpen}
          onClose={handleHistoryModalClose}
          marketData={marketData}
          priorityAssets={priorityAssets}
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
