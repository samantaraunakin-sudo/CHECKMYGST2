import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  Platform, ActivityIndicator, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useGST } from "@/contexts/GSTContext";
import { getApiUrl } from "@/lib/query-client";
import Colors from "@/constants/colors";

export default function GSTR2BUploadScreen() {
  const insets = useSafeAreaInsets();
  const { addGSTR2BEntries, clearGSTR2B, gstr2bEntries } = useGST();
  const [pastedText, setPastedText] = useState("");
  const [period, setPeriod] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const handleExtract = async () => {
    if (!pastedText.trim()) { Alert.alert("Required", "Please paste your GSTR-2B data"); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExtracting(true);
    setPreviewData([]);
    try {
      const url = new URL("/api/extract-gstr2b", getApiUrl());
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pastedText.trim() }),
      });
      if (!res.ok) throw new Error("Extraction failed");
      const data = await res.json();
      setPreviewData(data);
      if (data.length === 0) Alert.alert("No Data Found", "Could not extract invoice entries. Make sure you copied the GSTR-2B data correctly.");
    } catch {
      Alert.alert("Extraction Failed", "Could not extract GSTR-2B data. Please check your input.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSave = async () => {
    if (previewData.length === 0) { Alert.alert("No Data", "Extract GSTR-2B data first"); return; }
    setIsSaving(true);
    try {
      if (gstr2bEntries.length > 0) {
        await clearGSTR2B();
      }
      const entries = previewData.map((d) => ({
        supplierName: d.supplierName || "",
        supplierGSTIN: d.supplierGSTIN || "",
        invoiceNumber: d.invoiceNumber || "",
        invoiceDate: d.invoiceDate || "",
        taxableAmount: Number(d.taxableAmount) || 0,
        igst: Number(d.igst) || 0,
        cgst: Number(d.cgst) || 0,
        sgst: Number(d.sgst) || 0,
        totalITC: Number(d.totalITC) || (Number(d.igst) + Number(d.cgst) + Number(d.sgst)),
        gstRate: Number(d.gstRate) || 18,
        period: period || new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
      }));
      await addGSTR2BEntries(entries);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Alert.alert("Error", "Failed to save GSTR-2B data");
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
        <Text style={styles.headerTitle}>Upload GSTR-2B</Text>
        <TouchableOpacity style={[styles.saveBtn, (isSaving || previewData.length === 0) && { opacity: 0.4 }]} onPress={handleSave} disabled={isSaving || previewData.length === 0}>
          {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Import</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, Platform.OS === "web" && { paddingBottom: 34 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color={Colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>How to get GSTR-2B data</Text>
            <Text style={styles.infoText}>1. Login to gst.gov.in{"\n"}2. Go to Returns → GSTR-2B{"\n"}3. Select the tax period{"\n"}4. Copy the table data and paste below</Text>
          </View>
        </View>

        {gstr2bEntries.length > 0 && (
          <View style={styles.existingWarning}>
            <Ionicons name="warning" size={16} color={Colors.warning} />
            <Text style={styles.existingText}>{gstr2bEntries.length} existing GSTR-2B entries will be replaced on import</Text>
          </View>
        )}

        <View style={styles.field}>
          <Text style={styles.label}>Tax Period</Text>
          <TextInput style={styles.input} placeholder="e.g. November 2024" placeholderTextColor={Colors.textMuted} value={period} onChangeText={setPeriod} />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Paste GSTR-2B Data *</Text>
          <TextInput style={styles.textArea} placeholder={"Paste your GSTR-2B table data here...\n\nTip: Copy the entire B2B section from the GSTR-2B portal. AI will extract all supplier invoices automatically."} placeholderTextColor={Colors.textMuted} value={pastedText} onChangeText={setPastedText} multiline numberOfLines={8} textAlignVertical="top" />
        </View>

        <TouchableOpacity style={[styles.extractBtn, isExtracting && { opacity: 0.6 }]} onPress={handleExtract} disabled={isExtracting} activeOpacity={0.8}>
          {isExtracting ? (
            <><ActivityIndicator size="small" color="#fff" /><Text style={styles.extractBtnText}>AI Extracting...</Text></>
          ) : (
            <><Ionicons name="sparkles" size={18} color="#fff" /><Text style={styles.extractBtnText}>Extract with AI</Text></>
          )}
        </TouchableOpacity>

        {previewData.length > 0 && (
          <>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>{previewData.length} invoices extracted</Text>
              <View style={styles.successBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#059669" />
                <Text style={styles.successText}>Ready to import</Text>
              </View>
            </View>
            {previewData.slice(0, 5).map((item, idx) => (
              <View key={idx} style={styles.previewCard}>
                <Text style={styles.previewSupplier} numberOfLines={1}>{item.supplierName || "Unknown"}</Text>
                <Text style={styles.previewInv}>{item.invoiceNumber} • {item.invoiceDate}</Text>
                <View style={styles.previewAmounts}>
                  <Text style={styles.previewAmount}>Taxable: ₹{Number(item.taxableAmount || 0).toLocaleString("en-IN")}</Text>
                  <Text style={styles.previewAmount}>ITC: ₹{Number(item.totalITC || 0).toLocaleString("en-IN")}</Text>
                </View>
              </View>
            ))}
            {previewData.length > 5 && <Text style={styles.moreText}>+{previewData.length - 5} more invoices will be imported</Text>}
          </>
        )}
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
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  infoCard: { flexDirection: "row", gap: 12, backgroundColor: "#EFF6FF", borderRadius: 12, padding: 14, borderLeftWidth: 4, borderLeftColor: Colors.primary },
  infoTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary, marginBottom: 6 },
  infoText: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, lineHeight: 18 },
  existingWarning: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF3C7", borderRadius: 10, padding: 10 },
  existingText: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#92400E", flex: 1 },
  field: {},
  label: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary, marginBottom: 6 },
  input: { backgroundColor: Colors.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border },
  textArea: { backgroundColor: Colors.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border, minHeight: 160 },
  extractBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14 },
  extractBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
  previewHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  previewTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary },
  successBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  successText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#059669" },
  previewCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border },
  previewSupplier: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary },
  previewInv: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2 },
  previewAmounts: { flexDirection: "row", gap: 16, marginTop: 8 },
  previewAmount: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  moreText: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textMuted, textAlign: "center", paddingVertical: 8 },
});
