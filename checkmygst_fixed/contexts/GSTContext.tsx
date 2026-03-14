import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  ReactNode,
} from "react";
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
  quantity: number;
  rate: number;
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
  quantity: number;
  rate: number;
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

export interface Client {
  id: string;
  businessName: string;
  ownerName: string;
  gstin: string;
  phone: string;
  email: string;
  businessType: string;
  createdAt: string;
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
  if (!dateStr) return new Date();
  if (dateStr.includes("/")) {
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
  }
  if (dateStr.includes("-") && dateStr.length >= 10) {
    const parts = dateStr.substring(0, 10).split("-");
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  }
  return new Date(dateStr);
}

export function normalizeDateDisplay(dateStr: string): string {
  if (!dateStr) return "";
  if (dateStr.includes("/")) return dateStr;
  if (dateStr.includes("-") && dateStr.length >= 10) {
    const parts = dateStr.substring(0, 10).split("-");
    return parts[2] + "/" + parts[1] + "/" + parts[0];
  }
  return dateStr;
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

interface GSTContextValue {
  profile: BusinessProfile | null;
  purchases: PurchaseInvoice[];
  sales: SalesInvoice[];
  gstr2bEntries: GSTR2BEntry[];
  clients: Client[];
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

  addClient: (data: Omit<Client, "id" | "createdAt">) => Promise<Client>;
  updateClient: (id: string, data: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;

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
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const loadUserData = useCallback(async (uid: string) => {
    setIsLoaded(false);
    try {
      const [profileRes, purchasesRes, salesRes, gstr2bRes, clientsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid).single(),
        supabase.from("purchases").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
        supabase.from("sales").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
        supabase.from("gstr2b_entries").select("*").eq("user_id", uid),
        supabase.from("clients").select("*").eq("user_id", uid),
      ]);

      if (profileRes.data) {
        setProfile({
          id: profileRes.data.id,
          businessName: profileRes.data.business_name || "",
          ownerName: profileRes.data.owner_name || "",
          gstin: profileRes.data.gstin || "",
          phone: profileRes.data.phone || "",
          email: profileRes.data.email || "",
          businessType: profileRes.data.business_type || "",
        });
      }

      if (purchasesRes.data) {
        setPurchases(purchasesRes.data.map((p: any) => ({
          id: p.id,
          supplierName: p.supplier_name || "",
          supplierGSTIN: p.supplier_gstin || "",
          invoiceNumber: p.invoice_number || "",
          invoiceDate: p.invoice_date || "",
          description: p.description || "",
          hsn: p.hsn || "",
          quantity: p.quantity || 1,
          rate: p.rate || 0,
          gstRate: p.gst_rate || 0,
          taxableAmount: p.taxable_amount || 0,
          gstAmount: p.gst_amount || 0,
          totalAmount: p.total_amount || 0,
          createdAt: p.created_at || "",
        })));
      }

      if (salesRes.data) {
        setSales(salesRes.data.map((s: any) => ({
          id: s.id,
          customerName: s.customer_name || "",
          customerGSTIN: s.customer_gstin || "",
          invoiceNumber: s.invoice_number || "",
          invoiceDate: s.invoice_date || "",
          description: s.description || "",
          hsn: s.hsn || "",
          quantity: s.quantity || 1,
          rate: s.rate || 0,
          gstRate: s.gst_rate || 0,
          taxableAmount: s.taxable_amount || 0,
          gstAmount: s.gst_amount || 0,
          totalAmount: s.total_amount || 0,
          createdAt: s.created_at || "",
        })));
      }

      if (gstr2bRes.data) {
        setGstr2bEntries(gstr2bRes.data.map((g: any) => ({
          id: g.id,
          supplierName: g.supplier_name || "",
          supplierGSTIN: g.supplier_gstin || "",
          invoiceNumber: g.invoice_number || "",
          invoiceDate: g.invoice_date || "",
          taxableAmount: g.taxable_amount || 0,
          igst: g.igst || 0,
          cgst: g.cgst || 0,
          sgst: g.sgst || 0,
          totalITC: g.total_itc || 0,
          gstRate: g.gst_rate || 0,
          period: g.period || "",
        })));
      }

      if (clientsRes.data) {
        setClients(clientsRes.data.map((c: any) => ({
          id: c.id,
          businessName: c.business_name || "",
          ownerName: c.owner_name || "",
          gstin: c.gstin || "",
          phone: c.phone || "",
          email: c.email || "",
          businessType: c.business_type || "",
          createdAt: c.created_at || "",
        })));
      }
    } catch (err) {
      console.error("Error loading user data:", err);
    }
    setIsLoaded(true);
  }, []);

  const clearUserData = useCallback(() => {
    setProfile(null);
    setPurchases([]);
    setSales([]);
    setGstr2bEntries([]);
    setClients([]);
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
      } else {
        setIsLoaded(true);
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
    await supabase.from("profiles").upsert({
      id: userId,
      business_name: data.businessName,
      owner_name: data.ownerName,
      gstin: data.gstin,
      phone: data.phone,
      email: data.email,
      business_type: data.businessType,
      updated_at: new Date().toISOString(),
    });
    setProfile({ ...data, id: userId });
  }, [userId]);

  const addPurchase = useCallback(async (data: Omit<PurchaseInvoice, "id" | "createdAt">): Promise<PurchaseInvoice> => {
    if (!userId) throw new Error("Not logged in");
    const id = generateId();
    const { error } = await supabase.from("purchases").insert({
      id,
      user_id: userId,
      supplier_name: data.supplierName,
      supplier_gstin: data.supplierGSTIN,
      invoice_number: data.invoiceNumber,
      invoice_date: data.invoiceDate,
      description: data.description,
      hsn: data.hsn,
      quantity: data.quantity || 1,
      rate: data.rate || 0,
      gst_rate: data.gstRate,
      taxable_amount: data.taxableAmount,
      gst_amount: data.gstAmount,
      total_amount: data.totalAmount,
    });
    if (error) throw error;
    
    // Fixed Memory: Added quantity and rate explicitly here
    const newPurchase = { 
      ...data, 
      id, 
      quantity: data.quantity || 1, 
      rate: data.rate || 0, 
      createdAt: new Date().toISOString() 
    };
    setPurchases(prev => [newPurchase, ...prev]);
    return newPurchase;
  }, [userId]);

  const updatePurchase = useCallback(async (id: string, data: Partial<PurchaseInvoice>) => {
    if (!userId) return;
    await supabase.from("purchases").update({
      supplier_name: data.supplierName,
      supplier_gstin: data.supplierGSTIN,
      invoice_number: data.invoiceNumber,
      invoice_date: data.invoiceDate,
      description: data.description,
      hsn: data.hsn,
      quantity: data.quantity || 1,
      rate: data.rate || 0,
      gst_rate: data.gstRate,
      taxable_amount: data.taxableAmount,
      gst_amount: data.gstAmount,
      total_amount: data.totalAmount,
    }).eq("id", id);
    
    // Fixed Memory
    setPurchases(prev => prev.map(p => p.id === id ? { ...p, ...data, quantity: data.quantity || p.quantity, rate: data.rate || p.rate } : p));
  }, [userId]);

  const deletePurchase = useCallback(async (id: string) => {
    if (!userId) return;
    await supabase.from("purchases").delete().eq("id", id);
    setPurchases(prev => prev.filter(p => p.id !== id));
  }, [userId]);

  const updateSupplierAcrossPurchases = useCallback(async (
    oldKey: string,
    newData: { supplierName: string; supplierGSTIN: string }
  ) => {
    if (!userId) return;
    const toUpdate = purchases.filter(p => (p.supplierGSTIN || p.supplierName) === oldKey);
    for (const p of toUpdate) {
      await supabase.from("purchases").update({
        supplier_name: newData.supplierName,
        supplier_gstin: newData.supplierGSTIN,
      }).eq("id", p.id);
    }
    setPurchases(prev => prev.map(p => {
      const key = p.supplierGSTIN || p.supplierName;
      if (key === oldKey) return { ...p, supplierName: newData.supplierName, supplierGSTIN: newData.supplierGSTIN };
      return p;
    }));
  }, [purchases, userId]);

  const addSale = useCallback(async (data: Omit<SalesInvoice, "id" | "createdAt">): Promise<SalesInvoice> => {
    if (!userId) throw new Error("Not logged in");
    const id = generateId();
    const { error } = await supabase.from("sales").insert({
      id,
      user_id: userId,
      customer_name: data.customerName,
      customer_gstin: data.customerGSTIN,
      invoice_number: data.invoiceNumber,
      invoice_date: data.invoiceDate,
      description: data.description,
      hsn: data.hsn,
      quantity: data.quantity || 1,
      rate: data.rate || 0,
      gst_rate: data.gstRate,
      taxable_amount: data.taxableAmount,
      gst_amount: data.gstAmount,
      total_amount: data.totalAmount,
    });
    if (error) throw error;
    
    // Fixed Memory
    const newSale = { 
      ...data, 
      id, 
      quantity: data.quantity || 1, 
      rate: data.rate || 0, 
      createdAt: new Date().toISOString() 
    };
    setSales(prev => [newSale, ...prev]);
    return newSale;
  }, [userId]);

  const updateSale = useCallback(async (id: string, data: Partial<SalesInvoice>) => {
    if (!userId) return;
    await supabase.from("sales").update({
      customer_name: data.customerName,
      customer_gstin: data.customerGSTIN,
      invoice_number: data.invoiceNumber,
      invoice_date: data.invoiceDate,
      description: data.description,
      hsn: data.hsn,
      quantity: data.quantity || 1,
      rate: data.rate || 0,
      gst_rate: data.gstRate,
      taxable_amount: data.taxableAmount,
      gst_amount: data.gstAmount,
      total_amount: data.totalAmount,
    }).eq("id", id);
    
    // Fixed Memory
    setSales(prev => prev.map(s => s.id === id ? { ...s, ...data, quantity: data.quantity || s.quantity, rate: data.rate || s.rate } : s));
  }, [userId]);

  const deleteSale = useCallback(async (id: string) => {
    if (!userId) return;
    await supabase.from("sales").delete().eq("id", id);
    setSales(prev => prev.filter(s => s.id !== id));
  }, [userId]);

  const updateCustomerAcrossSales = useCallback(async (
    oldKey: string,
    newData: { customerName: string; customerGSTIN: string }
  ) => {
    if (!userId) return;
    const toUpdate = sales.filter(s => (s.customerGSTIN || s.customerName) === oldKey);
    for (const s of toUpdate) {
      await supabase.from("sales").update({
        customer_name: newData.customerName,
        customer_gstin: newData.customerGSTIN,
      }).eq("id", s.id);
    }
    setSales(prev => prev.map(s => {
      const key = s.customerGSTIN || s.customerName;
      if (key === oldKey) return { ...s, customerName: newData.customerName, customerGSTIN: newData.customerGSTIN };
      return s;
    }));
  }, [sales, userId]);

  const addGSTR2BEntries = useCallback(async (entries: Omit<GSTR2BEntry, "id">[]) => {
    if (!userId) return;
    const newEntries = entries.map(e => ({
      id: generateId(),
      user_id: userId,
      supplier_name: e.supplierName,
      supplier_gstin: e.supplierGSTIN,
      invoice_number: e.invoiceNumber,
      invoice_date: e.invoiceDate,
      taxable_amount: e.taxableAmount,
      igst: e.igst,
      cgst: e.cgst,
      sgst: e.sgst,
      total_itc: e.totalITC,
      gst_rate: e.gstRate,
      period: e.period,
    }));
    await supabase.from("gstr2b_entries").insert(newEntries);
    setGstr2bEntries(prev => [...prev, ...newEntries.map(e => ({
      id: e.id,
      supplierName: e.supplier_name,
      supplierGSTIN: e.supplier_gstin,
      invoiceNumber: e.invoice_number,
      invoiceDate: e.invoice_date,
      taxableAmount: e.taxable_amount,
      igst: e.igst,
      cgst: e.cgst,
      sgst: e.sgst,
      totalITC: e.total_itc,
      gstRate: e.gst_rate,
      period: e.period,
    }))]);
  }, [userId]);

  const clearGSTR2B = useCallback(async () => {
    if (!userId) return;
    await supabase.from("gstr2b_entries").delete().eq("user_id", userId);
    setGstr2bEntries([]);
  }, [userId]);

  const addClient = useCallback(async (data: Omit<Client, "id" | "createdAt">): Promise<Client> => {
    if (!userId) throw new Error("Not logged in");
    const id = generateId();
    await supabase.from("clients").insert({
      id,
      user_id: userId,
      business_name: data.businessName,
      owner_name: data.ownerName,
      gstin: data.gstin,
      phone: data.phone,
      email: data.email,
      business_type: data.businessType,
    });
    const newClient = { ...data, id, createdAt: new Date().toISOString() };
    setClients(prev => [...prev, newClient]);
    return newClient;
  }, [userId]);

  const updateClient = useCallback(async (id: string, data: Partial<Client>) => {
    if (!userId) return;
    await supabase.from("clients").update({
      business_name: data.businessName,
      owner_name: data.ownerName,
      gstin: data.gstin,
      phone: data.phone,
      email: data.email,
      business_type: data.businessType,
    }).eq("id", id);
    setClients(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
  }, [userId]);

  const deleteClient = useCallback(async (id: string) => {
    if (!userId) return;
    await supabase.from("clients").delete().eq("id", id);
    setClients(prev => prev.filter(c => c.id !== id));
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
        g => g.supplierGSTIN.toLowerCase() === purchase.supplierGSTIN.toLowerCase() &&
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
    const critical = results.filter(r => r.status === "supplier_not_filed" || r.status === "missing_from_register").length;
    const mismatches = results.filter(r => r.status === "amount_mismatch").length;
    if (critical > 0) return "red";
    if (mismatches > 0) return "yellow";
    return "green";
  }, []);

  const getITCSummary = useCallback((results: ReconciliationResult[]) => {
    const totalITCAvailable = gstr2bEntries.reduce((s, g) => s + g.totalITC, 0);
    const itcMatched = results.filter(r => r.status === "matched").reduce((s, r) => s + (r.gstr2bAmount ?? 0), 0);
    const itcAtRisk = results.filter(r => r.status === "supplier_not_filed").reduce((s, r) => s + (r.purchaseAmount ?? 0), 0);
    const itcRecoverable = results.filter(r => r.status === "missing_from_register").reduce((s, r) => s + (r.gstr2bAmount ?? 0), 0);
    return { totalITCAvailable, itcMatched, itcAtRisk, itcRecoverable };
  }, [gstr2bEntries]);

  const value = useMemo<GSTContextValue>(() => ({
    profile, purchases, sales, gstr2bEntries, clients, isLoaded, currentUserEmail,
    saveProfile,
    addPurchase, updatePurchase, deletePurchase, updateSupplierAcrossPurchases,
    addSale, updateSale, deleteSale, updateCustomerAcrossSales,
    addGSTR2BEntries, clearGSTR2B,
    addClient, updateClient, deleteClient,
    getSuppliers, getCustomers,
    getReconciliation, getRiskLevel, getITCSummary,
  }), [
    profile, purchases, sales, gstr2bEntries, clients, isLoaded, currentUserEmail,
    saveProfile,
    addPurchase, updatePurchase, deletePurchase, updateSupplierAcrossPurchases,
    addSale, updateSale, deleteSale, updateCustomerAcrossSales,
    addGSTR2BEntries, clearGSTR2B,
    addClient, updateClient, deleteClient,
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