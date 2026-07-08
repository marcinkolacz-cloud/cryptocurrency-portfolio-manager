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

interface ChartPoint {
  date: number;
  totalValue: number;
  totalProfitLoss: number;
  unrealizedProfitLoss: number;
  totalPurchaseValue: number;
}

interface LineConfig {
  key: keyof Omit<ChartPoint, "date">;
  name: string;
  color: string;
  gradientId: string;
  strokeWidth: number;
}

const translations = {
  pl: {
    portfolioValue: "Wartość portfela w czasie",
    portfolioValueOverTime: "Wartość portfela w czasie",
    profitLossOverTime: "Zysk/strata w czasie",
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
    portfolioValueOverTime: "Portfolio value over time",
    profitLossOverTime: "Profit/loss over time",
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

// Terminal ticker palette: neon green for value/profit, red for loss.
// Other series keep distinct hues but stay saturated against the dark canvas.
const LINE_COLORS = {
  totalValue: "#00ff88",
  totalProfitLoss: "#00ff88",
  unrealizedProfitLoss: "#ff3b30",
  totalPurchaseValue: "#3b82f6",
} as const;

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

  const chartData = useMemo<ChartPoint[]>(() => {
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
    const dataPoints: ChartPoint[] = [];

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

  const rangeButtons: { key: DateRange; label: string }[] = [
    { key: "7d", label: t.range7d },
    { key: "30d", label: t.range30d },
    { key: "90d", label: t.range90d },
    { key: "ytd", label: t.rangeYtd },
    { key: "max", label: t.rangeMax },
  ];

  const handleRangeChange = (range: DateRange) => {
    setDateRange(range);
    setSelectedDate(undefined);
  };

  return (
    <div className="space-y-2">
      {/* Compact period-filter toolbar — no title (title lives on the ValueChart card) */}
      <Card className="rounded-terminal border border-terminal bg-terminal-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          {rangeButtons.map((btn) => (
            <Button
              key={btn.key}
              variant={dateRange === btn.key ? "default" : "outline"}
              size="sm"
              onClick={() => handleRangeChange(btn.key)}
              className="rounded-terminal font-terminal"
            >
              {btn.label}
            </Button>
          ))}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="rounded-terminal font-terminal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "PPP") : t.selectDate}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto rounded-terminal p-0"
              align="start"
            >
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
      </Card>

      {/* Chart 1: Portfolio value over time */}
      <ValueChart
        title={t.portfolioValueOverTime}
        data={filteredChartData}
        hasData={hasData}
        showTotalValue={showTotalValue}
        showTotalPurchaseValue={showTotalPurchaseValue}
        onToggleTotalValue={(v) => setShowTotalValue(v)}
        onToggleTotalPurchaseValue={(v) => setShowTotalPurchaseValue(v)}
        showTotalValueLabel={t.showTotalValue}
        showTotalPurchaseValueLabel={t.showTotalPurchaseValue}
        totalValueName={t.totalValue}
        totalPurchaseValueName={t.totalPurchaseValue}
        formatCurrency={formatCurrency}
        noDataLabel={t.noData}
      />

      {/* Chart 2: Profit/loss over time */}
      <ProfitLossChart
        title={t.profitLossOverTime}
        data={filteredChartData}
        hasData={hasData}
        showTotalProfitLoss={showTotalProfitLoss}
        showUnrealizedProfitLoss={showUnrealizedProfitLoss}
        onToggleTotalProfitLoss={(v) => setShowTotalProfitLoss(v)}
        onToggleUnrealizedProfitLoss={(v) => setShowUnrealizedProfitLoss(v)}
        showTotalProfitLossLabel={t.showTotalProfitLoss}
        showUnrealizedProfitLossLabel={t.showUnrealizedProfitLoss}
        totalProfitLossName={t.totalProfitLoss}
        unrealizedProfitLossName={t.unrealizedProfitLoss}
        formatCurrency={formatCurrency}
        noDataLabel={t.noData}
      />
    </div>
  );
}

/* ---------- Shared chart sub-components ---------- */

interface ValueChartProps {
  title: string;
  data: ChartPoint[];
  hasData: boolean;
  showTotalValue: boolean;
  showTotalPurchaseValue: boolean;
  onToggleTotalValue: (checked: boolean) => void;
  onToggleTotalPurchaseValue: (checked: boolean) => void;
  showTotalValueLabel: string;
  showTotalPurchaseValueLabel: string;
  totalValueName: string;
  totalPurchaseValueName: string;
  formatCurrency: (value: number) => string;
  noDataLabel: string;
}

function ValueChart({
  title,
  data,
  hasData,
  showTotalValue,
  showTotalPurchaseValue,
  onToggleTotalValue,
  onToggleTotalPurchaseValue,
  showTotalValueLabel,
  showTotalPurchaseValueLabel,
  totalValueName,
  totalPurchaseValueName,
  formatCurrency,
  noDataLabel,
}: ValueChartProps) {
  const lines: LineConfig[] = [
    {
      key: "totalValue",
      name: totalValueName,
      color: LINE_COLORS.totalValue,
      gradientId: "colorTotalValue",
      strokeWidth: 1.5,
    },
    {
      key: "totalPurchaseValue",
      name: totalPurchaseValueName,
      color: LINE_COLORS.totalPurchaseValue,
      gradientId: "colorPurchaseValue",
      strokeWidth: 1.5,
    },
  ];

  const visibleLines = lines.filter((line) => {
    if (line.key === "totalValue") return showTotalValue;
    return showTotalPurchaseValue;
  });

  const { yAxisMin, yAxisMax } = useYAxisDomain(data, visibleLines);

  return (
    <Card className="rounded-terminal border border-terminal bg-terminal-card p-3">
      <CardHeader className="gap-2 p-3">
        <CardTitle className="text-base font-bold text-terminal">
          {title}
        </CardTitle>
        <div className="flex flex-wrap gap-4">
          <CheckboxLine
            id="show-total-value"
            checked={showTotalValue}
            onCheckedChange={onToggleTotalValue}
            label={showTotalValueLabel}
            color={LINE_COLORS.totalValue}
            bold
          />
          <CheckboxLine
            id="show-purchase-value"
            checked={showTotalPurchaseValue}
            onCheckedChange={onToggleTotalPurchaseValue}
            label={showTotalPurchaseValueLabel}
            color={LINE_COLORS.totalPurchaseValue}
          />
        </div>
      </CardHeader>
      <CardContent className="p-3">
        <ChartCanvas
          data={data}
          hasData={hasData}
          visibleLines={visibleLines}
          yAxisMin={yAxisMin}
          yAxisMax={yAxisMax}
          formatCurrency={formatCurrency}
          noDataLabel={noDataLabel}
        />
      </CardContent>
    </Card>
  );
}

interface ProfitLossChartProps {
  title: string;
  data: ChartPoint[];
  hasData: boolean;
  showTotalProfitLoss: boolean;
  showUnrealizedProfitLoss: boolean;
  onToggleTotalProfitLoss: (checked: boolean) => void;
  onToggleUnrealizedProfitLoss: (checked: boolean) => void;
  showTotalProfitLossLabel: string;
  showUnrealizedProfitLossLabel: string;
  totalProfitLossName: string;
  unrealizedProfitLossName: string;
  formatCurrency: (value: number) => string;
  noDataLabel: string;
}

function ProfitLossChart({
  title,
  data,
  hasData,
  showTotalProfitLoss,
  showUnrealizedProfitLoss,
  onToggleTotalProfitLoss,
  onToggleUnrealizedProfitLoss,
  showTotalProfitLossLabel,
  showUnrealizedProfitLossLabel,
  totalProfitLossName,
  unrealizedProfitLossName,
  formatCurrency,
  noDataLabel,
}: ProfitLossChartProps) {
  const lines: LineConfig[] = [
    {
      key: "totalProfitLoss",
      name: totalProfitLossName,
      color: LINE_COLORS.totalProfitLoss,
      gradientId: "colorTotalPL",
      strokeWidth: 1.5,
    },
    {
      key: "unrealizedProfitLoss",
      name: unrealizedProfitLossName,
      color: LINE_COLORS.unrealizedProfitLoss,
      gradientId: "colorUnrealizedPL",
      strokeWidth: 1.5,
    },
  ];

  const visibleLines = lines.filter((line) => {
    if (line.key === "totalProfitLoss") return showTotalProfitLoss;
    return showUnrealizedProfitLoss;
  });

  const { yAxisMin, yAxisMax } = useYAxisDomain(data, visibleLines);

  return (
    <Card className="rounded-terminal border border-terminal bg-terminal-card p-3">
      <CardHeader className="gap-2 p-3">
        <CardTitle className="text-base font-bold text-terminal">
          {title}
        </CardTitle>
        <div className="flex flex-wrap gap-4">
          <CheckboxLine
            id="show-total-pl"
            checked={showTotalProfitLoss}
            onCheckedChange={onToggleTotalProfitLoss}
            label={showTotalProfitLossLabel}
            color={LINE_COLORS.totalProfitLoss}
            bold
          />
          <CheckboxLine
            id="show-unrealized-pl"
            checked={showUnrealizedProfitLoss}
            onCheckedChange={onToggleUnrealizedProfitLoss}
            label={showUnrealizedProfitLossLabel}
            color={LINE_COLORS.unrealizedProfitLoss}
          />
        </div>
      </CardHeader>
      <CardContent className="p-3">
        <ChartCanvas
          data={data}
          hasData={hasData}
          visibleLines={visibleLines}
          yAxisMin={yAxisMin}
          yAxisMax={yAxisMax}
          formatCurrency={formatCurrency}
          noDataLabel={noDataLabel}
        />
      </CardContent>
    </Card>
  );
}

interface CheckboxLineProps {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  color: string;
  bold?: boolean;
}

function CheckboxLine({
  id,
  checked,
  onCheckedChange,
  label,
  color,
  bold = false,
}: CheckboxLineProps) {
  return (
    <div className="flex items-center space-x-2">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(c) => onCheckedChange(c === true)}
      />
      <Label
        htmlFor={id}
        className={`font-terminal text-xs ${bold ? "font-bold" : "font-medium"} leading-none cursor-pointer`}
        style={{ color }}
      >
        {label}
      </Label>
    </div>
  );
}

interface ChartCanvasProps {
  data: ChartPoint[];
  hasData: boolean;
  visibleLines: LineConfig[];
  yAxisMin: number;
  yAxisMax: number;
  formatCurrency: (value: number) => string;
  noDataLabel: string;
}

function ChartCanvas({
  data,
  hasData,
  visibleLines,
  yAxisMin,
  yAxisMax,
  formatCurrency,
  noDataLabel,
}: ChartCanvasProps) {
  if (!hasData) {
    return (
      <div className="flex h-[400px] w-full items-center justify-center text-terminal-muted font-terminal text-sm">
        {noDataLabel}
      </div>
    );
  }

  return (
    <div className="h-[400px] w-full bg-terminal">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid
            stroke="rgba(16,185,129,0.12)"
            strokeDasharray="2 2"
            strokeWidth={1}
            vertical={true}
            horizontal={true}
          />
          <XAxis
            dataKey="date"
            tickFormatter={(timestamp) => format(new Date(timestamp), "MMM d")}
            stroke="rgba(0,255,136,0.45)"
            tick={{
              fontSize: 11,
              fontFamily: "var(--font-mono-terminal)",
              fill: "rgba(0,255,136,0.75)",
            }}
          />
          <YAxis
            tickFormatter={(value) => formatCurrency(value)}
            domain={[yAxisMin, yAxisMax]}
            stroke="rgba(0,255,136,0.45)"
            tick={{
              fontSize: 11,
              fontFamily: "var(--font-mono-terminal)",
              fill: "rgba(0,255,136,0.75)",
            }}
            label={{
              value: "USD ($)",
              angle: -90,
              position: "insideLeft",
              className: "chart-axis-label-terminal",
              style: {
                textAnchor: "middle",
                fontSize: "11px",
                fontWeight: 600,
              },
            }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const point = payload[0]?.payload as ChartPoint | undefined;
                return (
                  <div className="rounded-terminal border border-terminal bg-terminal-card p-3 shadow-xl">
                    <p className="font-terminal text-xs text-terminal-muted mb-2">
                      {format(new Date(point?.date || Date.now()), "PPP")}
                    </p>
                    {visibleLines.map((line) => (
                      <p
                        key={line.key}
                        className="font-terminal text-xs font-bold mb-1 last:mb-0"
                        style={{ color: line.color }}
                      >
                        {line.name}: {formatCurrency(point?.[line.key] || 0)}
                      </p>
                    ))}
                  </div>
                );
              }
              return null;
            }}
          />
          <Legend
            wrapperStyle={{ paddingTop: "8px" }}
            iconType="line"
            formatter={(value) => (
              <span className="font-terminal text-xs">{value}</span>
            )}
          />
          {visibleLines.map((line) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              name={line.name}
              stroke={line.color}
              strokeWidth={line.strokeWidth}
              dot={false}
              connectNulls
              activeDot={{ r: 4, strokeWidth: 1 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function useYAxisDomain(
  data: ChartPoint[],
  visibleLines: LineConfig[],
): { yAxisMin: number; yAxisMax: number } {
  return useMemo(() => {
    if (data.length === 0 || visibleLines.length === 0) {
      return { yAxisMin: 0, yAxisMax: 100 };
    }

    const allValues = data.flatMap((d) =>
      visibleLines.map((line) => d[line.key] || 0),
    );

    if (allValues.length === 0) {
      return { yAxisMin: 0, yAxisMax: 100 };
    }

    const maxValue = Math.max(...allValues);
    const minValue = Math.min(...allValues);

    if (minValue === 0 && maxValue === 0) {
      return { yAxisMin: 0, yAxisMax: 100 };
    }

    const yAxisMin = minValue < 0 ? minValue * 1.1 : minValue * 0.95;
    const yAxisMax = maxValue * 1.05;

    return { yAxisMin, yAxisMax };
  }, [data, visibleLines]);
}
