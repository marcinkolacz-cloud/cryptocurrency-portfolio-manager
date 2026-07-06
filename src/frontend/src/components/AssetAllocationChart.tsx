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

const COLORS = [
  "#10b981", // green
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
        <div className="rounded-lg border bg-background/95 backdrop-blur-sm p-3 shadow-xl">
          <p className="text-sm font-bold mb-2">{data.name}</p>
          <p className="text-sm mb-1">
            {t.value}: {formatCurrency(data.value)}
          </p>
          <p className="text-sm">
            {t.percentage}: {formatPercent(data.percentage)}
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
          fill="currentColor"
          className="text-xs fill-foreground"
        >
          {showPercentage ? `${payload.value}%` : formatCurrency(payload.value)}
        </text>
      </g>
    );
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold">
              {t.assetAllocation}
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant={showPercentage ? "outline" : "default"}
                size="sm"
                onClick={() => setShowPercentage(false)}
              >
                {t.showDollar}
              </Button>
              <Button
                variant={showPercentage ? "default" : "outline"}
                size="sm"
                onClick={() => setShowPercentage(true)}
              >
                {t.showPercentage}
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="h-[400px] flex flex-col items-center justify-center text-center">
            <p className="text-muted-foreground">{t.noAssets}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t.addAssets}</p>
          </div>
        ) : (
          <div className="h-[500px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                  tick={{ fill: "currentColor", fontSize: 12 }}
                  className="fill-foreground"
                />
                <YAxis
                  tick={<CustomYAxisTick />}
                  width={showPercentage ? 60 : 100}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: "20px" }}
                  formatter={() => (showPercentage ? t.percentage : t.value)}
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
