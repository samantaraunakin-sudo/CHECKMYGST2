import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  Platform, ActivityIndicator, Alert, Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import { useGST } from "@/contexts/GSTContext";
import { getApiUrl } from "@/lib/query-client";
import Colors from "@/constants/colors";

function formatINR(n: number) {
  return "₹" + Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

type Tab = "upload" | "reconcile";

export default function GSTR2BUploadScreen() {
  const { addGSTR2BEntries, clearGSTR2B, gstr2bEntries, purchases } = useGST();

  const [tab, setTab] = useState<Tab>("upload");
  const [pastedText, setPastedText] = useState("");
  const [period, setPeriod] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadMode, setUploadMode] = useState<"text" | "image">("text");

  // ── Extract from text ──
  const handleExtractText = async () => {
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Extraction failed");
      setPreviewData(data);
      if (data.length === 0) Alert.alert("No Data Found", "Could not find any invoice entries. Check your pasted data.");
      else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert("Extraction Failed", e.message || "Please try again.");
    } finally {
      setIsExtracting(false);
    }
  };

  // ── Extract from image/PDF ──
  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
      base64: true,
    });
    if (result.canceled || !result.assets[0]) return;
    await processImageAsset(result.assets[0]);
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") { Alert.alert("Permission needed", "Allow camera access."); return; }
    } catch {}
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.9, base64: true });
    if (result.canceled || !result.assets[0]) return;
    await processImageAsset(result.assets[0]);
  };

  const processImageAsset = async (asset: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExtracting(true);
    setPreviewData([]);
    try {
      let base64 = asset.base64;
      if (!base64 && asset.uri) {
        base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: (FileSystem as any).EncodingType?.Base64 || "base64" });
      }
      const url = new URL("/api/extract-gstr2b", getApiUrl());
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType: asset.mimeType || "image/jpeg" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Extraction failed");
      setPreviewData(data);
      if (data.length === 0) Alert.alert("No Data Found", "Could not read invoice entries from this image.");
      else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert("Scan Failed", e.message || "Could not read the GSTR-2B. Try pasting the text instead.");
    } finally {
      setIsExtracting(false);
    }
  };

  // ── Save to app ──
  const handleSave = async () => {
    if (previewData.length === 0) { Alert.alert("No Data", "Extract GSTR-2B data first"); return; }
    setIsSaving(true);
    try {
      if (gstr2bEntries.length > 0) await clearGSTR2B();
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
      setTab("reconcile");
    } catch {
      Alert.alert("Error", "Failed to save GSTR-2B data");
    } finally {
      setIsSaving(false);
    }
  };

  // ── Reconciliation logic ──
  const reconcileResults = useMemo(() => {
    if (gstr2bEntries.length === 0) return { matched: [], mismatched: [], missing: [], itcAtRisk: 0 };

    const matched: any[] = [];
    const mismatched: any[] = [];
    const missing: any[] = [];
    let itcAtRisk = 0;

    gstr2bEntries.forEach(entry => {
      const found = (purchases as any[]).find(p =>
        p.supplierGSTIN === entry.supplierGSTIN ||
        p.invoiceNumber === entry.invoiceNumber ||
        p.supplierName?.toLowerCase() === entry.supplierName?.toLowerCase()
      );

      if (!found) {
        missing.push({ ...entry, issue: "Not in your purchase register" });
        itcAtRisk += entry.totalITC || 0;
      } else {
        const amtDiff = Math.abs((found.taxableAmount || 0) - (entry.taxableAmount || 0));
        const itcDiff = Math.abs((found.gstAmount || 0) - (entry.totalITC || 0));
        if (amtDiff > 1 || itcDiff > 1) {
          mismatched.push({
            ...entry,
            yourAmount: found.taxableAmount || 0,
            yourITC: found.gstAmount || 0,
            issue: `Amount diff: ₹${amtDiff.toFixed(0)}, ITC diff: ₹${itcDiff.toFixed(0)}`,
          });
          itcAtRisk += itcDiff;
        } else {
          matched.push({ ...entry });
        }
      }
    });

    return { matched, mismatched, missing, itcAtRisk };
  }, [gstr2bEntries, purchases]);

  const totalITC = gstr2bEntries.reduce((s, e) => s + (e.totalITC || 0), 0);
  const safeITC = reconcileResults.matched.reduce((s: number, e: any) => s + (e.totalITC || 0), 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="close" size={26} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>GSTR-2B Import</Text>
        {tab === "upload" ? (
          <TouchableOpacity
            style={[styles.saveBtn, (isSaving || previewData.length === 0) && { opacity: 0.4 }]}
            onPress={handleSave}
            disabled={isSaving || previewData.length === 0}
          >
            {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Import →</Text>}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.saveBtn} onPress={() => setTab("upload")}>
            <Text style={styles.saveBtnText}>Re-upload</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(["upload", "reconcile"] as Tab[]).map(t => (
          <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}>
              {t === "upload" ? "📤 Upload" : `⚖️ Reconcile ${gstr2bEntries.length > 0 ? `(${gstr2bEntries.length})` : ""}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {tab === "upload" ? (
          <>
            {/* Mode toggle */}
            <View style={styles.modeRow}>
              <TouchableOpacity style={[styles.modeBtn, uploadMode === "text" && styles.modeBtnActive]} onPress={() => setUploadMode("text")}>
                <Ionicons name="clipboard-outline" size={16} color={uploadMode === "text" ? "#fff" : Colors.primary} />
                <Text style={[styles.modeBtnText, uploadMode === "text" && styles.modeBtnTextActive]}>Paste Text</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modeBtn, uploadMode === "image" && styles.modeBtnActive]} onPress={() => setUploadMode("image")}>
                <Ionicons name="image-outline" size={16} color={uploadMode === "image" ? "#fff" : Colors.primary} />
                <Text style={[styles.modeBtnText, uploadMode === "image" && styles.modeBtnTextActive]}>Scan / Upload</Text>
              </TouchableOpacity>
            </View>

            {/* Info card */}
            <View style={styles.infoCard}>
              <Ionicons name="information-circle" size={18} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoTitle}>How to get GSTR-2B</Text>
                <Text style={styles.infoText}>
                  {uploadMode === "text"
                    ? "1. Login to gst.gov.in\n2. Go to Returns → GSTR-2B\n3. Copy the B2B table data\n4. Paste below"
                    : "1. Login to gst.gov.in\n2. Download GSTR-2B as PDF\n3. Upload or scan the PDF/screenshot below"}
                </Text>
              </View>
            </View>

            {/* Period input */}
            <View style={styles.field}>
              <Text style={styles.label}>Tax Period</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. March 2026"
                placeholderTextColor="#9ca3af"
                value={period}
                onChangeText={setPeriod}
              />
            </View>

            {uploadMode === "text" ? (
              <>
                <View style={styles.field}>
                  <Text style={styles.label}>Paste GSTR-2B Data *</Text>
                  <TextInput
                    style={styles.textArea}
                    placeholder="Paste your GSTR-2B table data here...\n\nAI will extract all supplier invoices automatically."
                    placeholderTextColor="#9ca3af"
                    value={pastedText}
                    onChangeText={setPastedText}
                    multiline
                    numberOfLines={8}
                    textAlignVertical="top"
                  />
                </View>
                <TouchableOpacity style={[styles.extractBtn, isExtracting && { opacity: 0.6 }]} onPress={handleExtractText} disabled={isExtracting} activeOpacity={0.8}>
                  {isExtracting
                    ? <><ActivityIndicator size="small" color="#fff" /><Text style={styles.extractBtnText}>AI Extracting...</Text></>
                    : <><Ionicons name="sparkles" size={18} color="#fff" /><Text style={styles.extractBtnText}>Extract with AI</Text></>
                  }
                </TouchableOpacity>
              </>
            ) : (
              <>
                {isExtracting ? (
                  <View style={styles.scanningBox}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={styles.scanningText}>AI reading your GSTR-2B...</Text>
                  </View>
                ) : (
                  <View style={styles.imageButtons}>
                    <TouchableOpacity style={styles.imageBtn} onPress={handleTakePhoto} activeOpacity={0.8}>
                      <Ionicons name="camera" size={28} color={Colors.primary} />
                      <Text style={styles.imageBtnText}>📷 Camera</Text>
                      <Text style={styles.imageBtnSub}>Scan printed GSTR-2B</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.imageBtn} onPress={handlePickImage} activeOpacity={0.8}>
                      <Ionicons name="document" size={28} color="#8b5cf6" />
                      <Text style={[styles.imageBtnText, { color: "#8b5cf6" }]}>📄 Upload</Text>
                      <Text style={styles.imageBtnSub}>PDF screenshot or image</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}

            {/* Preview */}
            {previewData.length > 0 && (
              <>
                <View style={styles.previewHeader}>
                  <Text style={styles.previewTitle}>✅ {previewData.length} invoices extracted</Text>
                  <Text style={styles.previewSub}>Total ITC: {formatINR(previewData.reduce((s, d) => s + (Number(d.totalITC) || 0), 0))}</Text>
                </View>
                {previewData.slice(0, 4).map((item, idx) => (
                  <View key={idx} style={styles.previewCard}>
                    <Text style={styles.previewSupplier} numberOfLines={1}>{item.supplierName || "Unknown Supplier"}</Text>
                    <Text style={styles.previewInv}>{item.invoiceNumber} · {item.invoiceDate}</Text>
                    <View style={styles.previewAmounts}>
                      <Text style={styles.previewAmount}>Taxable: {formatINR(item.taxableAmount || 0)}</Text>
                      <Text style={[styles.previewAmount, { color: "#16a34a" }]}>ITC: {formatINR(item.totalITC || 0)}</Text>
                    </View>
                  </View>
                ))}
                {previewData.length > 4 && <Text style={styles.moreText}>+{previewData.length - 4} more invoices</Text>}
                <TouchableOpacity style={styles.importBtn} onPress={handleSave} disabled={isSaving}>
                  {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.importBtnText}>Import & Reconcile →</Text>}
                </TouchableOpacity>
              </>
            )}
          </>
        ) : (
          <>
            {gstr2bEntries.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="cloud-upload-outline" size={48} color="#9ca3af" />
                <Text style={styles.emptyText}>No GSTR-2B data imported yet</Text>
                <TouchableOpacity style={styles.goUploadBtn} onPress={() => setTab("upload")}>
                  <Text style={styles.goUploadBtnText}>Upload GSTR-2B</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* ITC Summary */}
                <View style={styles.itcSummary}>
                  <View style={styles.itcCard}>
                    <Text style={styles.itcLabel}>Total ITC{"\n"}in GSTR-2B</Text>
                    <Text style={[styles.itcAmount, { color: "#2563eb" }]}>{formatINR(totalITC)}</Text>
                  </View>
                  <View style={styles.itcCard}>
                    <Text style={styles.itcLabel}>Safe ITC{"\n"}(Matched)</Text>
                    <Text style={[styles.itcAmount, { color: "#16a34a" }]}>{formatINR(safeITC)}</Text>
                  </View>
                  <View style={styles.itcCard}>
                    <Text style={styles.itcLabel}>ITC at{"\n"}Risk</Text>
                    <Text style={[styles.itcAmount, { color: "#dc2626" }]}>{formatINR(reconcileResults.itcAtRisk)}</Text>
                  </View>
                </View>

                {/* Risk banner */}
                {reconcileResults.itcAtRisk > 0 && (
                  <View style={styles.riskBanner}>
                    <Ionicons name="warning" size={18} color="#dc2626" />
                    <Text style={styles.riskText}>
                      {formatINR(reconcileResults.itcAtRisk)} ITC at risk — fix mismatches before filing GSTR-3B
                    </Text>
                  </View>
                )}

                {/* Matched */}
                {reconcileResults.matched.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>✅ Matched ({reconcileResults.matched.length})</Text>
                    {reconcileResults.matched.map((e, i) => (
                      <View key={i} style={[styles.entryCard, { borderLeftColor: "#16a34a" }]}>
                        <Text style={styles.entrySupplier} numberOfLines={1}>{e.supplierName}</Text>
                        <Text style={styles.entryDetail}>{e.invoiceNumber} · ITC: {formatINR(e.totalITC)}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Mismatched */}
                {reconcileResults.mismatched.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>⚠️ Amount Mismatch ({reconcileResults.mismatched.length})</Text>
                    {reconcileResults.mismatched.map((e, i) => (
                      <View key={i} style={[styles.entryCard, { borderLeftColor: "#d97706" }]}>
                        <Text style={styles.entrySupplier} numberOfLines={1}>{e.supplierName}</Text>
                        <Text style={styles.entryDetail}>{e.invoiceNumber}</Text>
                        <View style={styles.mismatchRow}>
                          <Text style={styles.mismatchLabel}>GSTR-2B: {formatINR(e.taxableAmount)} · Your records: {formatINR(e.yourAmount)}</Text>
                        </View>
                        <Text style={styles.issueText}>{e.issue}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Missing */}
                {reconcileResults.missing.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🔴 Missing from Register ({reconcileResults.missing.length})</Text>
                    {reconcileResults.missing.map((e, i) => (
                      <View key={i} style={[styles.entryCard, { borderLeftColor: "#dc2626" }]}>
                        <Text style={styles.entrySupplier} numberOfLines={1}>{e.supplierName}</Text>
                        <Text style={styles.entryDetail}>{e.invoiceNumber} · ITC: {formatINR(e.totalITC)}</Text>
                        <Text style={styles.issueText}>Not found in your purchase records</Text>
                        <TouchableOpacity style={styles.addEntryBtn} onPress={() => router.push("/purchase/add" as any)}>
                          <Text style={styles.addEntryBtnText}>+ Add to Purchases</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", paddingTop: Platform.OS === "ios" ? 56 : 48 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#e5e7eb", backgroundColor: "#fff" },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  saveBtn: { backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  saveBtnText: { fontSize: 14, fontWeight: "600", color: "#fff" },
  tabRow: { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabBtnActive: { borderBottomColor: Colors.primary },
  tabBtnText: { fontSize: 13, fontWeight: "600", color: "#6b7280" },
  tabBtnTextActive: { color: Colors.primary },
  scroll: { padding: 16, paddingBottom: 40 },
  modeRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  modeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.primary, backgroundColor: "#fff" },
  modeBtnActive: { backgroundColor: Colors.primary },
  modeBtnText: { fontSize: 13, fontWeight: "600", color: Colors.primary },
  modeBtnTextActive: { color: "#fff" },
  infoCard: { flexDirection: "row", gap: 10, backgroundColor: "#eff6ff", borderRadius: 12, padding: 14, borderLeftWidth: 4, borderLeftColor: Colors.primary, marginBottom: 16 },
  infoTitle: { fontSize: 13, fontWeight: "600", color: "#111827", marginBottom: 4 },
  infoText: { fontSize: 12, color: "#374151", lineHeight: 18 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "500", color: "#6b7280", marginBottom: 6 },
  input: { backgroundColor: "#fff", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#111827", borderWidth: 1, borderColor: "#e5e7eb" },
  textArea: { backgroundColor: "#fff", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: "#111827", borderWidth: 1, borderColor: "#e5e7eb", minHeight: 160 },
  extractBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, marginBottom: 16 },
  extractBtnText: { fontSize: 15, fontWeight: "600", color: "#fff" },
  scanningBox: { alignItems: "center", paddingVertical: 40, gap: 16 },
  scanningText: { fontSize: 15, fontWeight: "600", color: "#6b7280" },
  imageButtons: { flexDirection: "row", gap: 12, marginBottom: 16 },
  imageBtn: { flex: 1, backgroundColor: "#fff", borderRadius: 14, padding: 20, alignItems: "center", gap: 8, borderWidth: 1.5, borderColor: "#e5e7eb" },
  imageBtnText: { fontSize: 14, fontWeight: "700", color: Colors.primary },
  imageBtnSub: { fontSize: 11, color: "#9ca3af", textAlign: "center" },
  previewHeader: { marginBottom: 10 },
  previewTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  previewSub: { fontSize: 13, color: "#16a34a", fontWeight: "600", marginTop: 2 },
  previewCard: { backgroundColor: "#fff", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#e5e7eb", marginBottom: 8 },
  previewSupplier: { fontSize: 14, fontWeight: "600", color: "#111827" },
  previewInv: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  previewAmounts: { flexDirection: "row", gap: 16, marginTop: 8 },
  previewAmount: { fontSize: 12, fontWeight: "500", color: "#374151" },
  moreText: { fontSize: 12, color: "#9ca3af", textAlign: "center", paddingVertical: 8 },
  importBtn: { backgroundColor: "#16a34a", borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  importBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  emptyBox: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 15, fontWeight: "600", color: "#6b7280" },
  goUploadBtn: { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  goUploadBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  itcSummary: { flexDirection: "row", gap: 8, marginBottom: 16 },
  itcCard: { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1, borderColor: "#e5e7eb" },
  itcLabel: { fontSize: 11, color: "#6b7280", textAlign: "center", marginBottom: 6, lineHeight: 16 },
  itcAmount: { fontSize: 16, fontWeight: "800" },
  riskBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fef2f2", borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: "#fecaca" },
  riskText: { flex: 1, fontSize: 13, fontWeight: "600", color: "#dc2626" },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#111827", marginBottom: 8 },
  entryCard: { backgroundColor: "#fff", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#e5e7eb", borderLeftWidth: 4, marginBottom: 8 },
  entrySupplier: { fontSize: 14, fontWeight: "600", color: "#111827" },
  entryDetail: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  mismatchRow: { marginTop: 6 },
  mismatchLabel: { fontSize: 12, color: "#92400e" },
  issueText: { fontSize: 11, color: "#dc2626", marginTop: 4, fontWeight: "600" },
  addEntryBtn: { marginTop: 8, backgroundColor: "#eff6ff", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignSelf: "flex-start" },
  addEntryBtnText: { fontSize: 12, fontWeight: "600", color: Colors.primary },
});
