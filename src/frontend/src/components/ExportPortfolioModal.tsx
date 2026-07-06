import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Download, FileDown } from "lucide-react";
import { useState } from "react";
import type { Portfolio } from "../backend";
import {
  buildExportJson,
  downloadJson,
  getExportCounts,
} from "../utils/portfolioExport";

interface ExportPortfolioModalProps {
  portfolios: Portfolio[];
  isOpen: boolean;
  onClose: () => void;
  language: "pl" | "en";
}

const translations = {
  pl: {
    title: "Eksportuj dane portfela",
    subtitle: "Export Portfolio Data",
    selectAll: "Zaznacz wszystkie",
    portfoliosSection: "Portfele",
    assets: "aktyw.",
    txs: "trans.",
    summary: (p: number, a: number, tx: number) =>
      `Wybrano: ${p} portfel(e) \u00b7 ${a} aktyw(\u00f3w) \u00b7 ${tx} transakcj(i)`,
    cancel: "Anuluj",
    export: "Eksportuj jako JSON",
    noPortfolios: "Brak portfeli do eksportu.",
  },
  en: {
    title: "Export Portfolio Data",
    subtitle: "Eksportuj Dane Portfela",
    selectAll: "Select all",
    portfoliosSection: "Portfolios",
    assets: "assets",
    txs: "txs",
    summary: (p: number, a: number, tx: number) =>
      `Selected: ${p} portfolio(s) \u00b7 ${a} asset(s) \u00b7 ${tx} transaction(s)`,
    cancel: "Cancel",
    export: "Export as JSON",
    noPortfolios: "No portfolios to export.",
  },
};

export default function ExportPortfolioModal({
  portfolios,
  isOpen,
  onClose,
  language,
}: ExportPortfolioModalProps) {
  const t = translations[language];

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(portfolios.map((p) => p.id.toString())),
  );

  const allSelected =
    portfolios.length > 0 && selected.size === portfolios.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(portfolios.map((p) => p.id.toString())));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const counts = getExportCounts(portfolios, selected);

  const handleExport = () => {
    if (selected.size === 0) return;
    const json = buildExportJson(portfolios, selected);
    downloadJson(json);
    onClose();
  };

  const handleOpenChange = (val: boolean) => {
    if (val) {
      setSelected(new Set(portfolios.map((p) => p.id.toString())));
    } else {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg" data-ocid="export_portfolio.dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileDown className="h-5 w-5 text-primary" />
            {t.title}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {t.subtitle}
          </DialogDescription>
        </DialogHeader>

        <Separator />

        {portfolios.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t.noPortfolios}
          </p>
        ) : (
          <>
            {/* Select-all row */}
            <div className="flex items-center gap-3 rounded-md bg-muted/40 px-3 py-2">
              <Checkbox
                id="export-select-all"
                checked={allSelected}
                onCheckedChange={toggleAll}
                data-ocid="export_portfolio.select_all.checkbox"
              />
              <Label
                htmlFor="export-select-all"
                className="cursor-pointer font-semibold"
              >
                {t.selectAll}{" "}
                <span className="font-normal text-muted-foreground">
                  {t.portfoliosSection}
                </span>
              </Label>
            </div>

            {/* Portfolio checkboxes */}
            <ScrollArea className="max-h-56">
              <div className="space-y-2 pr-2">
                {portfolios.map((p) => {
                  const id = p.id.toString();
                  const checked = selected.has(id);
                  return (
                    <div
                      key={id}
                      className="flex items-center gap-3 rounded-md border border-border/50 bg-card px-3 py-2.5 transition-colors hover:bg-muted/30"
                      data-ocid={`export_portfolio.item.${id}`}
                    >
                      <Checkbox
                        id={`export-${id}`}
                        checked={checked}
                        onCheckedChange={() => toggleOne(id)}
                        data-ocid={`export_portfolio.checkbox.${id}`}
                      />
                      <Label
                        htmlFor={`export-${id}`}
                        className="flex-1 cursor-pointer text-sm font-medium"
                      >
                        {p.name}
                      </Label>
                      <span className="text-xs text-muted-foreground">
                        {p.assets.length} {t.assets} \u00b7{" "}
                        {p.transactions.length} {t.txs}
                      </span>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <Separator />

            {/* Summary counts */}
            <div
              className="rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm"
              data-ocid="export_portfolio.summary"
            >
              <div className="flex items-center gap-2 font-medium text-primary">
                <Download className="h-4 w-4" />
                {t.summary(
                  counts.portfolios,
                  counts.assets,
                  counts.transactions,
                )}
              </div>
            </div>
          </>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            data-ocid="export_portfolio.cancel_button"
          >
            {t.cancel}
          </Button>
          <Button
            onClick={handleExport}
            disabled={selected.size === 0}
            data-ocid="export_portfolio.submit_button"
          >
            <FileDown className="mr-2 h-4 w-4" />
            {t.export}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
