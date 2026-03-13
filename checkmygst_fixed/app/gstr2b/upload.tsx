import React, { useState, useMemo, useEffect } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  Platform, ActivityIndicator, Alert, Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { useGST } from "@/contexts/GSTContext";
import { getApiUrl } from "@/lib/query-client";
import Colors from "@/constants/colors";

WebBrowser.maybeCompleteAuthSession();

function formatINR(n: number) {
  return "₹" + Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

type Tab = "upload" | "gmail" | "reconcile";
type UploadMode = "text" | "file";

export default function GSTR2BUploadScreen() {
  const { addGSTR2BEntries, clearGSTR2B, gstr2bEntries, purchases } = useGST();

  const [tab, setTab] = useState<Tab>("upload");
  const [uploadMode, setUploadMode] = useState<UploadMode>("text");
  const [pastedText, setPastedText] = useState("");
  const [period, setPeriod] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Gmail state
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmails, setGmailEmails] = useState<any[]>([]);
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  const [extractingEmailId, setExtractingEmailId] = useState<string | null>(null);

  const apiBase = getApiUrl();

  // Check Gmail status on mount
  useEffect(() => {
    fetch(new URL("/api/gmail/status", apiBase).toString())
      .then(r => r.json())
      .then(d => setGmailConnected(d.connected))
      .catch(() => {});
  }, []);

  // ── Text extraction ──
  const handleExtractText = async () => {
    if (!pastedText.trim()) { Alert.alert("Required", "Please paste your GSTR-2B data"); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExtracting(true);
    setPreviewData([]);
    try {
      const res = await fetch(new URL("/api/extract-gstr2b", apiBase).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pastedText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Extraction failed");
      setPreviewData(data);
      if (data.length === 0) Alert.alert("No Data Found", "Could not find any invoice entries.");
      else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert("Extraction Failed", e.message || "Please try again.");
    } finally {
      setIsExtracting(false);
    }
  };

  // ── File (PDF/Excel) extraction ──
  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "text/csv",
        ],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setIsExtracting(true);
      setPreviewData([]);

      let base64 = "";
      if (Platform.OS === "web") {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.readAsDataURL(blob);
        });
      } else {
        base64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: (FileSystem as any).EncodingType?.Base64 || "base64",
        });
      }

      const res = await fetch(new URL("/api/extract-gstr2b-file", apiBase).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileBase64: base64, fileName: asset.name, mimeType: asset.mimeType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Extraction failed");
      setPreviewData(data);
      if (data.length === 0) Alert.alert("No Data Found", "Could not read invoice entries from this file.");
      else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert("File Error", e.message || "Could not read the file.");
    } finally {
      setIsExtracting(false);
    }
  };

  // ── Gmail OAuth ──
  const handleConnectGmail = async () => {
    try {
      const authUrl = new URL("/auth/google", apiBase).toString();
      const result = await WebBrowser.openAuthSessionAsync(authUrl, "https://checkmygst2.onrender.com");
      if (result.type === "success") {
        setGmailConnected(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        handleLoadGmailEmails();
      }
    } catch (e) {
      Alert.alert("Error", "Could not open Gmail login.");
    }
  };

  const handleDisconnectGmail = async () => {
    await fetch(new URL("/api/gmail/disconnect", apiBase).toString(), { method: "POST" });
    setGmailConnected(false);
    setGmailEmails([]);
  };

  const handleLoadGmailEmails = async () => {
    setIsLoadingEmails(true);
    try {
      const res = await fetch(new URL("/api/gmail/gst-emails", apiBase).toString());
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGmailEmails(data);
      if (data.length === 0) Alert.alert("No GST Emails", "No GSTR-2B emails found in your inbox.");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Could not load emails.");
    } finally {
      setIsLoadingEmails(false);
    }
  };

  const handleExtractFromEmail = async (emailId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExtractingEmailId(emailId);
    try {
      const res = await fetch(new URL("/api/gmail/extract-email", apiBase).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPreviewData(data);
      setTab("upload");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("✅ Extracted!", `${data.length} invoices found. Review and import below.`);
    } catch (e: any) {
      Alert.alert("Extraction Failed", e.message || "Could not extract from this email.");
    } finally {
      setExtractingEmailId(null);
    }
  };

  // ── Save & reconcile ──
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

  // ── Reconciliation ──
  const reconcileResults = useMemo(() => {
    if (gstr2bEntries.length === 0) return { matched: [], mismatched: [], missing: [], itcAtRisk: 0 };
    const matched: any[] = [], mismatched: any[] = [], missing: any[] = [];
    let itcAtRisk = 0;
    gstr2bEntries.forEach(entry => {
      const found = (purchases as any[]).find(p =>
        p.supplierGSTIN === entry.supplierGSTIN ||
        p.invoiceNumber === entry.invoiceNumber ||
        p.supplierName?.toLowerCase() === entry.supplierName?.toLowerCase()
      );
      if (!found) {
        missing.push(entry);
        itcAtRisk += entry.totalITC || 0;
      } else {
        const amtDiff = Math.abs((found.taxableAmount || 0) - (entry.taxableAmount || 0));
        const itcDiff = Math.abs((found.gstAmount || 0) - (entry.totalITC || 0));
        if (amtDiff > 1 || itcDiff > 1) {
          mismatched.push({ ...entry, yourAmount: found.taxableAmount || 0, yourITC: found.gstAmount || 0, itcDiff });
          itcAtRisk += itcDiff;
        } else {
          matched.push(entry);
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
        {tab === "upload" && previewData.length > 0 ? (
          <TouchableOpacity style={[styles.saveBtn, isSaving && { opacity: 0.5 }]} onPress={handleSave} disabled={isSaving}>
            {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Import →</Text>}
          </TouchableOpacity>
        ) : (
          <View style={{ width: 70 }} />
        )}
      </View>

      {/* Tab bar */}
      <View style={styles.tabRow}>
        {([
          { key: "upload", label: "📤 Upload" },
          { key: "gmail", label: `📧 Gmail${gmailConnected ? " ✓" : ""}` },
          { key: "reconcile", label: `⚖️ Reconcile${gstr2bEntries.length > 0 ? ` (${gstr2bEntries.length})` : ""}` },
        ] as { key: Tab; label: string }[]).map(t => (
          <TouchableOpacity key={t.key} style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]} onPress={() => setTab(t.key as Tab)}>
            <Text style={[styles.tabBtnText, tab === t.key && styles.tabBtnTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* ── UPLOAD TAB ── */}
        {tab === "upload" && (
          <>
            <View style={styles.modeRow}>
              {(["text", "file"] as UploadMode[]).map(m => (
                <TouchableOpacity key={m} style={[styles.modeBtn, uploadMode === m && styles.modeBtnActive]} onPress={() => setUploadMode(m)}>
                  <Ionicons name={m === "text" ? "clipboard-outline" : "document-attach-outline"} size={16} color={uploadMode === m ? "#fff" : Colors.primary} />
                  <Text style={[styles.modeBtnText, uploadMode === m && styles.modeBtnTextActive]}>
                    {m === "text" ? "Paste Text" : "PDF / Excel"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.infoCard}>
              <Ionicons name="information-circle" size={18} color={Colors.primary} />
              <Text style={styles.infoText}>
                {uploadMode === "text"
                  ? "Login to gst.gov.in → Returns → GSTR-2B → copy B2B table → paste below"
                  : "Login to gst.gov.in → Returns → GSTR-2B → Download as Excel or PDF → upload here"}
              </Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Tax Period</Text>
              <TextInput style={styles.input} placeholder="e.g. March 2026" placeholderTextColor="#9ca3af" value={period} onChangeText={setPeriod} />
            </View>

            {uploadMode === "text" ? (
              <>
                <TextInput
                  style={styles.textArea}
                  placeholder="Paste your GSTR-2B table data here..."
                  placeholderTextColor="#9ca3af"
                  value={pastedText}
                  onChangeText={setPastedText}
                  multiline
                  numberOfLines={8}
                  textAlignVertical="top"
                />
                <TouchableOpacity style={[styles.primaryBtn, isExtracting && { opacity: 0.6 }]} onPress={handleExtractText} disabled={isExtracting}>
                  {isExtracting ? <><ActivityIndicator size="small" color="#fff" /><Text style={styles.primaryBtnText}>AI Extracting...</Text></> : <><Ionicons name="sparkles" size={18} color="#fff" /><Text style={styles.primaryBtnText}>Extract with AI</Text></>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                {isExtracting ? (
                  <View style={styles.loadingBox}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={styles.loadingText}>AI reading your file...</Text>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.uploadBox} onPress={handlePickFile}>
                    <Ionicons name="cloud-upload-outline" size={40} color={Colors.primary} />
                    <Text style={styles.uploadBoxTitle}>Tap to upload</Text>
                    <Text style={styles.uploadBoxSub}>PDF, Excel (.xlsx), or CSV</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {previewData.length > 0 && (
              <View style={styles.previewSection}>
                <Text style={styles.previewTitle}>✅ {previewData.length} invoices extracted</Text>
                <Text style={styles.previewSub}>Total ITC: {formatINR(previewData.reduce((s, d) => s + (Number(d.totalITC) || 0), 0))}</Text>
                {previewData.slice(0, 3).map((item, idx) => (
                  <View key={idx} style={styles.previewCard}>
                    <Text style={styles.previewSupplier} numberOfLines={1}>{item.supplierName || "Unknown"}</Text>
                    <Text style={styles.previewInv}>{item.invoiceNumber} · {item.invoiceDate}</Text>
                    <View style={{ flexDirection: "row", gap: 16, marginTop: 6 }}>
                      <Text style={styles.previewAmt}>Taxable: {formatINR(item.taxableAmount || 0)}</Text>
                      <Text style={[styles.previewAmt, { color: "#16a34a" }]}>ITC: {formatINR(item.totalITC || 0)}</Text>
                    </View>
                  </View>
                ))}
                {previewData.length > 3 && <Text style={styles.moreText}>+{previewData.length - 3} more invoices</Text>}
                <TouchableOpacity style={styles.importBtn} onPress={handleSave} disabled={isSaving}>
                  {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.importBtnText}>Import & Reconcile →</Text>}
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* ── GMAIL TAB ── */}
        {tab === "gmail" && (
          <>
            {!gmailConnected ? (
              <View style={styles.gmailConnect}>
                <View style={styles.gmailIcon}>
                  <Ionicons name="mail" size={40} color="#ea4335" />
                </View>
                <Text style={styles.gmailTitle}>Connect Gmail</Text>
                <Text style={styles.gmailDesc}>
                  Auto-find GSTR-2B emails from gst.gov.in and import them in one tap.
                  {"\n\n"}We only read GST-related emails. Your data stays private.
                </Text>
                <TouchableOpacity style={styles.gmailBtn} onPress={handleConnectGmail}>
                  <Ionicons name="logo-google" size={20} color="#fff" />
                  <Text style={styles.gmailBtnText}>Connect with Google</Text>
                </TouchableOpacity>
                <Text style={styles.gmailNote}>Requires GOOGLE_CLIENT_ID to be set in server config</Text>
              </View>
            ) : (
              <>
                <View style={styles.gmailConnectedRow}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
                    <Text style={styles.gmailConnectedText}>Gmail Connected</Text>
                  </View>
                  <TouchableOpacity onPress={handleDisconnectGmail}>
                    <Text style={styles.disconnectText}>Disconnect</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={[styles.primaryBtn, isLoadingEmails && { opacity: 0.6 }]} onPress={handleLoadGmailEmails} disabled={isLoadingEmails}>
                  {isLoadingEmails ? <><ActivityIndicator size="small" color="#fff" /><Text style={styles.primaryBtnText}>Searching...</Text></> : <><Ionicons name="search" size={18} color="#fff" /><Text style={styles.primaryBtnText}>Search GST Emails</Text></>}
                </TouchableOpacity>

                {gmailEmails.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>{gmailEmails.length} GST emails found</Text>
                    {gmailEmails.map((email) => (
                      <View key={email.id} style={styles.emailCard}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.emailSubject} numberOfLines={2}>{email.subject}</Text>
                          <Text style={styles.emailMeta}>{email.from}</Text>
                          <Text style={styles.emailDate}>{new Date(email.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</Text>
                          {email.hasAttachment && (
                            <View style={styles.attachBadge}>
                              <Ionicons name="attach" size={12} color="#6b7280" />
                              <Text style={styles.attachText}>Has attachment</Text>
                            </View>
                          )}
                        </View>
                        <TouchableOpacity
                          style={[styles.extractEmailBtn, extractingEmailId === email.id && { opacity: 0.5 }]}
                          onPress={() => handleExtractFromEmail(email.id)}
                          disabled={!!extractingEmailId}
                        >
                          {extractingEmailId === email.id
                            ? <ActivityIndicator size="small" color={Colors.primary} />
                            : <><Ionicons name="sparkles" size={14} color={Colors.primary} /><Text style={styles.extractEmailBtnText}>Extract</Text></>
                          }
                        </TouchableOpacity>
                      </View>
                    ))}
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* ── RECONCILE TAB ── */}
        {tab === "reconcile" && (
          <>
            {gstr2bEntries.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="git-compare-outline" size={48} color="#9ca3af" />
                <Text style={styles.emptyText}>No GSTR-2B imported yet</Text>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => setTab("upload")}>
                  <Text style={styles.primaryBtnText}>Upload GSTR-2B</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* ITC cards */}
                <View style={styles.itcRow}>
                  {[
                    { label: "Total ITC\nin GSTR-2B", value: totalITC, color: "#2563eb" },
                    { label: "Safe ITC\n(Matched)", value: safeITC, color: "#16a34a" },
                    { label: "ITC at\nRisk", value: reconcileResults.itcAtRisk, color: "#dc2626" },
                  ].map(c => (
                    <View key={c.label} style={styles.itcCard}>
                      <Text style={styles.itcLabel}>{c.label}</Text>
                      <Text style={[styles.itcAmount, { color: c.color }]}>{formatINR(c.value)}</Text>
                    </View>
                  ))}
                </View>

                {reconcileResults.itcAtRisk > 0 && (
                  <View style={styles.riskBanner}>
                    <Ionicons name="warning" size={18} color="#dc2626" />
                    <Text style={styles.riskText}>{formatINR(reconcileResults.itcAtRisk)} ITC at risk — fix before filing GSTR-3B</Text>
                  </View>
                )}

                {reconcileResults.matched.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>✅ Matched ({reconcileResults.matched.length})</Text>
                    {reconcileResults.matched.map((e, i) => (
                      <View key={i} style={[styles.entryCard, { borderLeftColor: "#16a34a" }]}>
                        <Text style={styles.entryName} numberOfLines={1}>{e.supplierName}</Text>
                        <Text style={styles.entryDetail}>{e.invoiceNumber} · ITC: {formatINR(e.totalITC)}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {reconcileResults.mismatched.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>⚠️ Amount Mismatch ({reconcileResults.mismatched.length})</Text>
                    {reconcileResults.mismatched.map((e, i) => (
                      <View key={i} style={[styles.entryCard, { borderLeftColor: "#d97706" }]}>
                        <Text style={styles.entryName} numberOfLines={1}>{e.supplierName}</Text>
                        <Text style={styles.entryDetail}>{e.invoiceNumber}</Text>
                        <Text style={styles.mismatchInfo}>GSTR-2B: {formatINR(e.taxableAmount)} · Yours: {formatINR(e.yourAmount)}</Text>
                        <Text style={styles.issueText}>ITC diff: {formatINR(e.itcDiff)}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {reconcileResults.missing.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🔴 Not in Purchase Register ({reconcileResults.missing.length})</Text>
                    {reconcileResults.missing.map((e, i) => (
                      <View key={i} style={[styles.entryCard, { borderLeftColor: "#dc2626" }]}>
                        <Text style={styles.entryName} numberOfLines={1}>{e.supplierName}</Text>
                        <Text style={styles.entryDetail}>{e.invoiceNumber} · ITC: {formatINR(e.totalITC)}</Text>
                        <TouchableOpacity style={styles.fixBtn} onPress={() => router.push("/purchase/add" as any)}>
                          <Text style={styles.fixBtnText}>+ Add to Purchases</Text>
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
  tabBtn: { flex: 1, paddingVertical: 11, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabBtnActive: { borderBottomColor: Colors.primary },
  tabBtnText: { fontSize: 12, fontWeight: "600", color: "#6b7280" },
  tabBtnTextActive: { color: Colors.primary },
  scroll: { padding: 16, paddingBottom: 48 },
  modeRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  modeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.primary, backgroundColor: "#fff" },
  modeBtnActive: { backgroundColor: Colors.primary },
  modeBtnText: { fontSize: 13, fontWeight: "600", color: Colors.primary },
  modeBtnTextActive: { color: "#fff" },
  infoCard: { flexDirection: "row", gap: 10, backgroundColor: "#eff6ff", borderRadius: 10, padding: 12, borderLeftWidth: 3, borderLeftColor: Colors.primary, marginBottom: 14 },
  infoText: { flex: 1, fontSize: 12, color: "#374151", lineHeight: 18 },
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: "500", color: "#6b7280", marginBottom: 6 },
  input: { backgroundColor: "#fff", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#111827", borderWidth: 1, borderColor: "#e5e7eb" },
  textArea: { backgroundColor: "#fff", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: "#111827", borderWidth: 1, borderColor: "#e5e7eb", minHeight: 160, marginBottom: 14 },
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, marginBottom: 14 },
  primaryBtnText: { fontSize: 15, fontWeight: "600", color: "#fff" },
  loadingBox: { alignItems: "center", paddingVertical: 40, gap: 14 },
  loadingText: { fontSize: 15, fontWeight: "600", color: "#6b7280" },
  uploadBox: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 2, borderColor: "#bfdbfe", borderStyle: "dashed", padding: 40, alignItems: "center", gap: 10, marginBottom: 14 },
  uploadBoxTitle: { fontSize: 16, fontWeight: "700", color: Colors.primary },
  uploadBoxSub: { fontSize: 13, color: "#6b7280" },
  previewSection: { marginTop: 4 },
  previewTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  previewSub: { fontSize: 13, color: "#16a34a", fontWeight: "600", marginTop: 2, marginBottom: 10 },
  previewCard: { backgroundColor: "#fff", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#e5e7eb", marginBottom: 8 },
  previewSupplier: { fontSize: 14, fontWeight: "600", color: "#111827" },
  previewInv: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  previewAmt: { fontSize: 12, fontWeight: "500", color: "#374151" },
  moreText: { fontSize: 12, color: "#9ca3af", textAlign: "center", paddingVertical: 8 },
  importBtn: { backgroundColor: "#16a34a", borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  importBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  gmailConnect: { alignItems: "center", paddingTop: 20, gap: 14 },
  gmailIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#fef2f2", justifyContent: "center", alignItems: "center" },
  gmailTitle: { fontSize: 20, fontWeight: "800", color: "#111827" },
  gmailDesc: { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 22, paddingHorizontal: 10 },
  gmailBtn: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#ea4335", paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12 },
  gmailBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  gmailNote: { fontSize: 11, color: "#9ca3af", textAlign: "center" },
  gmailConnectedRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f0fdf4", borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: "#bbf7d0" },
  gmailConnectedText: { fontSize: 14, fontWeight: "600", color: "#16a34a" },
  disconnectText: { fontSize: 13, color: "#dc2626", fontWeight: "600" },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#111827", marginBottom: 10 },
  emailCard: { backgroundColor: "#fff", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#e5e7eb", marginBottom: 8, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  emailSubject: { fontSize: 13, fontWeight: "600", color: "#111827" },
  emailMeta: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  emailDate: { fontSize: 11, color: "#9ca3af", marginTop: 2 },
  attachBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  attachText: { fontSize: 11, color: "#6b7280" },
  extractEmailBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#eff6ff", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: "#bfdbfe" },
  extractEmailBtnText: { fontSize: 12, fontWeight: "600", color: Colors.primary },
  emptyBox: { alignItems: "center", paddingVertical: 60, gap: 14 },
  emptyText: { fontSize: 15, fontWeight: "600", color: "#6b7280" },
  itcRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  itcCard: { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1, borderColor: "#e5e7eb" },
  itcLabel: { fontSize: 10, color: "#6b7280", textAlign: "center", marginBottom: 6, lineHeight: 15 },
  itcAmount: { fontSize: 15, fontWeight: "800" },
  riskBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fef2f2", borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: "#fecaca" },
  riskText: { flex: 1, fontSize: 13, fontWeight: "600", color: "#dc2626" },
  section: { marginBottom: 16 },
  entryCard: { backgroundColor: "#fff", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#e5e7eb", borderLeftWidth: 4, marginBottom: 8 },
  entryName: { fontSize: 14, fontWeight: "600", color: "#111827" },
  entryDetail: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  mismatchInfo: { fontSize: 12, color: "#92400e", marginTop: 6 },
  issueText: { fontSize: 11, color: "#dc2626", marginTop: 2, fontWeight: "600" },
  fixBtn: { marginTop: 8, backgroundColor: "#eff6ff", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignSelf: "flex-start" },
  fixBtnText: { fontSize: 12, fontWeight: "600", color: Colors.primary },
});
