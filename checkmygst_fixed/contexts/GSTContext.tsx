import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";

export interface BusinessProfile {
  id: string;
  businessName: string;
  ownerName: string;
  gstin: string;
  phone: string;
  email: string;
  businessType: string;
}

export interface PurchaseInvoice {
  id: string;
  supplierName: string;
  supplierGSTIN: string;
  invoiceNumber: string;
  invoiceDate: string;
  description: string;
  hsn: string;
  gstRate: number;
  taxableAmount: number;
  gstAmount: number;
  totalAmount: number;
  createdAt: string;
}

export interface SalesInvoice {
  id: string;
  customerName: string;
  customerGSTIN: string;
  invoiceNumber: string;
  invoiceDate: string;
  description: string;
  hsn: string;
  gstRate: number;
  taxableAmount: number;
  gstAmount: number;
  totalAmount: number;
  createdAt: string;
}

export interface GSTR2BEntry {
  id: string;
  supplierName: string;
  supplierGSTIN: string;
  invoiceNumber: string;
  invoiceDate: string;
  taxableAmount: number;
  igst: number;
  cgst: number;
  sgst: number;
  totalITC: number;
  gstRate: number;
  period: string;
}

export type ReconciliationStatus =
  | "matched"
  | "amount_mismatch"
  | "missing_from_register"
  | "supplier_not_filed";

export interface ReconciliationResult {
  id: string;
  status: ReconciliationStatus;
  supplierName: string;
  supplierGSTIN: string;
  invoiceNumber: string;
  invoiceDate: string;
  purchaseAmount?: number;
  gstr2bAmount?: number;
  difference?: number;
  purchaseId?: string;
  gstr2bId?: string;
}

export interface SupplierSummary {
  supplierName: string;
  supplierGSTIN: string;
  invoiceCount: number;
  totalTaxable: number;
  totalGST: number;
  totalAmount: number;
  lastInvoiceDate: string;
}

export interface CustomerSummary {
  customerName: string;
  customerGSTIN: string;
  invoiceCount: number;
  totalTaxable: number;
  totalGST: number;
  totalAmount: number;
  lastInvoiceDate: string;
}

export function generateId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

export function getTodayDate(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function parseInvoiceDate(dateStr: string): Date {
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  }
  return new Date(dateStr);
}

export function getMonthKey(dateStr: string): string {
  try {
    const d = parseInvoiceDate(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  } catch {
    return "Unknown";
  }
}

export function getMonthLabel(monthKey: string): string {
  if (monthKey === "Unknown") return "Unknown";
  const [year, month] = monthKey.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(month) - 1]} ${year}`;
}

async function load<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

async function save(key: string, value: unknown) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

interface GSTContextValue {
  profile: BusinessProfile | null;
  purchases: PurchaseInvoice[];
  sales: SalesInvoice[];
  gstr2bEntries: GSTR2BEntry[];
  isLoaded: boolean;
  currentUserEmail: string;

  saveProfile: (data: Omit<BusinessProfile, "id">) => Promise<void>;

  addPurchase: (data: Omit<PurchaseInvoice, "id" | "createdAt">) => Promise<PurchaseInvoice>;
  updatePurchase: (id: string, data: Partial<PurchaseInvoice>) => Promise<void>;
  deletePurchase: (id: string) => Promise<void>;
  updateSupplierAcrossPurchases: (oldKey: string, newData: { supplierName: string; supplierGSTIN: string }) => Promise<void>;

  addSale: (data: Omit<SalesInvoice, "id" | "createdAt">) => Promise<SalesInvoice>;
  updateSale: (id: string, data: Partial<SalesInvoice>) => Promise<void>;
  deleteSale: (id: string) => Promise<void>;
  updateCustomerAcrossSales: (oldKey: string, newData: { customerName: string; customerGSTIN: string }) => Promise<void>;

  addGSTR2BEntries: (entries: Omit<GSTR2BEntry, "id">[]) => Promise<void>;
  clearGSTR2B: () => Promise<void>;

  getSuppliers: () => SupplierSummary[];
  getCustomers: () => CustomerSummary[];

  getReconciliation: () => ReconciliationResult[];
  getRiskLevel: (results: ReconciliationResult[]) => "green" | "yellow" | "red";
  getITCSummary: (results: ReconciliationResult[]) => {
    totalITCAvailable: number;
    itcMatched: number;
    itcAtRisk: number;
    itcRecoverable: number;
  };
}

const GSTContext = createContext<GSTContextValue | null>(null);

export function GSTProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [purchases, setPurchases] = useState<PurchaseInvoice[]>([]);
  const [sales, setSales] = useState<SalesInvoice[]>([]);
  const [gstr2bEntries, setGstr2bEntries] = useState<GSTR2BEntry[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const getKeys = (uid: string) => ({
    PROFILE: `${uid}_gst_profile`,
    PURCHASES: `${uid}_gst_purchases`,
    SALES: `${uid}_gst_sales`,
    GSTR2B: `${uid}_gst_gstr2b`,
  });

  const loadUserData = useCallback(async (uid: string) => {
    setIsLoaded(false);
    const KEYS = getKeys(uid);
    const [p, pur, s, g] = await Promise.all([
      load<BusinessProfile | null>(KEYS.PROFILE, null),
      load<PurchaseInvoice[]>(KEYS.PURCHASES, []),
      load<SalesInvoice[]>(KEYS.SALES, []),
      load<GSTR2BEntry[]>(KEYS.GSTR2B, []),
    ]);
    setProfile(p);
    setPurchases(pur);
    setSales(s);
    setGstr2bEntries(g);
    setIsLoaded(true);
  }, []);

  const clearUserData = useCallback(() => {
    setProfile(null);
    setPurchases([]);
    setSales([]);
    setGstr2bEntries([]);
    setIsLoaded(false);
    setUserId(null);
    setCurrentUserEmail("");
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id);
        setCurrentUserEmail(session.user.email || "");
        loadUserData(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserId(session.user.id);
        setCurrentUserEmail(session.user.email || "");
        loadUserData(session.user.id);
      } else {
        clearUserData();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const saveProfile = useCallback(async (data: Omit<BusinessProfile, "id">) => {
    if (!userId) return;
    const p: BusinessProfile = { ...data, id: profile?.id || generateId() };
    setProfile(p);
    await save(getKeys(userId).PROFILE, p);
  }, [profile, userId]);

  const addPurchase = useCallback(async (data: Omit<PurchaseInvoice, "id" | "createdAt">): Promise<PurchaseInvoice> => {
    if (!userId) throw new Error("Not logged in");
    const p: PurchaseInvoice = { ...data, id: generateId(), createdAt: new Date().toISOString() };
    const updated = [...purchases, p];
    setPurchases(updated);
    await save(getKeys(userId).PURCHASES, updated);
    return p;
  }, [purchases, userId]);

  const updatePurchase = useCallback(async (id: string, data: Partial<PurchaseInvoice>) => {
    if (!userId) return;
    const updated = purchases.map((p) => (p.id === id ? { ...p, ...data } : p));
    setPurchases(updated);
    await save(getKeys(userId).PURCHASES, updated);
  }, [purchases, userId]);

  const deletePurchase = useCallback(async (id: string) => {
    if (!userId) return;
    const updated = purchases.filter((p) => p.id !== id);
    setPurchases(updated);
    await save(getKeys(userId).PURCHASES, updated);
  }, [purchases, userId]);

  const updateSupplierAcrossPurchases = useCallback(async (
    oldKey: string,
    newData: { supplierName: string; supplierGSTIN: string }
  ) => {
    if (!userId) return;
    const updated = purchases.map((p) => {
      const key = p.supplierGSTIN || p.supplierName;
      if (key === oldKey) return { ...p, supplierName: newData.supplierName, supplierGSTIN: newData.supplierGSTIN };
      return p;
    });
    setPurchases(updated);
    await save(getKeys(userId).PURCHASES, updated);
  }, [purchases, userId]);

  const addSale = useCallback(async (data: Omit<SalesInvoice, "id" | "createdAt">): Promise<SalesInvoice> => {
    if (!userId) throw new Error("Not logged in");
    const s: SalesInvoice = { ...data, id: generateId(), createdAt: new Date().toISOString() };
    const updated = [...sales, s];
    setSales(updated);
    await save(getKeys(userId).SALES, updated);
    return s;
  }, [sales, userId]);

  const updateSale = useCallback(async (id: string, data: Partial<SalesInvoice>) => {
    if (!userId) return;
    const updated = sales.map((s) => (s.id === id ? { ...s, ...data } : s));
    setSales(updated);
    await save(getKeys(userId).SALES, updated);
  }, [sales, userId]);

  const deleteSale = useCallback(async (id: string) => {
    if (!userId) return;
    const updated = sales.filter((s) => s.id !== id);
    setSales(updated);
    await save(getKeys(userId).SALES, updated);
  }, [sales, userId]);

  const updateCustomerAcrossSales = useCallback(async (
    oldKey: string,
    newData: { customerName: string; customerGSTIN: string }
  ) => {
    if (!userId) return;
    const updated = sales.map((s) => {
      const key = s.customerGSTIN || s.customerName;
      if (key === oldKey) return { ...s, customerName: newData.customerName, customerGSTIN: newData.customerGSTIN };
      return s;
    });
    setSales(updated);
    await save(getKeys(userId).SALES, updated);
  }, [sales, userId]);

  const addGSTR2BEntries = useCallback(async (entries: Omit<GSTR2BEntry, "id">[]) => {
    if (!userId) return;
    const newEntries = entries.map((e) => ({ ...e, id: generateId() }));
    const updated = [...gstr2bEntries, ...newEntries];
    setGstr2bEntries(updated);
    await save(getKeys(userId).GSTR2B, updated);
  }, [gstr2bEntries, userId]);

  const clearGSTR2B = useCallback(async () => {
    if (!userId) return;
    setGstr2bEntries([]);
    await save(getKeys(userId).GSTR2B, []);
  }, [userId]);

  const getSuppliers = useCallback((): SupplierSummary[] => {
    const map = new Map<string, SupplierSummary>();
    for (const p of purchases) {
      const key = p.supplierGSTIN || p.supplierName;
      if (!key) continue;
      const existing = map.get(key);
      if (existing) {
        existing.invoiceCount += 1;
        existing.totalTaxable += p.taxableAmount;
        existing.totalGST += p.gstAmount;
        existing.totalAmount += p.totalAmount;
        if (p.invoiceDate > existing.lastInvoiceDate) existing.lastInvoiceDate = p.invoiceDate;
      } else {
        map.set(key, {
          supplierName: p.supplierName,
          supplierGSTIN: p.supplierGSTIN,
          invoiceCount: 1,
          totalTaxable: p.taxableAmount,
          totalGST: p.gstAmount,
          totalAmount: p.totalAmount,
          lastInvoiceDate: p.invoiceDate,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.supplierName.localeCompare(b.supplierName));
  }, [purchases]);

  const getCustomers = useCallback((): CustomerSummary[] => {
    const map = new Map<string, CustomerSummary>();
    for (const s of sales) {
      const key = s.customerGSTIN || s.customerName;
      if (!key) continue;
      const existing = map.get(key);
      if (existing) {
        existing.invoiceCount += 1;
        existing.totalTaxable += s.taxableAmount;
        existing.totalGST += s.gstAmount;
        existing.totalAmount += s.totalAmount;
        if (s.invoiceDate > existing.lastInvoiceDate) existing.lastInvoiceDate = s.invoiceDate;
      } else {
        map.set(key, {
          customerName: s.customerName,
          customerGSTIN: s.customerGSTIN,
          invoiceCount: 1,
          totalTaxable: s.taxableAmount,
          totalGST: s.gstAmount,
          totalAmount: s.totalAmount,
          lastInvoiceDate: s.invoiceDate,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.customerName.localeCompare(b.customerName));
  }, [sales]);

  const getReconciliation = useCallback((): ReconciliationResult[] => {
    const results: ReconciliationResult[] = [];
    const matchedGSTR2BIds = new Set<string>();

    for (const purchase of purchases) {
      const match = gstr2bEntries.find(
        (g) =>
          g.supplierGSTIN.toLowerCase() === purchase.supplierGSTIN.toLowerCase() &&
          g.invoiceNumber.toLowerCase() === purchase.invoiceNumber.toLowerCase()
      );
      if (match) {
        matchedGSTR2BIds.add(match.id);
        const diff = Math.abs(purchase.gstAmount - match.totalITC);
        results.push({
          id: generateId(),
          status: diff < 1 ? "matched" : "amount_mismatch",
          supplierName: purchase.supplierName,
          supplierGSTIN: purchase.supplierGSTIN,
          invoiceNumber: purchase.invoiceNumber,
          invoiceDate: purchase.invoiceDate,
          purchaseAmount: purchase.gstAmount,
          gstr2bAmount: match.totalITC,
          difference: diff,
          purchaseId: purchase.id,
          gstr2bId: match.id,
        });
      } else {
        results.push({
          id: generateId(),
          status: "supplier_not_filed",
          supplierName: purchase.supplierName,
          supplierGSTIN: purchase.supplierGSTIN,
          invoiceNumber: purchase.invoiceNumber,
          invoiceDate: purchase.invoiceDate,
          purchaseAmount: purchase.gstAmount,
          purchaseId: purchase.id,
        });
      }
    }

    for (const gstr2b of gstr2bEntries) {
      if (!matchedGSTR2BIds.has(gstr2b.id)) {
        results.push({
          id: generateId(),
          status: "missing_from_register",
          supplierName: gstr2b.supplierName,
          supplierGSTIN: gstr2b.supplierGSTIN,
          invoiceNumber: gstr2b.invoiceNumber,
          invoiceDate: gstr2b.invoiceDate,
          gstr2bAmount: gstr2b.totalITC,
          gstr2bId: gstr2b.id,
        });
      }
    }

    return results;
  }, [purchases, gstr2bEntries]);

  const getRiskLevel = useCallback((results: ReconciliationResult[]): "green" | "yellow" | "red" => {
    if (results.length === 0) return "green";
    const critical = results.filter(
      (r) => r.status === "supplier_not_filed" || r.status === "missing_from_register"
    ).length;
    const mismatches = results.filter((r) => r.status === "amount_mismatch").length;
    if (critical > 0) return "red";
    if (mismatches > 0) return "yellow";
    return "green";
  }, []);

  const getITCSummary = useCallback((results: ReconciliationResult[]) => {
    const totalITCAvailable = gstr2bEntries.reduce((s, g) => s + g.totalITC, 0);
    const itcMatched = results.filter((r) => r.status === "matched").reduce((s, r) => s + (r.gstr2bAmount ?? 0), 0);
    const itcAtRisk = results.filter((r) => r.status === "supplier_not_filed").reduce((s, r) => s + (r.purchaseAmount ?? 0), 0);
    const itcRecoverable = results.filter((r) => r.status === "missing_from_register").reduce((s, r) => s + (r.gstr2bAmount ?? 0), 0);
    return { totalITCAvailable, itcMatched, itcAtRisk, itcRecoverable };
  }, [gstr2bEntries]);

  const value = useMemo<GSTContextValue>(() => ({
    profile, purchases, sales, gstr2bEntries, isLoaded, currentUserEmail,
    saveProfile,
    addPurchase, updatePurchase, deletePurchase, updateSupplierAcrossPurchases,
    addSale, updateSale, deleteSale, updateCustomerAcrossSales,
    addGSTR2BEntries, clearGSTR2B,
    getSuppliers, getCustomers,
    getReconciliation, getRiskLevel, getITCSummary,
  }), [
    profile, purchases, sales, gstr2bEntries, isLoaded, currentUserEmail,
    saveProfile,
    addPurchase, updatePurchase, deletePurchase, updateSupplierAcrossPurchases,
    addSale, updateSale, deleteSale, updateCustomerAcrossSales,
    addGSTR2BEntries, clearGSTR2B,
    getSuppliers, getCustomers,
    getReconciliation, getRiskLevel, getITCSummary,
  ]);

  return <GSTContext.Provider value={value}>{children}</GSTContext.Provider>;
}

export function useGST() {
  const ctx = useContext(GSTContext);
  if (!ctx) throw new Error("useGST must be used within GSTProvider");
  return ctx;
}