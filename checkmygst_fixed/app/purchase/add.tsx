import React, { useState } from "react";
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
import { useGST, getTodayDate } from "@/contexts/GSTContext";
import { getApiUrl } from "@/lib/query-client";
import Colors from "@/constants/colors";

const GST_RATES = [0, 5, 12, 18, 28];

export default function AddPurchaseScreen() {
  const insets = useSafeAreaInsets();
  const { addPurchase } = useGST();
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hsnQuery, setHsnQuery] = useState("");
  const [hsnResult, setHsnResult] = useState("");
  const [hsnLoading, setHsnLoading] = useState(false);

  const [form, setForm] = useState({
    supplierName: "",
    supplierGSTIN: "",
    invoiceNumber: "",
    invoiceDate: getTodayDate(),
    description: "",
    hsn: "",
    gstRate: 18,
    taxableAmount: "",
  });

  const gstAmount = parseFloat(form.taxableAmount || "0") * (form.gstRate / 100);
  const totalAmount = parseFloat(form.taxableAmount || "0") + gstAmount;

  const updateForm = (key: string, value: string | number) => setForm((p) => ({ ...p, [key]: value }));

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      base64: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExtracting(true);
    try {
      let base64 = asset.base64;
      if (!base64 && asset.uri) {
        base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
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
        description: data.description || "",
        hsn: data.hsn || "",
        gstRate: data.gstRate || 18,
        taxableAmount: data.taxableAmount ? String(data.taxableAmount) : "",
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Extraction Failed", "Could not read the invoice. Please enter details manually.");
    } finally {
      setIsExtracting(false);
    }
  };

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
      if (data.hsn) { updateForm("hsn", data.hsn); }
    } catch {
      setHsnResult("HSN lookup failed. Please check your connection.");
    } finally {
      setHsnLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.supplierName.trim()) { Alert.alert("Required", "Supplier name is required"); return; }
    if (!form.invoiceNumber.trim()) { Alert.alert("Required", "Invoice number is required"); return; }
    if (!form.taxableAmount || parseFloat(form.taxableAmount) <= 0) { Alert.alert("Required", "Valid taxable amount is required"); return; }
    setIsSaving(true);
    try {
      await addPurchase({
        supplierName: form.supplierName.trim(),
        supplierGSTIN: form.supplierGSTIN.trim(),
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, Platform.OS === "web" && { paddingBottom: 34 }]} keyboardShouldPersistTaps="handled">
        {/* AI Scan */}
        <TouchableOpacity style={[styles.scanCard, isExtracting && { opacity: 0.7 }]} onPress={handlePickImage} disabled={isExtracting} activeOpacity={0.8}>
          {isExtracting ? (
            <><ActivityIndicator size="small" color={Colors.primary} /><View><Text style={styles.scanTitle}>Extracting with AI...</Text><Text style={styles.scanSubtitle}>Please wait</Text></View></>
          ) : (
            <><View style={styles.scanIcon}><Ionicons name="camera" size={22} color={Colors.primary} /></View><View><Text style={styles.scanTitle}>Scan Invoice with AI</Text><Text style={styles.scanSubtitle}>Upload photo to auto-fill fields</Text></View><Ionicons name="chevron-forward" size={18} color={Colors.textMuted} style={{ marginLeft: "auto" }} /></>
          )}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.divLine} />
          <Text style={styles.divText}>or enter manually</Text>
          <View style={styles.divLine} />
        </View>

        <Text style={styles.section}>Supplier Details</Text>
        <View style={styles.field}>
          <Text style={styles.label}>Supplier Name *</Text>
          <TextInput style={styles.input} placeholder="e.g. ABC Steel Co." placeholderTextColor={Colors.textMuted} value={form.supplierName} onChangeText={(v) => updateForm("supplierName", v)} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Supplier GSTIN</Text>
          <TextInput style={styles.input} placeholder="e.g. 29ABCDE1234F1Z5" placeholderTextColor={Colors.textMuted} value={form.supplierGSTIN} onChangeText={(v) => updateForm("supplierGSTIN", v.toUpperCase())} autoCapitalize="characters" maxLength={15} />
        </View>

        <Text style={styles.section}>Invoice Details</Text>
        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Invoice Number *</Text>
            <TextInput style={styles.input} placeholder="INV-001" placeholderTextColor={Colors.textMuted} value={form.invoiceNumber} onChangeText={(v) => updateForm("invoiceNumber", v)} />
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Invoice Date</Text>
            <TextInput style={styles.input} placeholder="DD/MM/YYYY" placeholderTextColor={Colors.textMuted} value={form.invoiceDate} onChangeText={(v) => updateForm("invoiceDate", v)} />
          </View>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Product Description</Text>
          <TextInput style={styles.input} placeholder="e.g. TMT Steel Bars 12mm" placeholderTextColor={Colors.textMuted} value={form.description} onChangeText={(v) => updateForm("description", v)} />
        </View>

        <Text style={styles.section}>GST Details</Text>
        {/* HSN Finder */}
        <View style={styles.hsnFinder}>
          <Text style={styles.label}>HSN Finder (AI)</Text>
          <View style={styles.hsnRow}>
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="Search product to find HSN..." placeholderTextColor={Colors.textMuted} value={hsnQuery} onChangeText={setHsnQuery} />
            <TouchableOpacity style={styles.hsnBtn} onPress={handleHSNLookup} disabled={hsnLoading}>
              {hsnLoading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="sparkles" size={18} color="#fff" />}
            </TouchableOpacity>
          </View>
          {hsnResult ? <Text style={styles.hsnResultText}>{hsnResult}</Text> : null}
        </View>

        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>HSN/SAC Code</Text>
            <TextInput style={styles.input} placeholder="e.g. 7214" placeholderTextColor={Colors.textMuted} value={form.hsn} onChangeText={(v) => updateForm("hsn", v)} keyboardType="numeric" />
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Taxable Amount (₹) *</Text>
            <TextInput style={styles.input} placeholder="0.00" placeholderTextColor={Colors.textMuted} value={form.taxableAmount} onChangeText={(v) => updateForm("taxableAmount", v)} keyboardType="numeric" />
          </View>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>GST Rate</Text>
          <View style={styles.rateRow}>
            {GST_RATES.map((rate) => (
              <TouchableOpacity key={rate} style={[styles.rateChip, form.gstRate === rate && styles.rateChipActive]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateForm("gstRate", rate); }}>
                <Text style={[styles.rateChipText, form.gstRate === rate && styles.rateChipTextActive]}>{rate}%</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.summary}>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Taxable Amount</Text><Text style={styles.summaryValue}>₹{parseFloat(form.taxableAmount || "0").toLocaleString("en-IN")}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>GST ({form.gstRate}%)</Text><Text style={styles.summaryValue}>₹{gstAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</Text></View>
          <View style={[styles.summaryRow, styles.summaryTotal]}><Text style={styles.summaryTotalLabel}>Total Amount</Text><Text style={styles.summaryTotalValue}>₹{totalAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</Text></View>
        </View>
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
  scrollContent: { padding: 16, gap: 4, paddingBottom: 60 },
  scanCard: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surface, borderRadius: 14, padding: 16, gap: 12, borderWidth: 1.5, borderColor: Colors.primary, marginBottom: 4 },
  scanIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center" },
  scanTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary },
  scanSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  divider: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 12 },
  divLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  divText: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  section: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary, marginTop: 8, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  field: { marginBottom: 12 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary, marginBottom: 6 },
  input: { backgroundColor: Colors.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border },
  row: { flexDirection: "row", gap: 12 },
  hsnFinder: { marginBottom: 12 },
  hsnRow: { flexDirection: "row", gap: 8 },
  hsnBtn: { width: 46, height: 46, borderRadius: 10, backgroundColor: Colors.primary, justifyContent: "center", alignItems: "center" },
  hsnResultText: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 6, lineHeight: 16 },
  rateRow: { flexDirection: "row", gap: 8 },
  rateChip: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  rateChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  rateChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
  rateChipTextActive: { color: "#fff" },
  summary: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginTop: 8, gap: 10, borderWidth: 1, borderColor: Colors.border },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryLabel: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  summaryValue: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.textPrimary },
  summaryTotal: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  summaryTotalLabel: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.textPrimary },
  summaryTotalValue: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.primary },
});
