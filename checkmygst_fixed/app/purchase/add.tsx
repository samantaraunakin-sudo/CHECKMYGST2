import { sharePDF, printPDF } from "../../lib/pdfGenerator";
import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  Platform, ActivityIndicator, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system";
import { useGST, getTodayDate, generateId } from "@/contexts/GSTContext";
import { getApiUrl } from "@/lib/query-client";
import { supabase } from "@/lib/supabase";
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

export default function AddPurchaseScreen() {
  const insets = useSafeAreaInsets();
  const { addPurchase } = useGST();
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hsnLoading, setHsnLoading] = useState<string | null>(null);

  const [form, setForm] = useState({
    supplierName: "",
    supplierGSTIN: "",
    invoiceNumber: "",
    invoiceDate: getTodayDate(),
  });

  const [items, setItems] = useState<LineItem[]>(() => {
    const initial = [{ id: generateId(), description: "", hsn: "", quantity: "", rate: "", gstRate: 18 }];
    return initial;
  });

  // itemsRef always holds latest items — fixes web stale closure bug on Save
  const itemsRef = useRef<LineItem[]>(items);
  const syncItems = (newItems: LineItem[]) => { itemsRef.current = newItems; return newItems; };

  const updateForm = (key: string, value: string) => setForm(p => ({ ...p, [key]: value }));

  const updateItem = (id: string, key: keyof LineItem, value: string | number) => {
    setItems(prev => syncItems(prev.map(item => item.id === id ? { ...item, [key]: value } : item)));
  };

  const addItem = () => {
    setItems(prev => [...prev, { id: generateId(), description: "", hsn: "", quantity: "", rate: "", gstRate: 18 }]);
  };

  const removeItem = (id: string) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter(item => item.id !== id));
  };

  // Type product name → get HSN + GST rate
  const handleHSNLookup = async (itemId: string, query: string) => {
    if (!query.trim()) return;
    setHsnLoading(itemId);
    try {
      const url = new URL("/api/hsn-lookup", getApiUrl());
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(prev => prev.map(item =>
        item.id === itemId ? {
          ...item,
          hsn: data.hsn || item.hsn,
          gstRate: data.gstRate || item.gstRate,
        } : item
      ));
    } catch {
      Alert.alert("Error", "Could not find HSN for this product");
    } finally {
      setHsnLoading(null);
    }
  };

  // Type HSN code → get product name + GST rate automatically
  const handleHSNReverseLookup = async (itemId: string, hsn: string) => {
    if (!hsn || hsn.length < 4) return;
    setHsnLoading(itemId);
    try {
      const url = new URL("/api/hsn-reverse-lookup", getApiUrl());
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hsn }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(prev => prev.map(item =>
        item.id === itemId ? {
          ...item,
          description: data.description || item.description,
          gstRate: data.gstRate || item.gstRate,
        } : item
      ));
    } catch {
      // silent fail
    } finally {
      setHsnLoading(null);
    }
  };

  // Scan invoice photo → auto-fill everything
  const handleTakePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Camera Permission", "Please allow camera access.");
        return;
      }
    } catch {}
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8, base64: true });
    if (result.canceled || !result.assets[0]) return;
    await processInvoiceImage(result.assets[0]);
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8, base64: true });
    if (result.canceled || !result.assets[0]) return;
    await processInvoiceImage(result.assets[0]);
  };

  const processInvoiceImage = async (asset: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExtracting(true);
    try {
      let base64 = asset.base64;
      if (!base64 && asset.uri) {
        base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: (FileSystem as any).EncodingType?.Base64 || "base64" });
      }
      const mimeType = asset.mimeType || "image/jpeg";
      const url = new URL("/api/extract-invoice", getApiUrl());
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });
      if (!res.ok) throw new Error("Extraction failed");
      const data = await res.json();
      setForm({
        supplierName: data.supplierName || "",
        supplierGSTIN: data.supplierGSTIN || "",
        invoiceNumber: data.invoiceNumber || "",
        invoiceDate: data.invoiceDate || getTodayDate(),
      });
      if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        setItems(data.items.map((item: any) => ({
          id: generateId(),
          description: item.description || "",
          hsn: item.hsn || "",
          quantity: String(item.quantity || "1"),
          rate: String(item.rate || ""),
          gstRate: item.gstRate || 18,
        })));
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Scan Failed", "Could not read the invoice. Please try again or enter details manually.");
    } finally {
      setIsExtracting(false);
    }
  };

  const subtotal = items.reduce((sum, item) => sum + calcItem(item).taxable, 0);
  const totalGST = items.reduce((sum, item) => sum + calcItem(item).gst, 0);
  const totalBeforeRound = subtotal + totalGST;
  const roundOff = Math.round(totalBeforeRound) - totalBeforeRound;
  const grandTotal = totalBeforeRound + roundOff;

  const handleSave = async () => {
    if (!form.supplierName.trim()) { Alert.alert("Required", "Supplier name is required"); return; }
    if (!form.invoiceNumber.trim()) { Alert.alert("Required", "Invoice number is required"); return; }
    // Use ref — guaranteed latest values even if state hasn't flushed on web
    const currentItems = itemsRef.current;
    const validItems = currentItems.filter(i => i.description.trim() && parseFloat(i.quantity || "0") > 0 && parseFloat(i.rate || "0") > 0);
    if (validItems.length === 0) { Alert.alert("Required", "At least one product with quantity and rate is required"); return; }

    setIsSaving(true);
    try {
      const purchase = await addPurchase({
        supplierName: form.supplierName.trim(),
        supplierGSTIN: form.supplierGSTIN.trim(),
        invoiceNumber: form.invoiceNumber.trim(),
        invoiceDate: form.invoiceDate || getTodayDate(),
        description: validItems.map(i => i.description).join(", "),
        hsn: validItems[0].hsn,
        quantity: validItems.length === 1 ? (parseFloat(validItems[0].quantity) || 1) : 1,
        rate: validItems.length === 1 ? (parseFloat(validItems[0].rate) || subtotal) : subtotal,
        gstRate: validItems[0].gstRate,
        taxableAmount: subtotal,
        gstAmount: totalGST,
        totalAmount: grandTotal,
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const lineItems = validItems.map(item => {
          const calc = calcItem(item);
          return {
            id: generateId(),
            purchase_id: purchase.id,
            user_id: user.id,
            description: item.description,
            hsn: item.hsn,
            quantity: parseFloat(item.quantity),
            rate: parseFloat(item.rate),
            taxable_amount: calc.taxable,
            gst_rate: item.gstRate,
            gst_amount: calc.gst,
            total_amount: calc.total,
          };
        });
        await supabase.from("purchase_items").insert(lineItems);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Alert.alert("Error", "Failed to save invoice");
    } finally {
      setIsSaving(false);
    }
  };

  const topPad = Platform.OS === "web" ? insets.top + 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="close" size={26} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Purchase Invoice</Text>
        <TouchableOpacity style={[styles.saveBtn, isSaving && { opacity: 0.6 }]} onPress={handleSave} disabled={isSaving}>
          {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

        {/* AI Scan Button */}
                {isExtracting ? (
          <View style={[styles.scanCard, { justifyContent: "center", alignItems: "center", flexDirection: "row", gap: 12 }]}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.scanTitle}>Reading invoice with AI...</Text>
          </View>
        ) : (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity style={[styles.scanCard, { flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center" }]} onPress={handleTakePhoto} activeOpacity={0.8}>
              <Ionicons name="camera" size={28} color={Colors.primary} />
              <Text style={[styles.scanTitle, { marginTop: 6 }]}>📷 Camera</Text>
              <Text style={styles.scanSubtitle}>Click photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.scanCard, { flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center" }]} onPress={handlePickImage} activeOpacity={0.8}>
              <Ionicons name="image-outline" size={28} color={Colors.primary} />
              <Text style={[styles.scanTitle, { marginTop: 6 }]}>🖼️ Upload</Text>
              <Text style={styles.scanSubtitle}>From gallery</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.divider}>
          <View style={styles.divLine} /><Text style={styles.divText}>or enter manually</Text><View style={styles.divLine} />
        </View>

        {/* Supplier Details */}
        <Text style={styles.section}>Supplier Details</Text>
        <View style={styles.field}>
          <Text style={styles.label}>Supplier Name *</Text>
          <TextInput style={styles.input} placeholder="e.g. ABC Steel Co." placeholderTextColor={Colors.textMuted} value={form.supplierName} onChangeText={v => updateForm("supplierName", v)} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Supplier GSTIN</Text>
          <TextInput style={styles.input} placeholder="e.g. 29ABCDE1234F1Z5" placeholderTextColor={Colors.textMuted} value={form.supplierGSTIN} onChangeText={v => updateForm("supplierGSTIN", v.toUpperCase())} autoCapitalize="characters" maxLength={15} />
        </View>

        {/* Invoice Details */}
        <Text style={styles.section}>Invoice Details</Text>
        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Invoice Number *</Text>
            <TextInput style={styles.input} placeholder="INV-001" placeholderTextColor={Colors.textMuted} value={form.invoiceNumber} onChangeText={v => updateForm("invoiceNumber", v)} />
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Invoice Date</Text>
            <TextInput style={styles.input} placeholder="DD/MM/YYYY" placeholderTextColor={Colors.textMuted} value={form.invoiceDate} onChangeText={v => updateForm("invoiceDate", v)} />
          </View>
        </View>

        {/* Products */}
        <Text style={styles.section}>Products / Items</Text>
        {items.map((item, index) => (
          <View key={item.id} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemTitle}>Item {index + 1}</Text>
              {items.length > 1 && (
                <TouchableOpacity onPress={() => removeItem(item.id)}>
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>

            {/* HSN Code — enter to auto-fill product + GST */}
            <View style={styles.field}>
              <Text style={styles.label}>HSN Code → auto-fills product + GST rate</Text>
              <View style={styles.hsnRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Type HSN code e.g. 7214"
                  placeholderTextColor={Colors.textMuted}
                  value={item.hsn}
                  onChangeText={v => {
                    updateItem(item.id, "hsn", v);
                    if (v.length >= 4) handleHSNReverseLookup(item.id, v);
                  }}
                  keyboardType="numeric"
                />
                <TouchableOpacity
                  style={styles.aiBtn}
                  onPress={() => handleHSNReverseLookup(item.id, item.hsn)}
                  disabled={hsnLoading === item.id}
                >
                  {hsnLoading === item.id
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name="search" size={16} color="#fff" />
                  }
                </TouchableOpacity>
              </View>
            </View>

            {/* Description — auto-filled from HSN, or type to get HSN */}
            <View style={styles.field}>
              <Text style={styles.label}>Product Description</Text>
              <View style={styles.hsnRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Auto-filled from HSN, or type product name"
                  placeholderTextColor={Colors.textMuted}
                  value={item.description}
                  onChangeText={v => updateItem(item.id, "description", v)}
                />
                <TouchableOpacity
                  style={[styles.aiBtn, { backgroundColor: "#7C3AED" }]}
                  onPress={() => handleHSNLookup(item.id, item.description)}
                  disabled={hsnLoading === item.id}
                >
                  {hsnLoading === item.id
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name="sparkles" size={16} color="#fff" />
                  }
                </TouchableOpacity>
              </View>
              <Text style={styles.hintText}>🔍 Search by HSN code above OR ✨ tap purple button to find HSN from product name</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>GST Rate (auto-filled from HSN)</Text>
              <View style={styles.rateRow}>
                {GST_RATES.map(rate => (
                  <TouchableOpacity key={rate} style={[styles.rateChip, item.gstRate === rate && styles.rateChipActive]} onPress={() => updateItem(item.id, "gstRate", rate)}>
                    <Text style={[styles.rateChipText, item.gstRate === rate && styles.rateChipTextActive]}>{rate}%</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>Quantity *</Text>
                <TextInput style={styles.input} placeholder="0" placeholderTextColor={Colors.textMuted} value={item.quantity} onChangeText={v => updateItem(item.id, "quantity", v)} onEndEditing={e => updateItem(item.id, "quantity", e.nativeEvent.text)} keyboardType="numeric" />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>Rate per unit (₹) *</Text>
                <TextInput style={styles.input} placeholder="0.00" placeholderTextColor={Colors.textMuted} value={item.rate} onChangeText={v => updateItem(item.id, "rate", v)} onEndEditing={e => updateItem(item.id, "rate", e.nativeEvent.text)} keyboardType="numeric" />
              </View>
            </View>

            {parseFloat(item.quantity || "0") > 0 && parseFloat(item.rate || "0") > 0 && (
              <View style={styles.itemSummary}>
                <Text style={styles.itemSummaryText}>Taxable: ₹{calcItem(item).taxable.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</Text>
                <Text style={styles.itemSummaryText}>GST: ₹{calcItem(item).gst.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</Text>
                <Text style={[styles.itemSummaryText, { fontWeight: "700", color: Colors.primary }]}>Total: ₹{calcItem(item).total.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</Text>
              </View>
            )}
          </View>
        ))}

        <TouchableOpacity style={styles.addItemBtn} onPress={addItem}>
          <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
          <Text style={styles.addItemText}>Add Another Product</Text>
        </TouchableOpacity>

        {/* Grand Total */}
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>Invoice Summary</Text>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Subtotal (Taxable)</Text><Text style={styles.summaryValue}>₹{subtotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Total GST</Text><Text style={styles.summaryValue}>₹{totalGST.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</Text></View>
          {Math.abs(roundOff) > 0.001 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Round Off</Text>
              <Text style={[styles.summaryValue, { color: roundOff > 0 ? "#22c55e" : "#EF4444" }]}>{roundOff > 0 ? "+" : ""}₹{roundOff.toFixed(2)}</Text>
            </View>
          )}
          <View style={[styles.summaryRow, styles.summaryTotal]}>
            <Text style={styles.summaryTotalLabel}>Grand Total</Text>
            <Text style={styles.summaryTotalValue}>₹{grandTotal.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</Text>
          </View>
        </View>
        {/* PDF BUTTONS */}

<TouchableOpacity
  style={{
    backgroundColor: "#2563EB",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 14
  }}
  onPress={() =>
    sharePDF({
      supplierName: form.supplierName,
      supplierGSTIN: form.supplierGSTIN,
      invoiceNumber: form.invoiceNumber,
      invoiceDate: form.invoiceDate,
      items,
      totalGST,
      grandTotal
    })
  }
>
  <Text style={{ color: "#fff", fontWeight: "600" }}>
    Generate & Share PDF Bill
  </Text>
</TouchableOpacity>

<TouchableOpacity
  style={{
    backgroundColor: "#111827",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10
  }}
  onPress={() =>
    printPDF({
      supplierName: form.supplierName,
      supplierGSTIN: form.supplierGSTIN,
      invoiceNumber: form.invoiceNumber,
      invoiceDate: form.invoiceDate,
      items,
      totalGST,
      grandTotal
    })
  }
>
  <Text style={{ color: "#fff", fontWeight: "600" }}>
    Print Invoice
  </Text>
</TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  headerTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary },
  saveBtn: { backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  saveBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  scrollContent: { padding: 16, gap: 4, paddingBottom: 80 },
  scanCard: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surface, borderRadius: 14, padding: 16, gap: 12, borderWidth: 1.5, borderColor: Colors.primary, marginBottom: 4 },
  scanIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center" },
  scanTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary },
  scanSubtitle: { fontSize: 12, color: Colors.textSecondary },
  divider: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 12 },
  divLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  divText: { fontSize: 12, color: Colors.textMuted },
  section: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary, marginTop: 8, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  field: { marginBottom: 12 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary, marginBottom: 6 },
  input: { backgroundColor: Colors.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border },
  row: { flexDirection: "row", gap: 12 },
  hsnRow: { flexDirection: "row", gap: 8 },
  aiBtn: { width: 46, height: 46, borderRadius: 10, backgroundColor: Colors.primary, justifyContent: "center", alignItems: "center" },
  hintText: { fontSize: 11, color: Colors.textMuted, marginTop: 4, lineHeight: 16 },
  itemCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  itemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  itemTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary },
  itemSummary: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#F0F7FF", borderRadius: 8, padding: 10, marginTop: 4 },
  itemSummaryText: { fontSize: 12, color: Colors.textSecondary },
  rateRow: { flexDirection: "row", gap: 4 },
  rateChip: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  rateChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  rateChipText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
  rateChipTextActive: { color: "#fff" },
  addItemBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.primary, borderStyle: "dashed", marginBottom: 16 },
  addItemText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.primary },
  summary: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, gap: 10, borderWidth: 1, borderColor: Colors.border },
  summaryTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.textPrimary, marginBottom: 4 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryLabel: { fontSize: 14, color: Colors.textSecondary },
  summaryValue: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.textPrimary },
  summaryTotal: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10, marginTop: 4 },
  summaryTotalLabel: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.textPrimary },
  summaryTotalValue: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.primary },
});