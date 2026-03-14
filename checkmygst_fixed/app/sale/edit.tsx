import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  Platform, ActivityIndicator, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { useGST, generateId } from "@/contexts/GSTContext";
import { getApiUrl } from "@/lib/query-client";
import Colors from "@/constants/colors";

const GST_RATES = [0, 5, 12, 18, 28];

interface LineItem {
  id: string;
  description: string;
  hsn: string;
  quantity: string;
  rate: string;
  gstRate: number;
}

function calcItem(item: LineItem) {
  const qty = parseFloat(item.quantity || "0");
  const rate = parseFloat(item.rate || "0");
  const taxable = qty * rate;
  const gst = taxable * (item.gstRate / 100);
  return { taxable, gst, total: taxable + gst };
}

export default function EditSaleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sales, updateSale } = useGST();
  const [isSaving, setIsSaving] = useState(false);
  const [hsnLoading, setHsnLoading] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [form, setForm] = useState({
    customerName: "",
    customerGSTIN: "",
    invoiceNumber: "",
    invoiceDate: "",
  });

  const [items, setItems] = useState<LineItem[]>([
    { id: generateId(), description: "", hsn: "", quantity: "1", rate: "", gstRate: 18 },
  ]);

  useEffect(() => {
    const sale = sales.find(s => s.id === id);
    if (!sale) { setNotFound(true); return; }
    setForm({
      customerName: (sale as any).customerName || "",
      customerGSTIN: (sale as any).customerGSTIN || "",
      invoiceNumber: (sale as any).invoiceNumber || "",
      invoiceDate: sale.invoiceDate || "",
    });
    const saleAny = sale as any;
    if (saleAny.items && Array.isArray(saleAny.items)) {
      setItems(saleAny.items.map((item: any) => ({
        id: generateId(),
        description: item.description || "",
        hsn: item.hsn || "",
        quantity: String(sale.quantity && sale.quantity > 0 ? sale.quantity : 1),
        rate: String(sale.rate && sale.rate > 0 ? sale.rate : (sale.taxableAmount || 0)),
        gstRate: item.gstRate || 18,
      })));
    } else {
      setItems([{
        id: generateId(),
        description: saleAny.description || "",
        hsn: saleAny.hsn || "",
        quantity: "1",
        rate: String(saleAny.taxableAmount || ""),
        gstRate: saleAny.gstRate || 18,
      }]);
    }
  }, [id, sales]);

  const updateForm = (key: string, value: string) => setForm(p => ({ ...p, [key]: value }));
  const updateItem = (itemId: string, key: keyof LineItem, value: string | number) =>
    setItems(prev => prev.map(item => item.id === itemId ? { ...item, [key]: value } : item));
  const addItem = () => setItems(prev => [...prev, { id: generateId(), description: "", hsn: "", quantity: "", rate: "", gstRate: 18 }]);
  const removeItem = (itemId: string) => { if (items.length > 1) setItems(prev => prev.filter(i => i.id !== itemId)); };

  const handleHSNLookup = async (itemId: string, query: string) => {
    if (!query.trim()) return;
    setHsnLoading(itemId);
    try {
      const res = await fetch(new URL("/api/hsn-lookup", getApiUrl()).toString(), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      const data = await res.json();
      setItems(prev => prev.map(item => item.id === itemId ? { ...item, hsn: data.hsn || item.hsn, gstRate: data.gstRate || item.gstRate } : item));
    } catch {} finally { setHsnLoading(null); }
  };

  const totals = items.map(calcItem);
  const totalTaxable = totals.reduce((s, t) => s + t.taxable, 0);
  const totalGST = totals.reduce((s, t) => s + t.gst, 0);
  const grandTotal = totals.reduce((s, t) => s + t.total, 0);

  const handleSave = async () => {
    if (!form.customerName.trim()) { Alert.alert("Required", "Customer name is required"); return; }
    setIsSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const firstItem = items[0];
      await updateSale(id!, {
        customerName: form.customerName.trim(),
        customerGSTIN: form.customerGSTIN.trim(),
        invoiceNumber: form.invoiceNumber.trim(),
        invoiceDate: form.invoiceDate.trim(),
        description: items.map(i => i.description).filter(Boolean).join(", "),
        hsn: firstItem.hsn,
        gstRate: firstItem.gstRate,
        taxableAmount: totalTaxable,
        gstAmount: totalGST,
        totalAmount: grandTotal,
        items: items.map(item => {
          const c = calcItem(item);
          return {
            description: item.description,
            hsn: item.hsn,
            quantity: parseFloat(item.quantity || "1"),
            rate: parseFloat(item.rate || "0"),
            gstRate: item.gstRate,
            taxableAmount: c.taxable,
            gstAmount: c.gst,
            total: c.total,
          };
        }),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Alert.alert("Error", "Could not save changes. Try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (notFound) return (
    <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
      <Text style={{ color: "#6b7280", fontSize: 16 }}>Invoice not found</Text>
      <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
        <Text style={{ color: Colors.primary }}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="close" size={26} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Sale</Text>
        <TouchableOpacity style={[styles.saveBtn, isSaving && { opacity: 0.5 }]} onPress={handleSave} disabled={isSaving}>
          {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        <Text style={styles.section}>Customer Details</Text>
        <View style={styles.field}>
          <Text style={styles.label}>Customer Name *</Text>
          <TextInput style={styles.input} value={form.customerName} onChangeText={v => updateForm("customerName", v)} placeholder="e.g. Sharma Enterprises" placeholderTextColor="#9ca3af" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Customer GSTIN</Text>
          <TextInput style={styles.input} value={form.customerGSTIN} onChangeText={v => updateForm("customerGSTIN", v.toUpperCase())} placeholder="15-digit GSTIN" placeholderTextColor="#9ca3af" autoCapitalize="characters" maxLength={15} />
        </View>
        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Invoice Number</Text>
            <TextInput style={styles.input} value={form.invoiceNumber} onChangeText={v => updateForm("invoiceNumber", v)} placeholder="e.g. INV-001" placeholderTextColor="#9ca3af" />
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Invoice Date</Text>
            <TextInput style={styles.input} value={form.invoiceDate} onChangeText={v => updateForm("invoiceDate", v)} placeholder="DD/MM/YYYY" placeholderTextColor="#9ca3af" />
          </View>
        </View>

        <Text style={styles.section}>Items</Text>
        {items.map((item, idx) => {
          const calc = calcItem(item);
          return (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>Item {idx + 1}</Text>
                {items.length > 1 && (
                  <TouchableOpacity onPress={() => removeItem(item.id)}>
                    <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Description</Text>
                <View style={styles.hsnRow}>
                  <TextInput style={[styles.input, { flex: 1 }]} value={item.description} onChangeText={v => updateItem(item.id, "description", v)} placeholder="Product name" placeholderTextColor="#9ca3af" onEndEditing={() => handleHSNLookup(item.id, item.description)} />
                  <TouchableOpacity style={styles.aiBtn} onPress={() => handleHSNLookup(item.id, item.description)}>
                    {hsnLoading === item.id ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="sparkles" size={18} color="#fff" />}
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.row}>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.label}>HSN</Text>
                  <TextInput style={styles.input} value={item.hsn} onChangeText={v => updateItem(item.id, "hsn", v)} placeholder="HSN" placeholderTextColor="#9ca3af" keyboardType="numeric" />
                </View>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.label}>Qty</Text>
                  <TextInput style={styles.input} value={item.quantity} onChangeText={v => updateItem(item.id, "quantity", v)} placeholder="1" placeholderTextColor="#9ca3af" keyboardType="decimal-pad" />
                </View>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.label}>Rate (₹)</Text>
                  <TextInput style={styles.input} value={item.rate} onChangeText={v => updateItem(item.id, "rate", v)} placeholder="0" placeholderTextColor="#9ca3af" keyboardType="decimal-pad" />
                </View>
              </View>
              <Text style={styles.label}>GST Rate</Text>
              <View style={styles.rateRow}>
                {GST_RATES.map(r => (
                  <TouchableOpacity key={r} style={[styles.rateChip, item.gstRate === r && styles.rateChipActive]} onPress={() => updateItem(item.id, "gstRate", r)}>
                    <Text style={[styles.rateChipText, item.gstRate === r && styles.rateChipTextActive]}>{r}%</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.itemSummary}>
                <Text style={styles.itemSummaryText}>Taxable: ₹{calc.taxable.toFixed(2)}</Text>
                <Text style={styles.itemSummaryText}>GST: ₹{calc.gst.toFixed(2)}</Text>
                <Text style={styles.itemSummaryText}>Total: ₹{calc.total.toFixed(2)}</Text>
              </View>
            </View>
          );
        })}

        <TouchableOpacity style={styles.addItemBtn} onPress={addItem}>
          <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
          <Text style={styles.addItemText}>Add Item</Text>
        </TouchableOpacity>

        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>Invoice Summary</Text>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Taxable Amount</Text><Text style={styles.summaryValue}>₹{totalTaxable.toFixed(2)}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Total GST</Text><Text style={styles.summaryValue}>₹{totalGST.toFixed(2)}</Text></View>
          <View style={[styles.summaryRow, styles.summaryTotal]}>
            <Text style={styles.summaryTotalLabel}>Grand Total</Text>
            <Text style={styles.summaryTotalValue}>₹{grandTotal.toFixed(2)}</Text>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", paddingTop: Platform.OS === "ios" ? 56 : 48 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#e5e7eb", backgroundColor: "#fff" },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  saveBtn: { backgroundColor: "#16a34a", paddingHorizontal: 20, paddingVertical: 8, borderRadius: 10 },
  saveBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  scroll: { padding: 16, paddingBottom: 60 },
  section: { fontSize: 13, fontWeight: "700", color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 8, marginBottom: 10 },
  field: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: "500", color: "#6b7280", marginBottom: 6 },
  input: { backgroundColor: "#fff", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#111827", borderWidth: 1, borderColor: "#e5e7eb" },
  row: { flexDirection: "row", gap: 10 },
  hsnRow: { flexDirection: "row", gap: 8 },
  aiBtn: { width: 46, height: 46, borderRadius: 10, backgroundColor: Colors.primary, justifyContent: "center", alignItems: "center" },
  itemCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#e5e7eb" },
  itemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  itemTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
  rateRow: { flexDirection: "row", gap: 4, marginBottom: 12 },
  rateChip: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: "#f3f4f6", borderWidth: 1, borderColor: "#e5e7eb", alignItems: "center" },
  rateChipActive: { backgroundColor: "#16a34a", borderColor: "#16a34a" },
  rateChipText: { fontSize: 11, fontWeight: "600", color: "#6b7280" },
  rateChipTextActive: { color: "#fff" },
  itemSummary: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#f0fdf4", borderRadius: 8, padding: 10 },
  itemSummaryText: { fontSize: 12, color: "#374151" },
  addItemBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: "#16a34a", borderStyle: "dashed", marginBottom: 16 },
  addItemText: { fontSize: 14, fontWeight: "600", color: "#16a34a" },
  summary: { backgroundColor: "#fff", borderRadius: 14, padding: 16, gap: 10, borderWidth: 1, borderColor: "#e5e7eb" },
  summaryTitle: { fontSize: 14, fontWeight: "700", color: "#111827", marginBottom: 4 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryLabel: { fontSize: 14, color: "#6b7280" },
  summaryValue: { fontSize: 14, fontWeight: "500", color: "#111827" },
  summaryTotal: { borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 10, marginTop: 4 },
  summaryTotalLabel: { fontSize: 15, fontWeight: "700", color: "#111827" },
  summaryTotalValue: { fontSize: 16, fontWeight: "800", color: "#16a34a" },
});
