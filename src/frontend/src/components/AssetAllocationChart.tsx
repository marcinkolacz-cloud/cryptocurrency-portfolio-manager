import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Portfolio } from "../backend";

interface AssetAllocationChartProps {
  portfolio: Portfolio;
  language: "pl" | "en";
}

const translations = {
  pl: {
    assetAllocation: "Alokacja aktywów",
    showPercentage: "Pokaż %",
    showDollar: "Pokaż $",
    noAssets: "Brak aktywów do wyświetlenia",
    addAssets: "Dodaj aktywa, aby zobaczyć wykres alokacji",
    value: "Wartość",
    percentage: "Procent",
    symbol: "Symbol",
  },
  en: {
    assetAllocation: "Asset allocation",
    showPercentage: "Show %",
    showDollar: "Show $",
    noAssets: "No assets to display",
    addAssets: "Add assets to see allocation chart",
    value: "Value",
    percentage: "Percentage",
    symbol: "Symbol",
  },
};

// Terminal palette: first color shifted to neon green for consistency with PortfolioChart.
// Color assignment order is unchanged — only hex values updated.
const COLORS = [
  "#00ff88", // terminal green
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
  "#6366f1", // indigo
  "#84cc16", // lime
];

export default function AssetAllocationChart({
  portfolio,
  language,
}: AssetAllocationChartProps) {
  const t = translations[language];
  const [showPercentage, setShowPercentage] = useState(false);

  const chartData = useMemo(() => {
    if (!portfolio?.assets) return [];

    const activeAssets = portfolio.assets.filter((asset) => {
      if (!asset) return false;
      const amount = asset.amount || 0;
      return amount > 0.00000001;
    });

    if (activeAssets.length === 0) return [];

    const totalValue = activeAssets.reduce((sum, asset) => {
      const amount = asset.amount || 0;
      const currentPrice = asset.currentPrice || 0;
      return sum + amount * currentPrice;
    }, 0);

    return activeAssets
      .map((asset) => {
        const value = (asset.amount || 0) * (asset.currentPrice || 0);
        const percentage = totalValue > 0 ? (value / totalValue) * 100 : 0;

        return {
          name: asset.symbol || "Unknown",
          value: value,
          percentage: percentage,
          displayValue: showPercentage ? percentage : value,
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [portfolio, showPercentage]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(language === "pl" ? "pl-PL" : "en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${new Intl.NumberFormat(language === "pl" ? "pl-PL" : "en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)}%`;
  };

  const hasData = chartData.length > 0;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-md border border-terminal bg-terminal-card p-3 shadow-xl">
          <p className="font-terminal text-xs font-bold text-terminal mb-2">
            {data.name}
          </p>
          <p className="font-terminal text-xs text-terminal-muted mb-1">
            {t.value}:{" "}
            <span className="text-terminal">{formatCurrency(data.value)}</span>
          </p>
          <p className="font-terminal text-xs text-terminal-muted">
            {t.percentage}:{" "}
            <span className="text-terminal">
              {formatPercent(data.percentage)}
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomYAxisTick = ({ x, y, payload }: any) => {
    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={0}
          y={0}
          dy={4}
          textAnchor="end"
          fill="rgba(0,255,136,0.75)"
          className="font-terminal text-xs"
          style={{ fontFamily: "var(--font-mono-terminal)" }}
        >
          {showPercentage ? `${payload.value}%` : formatCurrency(payload.value)}
        </text>
      </g>
    );
  };

  return (
    <Card className="border border-terminal bg-terminal-card p-3">
      <CardHeader className="gap-2 p-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold text-terminal">
            {t.assetAllocation}
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant={showPercentage ? "outline" : "default"}
              size="sm"
              onClick={() => setShowPercentage(false)}
              className="font-terminal"
            >
              {t.showDollar}
            </Button>
            <Button
              variant={showPercentage ? "default" : "outline"}
              size="sm"
              onClick={() => setShowPercentage(true)}
              className="font-terminal"
            >
              {t.showPercentage}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3">
        {!hasData ? (
          <div className="h-[400px] flex flex-col items-center justify-center text-center bg-terminal">
            <p className="text-terminal-muted font-terminal text-sm">
              {t.noAssets}
            </p>
            <p className="mt-2 font-terminal text-xs text-terminal-muted">
              {t.addAssets}
            </p>
          </div>
        ) : (
          <div className="h-[500px] w-full bg-terminal">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid stroke="rgba(0,255,136,0.08)" strokeWidth={1} />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                  stroke="rgba(0,255,136,0.45)"
                  tick={{
                    fill: "rgba(0,255,136,0.75)",
                    fontSize: 11,
                    fontFamily: "var(--font-mono-terminal)",
                  }}
                />
                <YAxis
                  tick={<CustomYAxisTick />}
                  width={showPercentage ? 60 : 100}
                  stroke="rgba(0,255,136,0.45)"
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: "8px" }}
                  formatter={(value) => (
                    <span className="font-terminal text-xs">{value}</span>
                  )}
                />
                <Bar
                  dataKey="displayValue"
                  name={showPercentage ? t.percentage : t.value}
                  radius={[8, 8, 0, 0]}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${entry.name}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
