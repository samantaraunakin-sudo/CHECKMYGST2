import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import { supabase } from "@/lib/supabase";

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

export interface SalesInvoice extends Omit<PurchaseInvoice, 'supplierName' | 'supplierGSTIN'> {
  customerName: string;
  customerGSTIN: string;
}

interface GSTContextValue {
  purchases: PurchaseInvoice[];
  sales: SalesInvoice[];
  isLoaded: boolean;
  addPurchase: (data: Omit<PurchaseInvoice, "id" | "createdAt">) => Promise<void>;
  addSale: (data: Omit<SalesInvoice, "id" | "createdAt">) => Promise<void>;
}

const GSTContext = createContext<GSTContextValue | null>(null);

export function GSTProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [purchases, setPurchases] = useState<PurchaseInvoice[]>([]);
  const [sales, setSales] = useState<SalesInvoice[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const fetchData = useCallback(async (uid: string) => {
    const { data: pData } = await supabase.from("purchases").select("*").eq("user_id", uid).order("created_at", { ascending: false });
    const { data: sData } = await supabase.from("sales").select("*").eq("user_id", uid).order("created_at", { ascending: false });

    if (pData) {
      setPurchases(pData.map(p => ({
        id: p.id,
        supplierName: p.supplier_name,
        supplierGSTIN: p.supplier_gstin,
        invoiceNumber: p.invoice_number,
        invoiceDate: p.invoice_date,
        description: p.description,
        hsn: p.hsn,
        quantity: parseFloat(p.quantity) || 1, // THE FIX: Explicitly parse quantity
        rate: parseFloat(p.rate) || 0,         // THE FIX: Explicitly parse rate
        gstRate: p.gst_rate,
        taxableAmount: p.taxable_amount,
        gstAmount: p.gst_amount,
        totalAmount: p.total_amount,
        createdAt: p.created_at
      })));
    }

    if (sData) {
      setSales(sData.map(s => ({
        id: s.id,
        customerName: s.customer_name,
        customerGSTIN: s.customer_gstin,
        invoiceNumber: s.invoice_number,
        invoiceDate: s.invoice_date,
        description: s.description,
        hsn: s.hsn,
        quantity: parseFloat(s.quantity) || 1,
        rate: parseFloat(s.rate) || 0,
        gstRate: s.gst_rate,
        taxableAmount: s.taxable_amount,
        gstAmount: s.gst_amount,
        totalAmount: s.total_amount,
        createdAt: s.created_at
      })));
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id);
        fetchData(session.user.id);
      }
    });
  }, [fetchData]);

  const addPurchase = async (data: Omit<PurchaseInvoice, "id" | "createdAt">) => {
    if (!userId) return;
    const { error } = await supabase.from("purchases").insert({
      user_id: userId,
      supplier_name: data.supplierName,
      supplier_gstin: data.supplierGSTIN,
      invoice_number: data.invoiceNumber,
      invoice_date: data.invoiceDate,
      description: data.description,
      hsn: data.hsn,
      quantity: data.quantity, // SAVING RAW NUMERIC
      rate: data.rate,         // SAVING RAW NUMERIC
      gst_rate: data.gstRate,
      taxable_amount: data.taxableAmount,
      gst_amount: data.gstAmount,
      total_amount: data.totalAmount
    });
    if (!error) fetchData(userId);
  };

  const addSale = async (data: Omit<SalesInvoice, "id" | "createdAt">) => {
    if (!userId) return;
    const { error } = await supabase.from("sales").insert({
      user_id: userId,
      customer_name: data.customerName,
      customer_gstin: data.customerGSTIN,
      invoice_number: data.invoiceNumber,
      invoice_date: data.invoiceDate,
      description: data.description,
      hsn: data.hsn,
      quantity: data.quantity,
      rate: data.rate,
      gst_rate: data.gstRate,
      taxable_amount: data.taxableAmount,
      gst_amount: data.gstAmount,
      total_amount: data.totalAmount
    });
    if (!error) fetchData(userId);
  };

  const value = useMemo(() => ({ purchases, sales, isLoaded, addPurchase, addSale }), [purchases, sales, isLoaded]);
  return <GSTContext.Provider value={value}>{children}</GSTContext.Provider>;
}

export const useGST = () => {
  const context = useContext(GSTContext);
  if (!context) throw new Error("useGST must be used within GSTProvider");
  return context;
};