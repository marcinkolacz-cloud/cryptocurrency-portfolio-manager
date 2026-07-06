import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { Loader2, X } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useFetchCoinChartData } from "../hooks/useQueries";

interface AssetChartProps {
  coinId: string;
  symbol: string;
  name: string;
  language: "pl" | "en";
  onClose: () => void;
}

const translations = {
  pl: {
    priceChart: "Wykres ceny",
    last30Days: "Ostatnie 30 dni",
    price: "Cena",
    date: "Data",
    loading: "Ładowanie wykresu...",
    error: "Błąd ładowania danych wykresu",
  },
  en: {
    priceChart: "Price chart",
    last30Days: "Last 30 days",
    price: "Price",
    date: "Date",
    loading: "Loading chart...",
    error: "Error loading chart data",
  },
};

export default function AssetChart({
  coinId,
  symbol,
  name,
  language,
  onClose,
}: AssetChartProps) {
  const { data, isLoading, isError } = useFetchCoinChartData(coinId);
  const t = translations[language];

  const chartData =
    data?.prices.map(([timestamp, price]) => ({
      date: timestamp,
      price: price,
    })) || [];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(language === "pl" ? "pl-PL" : "en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <Card className="border-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-xl font-bold">
            {symbol} - {name}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t.last30Days}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex h-[300px] items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">{t.loading}</p>
            </div>
          </div>
        )}

        {isError && (
          <div className="flex h-[300px] items-center justify-center">
            <p className="text-sm text-destructive">{t.error}</p>
          </div>
        )}

        {!isLoading && !isError && chartData.length > 0 && (
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(timestamp) =>
                    format(new Date(timestamp), "MMM d")
                  }
                  className="text-xs"
                />
                <YAxis
                  tickFormatter={(value) => `$${value.toFixed(2)}`}
                  className="text-xs"
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded-lg border bg-background p-3 shadow-lg">
                          <p className="text-sm font-medium">
                            {format(new Date(payload[0].payload.date), "PPP")}
                          </p>
                          <p className="text-sm font-bold text-primary">
                            {formatCurrency(payload[0].value as number)}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
