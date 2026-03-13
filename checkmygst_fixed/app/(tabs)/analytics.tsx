import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useGST, getMonthKey, getMonthLabel } from "@/contexts/GSTContext";
import Colors from "@/constants/colors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CHART_WIDTH = SCREEN_WIDTH - 64;

function formatINR(n: number) {
  if (n >= 100000) return "₹" + (n / 100000).toFixed(1) + "L";
  if (n >= 1000) return "₹" + (n / 1000).toFixed(1) + "K";
  return "₹" + Math.round(n);
}

type ChartType = "trend" | "suppliers" | "itc" | "salespurchases";

const CHART_OPTIONS: { key: ChartType; label: string; icon: string; color: string }[] = [
  { key: "trend", label: "GST Trend", icon: "trending-up", color: "#2563eb" },
  { key: "salespurchases", label: "Sales vs Purchases", icon: "bar-chart", color: "#7c3aed" },
  { key: "suppliers", label: "Top Suppliers", icon: "business", color: "#d97706" },
  { key: "itc", label: "ITC Utilisation", icon: "pie-chart", color: "#16a34a" },
];

// Simple bar chart component
function BarChart({ data, color, valueFormatter }: {
  data: { label: string; value: number; value2?: number; color2?: string }[];
  color: string;
  valueFormatter?: (n: number) => string;
}) {
  const maxVal = Math.max(...data.map(d => Math.max(d.value, d.value2 || 0)), 1);
  const fmt = valueFormatter || formatINR;
  return (
    <View style={bc.container}>
      {data.map((d, i) => (
        <View key={i} style={bc.group}>
          <Text style={bc.value}>{fmt(d.value)}</Text>
          <View style={bc.barRow}>
            <View style={[bc.bar, { height: Math.max((d.value / maxVal) * 120, 2), backgroundColor: color }]} />
            {d.value2 !== undefined && (
              <View style={[bc.bar, { height: Math.max((d.value2 / maxVal) * 120, 2), backgroundColor: d.color2 || "#16a34a" }]} />
            )}
          </View>
          <Text style={bc.label} numberOfLines={1}>{d.label}</Text>
        </View>
      ))}
    </View>
  );
}

const bc = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around", paddingTop: 8 },
  group: { alignItems: "center", flex: 1 },
  barRow: { flexDirection: "row", gap: 2, alignItems: "flex-end" },
  bar: { width: 18, borderRadius: 4, minHeight: 2 },
  value: { fontSize: 9, color: "#6b7280", marginBottom: 4, textAlign: "center" },
  label: { fontSize: 9, color: "#6b7280", marginTop: 4, textAlign: "center", width: 36 },
});

// Horizontal bar for suppliers/ITC
function HBar({ label, value, max, color, sublabel }: { label: string; value: number; max: number; color: string; sublabel?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <View style={hb.row}>
      <View style={hb.labelCol}>
        <Text style={hb.label} numberOfLines={1}>{label}</Text>
        {sublabel ? <Text style={hb.sublabel}>{sublabel}</Text> : null}
      </View>
      <View style={hb.barTrack}>
        <View style={[hb.barFill, { width: `${Math.max(pct, 1)}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={hb.value}>{formatINR(value)}</Text>
    </View>
  );
}

const hb = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 8 },
  labelCol: { width: 90 },
  label: { fontSize: 12, fontWeight: "600", color: "#111827" },
  sublabel: { fontSize: 10, color: "#9ca3af", marginTop: 1 },
  barTrack: { flex: 1, height: 10, backgroundColor: "#f3f4f6", borderRadius: 5, overflow: "hidden" },
  barFill: { height: 10, borderRadius: 5 },
  value: { width: 55, fontSize: 11, fontWeight: "700", color: "#374151", textAlign: "right" },
});

export default function AnalyticsScreen() {
  const { purchases, sales, gstr2bEntries, profile } = useGST();
  const [activeChart, setActiveChart] = useState<ChartType>("trend");

  // Last 6 months
  const months = useMemo(() => {
    const result = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      result.push({ key, label: d.toLocaleDateString("en-IN", { month: "short" }) });
    }
    return result;
  }, []);

  // Monthly data
  const monthlyData = useMemo(() => {
    return months.map(m => {
      const mp = purchases.filter(p => getMonthKey(p.invoiceDate) === m.key);
      const ms = sales.filter(s => getMonthKey(s.invoiceDate) === m.key);
      return {
        ...m,
        salesGST: ms.reduce((s, x) => s + (x.gstAmount || 0), 0),
        purchaseGST: mp.reduce((s, x) => s + (x.gstAmount || 0), 0),
        salesTotal: ms.reduce((s, x) => s + (x.totalAmount || 0), 0),
        purchaseTotal: mp.reduce((s, x) => s + (x.totalAmount || 0), 0),
        netGST: ms.reduce((s, x) => s + (x.gstAmount || 0), 0) - mp.reduce((s, x) => s + (x.gstAmount || 0), 0),
      };
    });
  }, [months, purchases, sales]);

  // Top suppliers
  const topSuppliers = useMemo(() => {
    const map = new Map<string, number>();
    purchases.forEach(p => {
      const key = (p as any).supplierName || "Unknown";
      map.set(key, (map.get(key) || 0) + (p.totalAmount || 0));
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }));
  }, [purchases]);

  // ITC utilisation
  const itcData = useMemo(() => {
    const totalITC = gstr2bEntries.reduce((s, g) => s + (g.totalITC || 0), 0);
    const usedITC = purchases.reduce((s, p) => s + (p.gstAmount || 0), 0);
    const outputGST = sales.reduce((s, x) => s + (x.gstAmount || 0), 0);
    const netPayable = Math.max(outputGST - usedITC, 0);
    const utilPct = outputGST > 0 ? Math.min((usedITC / outputGST) * 100, 100) : 0;
    return { totalITC, usedITC, outputGST, netPayable, utilPct };
  }, [purchases, sales, gstr2bEntries]);

  // Summary stats
  const totalSales = sales.reduce((s, x) => s + (x.totalAmount || 0), 0);
  const totalPurchases = purchases.reduce((s, x) => s + (x.totalAmount || 0), 0);
  const totalOutputGST = sales.reduce((s, x) => s + (x.gstAmount || 0), 0);
  const totalITC = purchases.reduce((s, x) => s + (x.gstAmount || 0), 0);
  const currentChart = CHART_OPTIONS.find(c => c.key === activeChart)!;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Analytics</Text>
        <Text style={styles.headerSub}>{profile?.businessName || "My Business"} · Last 6 months</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Summary Cards */}
        <View style={styles.summaryGrid}>
          {[
            { label: "Total Sales", value: formatINR(totalSales), color: "#2563eb", icon: "trending-up" },
            { label: "Total Purchases", value: formatINR(totalPurchases), color: "#7c3aed", icon: "trending-down" },
            { label: "Output GST", value: formatINR(totalOutputGST), color: "#dc2626", icon: "cash" },
            { label: "ITC Claimed", value: formatINR(totalITC), color: "#16a34a", icon: "shield-checkmark" },
          ].map(s => (
            <View key={s.label} style={styles.summaryCard}>
              <View style={[styles.summaryIcon, { backgroundColor: s.color + "18" }]}>
                <Ionicons name={s.icon as any} size={18} color={s.color} />
              </View>
              <Text style={styles.summaryValue}>{s.value}</Text>
              <Text style={styles.summaryLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Chart Selector */}
        <Text style={styles.sectionTitle}>Charts</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectorScroll}>
          {CHART_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.selectorChip, activeChart === opt.key && { backgroundColor: opt.color, borderColor: opt.color }]}
              onPress={() => setActiveChart(opt.key)}
            >
              <Ionicons name={opt.icon as any} size={14} color={activeChart === opt.key ? "#fff" : opt.color} />
              <Text style={[styles.selectorText, activeChart === opt.key && { color: "#fff" }]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Active Chart Card */}
        <View style={[styles.chartCard, { borderTopColor: currentChart.color, borderTopWidth: 3 }]}>
          <View style={styles.chartHeader}>
            <Ionicons name={currentChart.icon as any} size={18} color={currentChart.color} />
            <Text style={[styles.chartTitle, { color: currentChart.color }]}>{currentChart.label}</Text>
          </View>

          {/* GST Trend */}
          {activeChart === "trend" && (
            <>
              <Text style={styles.chartSub}>Monthly net GST payable over last 6 months</Text>
              <BarChart
                data={monthlyData.map(m => ({ label: m.label, value: Math.max(m.netGST, 0) }))}
                color="#2563eb"
              />
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: "#2563eb" }]} />
                  <Text style={styles.legendText}>Net GST Payable</Text>
                </View>
              </View>
              <View style={styles.trendStats}>
                {monthlyData.slice(-3).map(m => (
                  <View key={m.key} style={styles.trendStatItem}>
                    <Text style={styles.trendStatMonth}>{m.label}</Text>
                    <Text style={[styles.trendStatValue, { color: m.netGST > 0 ? "#dc2626" : "#16a34a" }]}>
                      {formatINR(Math.abs(m.netGST))}
                    </Text>
                    <Text style={styles.trendStatLabel}>{m.netGST > 0 ? "Payable" : "Credit"}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Sales vs Purchases */}
          {activeChart === "salespurchases" && (
            <>
              <Text style={styles.chartSub}>Monthly sales vs purchases comparison</Text>
              <BarChart
                data={monthlyData.map(m => ({ label: m.label, value: m.salesTotal, value2: m.purchaseTotal, color2: "#7c3aed" }))}
                color="#2563eb"
              />
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: "#2563eb" }]} />
                  <Text style={styles.legendText}>Sales</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: "#7c3aed" }]} />
                  <Text style={styles.legendText}>Purchases</Text>
                </View>
              </View>
            </>
          )}

          {/* Top Suppliers */}
          {activeChart === "suppliers" && (
            <>
              <Text style={styles.chartSub}>Your highest-value suppliers by purchase amount</Text>
              {topSuppliers.length === 0 ? (
                <Text style={styles.noData}>No purchase data yet</Text>
              ) : (
                topSuppliers.map((s, i) => (
                  <HBar
                    key={i}
                    label={s.name}
                    value={s.value}
                    max={topSuppliers[0].value}
                    color={["#d97706", "#f59e0b", "#fbbf24", "#fcd34d", "#fde68a", "#fef3c7"][i]}
                    sublabel={`#${i + 1} supplier`}
                  />
                ))
              )}
            </>
          )}

          {/* ITC Utilisation */}
          {activeChart === "itc" && (
            <>
              <Text style={styles.chartSub}>How much of your available ITC you are using</Text>

              {/* Utilisation circle */}
              <View style={styles.itcCenter}>
                <View style={styles.itcCircle}>
                  <Text style={styles.itcPct}>{itcData.utilPct.toFixed(0)}%</Text>
                  <Text style={styles.itcPctLabel}>Utilised</Text>
                </View>
              </View>

              <HBar label="Output GST" value={itcData.outputGST} max={Math.max(itcData.outputGST, itcData.usedITC)} color="#dc2626" sublabel="Tax on sales" />
              <HBar label="ITC Used" value={itcData.usedITC} max={Math.max(itcData.outputGST, itcData.usedITC)} color="#16a34a" sublabel="From purchases" />
              <HBar label="GSTR-2B ITC" value={itcData.totalITC} max={Math.max(itcData.outputGST, itcData.usedITC)} color="#2563eb" sublabel="Available credit" />

              <View style={styles.itcNetRow}>
                <Text style={styles.itcNetLabel}>Net GST Payable</Text>
                <Text style={[styles.itcNetValue, { color: itcData.netPayable > 0 ? "#dc2626" : "#16a34a" }]}>
                  {formatINR(itcData.netPayable)}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Month-wise table */}
        <View style={styles.tableCard}>
          <Text style={styles.tableTitle}>Month-wise Summary</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCell, { flex: 1.2 }]}>Month</Text>
            <Text style={[styles.tableCell, { flex: 1, textAlign: "right" }]}>Sales GST</Text>
            <Text style={[styles.tableCell, { flex: 1, textAlign: "right" }]}>ITC</Text>
            <Text style={[styles.tableCell, { flex: 1, textAlign: "right", color: "#dc2626" }]}>Net</Text>
          </View>
          {monthlyData.map(m => (
            <View key={m.key} style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 1.2, fontWeight: "600" }]}>{m.label}</Text>
              <Text style={[styles.tableCell, { flex: 1, textAlign: "right", color: "#dc2626" }]}>{formatINR(m.salesGST)}</Text>
              <Text style={[styles.tableCell, { flex: 1, textAlign: "right", color: "#16a34a" }]}>{formatINR(m.purchaseGST)}</Text>
              <Text style={[styles.tableCell, { flex: 1, textAlign: "right", fontWeight: "700", color: m.netGST > 0 ? "#dc2626" : "#16a34a" }]}>
                {formatINR(Math.abs(m.netGST))}
              </Text>
            </View>
          ))}
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
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  summaryCard: { width: "47%", backgroundColor: "#fff", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#e5e7eb" },
  summaryIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center", marginBottom: 10 },
  summaryValue: { fontSize: 16, fontWeight: "800", color: "#111827", marginBottom: 4 },
  summaryLabel: { fontSize: 11, color: "#6b7280" },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#111827", marginBottom: 10 },
  selectorScroll: { marginBottom: 14 },
  selectorChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: "#e5e7eb", backgroundColor: "#fff", marginRight: 8 },
  selectorText: { fontSize: 13, fontWeight: "600", color: "#374151" },
  chartCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#e5e7eb" },
  chartHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  chartTitle: { fontSize: 15, fontWeight: "700" },
  chartSub: { fontSize: 12, color: "#6b7280", marginBottom: 16 },
  legend: { flexDirection: "row", gap: 16, marginTop: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: "#6b7280" },
  noData: { fontSize: 14, color: "#9ca3af", textAlign: "center", paddingVertical: 24 },
  trendStats: { flexDirection: "row", justifyContent: "space-around", marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  trendStatItem: { alignItems: "center" },
  trendStatMonth: { fontSize: 12, color: "#6b7280", marginBottom: 4 },
  trendStatValue: { fontSize: 15, fontWeight: "800" },
  trendStatLabel: { fontSize: 10, color: "#9ca3af", marginTop: 2 },
  itcCenter: { alignItems: "center", marginBottom: 20 },
  itcCircle: { width: 110, height: 110, borderRadius: 55, backgroundColor: "#eff6ff", borderWidth: 8, borderColor: "#2563eb", justifyContent: "center", alignItems: "center" },
  itcPct: { fontSize: 24, fontWeight: "800", color: "#2563eb" },
  itcPctLabel: { fontSize: 11, color: "#6b7280" },
  itcNetRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  itcNetLabel: { fontSize: 14, fontWeight: "700", color: "#111827" },
  itcNetValue: { fontSize: 16, fontWeight: "800" },
  tableCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#e5e7eb" },
  tableTitle: { fontSize: 14, fontWeight: "700", color: "#111827", marginBottom: 12 },
  tableHeader: { flexDirection: "row", paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: "#e5e7eb", marginBottom: 4 },
  tableRow: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f9fafb" },
  tableCell: { fontSize: 12, color: "#374151" },
});
