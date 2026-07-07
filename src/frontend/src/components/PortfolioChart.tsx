import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format, startOfYear, subDays } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MarketData, Portfolio } from "../backend";

interface PortfolioChartProps {
  portfolio: Portfolio;
  language: "pl" | "en";
  marketData?: MarketData[];
}

type DateRange = "7d" | "30d" | "90d" | "ytd" | "max";

const translations = {
  pl: {
    portfolioValue: "Wartość portfela w czasie",
    value: "Wartość",
    date: "Data",
    noData: "Brak danych do wyświetlenia wykresu",
    totalValue: "Całkowita wartość (aktualna cena rynkowa)",
    totalProfitLoss: "Całkowity zysk/strata portfolio",
    unrealizedProfitLoss: "Niezrealizowany zysk/strata",
    totalPurchaseValue: "Całkowita wartość zakupu",
    addTransactions:
      "Dodaj transakcje, aby zobaczyć wykres wartości portfela w czasie",
    showTotalValue: "Pokaż całkowitą wartość",
    showTotalProfitLoss: "Pokaż całkowity zysk/stratę",
    showUnrealizedProfitLoss: "Pokaż niezrealizowany zysk/stratę",
    showTotalPurchaseValue: "Pokaż całkowitą wartość zakupu",
    range7d: "7 dni",
    range30d: "30 dni",
    range90d: "90 dni",
    rangeYtd: "Od początku roku",
    rangeMax: "Maksymalny",
    selectDate: "Wybierz datę",
  },
  en: {
    portfolioValue: "Portfolio value over time",
    value: "Value",
    date: "Date",
    noData: "No data to display chart",
    totalValue: "Total value (current market price)",
    totalProfitLoss: "Total profit/loss",
    unrealizedProfitLoss: "Unrealized profit/loss",
    totalPurchaseValue: "Total purchase value",
    addTransactions: "Add transactions to see portfolio value chart over time",
    showTotalValue: "Show total value",
    showTotalProfitLoss: "Show total profit/loss",
    showUnrealizedProfitLoss: "Show unrealized profit/loss",
    showTotalPurchaseValue: "Show total purchase value",
    range7d: "7 days",
    range30d: "30 days",
    range90d: "90 days",
    rangeYtd: "Year to date",
    rangeMax: "Max",
    selectDate: "Select date",
  },
};

export default function PortfolioChart({
  portfolio,
  language,
  marketData,
}: PortfolioChartProps) {
  const t = translations[language];
  const [showTotalValue, setShowTotalValue] = useState(true);
  const [showTotalProfitLoss, setShowTotalProfitLoss] = useState(true);
  const [showUnrealizedProfitLoss, setShowUnrealizedProfitLoss] =
    useState(true);
  const [showTotalPurchaseValue, setShowTotalPurchaseValue] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const priceMap = useMemo(() => {
    const map = new Map<string, number>();
    if (marketData && Array.isArray(marketData)) {
      for (const coin of marketData) {
        if (coin?.symbol && typeof coin.price === "number") {
          map.set(coin.symbol.toUpperCase(), coin.price);
        }
      }
    }
    return map;
  }, [marketData]);

  const chartData = useMemo(() => {
    if (!portfolio) {
      return [];
    }

    const transactions = portfolio.transactions || [];
    const assets = portfolio.assets || [];

    if (!Array.isArray(transactions) || transactions.length === 0) {
      const now = Date.now();
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
      return [
        {
          date: thirtyDaysAgo,
          totalValue: 0,
          totalProfitLoss: 0,
          unrealizedProfitLoss: 0,
          totalPurchaseValue: 0,
        },
        {
          date: now,
          totalValue: 0,
          totalProfitLoss: 0,
          unrealizedProfitLoss: 0,
          totalPurchaseValue: 0,
        },
      ];
    }

    const sortedTransactions = [...transactions].sort((a, b) =>
      Number((a?.date || 0n) - (b?.date || 0n)),
    );

    const holdings = new Map<
      string,
      { amount: number; avgPrice: number; totalCost: number }
    >();
    const dataPoints: Array<{
      date: number;
      totalValue: number;
      totalProfitLoss: number;
      unrealizedProfitLoss: number;
      totalPurchaseValue: number;
    }> = [];

    let cumulativeRealizedPL = 0;
    let cumulativePurchaseValue = 0;

    for (const tx of sortedTransactions) {
      if (!tx) continue;

      const symbol = (tx.assetSymbol || "").toUpperCase();
      const holding = holdings.get(symbol) || {
        amount: 0,
        avgPrice: 0,
        totalCost: 0,
      };
      const txAmount = tx.amount || 0;
      const txPrice = tx.price || 0;

      if (tx.type === "buy") {
        cumulativePurchaseValue += txAmount * txPrice;
        const newAmount = holding.amount + txAmount;
        const newTotalCost = holding.totalCost + txAmount * txPrice;
        const newAvgPrice = newAmount > 0 ? newTotalCost / newAmount : 0;
        holdings.set(symbol, {
          amount: newAmount,
          avgPrice: newAvgPrice,
          totalCost: newTotalCost,
        });
      } else if (tx.type === "sell") {
        const sellValue = txAmount * txPrice;
        const costBasis = txAmount * holding.avgPrice;
        const realizedPL = sellValue - costBasis;
        cumulativeRealizedPL += realizedPL;

        const newAmount = Math.max(0, holding.amount - txAmount);
        const newTotalCost = Math.max(0, holding.totalCost - costBasis);
        holdings.set(symbol, {
          amount: newAmount,
          avgPrice: holding.avgPrice,
          totalCost: newTotalCost,
        });
      }

      let totalValue = 0;
      let totalInvested = 0;
      for (const [sym, h] of holdings) {
        if (h.amount > 0) {
          const currentPrice = priceMap.get(sym) || h.avgPrice;
          totalValue += h.amount * currentPrice;
          totalInvested += h.totalCost;
        }
      }

      const unrealizedPL = totalValue - totalInvested;
      const totalPL = cumulativeRealizedPL + unrealizedPL;

      dataPoints.push({
        date: Number(tx.date || 0n) / 1000000,
        totalValue,
        totalProfitLoss: totalPL,
        unrealizedProfitLoss: unrealizedPL,
        totalPurchaseValue: cumulativePurchaseValue,
      });
    }

    if (Array.isArray(assets) && assets.length > 0) {
      let currentValue = 0;
      let currentInvested = 0;

      for (const asset of assets) {
        if (asset && (asset.amount || 0) > 0) {
          const currentPrice =
            priceMap.get(asset.symbol?.toUpperCase() || "") ||
            asset.currentPrice ||
            0;
          currentValue += (asset.amount || 0) * currentPrice;
          currentInvested += (asset.amount || 0) * (asset.averagePrice || 0);
        }
      }

      const currentUnrealizedPL = currentValue - currentInvested;
      const currentTotalPL = cumulativeRealizedPL + currentUnrealizedPL;

      dataPoints.push({
        date: Date.now(),
        totalValue: currentValue,
        totalProfitLoss: currentTotalPL,
        unrealizedProfitLoss: currentUnrealizedPL,
        totalPurchaseValue: cumulativePurchaseValue,
      });
    }

    if (dataPoints.length === 1) {
      const singlePoint = dataPoints[0];
      dataPoints.unshift({
        date: singlePoint.date - 3600000,
        totalValue: singlePoint.totalValue,
        totalProfitLoss: singlePoint.totalProfitLoss,
        unrealizedProfitLoss: singlePoint.unrealizedProfitLoss,
        totalPurchaseValue: singlePoint.totalPurchaseValue,
      });
    }

    return dataPoints;
  }, [portfolio, priceMap]);

  const filteredChartData = useMemo(() => {
    if (selectedDate) {
      const selectedTime = selectedDate.getTime();
      return chartData.filter((point) => point.date <= selectedTime);
    }

    if (dateRange === "max") return chartData;

    const now = Date.now();
    let cutoffDate: number;

    switch (dateRange) {
      case "7d":
        cutoffDate = subDays(now, 7).getTime();
        break;
      case "30d":
        cutoffDate = subDays(now, 30).getTime();
        break;
      case "90d":
        cutoffDate = subDays(now, 90).getTime();
        break;
      case "ytd":
        cutoffDate = startOfYear(now).getTime();
        break;
      default:
        return chartData;
    }

    const filtered = chartData.filter((point) => point.date >= cutoffDate);

    if (filtered.length === 0 && chartData.length > 0) {
      return [chartData[chartData.length - 1]];
    }

    if (filtered.length === 1) {
      return [
        { ...filtered[0], date: filtered[0].date - 3600000 },
        filtered[0],
      ];
    }

    return filtered;
  }, [chartData, dateRange, selectedDate]);

  const formatCurrency = (value: number) => {
    return `$${new Intl.NumberFormat(language === "pl" ? "pl-PL" : "en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)}`;
  };

  const hasData = filteredChartData.length > 0;
  const allValues = filteredChartData.flatMap((d) =>
    [
      showTotalValue ? d.totalValue || 0 : null,
      showTotalProfitLoss ? d.totalProfitLoss || 0 : null,
      showUnrealizedProfitLoss ? d.unrealizedProfitLoss || 0 : null,
      showTotalPurchaseValue ? d.totalPurchaseValue || 0 : null,
    ].filter((v): v is number => v !== null),
  );

  const maxValue =
    hasData && allValues.length > 0 ? Math.max(...allValues) : 100;
  const minValue = hasData && allValues.length > 0 ? Math.min(...allValues) : 0;

  const yAxisMin =
    minValue === 0 && maxValue === 0
      ? 0
      : minValue < 0
        ? minValue * 1.1
        : minValue * 0.95;
  const yAxisMax = minValue === 0 && maxValue === 0 ? 100 : maxValue * 1.05;

  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex flex-col gap-4">
          <CardTitle className="text-xl font-bold">
            {t.portfolioValue}
          </CardTitle>

          <div className="flex flex-wrap gap-2">
            <Button
              variant={dateRange === "7d" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setDateRange("7d");
                setSelectedDate(undefined);
              }}
            >
              {t.range7d}
            </Button>
            <Button
              variant={dateRange === "30d" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setDateRange("30d");
                setSelectedDate(undefined);
              }}
            >
              {t.range30d}
            </Button>
            <Button
              variant={dateRange === "90d" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setDateRange("90d");
                setSelectedDate(undefined);
              }}
            >
              {t.range90d}
            </Button>
            <Button
              variant={dateRange === "ytd" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setDateRange("ytd");
                setSelectedDate(undefined);
              }}
            >
              {t.rangeYtd}
            </Button>
            <Button
              variant={dateRange === "max" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setDateRange("max");
                setSelectedDate(undefined);
              }}
            >
              {t.rangeMax}
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : t.selectDate}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date);
                    setDateRange("max");
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-total-value"
                checked={showTotalValue}
                onCheckedChange={(checked) =>
                  setShowTotalValue(checked === true)
                }
              />
              <Label
                htmlFor="show-total-value"
                className="text-sm font-bold leading-none cursor-pointer"
                style={{ color: "#10b981" }}
              >
                {t.showTotalValue}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-total-pl"
                checked={showTotalProfitLoss}
                onCheckedChange={(checked) =>
                  setShowTotalProfitLoss(checked === true)
                }
              />
              <Label
                htmlFor="show-total-pl"
                className="text-sm font-medium leading-none cursor-pointer"
                style={{ color: "oklch(0.646 0.222 145)" }}
              >
                {t.showTotalProfitLoss}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-unrealized-pl"
                checked={showUnrealizedProfitLoss}
                onCheckedChange={(checked) =>
                  setShowUnrealizedProfitLoss(checked === true)
                }
              />
              <Label
                htmlFor="show-unrealized-pl"
                className="text-sm font-medium leading-none cursor-pointer"
                style={{ color: "oklch(0.6 0.118 220)" }}
              >
                {t.showUnrealizedProfitLoss}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-purchase-value"
                checked={showTotalPurchaseValue}
                onCheckedChange={(checked) =>
                  setShowTotalPurchaseValue(checked === true)
                }
              />
              <Label
                htmlFor="show-purchase-value"
                className="text-sm font-medium leading-none cursor-pointer"
                style={{ color: "oklch(0.65 0.24 300)" }}
              >
                {t.showTotalPurchaseValue}
              </Label>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={filteredChartData}>
              <defs>
                <linearGradient
                  id="colorTotalValue"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorTotalPL" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="oklch(0.646 0.222 145)"
                    stopOpacity={0.1}
                  />
                  <stop
                    offset="95%"
                    stopColor="oklch(0.646 0.222 145)"
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient
                  id="colorUnrealizedPL"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor="oklch(0.6 0.118 220)"
                    stopOpacity={0.1}
                  />
                  <stop
                    offset="95%"
                    stopColor="oklch(0.6 0.118 220)"
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient
                  id="colorPurchaseValue"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor="oklch(0.65 0.24 300)"
                    stopOpacity={0.1}
                  />
                  <stop
                    offset="95%"
                    stopColor="oklch(0.65 0.24 300)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                className="chart-grid-light dark:chart-grid-dark"
                vertical={true}
                horizontal={true}
              />
              <XAxis
                dataKey="date"
                tickFormatter={(timestamp) =>
                  format(new Date(timestamp), "MMM d")
                }
                className="chart-axis-light dark:chart-axis-dark"
                tick={{ fontSize: 12 }}
              />
              <YAxis
                tickFormatter={(value) => formatCurrency(value)}
                className="chart-axis-light dark:chart-axis-dark"
                domain={[yAxisMin, yAxisMax]}
                tick={{ fontSize: 12 }}
                label={{
                  value: "USD ($)",
                  angle: -90,
                  position: "insideLeft",
                  className:
                    "chart-axis-label-light dark:chart-axis-label-dark",
                  style: {
                    textAnchor: "middle",
                    fontSize: "12px",
                    fontWeight: 600,
                  },
                }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg border bg-background/95 backdrop-blur-sm p-3 shadow-xl">
                        <p className="text-sm font-medium mb-2">
                          {format(
                            new Date(payload[0]?.payload?.date || Date.now()),
                            "PPP",
                          )}
                        </p>
                        {showTotalValue && (
                          <p
                            className="text-sm font-bold mb-1"
                            style={{ color: "#10b981" }}
                          >
                            {t.totalValue}:{" "}
                            {formatCurrency(
                              payload[0]?.payload?.totalValue || 0,
                            )}
                          </p>
                        )}
                        {showTotalProfitLoss && (
                          <p
                            className="text-sm font-bold mb-1"
                            style={{ color: "oklch(0.646 0.222 145)" }}
                          >
                            {t.totalProfitLoss}:{" "}
                            {formatCurrency(
                              payload[0]?.payload?.totalProfitLoss || 0,
                            )}
                          </p>
                        )}
                        {showUnrealizedProfitLoss && (
                          <p
                            className="text-sm font-bold mb-1"
                            style={{ color: "oklch(0.6 0.118 220)" }}
                          >
                            {t.unrealizedProfitLoss}:{" "}
                            {formatCurrency(
                              payload[0]?.payload?.unrealizedProfitLoss || 0,
                            )}
                          </p>
                        )}
                        {showTotalPurchaseValue && (
                          <p
                            className="text-sm font-bold"
                            style={{ color: "oklch(0.65 0.24 300)" }}
                          >
                            {t.totalPurchaseValue}:{" "}
                            {formatCurrency(
                              payload[0]?.payload?.totalPurchaseValue || 0,
                            )}
                          </p>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend wrapperStyle={{ paddingTop: "20px" }} iconType="line" />
              {showTotalValue && (
                <Line
                  type="monotone"
                  dataKey="totalValue"
                  name={t.totalValue}
                  stroke="#10b981"
                  strokeWidth={4}
                  dot={false}
                  connectNulls
                  activeDot={{ r: 6, strokeWidth: 2 }}
                />
              )}
              {showTotalProfitLoss && (
                <Line
                  type="monotone"
                  dataKey="totalProfitLoss"
                  name={t.totalProfitLoss}
                  stroke="oklch(0.646 0.222 145)"
                  strokeWidth={3}
                  dot={false}
                  connectNulls
                  activeDot={{ r: 6, strokeWidth: 2 }}
                />
              )}
              {showUnrealizedProfitLoss && (
                <Line
                  type="monotone"
                  dataKey="unrealizedProfitLoss"
                  name={t.unrealizedProfitLoss}
                  stroke="oklch(0.6 0.118 220)"
                  strokeWidth={3}
                  dot={false}
                  connectNulls
                  activeDot={{ r: 6, strokeWidth: 2 }}
                />
              )}
              {showTotalPurchaseValue && (
                <Line
                  type="monotone"
                  dataKey="totalPurchaseValue"
                  name={t.totalPurchaseValue}
                  stroke="oklch(0.65 0.24 300)"
                  strokeWidth={3}
                  dot={false}
                  connectNulls
                  activeDot={{ r: 6, strokeWidth: 2 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
