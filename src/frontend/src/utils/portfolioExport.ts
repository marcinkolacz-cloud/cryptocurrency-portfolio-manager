import type { Portfolio, Transaction } from "../backend";

// ─── Export types ──────────────────────────────────────────────────────────────

export interface ExportTransaction {
  id: string;
  date: string;
  type: string;
  comment: string;
  assetSymbol: string;
  assetName: string;
  price: number;
  amount: number;
}

export interface ExportAsset {
  symbol: string;
  name: string;
  amount: number;
  averagePurchasePrice: number;
}

export interface ExportPortfolio {
  name: string;
  createdAt: string;
  assets: ExportAsset[];
  transactions: ExportTransaction[];
}

export interface ExportData {
  version: string;
  exportedAt: string;
  portfolios: ExportPortfolio[];
}

// ─── Export counts ─────────────────────────────────────────────────────────────

export interface ExportCounts {
  portfolios: number;
  assets: number;
  transactions: number;
}

export function getExportCounts(
  portfolios: Portfolio[],
  selectedIds: Set<string>,
): ExportCounts {
  const selected = portfolios.filter((p) => selectedIds.has(p.id.toString()));
  return {
    portfolios: selected.length,
    assets: selected.reduce((sum, p) => sum + p.assets.length, 0),
    transactions: selected.reduce((sum, p) => sum + p.transactions.length, 0),
  };
}

// ─── Serialise Portfolio → ExportPortfolio ────────────────────────────────────

function serializeTransaction(tx: Transaction): ExportTransaction {
  return {
    id: tx.id.toString(),
    date: tx.date.toString(),
    type: tx.type,
    comment: tx.comment,
    assetSymbol: tx.assetSymbol,
    assetName: tx.assetName,
    price: tx.price,
    amount: tx.amount,
  };
}

function serializePortfolio(p: Portfolio): ExportPortfolio {
  return {
    name: p.name,
    createdAt: p.createdAt.toString(),
    assets: p.assets.map((a) => ({
      symbol: a.symbol,
      name: a.name,
      amount: a.amount,
      averagePurchasePrice: a.averagePurchasePrice,
    })),
    transactions: p.transactions.map(serializeTransaction),
  };
}

// ─── Build and trigger download ───────────────────────────────────────────────

export function buildExportJson(
  portfolios: Portfolio[],
  selectedIds: Set<string>,
): string {
  const selected = portfolios.filter((p) => selectedIds.has(p.id.toString()));
  const data: ExportData = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    portfolios: selected.map(serializePortfolio),
  };
  return JSON.stringify(data, null, 2);
}

export function downloadJson(json: string): void {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const datePart = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
  ].join("-");
  const timePart = [pad(now.getHours()), pad(now.getMinutes())].join("-");
  const filename = `portfolio_export_${datePart}_${timePart}.json`;

  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Import / validation ──────────────────────────────────────────────────────

export interface ImportCounts {
  portfolios: number;
  assets: number;
  transactions: number;
}

export interface ImportResult {
  data: ExportData;
  counts: ImportCounts;
}

function isExportTransaction(obj: unknown): obj is ExportTransaction {
  if (typeof obj !== "object" || obj === null) return false;
  const t = obj as Record<string, unknown>;
  return (
    typeof t.id === "string" &&
    typeof t.date === "string" &&
    typeof t.type === "string" &&
    typeof t.assetSymbol === "string" &&
    typeof t.assetName === "string" &&
    typeof t.price === "number" &&
    typeof t.amount === "number"
  );
}

function isExportAsset(obj: unknown): obj is ExportAsset {
  if (typeof obj !== "object" || obj === null) return false;
  const a = obj as Record<string, unknown>;
  return (
    typeof a.symbol === "string" &&
    typeof a.name === "string" &&
    typeof a.amount === "number"
  );
}

function isExportPortfolio(obj: unknown): obj is ExportPortfolio {
  if (typeof obj !== "object" || obj === null) return false;
  const p = obj as Record<string, unknown>;
  return (
    typeof p.name === "string" &&
    Array.isArray(p.assets) &&
    (p.assets as unknown[]).every(isExportAsset) &&
    Array.isArray(p.transactions) &&
    (p.transactions as unknown[]).every(isExportTransaction)
  );
}

export function parseImportJson(raw: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("INVALID_JSON");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("INVALID_STRUCTURE");
  }

  const obj = parsed as Record<string, unknown>;

  if (!Array.isArray(obj.portfolios)) {
    throw new Error("INVALID_STRUCTURE");
  }

  const portfolios = obj.portfolios as unknown[];
  if (!portfolios.every(isExportPortfolio)) {
    throw new Error("INVALID_STRUCTURE");
  }

  const data: ExportData = {
    version: typeof obj.version === "string" ? obj.version : "1.0",
    exportedAt:
      typeof obj.exportedAt === "string"
        ? obj.exportedAt
        : new Date().toISOString(),
    portfolios: portfolios as ExportPortfolio[],
  };

  const counts: ImportCounts = {
    portfolios: data.portfolios.length,
    assets: data.portfolios.reduce((sum, p) => sum + p.assets.length, 0),
    transactions: data.portfolios.reduce(
      (sum, p) => sum + p.transactions.length,
      0,
    ),
  };

  return { data, counts };
}

// ─── Name conflict resolution ─────────────────────────────────────────────────

export function resolvePortfolioName(
  desiredName: string,
  existingNames: string[],
): string {
  if (!existingNames.includes(desiredName)) return desiredName;
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const suffixed = `${desiredName} (imported ${today})`;
  if (!existingNames.includes(suffixed)) return suffixed;
  // fallback with counter
  let i = 2;
  while (existingNames.includes(`${suffixed} ${i}`)) i++;
  return `${suffixed} ${i}`;
}

// ─── Convert exported transaction back to Transaction bigint ──────────────────

export function toBackendTransaction(
  tx: ExportTransaction,
  newId: bigint,
): Transaction {
  return {
    id: newId,
    date: BigInt(tx.date),
    type: tx.type,
    comment: tx.comment ?? "",
    assetSymbol: tx.assetSymbol,
    assetName: tx.assetName,
    price: tx.price,
    amount: tx.amount,
  };
}
