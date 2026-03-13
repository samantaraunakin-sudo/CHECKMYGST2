import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, Share, Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useGST, getMonthKey, getMonthLabel, parseInvoiceDate } from "@/contexts/GSTContext";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

const { width: SW } = Dimensions.get("window");

function formatINR(n: number) {
  if (n >= 10000000) return "₹" + (n / 10000000).toFixed(1) + "Cr";
  if (n >= 100000) return "₹" + (n / 100000).toFixed(1) + "L";
  if (n >= 1000) return "₹" + (n / 1000).toFixed(1) + "K";
  return "₹" + Math.round(Math.abs(n)).toLocaleString("en-IN");
}

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function getMonthKeyFromDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
function isSameDay(dateStr: string, isoKey: string) {
  if (!dateStr) return false;
  try {
    const d = parseInvoiceDate(dateStr);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    return key === isoKey;
  } catch { return false; }
}

// Mini bar chart
function MiniBar({ data, colors: barColors }: { data: { label: string; v1: number; v2: number }[]; colors: [string, string] }) {
  const max = Math.max(...data.map(d => Math.max(d.v1, d.v2)), 1);
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around", height: 80, marginTop: 8 }}>
      {data.map((d, i) => (
        <View key={i} style={{ alignItems: "center", flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2 }}>
            <View style={{ width: 10, height: Math.max((d.v1/max)*60, 2), backgroundColor: barColors[0], borderRadius: 3 }} />
            <View style={{ width: 10, height: Math.max((d.v2/max)*60, 2), backgroundColor: barColors[1], borderRadius: 3 }} />
          </View>
          <Text style={{ fontSize: 9, color: "#9ca3af", marginTop: 3 }}>{d.label}</Text>
        </View>
      ))}
    </View>
  );
}

type DashTab = "overview" | "analytics" | "risk";

export default function DashboardScreen() {
  const { profile, purchases, sales, gstr2bEntries } = useGST();
  const [activeTab, setActiveTab] = useState<DashTab>("overview");

  const now = new Date();
  const todayKey = getTodayKey();
  const currentMonthKey = getMonthKeyFromDate(now);
  // Previous month for filings context
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthKey = getMonthKeyFromDate(prevMonth);
  const prevMonthLabel = prevMonth.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  // Today
  const todayPurchases = useMemo(() => purchases.filter(p => isSameDay(p.invoiceDate, todayKey)), [purchases, todayKey]);
  const todaySales = useMemo(() => sales.filter(s => isSameDay(s.invoiceDate, todayKey)), [sales, todayKey]);

  // This month
  const monthPurchases = useMemo(() => purchases.filter(p => getMonthKey(p.invoiceDate) === currentMonthKey), [purchases, currentMonthKey]);
  const monthSales = useMemo(() => sales.filter(s => getMonthKey(s.invoiceDate) === currentMonthKey), [sales, currentMonthKey]);

  // Last month (for filing context)
  const prevMonthPurchases = useMemo(() => purchases.filter(p => getMonthKey(p.invoiceDate) === prevMonthKey), [purchases, prevMonthKey]);
  const prevMonthSales = useMemo(() => sales.filter(s => getMonthKey(s.invoiceDate) === prevMonthKey), [sales, prevMonthKey]);

  const monthPurchaseGST = monthPurchases.reduce((s, p) => s + (p.gstAmount || 0), 0);
  const monthSalesGST = monthSales.reduce((s, p) => s + (p.gstAmount || 0), 0);
  const netGST = monthSalesGST - monthPurchaseGST;
  const totalITC = gstr2bEntries.reduce((s, g) => s + (g.totalITC || 0), 0);

  // Last 6 months for chart
  const chartData = useMemo(() => {
    const result = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = getMonthKeyFromDate(d);
      const mp = purchases.filter(p => getMonthKey(p.invoiceDate) === key);
      const ms = sales.filter(s => getMonthKey(s.invoiceDate) === key);
      result.push({
        label: d.toLocaleDateString("en-IN", { month: "short" }),
        v1: ms.reduce((s, x) => s + (x.totalAmount || 0), 0),
        v2: mp.reduce((s, x) => s + (x.totalAmount || 0), 0),
      });
    }
    return result;
  }, [purchases, sales]);

  // Top suppliers
  const topSuppliers = useMemo(() => {
    const map = new Map<string, number>();
    purchases.forEach(p => {
      const k = (p as any).supplierName || "Unknown";
      map.set(k, (map.get(k) || 0) + (p.totalAmount || 0));
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [purchases]);

  // GST Risk
  const riskData = useMemo(() => {
    let score = 0;
    const issues: { text: string; severity: "high" | "medium" | "low" }[] = [];
    const tips: string[] = [];

    if (gstr2bEntries.length === 0 && purchases.length > 0) {
      score += 25;
      issues.push({ text: "GSTR-2B not uploaded — your tax credits are unverified", severity: "high" });
      tips.push("Upload your GSTR-2B from gst.gov.in to verify your tax credits");
    }
    const gstr3bDue = new Date(now.getFullYear(), now.getMonth(), 20);
    const daysToGSTR3B = Math.ceil((gstr3bDue.getTime() - now.getTime()) / 86400000);
    if (daysToGSTR3B < 0) {
      score += 30;
      issues.push({ text: "GSTR-3B filing is overdue — late fees are accumulating", severity: "high" });
      tips.push("File GSTR-3B immediately on gst.gov.in to stop late fees");
    } else if (daysToGSTR3B <= 5) {
      score += 15;
      issues.push({ text: `GSTR-3B due in ${daysToGSTR3B} days — file soon`, severity: "medium" });
      tips.push("File GSTR-3B before the 20th of this month");
    }
    if (netGST > 50000) {
      score += 10;
      issues.push({ text: `High GST payable this month: ${formatINR(netGST)}`, severity: "medium" });
      tips.push("Make sure you have enough cash to pay your GST liability");
    }
    if (monthPurchases.length === 0 && now.getDate() > 10) {
      score += 10;
      issues.push({ text: "No purchases recorded this month", severity: "low" });
      tips.push("Record your purchase invoices to claim Input Tax Credit (ITC)");
    }
    if (monthSales.length === 0 && now.getDate() > 10) {
      score += 10;
      issues.push({ text: "No sales recorded this month", severity: "low" });
      tips.push("Record your sales invoices for accurate GST filing");
    }
    const level = score === 0 ? "All Good" : score <= 20 ? "Low Risk" : score <= 40 ? "Needs Attention" : "Urgent Action Needed";
    const color = score === 0 ? "#16a34a" : score <= 20 ? "#65a30d" : score <= 40 ? "#d97706" : "#dc2626";
    const emoji = score === 0 ? "✅" : score <= 20 ? "🟡" : score <= 40 ? "⚠️" : "🔴";
    return { score: Math.min(score, 100), level, color, emoji, issues, tips };
  }, [purchases, sales, gstr2bEntries, netGST, monthPurchases, monthSales]);

  // Filing status for prev month (what's actually due now)
  const gstr1Due = new Date(now.getFullYear(), now.getMonth(), 11);
  const gstr3bDue = new Date(now.getFullYear(), now.getMonth(), 20);
  const daysToGSTR1 = Math.ceil((gstr1Due.getTime() - now.getTime()) / 86400000);
  const daysToGSTR3B = Math.ceil((gstr3bDue.getTime() - now.getTime()) / 86400000);

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={["#1d4ed8", "#2563eb"]} style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>CheckMyGST</Text>
          <Text style={styles.headerSub}>{profile?.businessName || "Set up your business →"}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.push("/gstr2b/upload" as any)}>
            <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => {
            const msg = `CheckMyGST Report\n${profile?.businessName || "My Business"}\n\nThis Month:\nSales: ${formatINR(monthSales.reduce((s,x)=>s+x.totalAmount,0))}\nPurchases: ${formatINR(monthPurchases.reduce((s,x)=>s+x.totalAmount,0))}\nNet GST: ${formatINR(netGST)}\n\nGenerated via CheckMyGST`;
            Share.share({ message: msg });
          }}>
            <Ionicons name="share-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Today's snapshot */}
        <View style={styles.todayCard}>
          <Text style={styles.todayDate}>{now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</Text>
          <View style={styles.todayRow}>
            <View style={styles.todayStat}>
              <Text style={styles.todayStatLabel}>Today's Sales</Text>
              <Text style={[styles.todayStatValue, { color: "#16a34a" }]}>{formatINR(todaySales.reduce((s,x)=>s+x.totalAmount,0))}</Text>
              <Text style={styles.todayStatCount}>{todaySales.length} invoice{todaySales.length !== 1 ? "s" : ""}</Text>
            </View>
            <View style={styles.todayDivider} />
            <View style={styles.todayStat}>
              <Text style={styles.todayStatLabel}>Today's Purchases</Text>
              <Text style={[styles.todayStatValue, { color: "#2563eb" }]}>{formatINR(todayPurchases.reduce((s,x)=>s+x.totalAmount,0))}</Text>
              <Text style={styles.todayStatCount}>{todayPurchases.length} invoice{todayPurchases.length !== 1 ? "s" : ""}</Text>
            </View>
          </View>
        </View>

        {/* Urgent filing alert */}
        {(daysToGSTR1 >= 0 && daysToGSTR1 <= 7) && (
          <TouchableOpacity style={styles.alertBanner} onPress={() => router.push("/(tabs)/filings" as any)}>
            <Ionicons name="alarm" size={18} color="#dc2626" />
            <Text style={styles.alertText}>
              {`GSTR-1 for ${prevMonthLabel} due in ${daysToGSTR1} day${daysToGSTR1 !== 1 ? "s" : ""} (${gstr1Due.toLocaleDateString("en-IN", { day: "numeric", month: "short" })})`}
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#dc2626" />
          </TouchableOpacity>
        )}
        {(daysToGSTR3B >= 0 && daysToGSTR3B <= 7) && (
          <TouchableOpacity style={[styles.alertBanner, { borderColor: "#d97706", backgroundColor: "#fffbeb" }]} onPress={() => router.push("/(tabs)/filings" as any)}>
            <Ionicons name="alarm" size={18} color="#d97706" />
            <Text style={[styles.alertText, { color: "#92400e" }]}>
              {`GSTR-3B for ${prevMonthLabel} due in ${daysToGSTR3B} day${daysToGSTR3B !== 1 ? "s" : ""} (${gstr3bDue.toLocaleDateString("en-IN", { day: "numeric", month: "short" })})`}
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#d97706" />
          </TouchableOpacity>
        )}

        {/* Dashboard tabs */}
        <View style={styles.dashTabs}>
          {([
            { key: "overview", label: "📊 Overview" },
            { key: "analytics", label: "📈 Analytics" },
            { key: "risk", label: `${riskData.emoji} GST Risk` },
          ] as { key: DashTab; label: string }[]).map(t => (
            <TouchableOpacity key={t.key} style={[styles.dashTab, activeTab === t.key && styles.dashTabActive]} onPress={() => setActiveTab(t.key)}>
              <Text style={[styles.dashTabText, activeTab === t.key && styles.dashTabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── OVERVIEW ── */}
        {activeTab === "overview" && (
          <>
            <Text style={styles.sectionTitle}>{now.toLocaleDateString("en-IN", { month: "long", year: "numeric" })} Summary</Text>
            <View style={styles.statsGrid}>
              {[
                { label: "Sales this month", value: formatINR(monthSales.reduce((s,x)=>s+x.totalAmount,0)), sub: `${monthSales.length} invoices`, color: "#16a34a", icon: "trending-up-outline" },
                { label: "Purchases this month", value: formatINR(monthPurchases.reduce((s,x)=>s+x.totalAmount,0)), sub: `${monthPurchases.length} invoices`, color: "#2563eb", icon: "trending-down-outline" },
                { label: "GST on Sales\n(you collected)", value: formatINR(monthSalesGST), sub: "Output Tax", color: "#dc2626", icon: "cash-outline" },
                { label: "GST on Purchases\n(you can deduct)", value: formatINR(monthPurchaseGST), sub: "Input Tax Credit", color: "#16a34a", icon: "shield-checkmark-outline" },
              ].map(s => (
                <View key={s.label} style={styles.statCard}>
                  <View style={[styles.statIcon, { backgroundColor: s.color + "15" }]}>
                    <Ionicons name={s.icon as any} size={20} color={s.color} />
                  </View>
                  <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                  <Text style={styles.statSub}>{s.sub}</Text>
                </View>
              ))}
            </View>

            {/* Net GST payable */}
            <View style={[styles.netGSTCard, { borderColor: netGST > 0 ? "#fecaca" : "#bbf7d0", backgroundColor: netGST > 0 ? "#fef2f2" : "#f0fdf4" }]}>
              <View>
                <Text style={styles.netGSTLabel}>Net GST You Need to Pay This Month</Text>
                <Text style={styles.netGSTExplain}>Sales GST − Purchase GST = Amount to deposit with govt</Text>
              </View>
              <Text style={[styles.netGSTValue, { color: netGST > 0 ? "#dc2626" : "#16a34a" }]}>{formatINR(Math.abs(netGST))}</Text>
            </View>

            {/* GSTR-2B ITC */}
            {totalITC > 0 && (
              <View style={styles.itcCard}>
                <Ionicons name="checkmark-shield-outline" size={20} color="#16a34a" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itcTitle}>Verified Tax Credit (from GSTR-2B)</Text>
                  <Text style={styles.itcSub}>This is the tax credit confirmed by your suppliers. Use this to reduce your GST payment.</Text>
                </View>
                <Text style={styles.itcValue}>{formatINR(totalITC)}</Text>
              </View>
            )}

            {/* Quick Actions */}
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionsGrid}>
              {[
                { label: "Record a Purchase", icon: "arrow-down-circle-outline", color: "#eff6ff", iconColor: "#2563eb", route: "/purchase/add", desc: "Add supplier invoice" },
                { label: "Record a Sale", icon: "arrow-up-circle-outline", color: "#f0fdf4", iconColor: "#16a34a", route: "/sale/add", desc: "Add customer invoice" },
                { label: "Upload GSTR-2B", icon: "cloud-upload-outline", color: "#fffbeb", iconColor: "#d97706", route: "/gstr2b/upload", desc: "Verify your tax credits" },
                { label: "View Filings", icon: "calendar-outline", color: "#fdf4ff", iconColor: "#9333ea", route: "/(tabs)/filings", desc: "Check due dates" },
              ].map(a => (
                <TouchableOpacity key={a.label} style={styles.actionCard} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(a.route as any); }} activeOpacity={0.8}>
                  <View style={[styles.actionIcon, { backgroundColor: a.color }]}>
                    <Ionicons name={a.icon as any} size={22} color={a.iconColor} />
                  </View>
                  <Text style={styles.actionLabel}>{a.label}</Text>
                  <Text style={styles.actionDesc}>{a.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* ── ANALYTICS ── */}
        {activeTab === "analytics" && (
          <>
            <View style={styles.analyticsCard}>
              <Text style={styles.analyticsTitle}>📈 Sales vs Purchases — Last 6 Months</Text>
              <Text style={styles.analyticsSub}>Blue = Sales &nbsp;|&nbsp; Purple = Purchases</Text>
              <MiniBar data={chartData} colors={["#16a34a", "#2563eb"]} />
              <View style={styles.chartLegend}>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: "#16a34a" }]} /><Text style={styles.legendText}>Sales</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: "#2563eb" }]} /><Text style={styles.legendText}>Purchases</Text></View>
              </View>
            </View>

            {/* Monthly table */}
            <View style={styles.analyticsCard}>
              <Text style={styles.analyticsTitle}>📅 Month-wise GST Summary</Text>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableCell, { flex: 1.3 }]}>Month</Text>
                <Text style={[styles.tableCell, { flex: 1, textAlign: "right" }]}>Sales GST</Text>
                <Text style={[styles.tableCell, { flex: 1, textAlign: "right" }]}>Purchase GST</Text>
                <Text style={[styles.tableCell, { flex: 1, textAlign: "right" }]}>Net Payable</Text>
              </View>
              {chartData.map((d, i) => {
                const mKey = getMonthKeyFromDate(new Date(now.getFullYear(), now.getMonth() - (5 - i), 1));
                const ms = sales.filter(s => getMonthKey(s.invoiceDate) === mKey);
                const mp = purchases.filter(p => getMonthKey(p.invoiceDate) === mKey);
                const sg = ms.reduce((s, x) => s + (x.gstAmount || 0), 0);
                const pg = mp.reduce((s, x) => s + (x.gstAmount || 0), 0);
                const net = sg - pg;
                return (
                  <View key={i} style={styles.tableRow}>
                    <Text style={[styles.tableCell, { flex: 1.3, fontWeight: "600" }]}>{d.label}</Text>
                    <Text style={[styles.tableCell, { flex: 1, textAlign: "right", color: "#dc2626" }]}>{formatINR(sg)}</Text>
                    <Text style={[styles.tableCell, { flex: 1, textAlign: "right", color: "#16a34a" }]}>{formatINR(pg)}</Text>
                    <Text style={[styles.tableCell, { flex: 1, textAlign: "right", fontWeight: "700", color: net > 0 ? "#dc2626" : "#16a34a" }]}>{formatINR(Math.abs(net))}</Text>
                  </View>
                );
              })}
            </View>

            {/* Top Suppliers */}
            {topSuppliers.length > 0 && (
              <View style={styles.analyticsCard}>
                <Text style={styles.analyticsTitle}>🏪 Top Suppliers by Purchase Value</Text>
                {topSuppliers.map(([name, val], i) => (
                  <View key={i} style={styles.supplierRow}>
                    <View style={[styles.supplierRank, { backgroundColor: ["#fef3c7","#f3f4f6","#fdf4ff","#f0fdf4"][i] }]}>
                      <Text style={styles.supplierRankText}>#{i+1}</Text>
                    </View>
                    <Text style={styles.supplierName} numberOfLines={1}>{name}</Text>
                    <Text style={styles.supplierVal}>{formatINR(val)}</Text>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity style={styles.fullReportBtn} onPress={() => router.push("/(tabs)/reports" as any)}>
              <Ionicons name="document-text-outline" size={18} color="#fff" />
              <Text style={styles.fullReportBtnText}>Download Full PDF Report</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── RISK ── */}
        {activeTab === "risk" && (
          <>
            {/* What is risk meter */}
            <View style={styles.riskExplainCard}>
              <Text style={styles.riskExplainTitle}>What is the GST Risk Meter?</Text>
              <Text style={styles.riskExplainText}>
                This shows how likely you are to face GST penalties or notices. Like a car dashboard warning light — green means everything is fine, red means you need to take action immediately.
              </Text>
            </View>

            {/* Risk score */}
            <View style={[styles.riskCard, { borderColor: riskData.color }]}>
              <View style={styles.riskScoreRow}>
                <View>
                  <Text style={[styles.riskLevel, { color: riskData.color }]}>{riskData.emoji} {riskData.level}</Text>
                  <Text style={styles.riskScoreLabel}>Risk Score: {riskData.score}/100</Text>
                </View>
                <View style={styles.riskMeter}>
                  <View style={styles.riskTrack}>
                    <View style={[styles.riskFill, { width: `${riskData.score}%` as any, backgroundColor: riskData.color }]} />
                  </View>
                </View>
              </View>

              {/* Color scale explanation */}
              <View style={styles.riskScale}>
                {[
                  { label: "0–20\nSafe", color: "#16a34a" },
                  { label: "21–40\nLow Risk", color: "#65a30d" },
                  { label: "41–60\nAttention", color: "#d97706" },
                  { label: "61–100\nUrgent", color: "#dc2626" },
                ].map(s => (
                  <View key={s.label} style={styles.riskScaleItem}>
                    <View style={[styles.riskScaleDot, { backgroundColor: s.color }]} />
                    <Text style={styles.riskScaleText}>{s.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Issues */}
            {riskData.issues.length === 0 ? (
              <View style={styles.riskAllGood}>
                <Text style={styles.riskAllGoodEmoji}>🎉</Text>
                <Text style={styles.riskAllGoodTitle}>Everything looks good!</Text>
                <Text style={styles.riskAllGoodSub}>No GST compliance issues found. Keep recording your invoices regularly.</Text>
              </View>
            ) : (
              <>
                <Text style={styles.sectionTitle}>Issues Found</Text>
                {riskData.issues.map((issue, i) => (
                  <View key={i} style={[styles.issueCard, {
                    borderLeftColor: issue.severity === "high" ? "#dc2626" : issue.severity === "medium" ? "#d97706" : "#65a30d",
                    backgroundColor: issue.severity === "high" ? "#fef2f2" : issue.severity === "medium" ? "#fffbeb" : "#f7fee7",
                  }]}>
                    <Ionicons
                      name={issue.severity === "high" ? "close-circle" : issue.severity === "medium" ? "warning" : "information-circle"}
                      size={18}
                      color={issue.severity === "high" ? "#dc2626" : issue.severity === "medium" ? "#d97706" : "#65a30d"}
                    />
                    <Text style={styles.issueText}>{issue.text}</Text>
                  </View>
                ))}

                <Text style={styles.sectionTitle}>What You Should Do</Text>
                {riskData.tips.map((tip, i) => (
                  <View key={i} style={styles.tipCard}>
                    <View style={styles.tipNumber}><Text style={styles.tipNumberText}>{i+1}</Text></View>
                    <Text style={styles.tipText}>{tip}</Text>
                  </View>
                ))}
              </>
            )}

            {/* Penalty info */}
            <View style={styles.penaltyCard}>
              <Text style={styles.penaltyTitle}>⚠️ Know the Penalties</Text>
              {[
                { q: "What happens if I file GSTR-1 late?", a: "₹50 per day fine (₹20/day if no sales). Max ₹10,000." },
                { q: "What if I don't pay GST on time?", a: "18% annual interest on unpaid amount + ₹50/day late fee." },
                { q: "What is the maximum penalty?", a: "₹10,000 per return + interest on unpaid tax." },
              ].map(p => (
                <View key={p.q} style={styles.penaltyRow}>
                  <Text style={styles.penaltyQ}>❓ {p.q}</Text>
                  <Text style={styles.penaltyA}>→ {p.a}</Text>
                </View>
              ))}
            </View>
          </>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: { paddingTop: Platform.OS === "ios" ? 56 : 48, paddingBottom: 16, paddingHorizontal: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#fff" },
  headerSub: { fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 2 },
  headerRight: { flexDirection: "row", gap: 8 },
  headerBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  scroll: { paddingHorizontal: 16, paddingBottom: 100 },
  todayCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginTop: 16, marginBottom: 12, borderWidth: 1, borderColor: "#e5e7eb" },
  todayDate: { fontSize: 13, color: "#6b7280", marginBottom: 12, fontWeight: "500" },
  todayRow: { flexDirection: "row" },
  todayStat: { flex: 1, alignItems: "center" },
  todayStatLabel: { fontSize: 12, color: "#6b7280", marginBottom: 4 },
  todayStatValue: { fontSize: 22, fontWeight: "800" },
  todayStatCount: { fontSize: 11, color: "#9ca3af", marginTop: 2 },
  todayDivider: { width: 1, backgroundColor: "#e5e7eb", marginHorizontal: 16 },
  alertBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fef2f2", borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#fecaca" },
  alertText: { flex: 1, fontSize: 13, fontWeight: "600", color: "#dc2626" },
  dashTabs: { flexDirection: "row", backgroundColor: "#fff", borderRadius: 12, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: "#e5e7eb" },
  dashTab: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8 },
  dashTabActive: { backgroundColor: Colors.primary },
  dashTabText: { fontSize: 12, fontWeight: "600", color: "#6b7280" },
  dashTabTextActive: { color: "#fff" },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#111827", marginBottom: 10, marginTop: 4 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  statCard: { width: "47%", backgroundColor: "#fff", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#e5e7eb" },
  statIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  statValue: { fontSize: 18, fontWeight: "800", marginBottom: 4 },
  statLabel: { fontSize: 11, color: "#374151", fontWeight: "500", lineHeight: 16 },
  statSub: { fontSize: 10, color: "#9ca3af", marginTop: 3 },
  netGSTCard: { borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1.5, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  netGSTLabel: { fontSize: 13, fontWeight: "700", color: "#111827", marginBottom: 4 },
  netGSTExplain: { fontSize: 11, color: "#6b7280" },
  netGSTValue: { fontSize: 22, fontWeight: "800" },
  itcCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#f0fdf4", borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#bbf7d0" },
  itcTitle: { fontSize: 13, fontWeight: "700", color: "#166534" },
  itcSub: { fontSize: 11, color: "#16a34a", marginTop: 2, lineHeight: 16 },
  itcValue: { fontSize: 18, fontWeight: "800", color: "#16a34a" },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 8 },
  actionCard: { width: "47%", backgroundColor: "#fff", borderRadius: 14, padding: 14, alignItems: "center", gap: 6, borderWidth: 1, borderColor: "#e5e7eb" },
  actionIcon: { width: 48, height: 48, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  actionLabel: { fontSize: 12, fontWeight: "700", color: "#111827", textAlign: "center" },
  actionDesc: { fontSize: 10, color: "#9ca3af", textAlign: "center" },
  analyticsCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#e5e7eb" },
  analyticsTitle: { fontSize: 14, fontWeight: "700", color: "#111827", marginBottom: 4 },
  analyticsSub: { fontSize: 11, color: "#6b7280", marginBottom: 4 },
  chartLegend: { flexDirection: "row", gap: 16, marginTop: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: "#6b7280" },
  tableHeader: { flexDirection: "row", paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: "#e5e7eb", marginBottom: 4 },
  tableRow: { flexDirection: "row", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "#f9fafb" },
  tableCell: { fontSize: 12, color: "#374151" },
  supplierRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  supplierRank: { width: 32, height: 32, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  supplierRankText: { fontSize: 12, fontWeight: "700", color: "#374151" },
  supplierName: { flex: 1, fontSize: 13, fontWeight: "600", color: "#111827" },
  supplierVal: { fontSize: 13, fontWeight: "700", color: "#374151" },
  fullReportBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, marginBottom: 8 },
  fullReportBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  riskExplainCard: { backgroundColor: "#eff6ff", borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#bfdbfe" },
  riskExplainTitle: { fontSize: 14, fontWeight: "700", color: "#1d4ed8", marginBottom: 6 },
  riskExplainText: { fontSize: 13, color: "#1e40af", lineHeight: 20 },
  riskCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 2 },
  riskScoreRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  riskLevel: { fontSize: 18, fontWeight: "800" },
  riskScoreLabel: { fontSize: 12, color: "#6b7280", marginTop: 4 },
  riskMeter: { flex: 1, marginLeft: 16 },
  riskTrack: { height: 12, backgroundColor: "#f3f4f6", borderRadius: 6, overflow: "hidden" },
  riskFill: { height: 12, borderRadius: 6 },
  riskScale: { flexDirection: "row", justifyContent: "space-between" },
  riskScaleItem: { alignItems: "center", gap: 4 },
  riskScaleDot: { width: 12, height: 12, borderRadius: 6 },
  riskScaleText: { fontSize: 9, color: "#6b7280", textAlign: "center" },
  riskAllGood: { alignItems: "center", paddingVertical: 32, gap: 8 },
  riskAllGoodEmoji: { fontSize: 48 },
  riskAllGoodTitle: { fontSize: 18, fontWeight: "800", color: "#111827" },
  riskAllGoodSub: { fontSize: 13, color: "#6b7280", textAlign: "center", lineHeight: 20 },
  issueCard: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 12, borderRadius: 10, borderLeftWidth: 4, marginBottom: 8 },
  issueText: { flex: 1, fontSize: 13, fontWeight: "600", color: "#111827", lineHeight: 18 },
  tipCard: { flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: "#fff", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#e5e7eb", marginBottom: 8 },
  tipNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary, justifyContent: "center", alignItems: "center" },
  tipNumberText: { fontSize: 13, fontWeight: "800", color: "#fff" },
  tipText: { flex: 1, fontSize: 13, color: "#374151", lineHeight: 20 },
  penaltyCard: { backgroundColor: "#fffbeb", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#fde68a", marginBottom: 8 },
  penaltyTitle: { fontSize: 14, fontWeight: "700", color: "#92400e", marginBottom: 12 },
  penaltyRow: { marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: "#fde68a" },
  penaltyQ: { fontSize: 13, fontWeight: "600", color: "#78350f", marginBottom: 4 },
  penaltyA: { fontSize: 13, color: "#92400e", lineHeight: 18 },
});
