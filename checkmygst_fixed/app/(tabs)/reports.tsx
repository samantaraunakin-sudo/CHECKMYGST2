import React, { useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, ActivityIndicator, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";
import { useGST, getMonthKey, getMonthLabel } from "@/contexts/GSTContext";
import Colors from "@/constants/colors";

function formatINR(n: number) {
  return "₹" + Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export default function ReportsScreen() {
  const { purchases, sales, gstr2bEntries, profile } = useGST();
  const [isPrinting, setIsPrinting] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  // ── Duplicate Detection ──
  const duplicates = useMemo(() => {
    const dupes: any[] = [];
    const seen = new Map<string, any>();

    [...purchases.map(p => ({ ...p, _type: "Purchase" })),
     ...sales.map(s => ({ ...s, _type: "Sale" }))
    ].forEach(inv => {
      const key1 = `${inv.invoiceNumber?.trim()?.toLowerCase()}_${inv._type}`;
      const key2 = `${inv.supplierName?.trim()?.toLowerCase() || inv.customerName?.trim()?.toLowerCase()}_${inv.totalAmount}_${inv.invoiceDate}_${inv._type}`;
      if (inv.invoiceNumber && seen.has(key1)) {
        dupes.push({ type: "Same Invoice Number", a: seen.get(key1), b: inv });
      } else if (seen.has(key2)) {
        dupes.push({ type: "Same Amount + Date + Party", a: seen.get(key2), b: inv });
      } else {
        if (inv.invoiceNumber) seen.set(key1, inv);
        seen.set(key2, inv);
      }
    });
    return dupes;
  }, [purchases, sales]);

  // ── GST Risk Meter ──
  const riskData = useMemo(() => {
    let score = 0;
    const issues: { label: string; severity: "high" | "medium" | "low"; points: number }[] = [];

    // Duplicate invoices
    if (duplicates.length > 0) {
      const pts = Math.min(duplicates.length * 10, 30);
      score += pts;
      issues.push({ label: `${duplicates.length} duplicate invoice(s) found`, severity: "high", points: pts });
    }

    // Missing GSTR-2B
    if (gstr2bEntries.length === 0 && purchases.length > 0) {
      score += 20;
      issues.push({ label: "GSTR-2B not uploaded this month", severity: "medium", points: 20 });
    }

    // ITC mismatch
    const totalPurchaseGST = purchases.reduce((s, p) => s + (p.gstAmount || 0), 0);
    const totalGSTR2BITC = gstr2bEntries.reduce((s, g) => s + (g.totalITC || 0), 0);
    if (gstr2bEntries.length > 0) {
      const diff = Math.abs(totalPurchaseGST - totalGSTR2BITC);
      if (diff > 1000) {
        score += 25;
        issues.push({ label: `ITC mismatch of ${formatINR(diff)}`, severity: "high", points: 25 });
      }
    }

    // Overdue filings check
    const now = new Date();
    const gstr1Due = new Date(now.getFullYear(), now.getMonth(), 11);
    const gstr3bDue = new Date(now.getFullYear(), now.getMonth(), 20);
    if (now > gstr1Due) {
      score += 15;
      issues.push({ label: "GSTR-1 may be overdue", severity: "medium", points: 15 });
    }
    if (now > gstr3bDue) {
      score += 15;
      issues.push({ label: "GSTR-3B may be overdue", severity: "high", points: 15 });
    }

    // No sales data
    if (sales.length === 0) {
      score += 10;
      issues.push({ label: "No sales recorded this month", severity: "low", points: 10 });
    }

    const level = score === 0 ? "Safe" : score <= 20 ? "Low Risk" : score <= 50 ? "Medium Risk" : "High Risk";
    const color = score === 0 ? "#16a34a" : score <= 20 ? "#65a30d" : score <= 50 ? "#d97706" : "#dc2626";
    return { score: Math.min(score, 100), level, color, issues };
  }, [duplicates, purchases, sales, gstr2bEntries]);

  // ── Monthly Stats for PDF ──
  const monthStats = useMemo(() => {
    const mp = purchases.filter(p => getMonthKey(p.invoiceDate) === selectedMonth);
    const ms = sales.filter(s => getMonthKey(s.invoiceDate) === selectedMonth);
    return {
      purchases: mp,
      sales: ms,
      purchaseTotal: mp.reduce((s, p) => s + (p.totalAmount || 0), 0),
      salesTotal: ms.reduce((s, p) => s + (p.totalAmount || 0), 0),
      purchaseGST: mp.reduce((s, p) => s + (p.gstAmount || 0), 0),
      salesGST: ms.reduce((s, p) => s + (p.gstAmount || 0), 0),
      itc: gstr2bEntries.reduce((s, g) => s + (g.totalITC || 0), 0),
    };
  }, [selectedMonth, purchases, sales, gstr2bEntries]);

  // ── PDF Generation ──
  const generatePDF = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsPrinting(true);
    try {
      const netGST = monthStats.salesGST - monthStats.purchaseGST;
      const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  body { font-family: Arial, sans-serif; padding: 32px; color: #111; }
  h1 { color: #1d4ed8; font-size: 22px; margin-bottom: 4px; }
  .sub { color: #6b7280; font-size: 13px; margin-bottom: 24px; }
  .section { margin-bottom: 24px; }
  .section-title { font-size: 15px; font-weight: bold; color: #1d4ed8; border-bottom: 2px solid #bfdbfe; padding-bottom: 6px; margin-bottom: 12px; }
  .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
  .total-row { display: flex; justify-content: space-between; padding: 10px 0; font-weight: bold; font-size: 15px; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: bold; }
  .safe { background: #f0fdf4; color: #16a34a; }
  .medium { background: #fffbeb; color: #d97706; }
  .high { background: #fef2f2; color: #dc2626; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #eff6ff; padding: 8px; text-align: left; }
  td { padding: 7px 8px; border-bottom: 1px solid #f3f4f6; }
  .footer { margin-top: 40px; font-size: 11px; color: #9ca3af; text-align: center; }
</style>
</head>
<body>
<h1>GST Monthly Report</h1>
<div class="sub">${profile?.businessName || "My Business"} &nbsp;|&nbsp; GSTIN: ${profile?.gstin || "N/A"} &nbsp;|&nbsp; Period: ${getMonthLabel(selectedMonth)}</div>

<div class="section">
  <div class="section-title">Summary</div>
  <div class="row"><span>Total Sales</span><span>${formatINR(monthStats.salesTotal)}</span></div>
  <div class="row"><span>Total Purchases</span><span>${formatINR(monthStats.purchaseTotal)}</span></div>
  <div class="row"><span>Output GST (on Sales)</span><span style="color:#ef4444">${formatINR(monthStats.salesGST)}</span></div>
  <div class="row"><span>Input Tax Credit (ITC)</span><span style="color:#16a34a">${formatINR(monthStats.purchaseGST)}</span></div>
  <div class="row"><span>GSTR-2B ITC Available</span><span style="color:#2563eb">${formatINR(monthStats.itc)}</span></div>
  <div class="total-row"><span>Net GST Payable</span><span style="color:${netGST > 0 ? "#ef4444" : "#16a34a"}">${formatINR(netGST)}</span></div>
</div>

<div class="section">
  <div class="section-title">GST Risk Assessment</div>
  <div class="row"><span>Risk Level</span><span><span class="badge ${riskData.score <= 20 ? "safe" : riskData.score <= 50 ? "medium" : "high"}">${riskData.level}</span></span></div>
  <div class="row"><span>Risk Score</span><span>${riskData.score}/100</span></div>
  ${riskData.issues.map(i => `<div class="row"><span>⚠ ${i.label}</span><span style="color:#dc2626">-${i.points} pts</span></div>`).join("")}
  ${duplicates.length > 0 ? `<div class="row"><span>Duplicate Invoices</span><span style="color:#dc2626">${duplicates.length} found</span></div>` : ""}
</div>

${monthStats.sales.length > 0 ? `
<div class="section">
  <div class="section-title">Sales Invoices (${monthStats.sales.length})</div>
  <table>
    <tr><th>Date</th><th>Party</th><th>Invoice No</th><th>Taxable</th><th>GST</th><th>Total</th></tr>
    ${monthStats.sales.slice(0, 20).map(s => `<tr><td>${s.invoiceDate}</td><td>${(s as any).customerName || "-"}</td><td>${(s as any).invoiceNumber || "-"}</td><td>${formatINR((s as any).taxableAmount || 0)}</td><td>${formatINR(s.gstAmount || 0)}</td><td>${formatINR(s.totalAmount || 0)}</td></tr>`).join("")}
    ${monthStats.sales.length > 20 ? `<tr><td colspan="6" style="text-align:center;color:#6b7280">... and ${monthStats.sales.length - 20} more</td></tr>` : ""}
  </table>
</div>` : ""}

${monthStats.purchases.length > 0 ? `
<div class="section">
  <div class="section-title">Purchase Invoices (${monthStats.purchases.length})</div>
  <table>
    <tr><th>Date</th><th>Supplier</th><th>Invoice No</th><th>Taxable</th><th>GST</th><th>Total</th></tr>
    ${monthStats.purchases.slice(0, 20).map(p => `<tr><td>${p.invoiceDate}</td><td>${(p as any).supplierName || "-"}</td><td>${(p as any).invoiceNumber || "-"}</td><td>${formatINR((p as any).taxableAmount || 0)}</td><td>${formatINR(p.gstAmount || 0)}</td><td>${formatINR(p.totalAmount || 0)}</td></tr>`).join("")}
    ${monthStats.purchases.length > 20 ? `<tr><td colspan="6" style="text-align:center;color:#6b7280">... and ${monthStats.purchases.length - 20} more</td></tr>` : ""}
  </table>
</div>` : ""}

<div class="footer">Generated by CheckMyGST &nbsp;|&nbsp; ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</div>
</body>
</html>`;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Share GST Report" });
      } else {
        await Print.printAsync({ html });
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "Could not generate PDF");
    } finally {
      setIsPrinting(false);
    }
  };

  const severityColor = (s: string) => s === "high" ? "#dc2626" : s === "medium" ? "#d97706" : "#65a30d";
  const severityBg = (s: string) => s === "high" ? "#fef2f2" : s === "medium" ? "#fffbeb" : "#f7fee7";

  // Month picker options — last 6 months
  const monthOptions = useMemo(() => {
    const opts = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      opts.push({ key, label: d.toLocaleDateString("en-IN", { month: "short", year: "numeric" }) });
    }
    return opts;
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reports & Tools</Text>
        <Text style={styles.headerSub}>{profile?.businessName || "My Business"}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Risk Meter ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="shield-checkmark-outline" size={20} color={riskData.color} />
            <Text style={styles.cardTitle}>GST Risk Meter</Text>
          </View>

          {/* Meter bar */}
          <View style={styles.meterContainer}>
            <View style={styles.meterTrack}>
              <View style={[styles.meterFill, { width: `${riskData.score}%` as any, backgroundColor: riskData.color }]} />
            </View>
            <Text style={[styles.meterScore, { color: riskData.color }]}>{riskData.score}/100</Text>
          </View>

          <View style={[styles.riskBadge, { backgroundColor: riskData.color + "18" }]}>
            <Text style={[styles.riskLevel, { color: riskData.color }]}>{riskData.level}</Text>
          </View>

          {riskData.issues.length === 0 ? (
            <Text style={styles.noIssues}>✅ No issues detected. You are GST compliant!</Text>
          ) : (
            riskData.issues.map((issue, i) => (
              <View key={i} style={[styles.issueRow, { backgroundColor: severityBg(issue.severity) }]}>
                <Ionicons name={issue.severity === "high" ? "close-circle" : "warning"} size={16} color={severityColor(issue.severity)} />
                <Text style={[styles.issueText, { color: severityColor(issue.severity) }]}>{issue.label}</Text>
              </View>
            ))
          )}
        </View>

        {/* ── Duplicate Detection ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="copy-outline" size={20} color={duplicates.length > 0 ? "#dc2626" : "#16a34a"} />
            <Text style={styles.cardTitle}>Duplicate Invoice Detection</Text>
            <View style={[styles.countBadge, { backgroundColor: duplicates.length > 0 ? "#fef2f2" : "#f0fdf4" }]}>
              <Text style={[styles.countText, { color: duplicates.length > 0 ? "#dc2626" : "#16a34a" }]}>
                {duplicates.length > 0 ? `${duplicates.length} found` : "Clean ✓"}
              </Text>
            </View>
          </View>

          {duplicates.length === 0 ? (
            <Text style={styles.noIssues}>✅ No duplicate invoices found in your records.</Text>
          ) : (
            duplicates.map((dupe, i) => (
              <View key={i} style={styles.dupeCard}>
                <Text style={styles.dupeType}>⚠️ {dupe.type}</Text>
                <View style={styles.dupeRow}>
                  <View style={styles.dupeItem}>
                    <Text style={styles.dupeLabel}>{dupe.a._type}</Text>
                    <Text style={styles.dupeName} numberOfLines={1}>{dupe.a.supplierName || dupe.a.customerName || "Unknown"}</Text>
                    <Text style={styles.dupeDetail}>#{dupe.a.invoiceNumber || "N/A"} · {dupe.a.invoiceDate}</Text>
                    <Text style={styles.dupeAmount}>{formatINR(dupe.a.totalAmount || 0)}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={16} color="#9ca3af" style={{ marginTop: 16 }} />
                  <View style={styles.dupeItem}>
                    <Text style={styles.dupeLabel}>{dupe.b._type}</Text>
                    <Text style={styles.dupeName} numberOfLines={1}>{dupe.b.supplierName || dupe.b.customerName || "Unknown"}</Text>
                    <Text style={styles.dupeDetail}>#{dupe.b.invoiceNumber || "N/A"} · {dupe.b.invoiceDate}</Text>
                    <Text style={styles.dupeAmount}>{formatINR(dupe.b.totalAmount || 0)}</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        {/* ── PDF Report ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="document-text-outline" size={20} color={Colors.primary} />
            <Text style={styles.cardTitle}>Monthly GST Report</Text>
          </View>

          {/* Month selector */}
          <Text style={styles.label}>Select Month</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthScroll}>
            {monthOptions.map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.monthChip, selectedMonth === opt.key && styles.monthChipActive]}
                onPress={() => setSelectedMonth(opt.key)}
              >
                <Text style={[styles.monthChipText, selectedMonth === opt.key && styles.monthChipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Stats preview */}
          <View style={styles.statsGrid}>
            {[
              { label: "Sales", value: formatINR(monthStats.salesTotal), color: "#2563eb" },
              { label: "Purchases", value: formatINR(monthStats.purchaseTotal), color: "#7c3aed" },
              { label: "Output GST", value: formatINR(monthStats.salesGST), color: "#dc2626" },
              { label: "ITC", value: formatINR(monthStats.purchaseGST), color: "#16a34a" },
            ].map(s => (
              <View key={s.label} style={styles.statBox}>
                <Text style={styles.statLabel}>{s.label}</Text>
                <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              </View>
            ))}
          </View>

          <View style={styles.netRow}>
            <Text style={styles.netLabel}>Net GST Payable</Text>
            <Text style={[styles.netValue, { color: monthStats.salesGST - monthStats.purchaseGST > 0 ? "#dc2626" : "#16a34a" }]}>
              {formatINR(monthStats.salesGST - monthStats.purchaseGST)}
            </Text>
          </View>

          <TouchableOpacity style={[styles.pdfBtn, isPrinting && { opacity: 0.6 }]} onPress={generatePDF} disabled={isPrinting}>
            {isPrinting
              ? <><ActivityIndicator size="small" color="#fff" /><Text style={styles.pdfBtnText}>Generating PDF...</Text></>
              : <><Ionicons name="download-outline" size={18} color="#fff" /><Text style={styles.pdfBtnText}>Download / Share PDF Report</Text></>
            }
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", paddingTop: Platform.OS === "ios" ? 56 : 48 },
  header: { backgroundColor: "#fff", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#111827" },
  headerSub: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  scroll: { padding: 16, paddingBottom: 48 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#e5e7eb" },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#111827", flex: 1 },
  countBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  countText: { fontSize: 12, fontWeight: "700" },
  meterContainer: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  meterTrack: { flex: 1, height: 12, backgroundColor: "#f3f4f6", borderRadius: 6, overflow: "hidden" },
  meterFill: { height: 12, borderRadius: 6 },
  meterScore: { fontSize: 14, fontWeight: "800", minWidth: 50, textAlign: "right" },
  riskBadge: { alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, marginBottom: 12 },
  riskLevel: { fontSize: 14, fontWeight: "800" },
  noIssues: { fontSize: 13, color: "#16a34a", fontWeight: "500" },
  issueRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 8, marginBottom: 6 },
  issueText: { fontSize: 13, fontWeight: "600", flex: 1 },
  dupeCard: { backgroundColor: "#fef2f2", borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#fecaca" },
  dupeType: { fontSize: 12, fontWeight: "700", color: "#dc2626", marginBottom: 8 },
  dupeRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  dupeItem: { flex: 1, backgroundColor: "#fff", borderRadius: 8, padding: 10 },
  dupeLabel: { fontSize: 10, fontWeight: "700", color: "#6b7280", textTransform: "uppercase", marginBottom: 2 },
  dupeName: { fontSize: 13, fontWeight: "600", color: "#111827" },
  dupeDetail: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  dupeAmount: { fontSize: 13, fontWeight: "700", color: "#374151", marginTop: 4 },
  label: { fontSize: 13, fontWeight: "500", color: "#6b7280", marginBottom: 8 },
  monthScroll: { marginBottom: 14 },
  monthChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: "#e5e7eb", marginRight: 8, backgroundColor: "#fff" },
  monthChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  monthChipText: { fontSize: 13, fontWeight: "600", color: "#374151" },
  monthChipTextActive: { color: "#fff" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  statBox: { width: "47%", backgroundColor: "#f8fafc", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#e5e7eb" },
  statLabel: { fontSize: 11, color: "#6b7280", marginBottom: 4 },
  statValue: { fontSize: 15, fontWeight: "800" },
  netRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderTopWidth: 1, borderTopColor: "#f3f4f6", marginBottom: 14 },
  netLabel: { fontSize: 14, fontWeight: "700", color: "#111827" },
  netValue: { fontSize: 16, fontWeight: "800" },
  pdfBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14 },
  pdfBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});
