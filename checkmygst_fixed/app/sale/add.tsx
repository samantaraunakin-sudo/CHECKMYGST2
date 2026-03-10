import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  Platform, ActivityIndicator, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useGST, getTodayDate } from "@/contexts/GSTContext";
import { getApiUrl } from "@/lib/query-client";
import Colors from "@/constants/colors";

const GST_RATES = [0, 5, 12, 18, 28];

export default function AddSaleScreen() {
  const insets = useSafeAreaInsets();
  const { addSale } = useGST();
  const [isSaving, setIsSaving] = useState(false);
  const [hsnQuery, setHsnQuery] = useState("");
  const [hsnResult, setHsnResult] = useState("");
  const [hsnLoading, setHsnLoading] = useState(false);

  const [form, setForm] = useState({
    customerName: "",
    customerGSTIN: "",
    invoiceNumber: "",
    invoiceDate: getTodayDate(),
    description: "",
    hsn: "",
    gstRate: 18,
    taxableAmount: "",
  });

  const gstAmount = parseFloat(form.taxableAmount || "0") * (form.gstRate / 100);
  const totalAmount = parseFloat(form.taxableAmount || "0") + gstAmount;

  const update = (key: string, value: string | number) => setForm((p) => ({ ...p, [key]: value }));

  const handleHSNLookup = async () => {
    if (!hsnQuery.trim()) return;
    setHsnLoading(true);
    setHsnResult("");
    try {
      const url = new URL("/api/hsn-lookup", getApiUrl());
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: hsnQuery.trim() }),
      });
      if (!res.ok) throw new Error("Lookup failed");
      const data = await res.json();
      setHsnResult(data.description || "No description found");
      if (data.hsn) { update("hsn", data.hsn); }
    } catch {
      setHsnResult("HSN lookup failed. Please check your connection.");
    } finally {
      setHsnLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.customerName.trim()) { Alert.alert("Required", "Customer name is required"); return; }
    if (!form.invoiceNumber.trim()) { Alert.alert("Required", "Invoice number is required"); return; }
    if (!form.taxableAmount || parseFloat(form.taxableAmount) <= 0) { Alert.alert("Required", "Valid taxable amount is required"); return; }
    setIsSaving(true);
    try {
      await addSale({
        customerName: form.customerName.trim(),
        customerGSTIN: form.customerGSTIN.trim(),
        invoiceNumber: form.invoiceNumber.trim(),
        invoiceDate: form.invoiceDate || getTodayDate(),
        description: form.description.trim(),
        hsn: form.hsn.trim(),
        gstRate: form.gstRate,
        taxableAmount: parseFloat(form.taxableAmount),
        gstAmount,
        totalAmount,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Alert.alert("Error", "Failed to save sale");
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
        <Text style={styles.headerTitle}>Add Sale Invoice</Text>
        <TouchableOpacity style={[styles.saveBtn, isSaving && { opacity: 0.6 }]} onPress={handleSave} disabled={isSaving}>
          {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, Platform.OS === "web" && { paddingBottom: 34 }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.section}>Customer Details</Text>
        <View style={styles.field}>
          <Text style={styles.label}>Customer Name *</Text>
          <TextInput style={styles.input} placeholder="e.g. Verma Traders" placeholderTextColor={Colors.textMuted} value={form.customerName} onChangeText={(v) => update("customerName", v)} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Customer GSTIN (optional)</Text>
          <TextInput style={styles.input} placeholder="e.g. 29ABCDE1234F1Z5" placeholderTextColor={Colors.textMuted} value={form.customerGSTIN} onChangeText={(v) => update("customerGSTIN", v.toUpperCase())} autoCapitalize="characters" maxLength={15} />
        </View>

        <Text style={styles.section}>Invoice Details</Text>
        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Invoice Number *</Text>
            <TextInput style={styles.input} placeholder="INV-001" placeholderTextColor={Colors.textMuted} value={form.invoiceNumber} onChangeText={(v) => update("invoiceNumber", v)} />
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Invoice Date</Text>
            <TextInput style={styles.input} placeholder="DD/MM/YYYY" placeholderTextColor={Colors.textMuted} value={form.invoiceDate} onChangeText={(v) => update("invoiceDate", v)} />
          </View>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Description</Text>
          <TextInput style={styles.input} placeholder="Product / service description" placeholderTextColor={Colors.textMuted} value={form.description} onChangeText={(v) => update("description", v)} />
        </View>

        <Text style={styles.section}>GST Details</Text>
        <View style={styles.hsnFinder}>
          <Text style={styles.label}>HSN Finder (AI)</Text>
          <View style={styles.hsnRow}>
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="Search product to find HSN..." placeholderTextColor={Colors.textMuted} value={hsnQuery} onChangeText={setHsnQuery} />
            <TouchableOpacity style={[styles.hsnBtn, { backgroundColor: Colors.success }]} onPress={handleHSNLookup} disabled={hsnLoading}>
              {hsnLoading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="sparkles" size={18} color="#fff" />}
            </TouchableOpacity>
          </View>
          {hsnResult ? <Text style={styles.hsnResultText}>{hsnResult}</Text> : null}
        </View>

        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>HSN/SAC Code</Text>
            <TextInput style={styles.input} placeholder="e.g. 7214" placeholderTextColor={Colors.textMuted} value={form.hsn} onChangeText={(v) => update("hsn", v)} keyboardType="numeric" />
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Taxable Amount (₹) *</Text>
            <TextInput style={styles.input} placeholder="0.00" placeholderTextColor={Colors.textMuted} value={form.taxableAmount} onChangeText={(v) => update("taxableAmount", v)} keyboardType="numeric" />
          </View>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>GST Rate</Text>
          <View style={styles.rateRow}>
            {GST_RATES.map((rate) => (
              <TouchableOpacity key={rate} style={[styles.rateChip, form.gstRate === rate && styles.rateChipActive]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); update("gstRate", rate); }}>
                <Text style={[styles.rateChipText, form.gstRate === rate && styles.rateChipTextActive]}>{rate}%</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.summary}>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Taxable Amount</Text><Text style={styles.summaryValue}>₹{parseFloat(form.taxableAmount || "0").toLocaleString("en-IN")}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>GST ({form.gstRate}%)</Text><Text style={styles.summaryValue}>₹{gstAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</Text></View>
          <View style={[styles.summaryRow, styles.summaryTotal]}><Text style={styles.summaryTotalLabel}>Total Amount</Text><Text style={[styles.summaryTotalValue, { color: Colors.success }]}>₹{totalAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</Text></View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  headerTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary },
  saveBtn: { backgroundColor: Colors.success, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  saveBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  scrollContent: { padding: 16, gap: 4, paddingBottom: 60 },
  section: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary, marginTop: 8, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  field: { marginBottom: 12 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary, marginBottom: 6 },
  input: { backgroundColor: Colors.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border },
  row: { flexDirection: "row", gap: 12 },
  hsnFinder: { marginBottom: 12 },
  hsnRow: { flexDirection: "row", gap: 8 },
  hsnBtn: { width: 46, height: 46, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  hsnResultText: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 6, lineHeight: 16 },
  rateRow: { flexDirection: "row", gap: 8 },
  rateChip: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  rateChipActive: { backgroundColor: Colors.success, borderColor: Colors.success },
  rateChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
  rateChipTextActive: { color: "#fff" },
  summary: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginTop: 8, gap: 10, borderWidth: 1, borderColor: Colors.border },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryLabel: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  summaryValue: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.textPrimary },
  summaryTotal: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  summaryTotalLabel: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.textPrimary },
  summaryTotalValue: { fontSize: 16, fontFamily: "Inter_700Bold" },
});
