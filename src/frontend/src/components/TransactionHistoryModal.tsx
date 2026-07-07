import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowDownRight,
  ArrowUpDown,
  ArrowUpRight,
  Download,
  FileJson,
  FileSpreadsheet,
  Loader2,
  Pencil,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type {
  MarketData,
  Portfolio,
  PriorityAsset,
  Transaction,
} from "../backend";
import { useDeleteTransaction } from "../hooks/useQueries";
import TransactionEditDialog from "./TransactionEditDialog";

interface TransactionHistoryModalProps {
  portfolio: Portfolio;
  language: "pl" | "en";
  open: boolean;
  onClose: () => void;
  marketData?: MarketData[];
  priorityAssets?: PriorityAsset[];
}

const translations = {
  pl: {
    title: "Historia transakcji",
    subtitle: "Pełna historia wszystkich transakcji kupna i sprzedaży",
    noTransactions: "Brak transakcji",
    noMatching: "Brak pasujących transakcji",
    date: "Data",
    type: "Typ",
    symbol: "Symbol",
    amount: "Ilość",
    price: "Cena $",
    totalValue: "Wartość całkowita $",
    comment: "Komentarz",
    actions: "Akcje",
    buy: "Kup",
    sell: "Sprzedaj",
    exportCsv: "Eksportuj CSV",
    exportJson: "Eksportuj JSON",
    search: "Szukaj po symbolu...",
    filterByType: "Filtruj po typie",
    all: "Wszystkie",
    sortBy: "Sortuj",
    edit: "Edytuj",
    delete: "Usuń",
    deleteConfirmTitle: "Usuń transakcję",
    deleteConfirmDescription:
      "Czy na pewno chcesz usunąć tę transakcję? Ta operacja jest nieodwracalna i zaktualizuje wszystkie powiązane salda i podsumowania.",
    cancel: "Anuluj",
    confirm: "Potwierdź",
    exportSuccess: "Historia transakcji wyeksportowana",
    deleteSuccess: "Transakcja usunięta pomyślnie",
    deleteError: "Błąd podczas usuwania transakcji",
    close: "Zamknij",
    filters: "Filtry",
    dateFrom: "Data od",
    dateTo: "Data do",
    clearFilters: "Wyczyść filtry",
    deleting: "Usuwanie...",
  },
  en: {
    title: "Transaction History",
    subtitle: "Complete history of all buy and sell transactions",
    noTransactions: "No transactions",
    noMatching: "No matching transactions",
    date: "Date",
    type: "Type",
    symbol: "Symbol",
    amount: "Amount",
    price: "Price $",
    totalValue: "Total Value $",
    comment: "Comment",
    actions: "Actions",
    buy: "Buy",
    sell: "Sell",
    exportCsv: "Export CSV",
    exportJson: "Export JSON",
    search: "Search by symbol...",
    filterByType: "Filter by type",
    all: "All",
    sortBy: "Sort",
    edit: "Edit",
    delete: "Delete",
    deleteConfirmTitle: "Delete transaction",
    deleteConfirmDescription:
      "Are you sure you want to delete this transaction? This action cannot be undone and will update all related balances and summaries.",
    cancel: "Cancel",
    confirm: "Confirm",
    exportSuccess: "Transaction history exported",
    deleteSuccess: "Transaction deleted successfully",
    deleteError: "Error deleting transaction",
    close: "Close",
    filters: "Filters",
    dateFrom: "Date from",
    dateTo: "Date to",
    clearFilters: "Clear filters",
    deleting: "Deleting...",
  },
};

type SortField = "date" | "type" | "symbol" | "amount" | "price" | "total";
type SortDirection = "asc" | "desc";

export default function TransactionHistoryModal({
  portfolio,
  language,
  open,
  onClose,
  marketData,
  priorityAssets,
}: TransactionHistoryModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "buy" | "sell">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] =
    useState<Transaction | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [transactionToEdit, setTransactionToEdit] =
    useState<Transaction | null>(null);
  const deleteTransaction = useDeleteTransaction();
  const t = translations[language];

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

  const formatDate = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) / 1000000);
    return new Intl.DateTimeFormat(language === "pl" ? "pl-PL" : "en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const formatDateForCsv = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) / 1000000);
    return date.toISOString();
  };

  const filteredAndSortedTransactions = useMemo(() => {
    let filtered = [...portfolio.transactions];

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (tx) =>
          tx.assetSymbol.toLowerCase().includes(term) ||
          tx.assetName.toLowerCase().includes(term),
      );
    }

    // Apply type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter((tx) => tx.type === typeFilter);
    }

    // Apply date range filter
    if (dateFrom) {
      const fromDate = new Date(dateFrom).getTime() * 1000000;
      filtered = filtered.filter((tx) => Number(tx.date) >= fromDate);
    }
    if (dateTo) {
      const toDate = new Date(dateTo).getTime() * 1000000 + 86400000000000; // Add 1 day
      filtered = filtered.filter((tx) => Number(tx.date) <= toDate);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "date":
          comparison = Number(a.date - b.date);
          break;
        case "type":
          comparison = a.type.localeCompare(b.type);
          break;
        case "symbol":
          comparison = a.assetSymbol.localeCompare(b.assetSymbol);
          break;
        case "amount":
          comparison = a.amount - b.amount;
          break;
        case "price":
          comparison = a.price - b.price;
          break;
        case "total":
          comparison = a.amount * a.price - b.amount * b.price;
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [
    portfolio.transactions,
    searchTerm,
    typeFilter,
    dateFrom,
    dateTo,
    sortField,
    sortDirection,
  ]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setTypeFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  const exportToCsv = () => {
    if (portfolio.transactions.length === 0) {
      toast.error("No transactions to export");
      return;
    }

    const headers = [
      "Date",
      "Type",
      "Symbol",
      "Asset Name",
      "Amount",
      "Price ($)",
      "Total Value ($)",
      "Comment",
    ];
    const rows = filteredAndSortedTransactions.map((tx) => [
      formatDateForCsv(tx.date),
      tx.type,
      tx.assetSymbol,
      tx.assetName,
      tx.amount.toString(),
      tx.price.toString(),
      (tx.amount * tx.price).toString(),
      tx.comment || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `portfolio_${portfolio.name}_transactions_${Date.now()}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(t.exportSuccess);
  };

  const exportToJson = () => {
    if (portfolio.transactions.length === 0) {
      toast.error("No transactions to export");
      return;
    }

    const jsonData = filteredAndSortedTransactions.map((tx) => ({
      date: formatDateForCsv(tx.date),
      type: tx.type,
      symbol: tx.assetSymbol,
      assetName: tx.assetName,
      amount: tx.amount,
      priceUSD: tx.price,
      totalValueUSD: tx.amount * tx.price,
      comment: tx.comment || "",
    }));

    const blob = new Blob([JSON.stringify(jsonData, null, 2)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `portfolio_${portfolio.name}_transactions_${Date.now()}.json`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(t.exportSuccess);
  };

  const handleEdit = (transaction: Transaction) => {
    setTransactionToEdit(transaction);
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (transaction: Transaction) => {
    setTransactionToDelete(transaction);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!transactionToDelete) return;

    try {
      await deleteTransaction.mutateAsync({
        portfolioId: portfolio.id,
        transactionId: transactionToDelete.id,
      });
      toast.success(t.deleteSuccess);
      setDeleteDialogOpen(false);
      setTransactionToDelete(null);
    } catch (error) {
      console.error("Delete transaction error:", error);
      toast.error(t.deleteError);
    }
  };

  const handleEditDialogClose = () => {
    setEditDialogOpen(false);
    setTransactionToEdit(null);
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
      className={`cursor-pointer select-none ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown
          className={`h-3 w-3 ${sortField === field ? "opacity-100" : "opacity-50"}`}
        />
      </div>
    </TableHead>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-[95vw] w-[1400px] max-h-[95vh] p-0 bg-white dark:bg-gray-950 [&>button]:hidden">
          <div
            className="fixed inset-0 z-50 bg-white dark:bg-gray-950"
            style={{ pointerEvents: "none" }}
          />
          <div className="relative z-50 flex flex-col h-[95vh]">
            <DialogHeader className="px-6 pt-6 pb-4 border-b bg-white dark:bg-gray-950 flex-shrink-0">
              <div className="flex items-start justify-between">
                <div>
                  <DialogTitle className="text-2xl font-bold">
                    {t.title}
                  </DialogTitle>
                  <DialogDescription className="mt-1">
                    {t.subtitle}
                  </DialogDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </DialogHeader>

            <div className="px-6 py-4 border-b space-y-4 bg-white dark:bg-gray-950 flex-shrink-0">
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-[200px]">
                  <Label className="text-xs mb-1.5 block">{t.search}</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder={t.search}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="w-[150px]">
                  <Label className="text-xs mb-1.5 block">
                    {t.filterByType}
                  </Label>
                  <Select
                    value={typeFilter}
                    onValueChange={(value) =>
                      setTypeFilter(value as "all" | "buy" | "sell")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t.all}</SelectItem>
                      <SelectItem value="buy">{t.buy}</SelectItem>
                      <SelectItem value="sell">{t.sell}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-[160px]">
                  <Label className="text-xs mb-1.5 block">{t.dateFrom}</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>

                <div className="w-[160px]">
                  <Label className="text-xs mb-1.5 block">{t.dateTo}</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 justify-between items-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearFilters}
                  disabled={
                    !searchTerm && typeFilter === "all" && !dateFrom && !dateTo
                  }
                >
                  {t.clearFilters}
                </Button>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportToCsv}
                    disabled={portfolio.transactions.length === 0}
                  >
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    {t.exportCsv}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportToJson}
                    disabled={portfolio.transactions.length === 0}
                  >
                    <FileJson className="mr-2 h-4 w-4" />
                    {t.exportJson}
                  </Button>
                </div>
              </div>
            </div>

            <ScrollArea className="flex-1 overflow-y-auto px-6 bg-white dark:bg-gray-950">
              <div className="pb-4">
                {filteredAndSortedTransactions.length === 0 ? (
                  <div className="py-16 text-center text-muted-foreground">
                    {portfolio.transactions.length === 0
                      ? t.noTransactions
                      : t.noMatching}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableHeader field="type">{t.type}</SortableHeader>
                        <SortableHeader field="symbol">
                          {t.symbol}
                        </SortableHeader>
                        <SortableHeader field="amount" className="text-right">
                          {t.amount}
                        </SortableHeader>
                        <SortableHeader field="price" className="text-right">
                          {t.price}
                        </SortableHeader>
                        <SortableHeader field="total" className="text-right">
                          {t.totalValue}
                        </SortableHeader>
                        <SortableHeader field="date">{t.date}</SortableHeader>
                        <TableHead>{t.comment}</TableHead>
                        <TableHead className="text-right">
                          {t.actions}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAndSortedTransactions.map((transaction) => (
                        <TableRow key={transaction.id.toString()}>
                          <TableCell>
                            <Badge
                              variant={
                                transaction.type === "buy"
                                  ? "default"
                                  : "secondary"
                              }
                              className="whitespace-nowrap"
                            >
                              {transaction.type === "buy" ? (
                                <>
                                  <ArrowUpRight className="mr-1 h-3 w-3" />
                                  {t.buy}
                                </>
                              ) : (
                                <>
                                  <ArrowDownRight className="mr-1 h-3 w-3" />
                                  {t.sell}
                                </>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-semibold">
                                {transaction.assetSymbol}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {transaction.assetName}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatNumber(transaction.amount)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(transaction.price)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            {formatCurrency(
                              transaction.amount * transaction.price,
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {formatDate(transaction.date)}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm">
                            {transaction.comment || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-accent"
                                onClick={() => handleEdit(transaction)}
                                title={t.edit}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteClick(transaction)}
                                title={t.delete}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </ScrollArea>

            <div className="px-6 py-4 border-t flex justify-between items-center bg-white dark:bg-gray-950 flex-shrink-0">
              <div className="text-sm text-muted-foreground">
                {filteredAndSortedTransactions.length}{" "}
                {language === "pl" ? "transakcji" : "transactions"}
              </div>
              <Button onClick={onClose}>{t.close}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-white dark:bg-gray-950">
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.deleteConfirmDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTransactionToDelete(null)}>
              {t.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteTransaction.isPending}
            >
              {deleteTransaction.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t.deleting}
                </>
              ) : (
                t.confirm
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editDialogOpen && transactionToEdit && (
        <TransactionEditDialog
          portfolioId={portfolio.id}
          transaction={transactionToEdit}
          onClose={handleEditDialogClose}
          language={language}
          marketData={marketData}
          priorityAssets={priorityAssets}
        />
      )}
    </>
  );
}
