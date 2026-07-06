import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  AlertCircle,
  CheckCircle2,
  FileUp,
  Loader2,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { Portfolio } from "../backend";
import { useAddTransaction, useCreatePortfolio } from "../hooks/useQueries";
import {
  type ExportData,
  type ImportCounts,
  parseImportJson,
  resolvePortfolioName,
  toBackendTransaction,
} from "../utils/portfolioExport";

interface ImportPortfolioModalProps {
  portfolios: Portfolio[];
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
  language: "pl" | "en";
}

const translations = {
  pl: {
    title: "Importuj dane portfela",
    subtitle: "Import Portfolio Data",
    dropzone: "Kliknij lub przeci\u0105gnij plik JSON",
    dropzoneHint: "Obs\u0142ugiwany format: .json (eksport z tej aplikacji)",
    parseError: "Nieprawid\u0142owy lub uszkodzony plik JSON",
    summaryTitle: "Podsumowanie importu",
    portfoliosLabel: "Portfele",
    assetsLabel: "Aktywa",
    txLabel: "Transakcje",
    conflictNote:
      "Portfele o istniej\u0105cej nazwie otrzymaj\u0105 sufiks (imported YYYY-MM-DD)",
    importing: "Importowanie...",
    import: "Importuj",
    cancel: "Anuluj",
    close: "Zamknij",
    successMsg: (p: number, a: number, tx: number) =>
      `Zaimportowano ${p} portfele, ${a} aktyw\u00f3w, ${tx} transakcji`,
    errorMsg: "B\u0142\u0105d podczas importu",
  },
  en: {
    title: "Import Portfolio Data",
    subtitle: "Importuj Dane Portfela",
    dropzone: "Click or drag a JSON file here",
    dropzoneHint: "Supported format: .json (exported from this app)",
    parseError: "Invalid or corrupted JSON file",
    summaryTitle: "Import summary",
    portfoliosLabel: "Portfolios",
    assetsLabel: "Assets",
    txLabel: "Transactions",
    conflictNote:
      "Portfolios with conflicting names will get suffix (imported YYYY-MM-DD)",
    importing: "Importing...",
    import: "Import",
    cancel: "Cancel",
    close: "Close",
    successMsg: (p: number, a: number, tx: number) =>
      `Imported ${p} portfolios, ${a} assets, ${tx} transactions`,
    errorMsg: "Error during import",
  },
};

type Step = "idle" | "preview" | "importing" | "done" | "error";

export default function ImportPortfolioModal({
  portfolios,
  isOpen,
  onClose,
  onImportComplete,
  language,
}: ImportPortfolioModalProps) {
  const tr = translations[language];
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("idle");
  const [parseError, setParseError] = useState<string | null>(null);
  const [importData, setImportData] = useState<ExportData | null>(null);
  const [previewCounts, setPreviewCounts] = useState<ImportCounts | null>(null);
  const [doneCounts, setDoneCounts] = useState<ImportCounts | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const createPortfolio = useCreatePortfolio();
  const addTransaction = useAddTransaction();

  const reset = () => {
    setStep("idle");
    setParseError(null);
    setImportData(null);
    setPreviewCounts(null);
    setDoneCounts(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = e.target?.result as string;
        const result = parseImportJson(raw);
        setImportData(result.data);
        setPreviewCounts(result.counts);
        setStep("preview");
        setParseError(null);
      } catch {
        setParseError(tr.parseError);
        setStep("error");
      }
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleImport = async () => {
    if (!importData || !previewCounts) return;
    setStep("importing");

    const existingNames = portfolios.map((p) => p.name);
    let totalAssets = 0;
    let totalTx = 0;
    let totalPortfolios = 0;

    try {
      for (const ep of importData.portfolios) {
        const finalName = resolvePortfolioName(ep.name, existingNames);
        existingNames.push(finalName);
        const newId = await createPortfolio.mutateAsync(finalName);

        let txId = BigInt(Date.now());
        for (const tx of ep.transactions) {
          await addTransaction.mutateAsync({
            portfolioId: newId,
            transaction: toBackendTransaction(tx, txId),
          });
          txId += BigInt(1);
          totalTx += 1;
        }

        totalAssets += ep.assets.length;
        totalPortfolios += 1;
      }

      const done: ImportCounts = {
        portfolios: totalPortfolios,
        assets: totalAssets,
        transactions: totalTx,
      };
      setDoneCounts(done);
      setStep("done");
      toast.success(
        tr.successMsg(done.portfolios, done.assets, done.transactions),
      );
      onImportComplete();
    } catch (err) {
      console.error("[Import] error:", err);
      toast.error(tr.errorMsg);
      setStep("error");
      setParseError(tr.errorMsg);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(val) => !val && handleClose()}>
      <DialogContent className="max-w-lg" data-ocid="import_portfolio.dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileUp className="h-5 w-5 text-primary" />
            {tr.title}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {tr.subtitle}
          </DialogDescription>
        </DialogHeader>

        <Separator />

        {/* ---- Step: idle / error ---- */}
        {(step === "idle" || step === "error") && (
          <div className="space-y-4">
            <button
              type="button"
              aria-label={tr.dropzone}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              data-ocid="import_portfolio.dropzone"
              className={`flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed bg-transparent px-6 py-10 text-center transition-colors ${
                isDragging
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/60 hover:bg-muted/30"
              }`}
            >
              <Upload
                className={`h-10 w-10 ${
                  isDragging ? "text-primary" : "text-muted-foreground"
                }`}
              />
              <div>
                <p className="font-medium text-foreground">{tr.dropzone}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {tr.dropzoneHint}
                </p>
              </div>
            </button>

            {step === "error" && parseError && (
              <div
                className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                data-ocid="import_portfolio.error_state"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                {parseError}
              </div>
            )}

            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleFileChange}
              data-ocid="import_portfolio.upload_button"
            />
          </div>
        )}

        {/* ---- Step: preview ---- */}
        {step === "preview" && previewCounts && (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-foreground">
              {tr.summaryTitle}
            </p>
            <div
              className="grid grid-cols-3 gap-3"
              data-ocid="import_portfolio.summary"
            >
              {[
                { label: tr.portfoliosLabel, value: previewCounts.portfolios },
                { label: tr.assetsLabel, value: previewCounts.assets },
                { label: tr.txLabel, value: previewCounts.transactions },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex flex-col items-center rounded-md border border-primary/20 bg-primary/5 py-3"
                >
                  <span className="text-2xl font-bold text-primary">
                    {item.value}
                  </span>
                  <span className="mt-1 text-xs text-muted-foreground">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{tr.conflictNote}</p>
          </div>
        )}

        {/* ---- Step: importing ---- */}
        {step === "importing" && (
          <div
            className="flex flex-col items-center gap-4 py-8"
            data-ocid="import_portfolio.loading_state"
          >
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm font-medium text-muted-foreground">
              {tr.importing}
            </p>
          </div>
        )}

        {/* ---- Step: done ---- */}
        {step === "done" && doneCounts && (
          <div
            className="flex flex-col items-center gap-3 rounded-md border border-green-500/30 bg-green-500/10 px-4 py-6 text-center"
            data-ocid="import_portfolio.success_state"
          >
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <p className="font-semibold text-green-700 dark:text-green-400">
              {tr.successMsg(
                doneCounts.portfolios,
                doneCounts.assets,
                doneCounts.transactions,
              )}
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={step === "importing"}
            data-ocid="import_portfolio.cancel_button"
          >
            {step === "done" ? tr.close : tr.cancel}
          </Button>
          {step === "preview" && (
            <Button
              onClick={handleImport}
              data-ocid="import_portfolio.submit_button"
            >
              <FileUp className="mr-2 h-4 w-4" />
              {tr.import}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
