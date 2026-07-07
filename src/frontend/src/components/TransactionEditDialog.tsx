import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
import { Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { MarketData, PriorityAsset, Transaction } from "../backend";
import { useEditTransaction } from "../hooks/useQueries";

interface TransactionEditDialogProps {
  portfolioId: bigint;
  transaction: Transaction;
  onClose: () => void;
  language: "pl" | "en";
  marketData?: MarketData[];
  priorityAssets?: PriorityAsset[];
}

const translations = {
  pl: {
    title: "Edytuj transakcję",
    description: "Zaktualizuj szczegóły transakcji",
    type: "Typ",
    buy: "Kup",
    sell: "Sprzedaj",
    asset: "Aktywo",
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
    save: "Zapisz",
    saving: "Zapisywanie...",
    success: "Transakcja zaktualizowana pomyślnie",
    error: "Błąd aktualizacji transakcji",
    fillAll: "Wypełnij wszystkie pola",
  },
  en: {
    title: "Edit transaction",
    description: "Update transaction details",
    type: "Type",
    buy: "Buy",
    sell: "Sell",
    asset: "Asset",
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
    save: "Save",
    saving: "Saving...",
    success: "Transaction updated successfully",
    error: "Error updating transaction",
    fillAll: "Fill all fields",
  },
};

export default function TransactionEditDialog({
  portfolioId,
  transaction,
  onClose,
  language,
  marketData: _marketData,
  priorityAssets: _priorityAssets,
}: TransactionEditDialogProps) {
  const [amount, setAmount] = useState(transaction.amount.toString());
  const [price, setPrice] = useState(transaction.price.toString());
  const [date, setDate] = useState<Date>(
    new Date(Number(transaction.date) / 1000000),
  );
  const [comment, setComment] = useState(transaction.comment || "");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const editTransaction = useEditTransaction();
  const t = translations[language];

  const totalValue = useMemo(() => {
    const amountNum = Number.parseFloat(amount) || 0;
    const priceNum = Number.parseFloat(price) || 0;
    return amountNum * priceNum;
  }, [amount, price]);

  const handleSave = async () => {
    const amountNum = Number.parseFloat(amount);
    const priceNum = Number.parseFloat(price);

    if (
      Number.isNaN(amountNum) ||
      Number.isNaN(priceNum) ||
      amountNum <= 0 ||
      priceNum < 0
    ) {
      toast.error(t.fillAll);
      return;
    }

    try {
      const transactionDate = BigInt(date.getTime() * 1000000);

      await editTransaction.mutateAsync({
        portfolioId,
        transactionId: transaction.id,
        transaction: {
          ...transaction,
          amount: amountNum,
          price: priceNum,
          date: transactionDate,
          comment: comment.trim(),
        },
      });

      toast.success(t.success);
      onClose();
    } catch (error) {
      console.error("Edit transaction error:", error);
      toast.error(t.error);
    }
  };

  const formatCurrency = (value: number) => {
    return `$${new Intl.NumberFormat(language === "pl" ? "pl-PL" : "en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)}`;
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{t.asset}</Label>
            <div className="rounded-md border bg-muted/50 px-3 py-2">
              <div className="font-semibold">{transaction.assetSymbol}</div>
              <div className="text-xs text-muted-foreground">
                {transaction.assetName}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t.type}</Label>
            <div className="rounded-md border bg-muted/50 px-3 py-2">
              <div className="font-semibold capitalize">
                {transaction.type === "buy" ? t.buy : t.sell}
              </div>
            </div>
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
            {t.cancel}
          </Button>
          <Button
            onClick={handleSave}
            disabled={editTransaction.isPending}
            className="w-full sm:w-auto"
          >
            {editTransaction.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t.saving}
              </>
            ) : (
              t.save
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
