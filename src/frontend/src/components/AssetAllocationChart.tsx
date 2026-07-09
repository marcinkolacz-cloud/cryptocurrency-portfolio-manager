import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTheme } from "next-themes";
import { useMemo, useState } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
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
// Light theme tones the first color down to a readable green on white.
const DARK_COLORS = [
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

const LIGHT_COLORS = [
  "#16a34a", // green
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

interface AllocationPalette {
  colors: string[];
  labelFill: string;
}

function useAllocationPalette(): AllocationPalette {
  const { resolvedTheme } = useTheme();
  if (resolvedTheme === "light") {
    return { colors: LIGHT_COLORS, labelFill: "#1a1a1a" };
  }
  return { colors: DARK_COLORS, labelFill: "rgba(255,255,255,0.92)" };
}

// Slices below this percentage get no inline label — they are too small to read
// and would clutter the chart. Exact values remain available in the list below.
const INLINE_LABEL_MIN_PERCENT = 5;

export default function AssetAllocationChart({
  portfolio,
  language,
}: AssetAllocationChartProps) {
  const t = translations[language];
  const palette = useAllocationPalette();
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
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value)}%`;
  };

  const hasData = chartData.length > 0;

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{
      payload: { name: string; value: number; percentage: number };
    }>;
  }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-terminal border border-terminal bg-terminal-card p-3 shadow-xl">
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

  // Inline label rendered next to each slice. Only shown for slices large
  // enough to read (>= INLINE_LABEL_MIN_PERCENT). Honors the $/% toggle.
  // Explicit fontSize bumps the label above recharts' ~11px default for
  // better readability alongside the larger list rows and legend.
  const renderInlineLabel = (entry: {
    name: string;
    value: number;
    percentage: number;
  }) => {
    if (entry.percentage < INLINE_LABEL_MIN_PERCENT) return "";
    const text = showPercentage
      ? formatPercent(entry.percentage)
      : formatCurrency(entry.value);
    return (
      <tspan fontSize={13} fill={palette.labelFill} style={{ font: "inherit" }}>
        {text}
      </tspan>
    );
  };

  return (
    <Card className="flex h-full flex-col rounded-terminal border border-terminal bg-terminal-card p-3">
      <CardHeader className="gap-2 p-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold text-terminal">
            {t.assetAllocation}
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant={showPercentage ? "outline" : "default"}
              size="sm"
              onClick={() => setShowPercentage(false)}
              data-ocid="allocation.show_dollar.toggle"
              className="rounded-terminal font-terminal"
            >
              {t.showDollar}
            </Button>
            <Button
              variant={showPercentage ? "default" : "outline"}
              size="sm"
              onClick={() => setShowPercentage(true)}
              data-ocid="allocation.show_percentage.toggle"
              className="rounded-terminal font-terminal"
            >
              {t.showPercentage}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2 p-2">
        {!hasData ? (
          <div className="flex h-[400px] flex-col items-center justify-center text-center bg-terminal">
            <p className="text-terminal-muted font-terminal text-sm">
              {t.noAssets}
            </p>
            <p className="mt-2 font-terminal text-xs text-terminal-muted">
              {t.addAssets}
            </p>
          </div>
        ) : (
          <>
            {/* Donut chart — fixed comfortable height; list below fills the rest */}
            <div className="h-[280px] w-full bg-terminal">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ paddingTop: "4px", fontSize: "13px" }}
                    formatter={(value) => (
                      <span className="font-terminal text-sm text-terminal">
                        {value}
                      </span>
                    )}
                  />
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius="55%"
                    outerRadius="85%"
                    paddingAngle={1}
                    stroke="var(--terminal-card)"
                    strokeWidth={1}
                    isAnimationActive={false}
                    label={renderInlineLabel}
                    labelLine={{
                      stroke: palette.labelFill,
                      strokeWidth: 1,
                    }}
                  >
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${entry.name}`}
                        fill={palette.colors[index % palette.colors.length]}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Compact asset list — fills remaining vertical space naturally.
                Grows with available height; scrolls only if many assets overflow. */}
            <div
              className="flex-1 overflow-y-auto border border-terminal bg-terminal"
              data-ocid="allocation.list"
            >
              <div className="flex flex-col">
                {chartData.map((entry, index) => (
                  <div
                    key={entry.name}
                    data-ocid={`allocation.list.item.${index + 1}`}
                    className="flex items-center gap-2 border-b border-terminal px-2 py-1.5 last:border-b-0 hover:bg-terminal-hover"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-terminal"
                      style={{
                        backgroundColor:
                          palette.colors[index % palette.colors.length],
                      }}
                      aria-hidden="true"
                    />
                    <span className="font-terminal text-sm font-bold text-terminal w-16 shrink-0 truncate">
                      {entry.name}
                    </span>
                    <span className="font-terminal text-sm text-terminal flex-1 text-right tabular-nums truncate">
                      {formatCurrency(entry.value)}
                    </span>
                    <span className="font-terminal text-sm text-terminal-muted w-16 shrink-0 text-right tabular-nums">
                      {formatPercent(entry.percentage)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
