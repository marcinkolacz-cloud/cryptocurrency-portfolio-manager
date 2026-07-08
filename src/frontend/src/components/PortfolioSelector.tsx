import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Portfolio } from "../backend";
import { useCreatePortfolio, useDeletePortfolio } from "../hooks/useQueries";

interface PortfolioSelectorProps {
  portfolios: Portfolio[];
  selectedPortfolioId: bigint | null;
  onSelectPortfolio: (id: bigint | null) => void;
  language: "pl" | "en";
}

const translations = {
  pl: {
    selectPortfolio: "Wybierz portfel",
    createNew: "Nowy portfel",
    delete: "Usuń",
    createTitle: "Utwórz nowy portfel",
    createDescription: "Podaj nazwę dla nowego portfela",
    nameLabel: "Nazwa portfela",
    namePlaceholder: "np. Mój portfel krypto",
    cancel: "Anuluj",
    create: "Utwórz",
    creating: "Tworzenie...",
    deleteTitle: "Usuń portfel",
    deleteDescription:
      "Czy na pewno chcesz usunąć ten portfel? Wszystkie aktywa i transakcje zostaną trwale usunięte.",
    deleting: "Usuwanie...",
    createSuccess: "Portfel utworzony pomyślnie",
    createError: "Błąd tworzenia portfela",
    deleteSuccess: "Portfel usunięty pomyślnie",
    deleteError: "Błąd usuwania portfela",
    maxPortfolios: "Osiągnięto maksymalną liczbę portfeli (10)",
  },
  en: {
    selectPortfolio: "Select portfolio",
    createNew: "New portfolio",
    delete: "Delete",
    createTitle: "Create new portfolio",
    createDescription: "Enter a name for your new portfolio",
    nameLabel: "Portfolio name",
    namePlaceholder: "e.g. My crypto portfolio",
    cancel: "Cancel",
    create: "Create",
    creating: "Creating...",
    deleteTitle: "Delete portfolio",
    deleteDescription:
      "Are you sure you want to delete this portfolio? All assets and transactions will be permanently removed.",
    deleting: "Deleting...",
    createSuccess: "Portfolio created successfully",
    createError: "Error creating portfolio",
    deleteSuccess: "Portfolio deleted successfully",
    deleteError: "Error deleting portfolio",
    maxPortfolios: "Maximum number of portfolios reached (10)",
  },
};

export default function PortfolioSelector({
  portfolios,
  selectedPortfolioId,
  onSelectPortfolio,
  language,
}: PortfolioSelectorProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState("");
  const createPortfolio = useCreatePortfolio();
  const deletePortfolio = useDeletePortfolio();
  const t = translations[language];

  const handleCreate = async () => {
    if (!newPortfolioName.trim()) return;

    if (portfolios.length >= 10) {
      toast.error(t.maxPortfolios);
      return;
    }

    try {
      const newId = await createPortfolio.mutateAsync(newPortfolioName.trim());
      toast.success(t.createSuccess);
      setShowCreateDialog(false);
      setNewPortfolioName("");
      onSelectPortfolio(newId);
    } catch (error) {
      console.error("Create portfolio error:", error);
      toast.error(t.createError);
    }
  };

  const handleDelete = async () => {
    if (!selectedPortfolioId) return;

    try {
      await deletePortfolio.mutateAsync(selectedPortfolioId);
      toast.success(t.deleteSuccess);
      setShowDeleteDialog(false);
      onSelectPortfolio(null);
    } catch (error) {
      console.error("Delete portfolio error:", error);
      toast.error(t.deleteError);
    }
  };

  return (
    <>
      <div className="flex flex-1 items-center gap-2">
        <Select
          value={selectedPortfolioId?.toString() || ""}
          onValueChange={(value) => onSelectPortfolio(BigInt(value))}
        >
          <SelectTrigger
            className="w-full max-w-[300px] rounded-terminal border-terminal bg-terminal-card font-terminal text-terminal hover:bg-terminal-hover data-[placeholder]:text-terminal-muted"
            data-ocid="portfolio.select"
          >
            <SelectValue placeholder={t.selectPortfolio} />
          </SelectTrigger>
          <SelectContent
            className="rounded-terminal border-terminal bg-terminal-card font-terminal text-terminal"
            data-ocid="portfolio.select.dropdown_menu"
          >
            {portfolios.map((portfolio) => (
              <SelectItem
                key={portfolio.id.toString()}
                value={portfolio.id.toString()}
                className="rounded-terminal font-terminal text-terminal focus:bg-terminal-hover focus:text-terminal-green"
              >
                {portfolio.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          onClick={() => setShowCreateDialog(true)}
          disabled={portfolios.length >= 10}
          size="sm"
          data-ocid="portfolio.new_button"
          className="rounded-terminal border-terminal bg-terminal-card font-terminal text-terminal-green hover:bg-terminal-hover hover:text-terminal-green"
        >
          <Plus className="mr-2 h-4 w-4" />
          {t.createNew}
        </Button>

        {selectedPortfolioId && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
            title={t.delete}
            data-ocid="portfolio.delete_button"
            className="rounded-terminal border-terminal bg-terminal-card font-terminal text-terminal-red hover:bg-terminal-hover hover:text-terminal-red"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent
          className="rounded-terminal border-terminal bg-terminal-card font-terminal text-terminal"
          data-ocid="portfolio.create.dialog"
        >
          <DialogHeader>
            <DialogTitle className="text-terminal">{t.createTitle}</DialogTitle>
            <DialogDescription className="text-terminal-muted">
              {t.createDescription}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label
                htmlFor="portfolio-name"
                className="text-terminal-muted font-terminal"
              >
                {t.nameLabel}
              </Label>
              <Input
                id="portfolio-name"
                value={newPortfolioName}
                onChange={(e) => setNewPortfolioName(e.target.value)}
                placeholder={t.namePlaceholder}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="rounded-terminal border-terminal bg-terminal font-terminal text-terminal placeholder:text-terminal-muted"
                data-ocid="portfolio.name.input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              data-ocid="portfolio.create.cancel_button"
              className="rounded-terminal border-terminal bg-terminal-card font-terminal text-terminal hover:bg-terminal-hover"
            >
              {t.cancel}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newPortfolioName.trim() || createPortfolio.isPending}
              data-ocid="portfolio.create.confirm_button"
              className="rounded-terminal border-terminal bg-terminal-card font-terminal text-terminal-green hover:bg-terminal-hover hover:text-terminal-green"
            >
              {createPortfolio.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t.creating}
                </>
              ) : (
                t.create
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent
          className="rounded-terminal border-terminal bg-terminal-card font-terminal text-terminal"
          data-ocid="portfolio.delete.dialog"
        >
          <DialogHeader>
            <DialogTitle className="text-terminal">{t.deleteTitle}</DialogTitle>
            <DialogDescription className="text-terminal-muted">
              {t.deleteDescription}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              data-ocid="portfolio.delete.cancel_button"
              className="rounded-terminal border-terminal bg-terminal-card font-terminal text-terminal hover:bg-terminal-hover"
            >
              {t.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deletePortfolio.isPending}
              data-ocid="portfolio.delete.confirm_button"
              className="rounded-terminal font-terminal"
            >
              {deletePortfolio.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t.deleting}
                </>
              ) : (
                t.delete
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
