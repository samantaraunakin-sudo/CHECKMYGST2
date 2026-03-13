import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useGST, getMonthKey } from "@/contexts/GSTContext";
import Colors from "@/constants/colors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

function formatINR(n: number) {
  if (n >= 100000) return "₹" + (n / 100000).toFixed(1) + "L";
  if (n >= 1000) return "₹" + (n / 1000).toFixed(1) + "K";
  return "₹" + Math.round(n);
}

// ── Bar Chart ──────────────────────────────────────────────
function BarChart({ data, color }: {
  data: { label: string; value: number; value2?: number; color2?: string }[];
  color: string;
}) {
  const maxVal = Math.max(...data.map(d => Math.max(d.value, d.value2 || 0)), 1);
  return (
    <View style={bc.container}>
      {data.map((d, i) => (
        <View key={i} style={bc.group}>
          <Text style={bc.value}>{formatINR(d.value)}</Text>
          <View style={bc.barRow}>
            <View style={[bc.bar, { height: Math.max((d.value / maxVal) * 110, 2), backgroundColor: color }]} />
            {d.value2 !== undefined && (
              <View style={[bc.bar, { height: Math.max((d.value2 / maxVal) * 110, 2), backgroundColor: d.color2 || "#16a34a" }]} />
            )}
          </View>
          <Text style={bc.label} numberOfLines={1}>{d.label}</Text>
        </View>
      ))}
    </View>
  );
}
const bc = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around", paddingTop: 8, height: 150 },
  group: { alignItems: "center", flex: 1 },
  barRow: { flexDirection: "row", gap: 2, alignItems: "flex-end" },
  bar: { width: 16, borderRadius: 4, minHeight: 2 },
  value: { fontSize: 8, color: "#6b7280", marginBottom: 3, textAlign: "center" },
  label: { fontSize: 9, color: "#6b7280", marginTop: 4, textAlign: "center", width: 34 },
});

// ── Line Chart ─────────────────────────────────────────────
function LineChart({ data, color, color2, label1, label2 }: {
  data: { label: string; value: number; value2?: number }[];
  color: string; color2?: string; label1?: string; label2?: string;
}) {
  const W = SCREEN_WIDTH - 96;
  const H = 110;
  const allVals = data.flatMap(d => [d.value, d.value2 ?? 0]);
  const maxVal = Math.max(...allVals, 1);
  const minVal = 0;
  const range = maxVal - minVal || 1;
  const pts = (vals: number[]) =>
    vals.map((v, i) => ({
      x: (i / Math.max(data.length - 1, 1)) * W,
      y: H - ((v - minVal) / range) * H,
    }));
  const line1 = pts(data.map(d => d.value));
  const line2 = data[0]?.value2 !== undefined ? pts(data.map(d => d.value2 ?? 0)) : null;
  const pathD = (points: { x: number; y: number }[]) =>
    points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

  return (
    <View>
      <View style={{ height: H + 30, marginTop: 8 }}>
        <svg width={W} height={H} style={{ overflow: "visible" } as any}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
            <line key={i} x1={0} y1={H * (1 - t)} x2={W} y2={H * (1 - t)}
              stroke="#f3f4f6" strokeWidth={1} />
          ))}
          {/* Line 1 */}
          <path d={pathD(line1)} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          {/* Area fill */}
          <path d={`${pathD(line1)} L ${line1[line1.length-1].x} ${H} L 0 ${H} Z`}
            fill={color} fillOpacity={0.08} />
          {/* Line 2 */}
          {line2 && <path d={pathD(line2)} fill="none" stroke={color2 || "#16a34a"} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />}
          {/* Dots line 1 */}
          {line1.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={3.5} fill={color} />
          ))}
          {/* Dots line 2 */}
          {line2?.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={3.5} fill={color2 || "#16a34a"} />
          ))}
        </svg>
        {/* X labels */}
        <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 4 }}>
          {data.map((d, i) => (
            <Text key={i} style={{ fontSize: 9, color: "#9ca3af", textAlign: "center", flex: 1 }}>{d.label}</Text>
          ))}
        </View>
      </View>
    </View>
  );
}

// ── Pie Chart ──────────────────────────────────────────────
function PieChart({ slices }: { slices: { label: string; value: number; color: string }[] }) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  let startAngle = -Math.PI / 2;
  const R = 70; const cx = 85; const cy = 80;
  const paths = slices.map(slice => {
    const angle = (slice.value / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const x1 = cx + R * Math.cos(startAngle);
    const y1 = cy + R * Math.sin(startAngle);
    const x2 = cx + R * Math.cos(endAngle);
    const y2 = cy + R * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${R} ${R} 0 ${largeArc} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`;
    const midAngle = startAngle + angle / 2;
    startAngle = endAngle;
    return { d, color: slice.color, midAngle, pct: ((slice.value / total) * 100).toFixed(0) };
  });
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginTop: 8 }}>
      <svg width={170} height={160} style={{} as any}>
        {paths.map((p, i) => (
          <path key={i} d={p.d} fill={p.color} stroke="#fff" strokeWidth={2} />
        ))}
        <circle cx={cx} cy={cy} r={30} fill="#fff" />
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize={11} fill="#374151" fontWeight="bold">Total</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize={10} fill="#6b7280">{formatINR(total)}</text>
      </svg>
      <View style={{ flex: 1, gap: 8 }}>
        {slices.map((s, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.color }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: "600", color: "#374151" }}>{s.label}</Text>
              <Text style={{ fontSize: 10, color: "#9ca3af" }}>{formatINR(s.value)} · {((s.value/total)*100).toFixed(0)}%</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Horizontal Bar ─────────────────────────────────────────
function HBar({ label, value, max, color, sublabel }: {
  label: string; value: number; max: number; color: string; sublabel?: string;
}) {
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

// ── Chart type toggle ──────────────────────────────────────
type ViewMode = "bar" | "line" | "pie";

function ChartToggle({ mode, onChange, hidePie }: { mode: ViewMode; onChange: (m: ViewMode) => void; hidePie?: boolean }) {
  const opts: { key: ViewMode; icon: string }[] = [
    { key: "bar", icon: "bar-chart-outline" },
    { key: "line", icon: "trending-up-outline" },
    ...(!hidePie ? [{ key: "pie" as ViewMode, icon: "pie-chart-outline" }] : []),
  ];
  return (
    <View style={ct.row}>
      {opts.map(o => (
        <TouchableOpacity
          key={o.key}
          style={[ct.btn, mode === o.key && ct.btnActive]}
          onPress={() => onChange(o.key)}
        >
          <Ionicons name={o.icon as any} size={16} color={mode === o.key ? "#fff" : "#6b7280"} />
        </TouchableOpacity>
      ))}
    </View>
  );
}
const ct = StyleSheet.create({
  row: { flexDirection: "row", gap: 6, marginLeft: "auto" },
  btn: { width: 32, height: 32, borderRadius: 8, backgroundColor: "#f3f4f6", justifyContent: "center", alignItems: "center" },
  btnActive: { backgroundColor: Colors.primary },
});

// ── Main Screen ────────────────────────────────────────────
type ChartType = "trend" | "salespurchases" | "suppliers" | "itc";

const CHART_OPTIONS: { key: ChartType; label: string; icon: string; color: string }[] = [
  { key: "trend",          label: "GST Trend",        icon: "trending-up",   color: "#2563eb" },
  { key: "salespurchases", label: "Sales vs Purchases", icon: "bar-chart",   color: "#7c3aed" },
  { key: "suppliers",      label: "Top Suppliers",    icon: "business",      color: "#d97706" },
  { key: "itc",            label: "ITC Utilisation",  icon: "pie-chart",     color: "#16a34a" },
];

export default function AnalyticsScreen() {
  const { purchases, sales, gstr2bEntries, profile } = useGST();
  const [activeChart, setActiveChart] = useState<ChartType>("trend");
  const [trendMode, setTrendMode]   = useState<ViewMode>("bar");
  const [spMode, setSpMode]         = useState<ViewMode>("bar");
  const [itcMode, setItcMode]       = useState<ViewMode>("bar");

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

  const monthlyData = useMemo(() => {
    return months.map(m => {
      const mp = purchases.filter(p => getMonthKey(p.invoiceDate) === m.key);
      const ms = sales.filter(s => getMonthKey(s.invoiceDate) === m.key);
      const salesGST = ms.reduce((s, x) => s + (x.gstAmount || 0), 0);
      const purchaseGST = mp.reduce((s, x) => s + (x.gstAmount || 0), 0);
      return {
        ...m,
        salesGST, purchaseGST,
        salesTotal: ms.reduce((s, x) => s + (x.totalAmount || 0), 0),
        purchaseTotal: mp.reduce((s, x) => s + (x.totalAmount || 0), 0),
        netGST: salesGST - purchaseGST,
      };
    });
  }, [months, purchases, sales]);

  const topSuppliers = useMemo(() => {
    const map = new Map<string, number>();
    purchases.forEach(p => {
      const key = (p as any).supplierName || "Unknown";
      map.set(key, (map.get(key) || 0) + (p.totalAmount || 0));
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name, value }));
  }, [purchases]);

  const itcData = useMemo(() => {
    const totalITC   = gstr2bEntries.reduce((s, g) => s + (g.totalITC || 0), 0);
    const usedITC    = purchases.reduce((s, p) => s + (p.gstAmount || 0), 0);
    const outputGST  = sales.reduce((s, x) => s + (x.gstAmount || 0), 0);
    const netPayable = Math.max(outputGST - usedITC, 0);
    const utilPct    = outputGST > 0 ? Math.min((usedITC / outputGST) * 100, 100) : 0;
    return { totalITC, usedITC, outputGST, netPayable, utilPct };
  }, [purchases, sales, gstr2bEntries]);

  const totalSales     = sales.reduce((s, x) => s + (x.totalAmount || 0), 0);
  const totalPurchases = purchases.reduce((s, x) => s + (x.totalAmount || 0), 0);
  const totalOutputGST = sales.reduce((s, x) => s + (x.gstAmount || 0), 0);
  const totalITC       = purchases.reduce((s, x) => s + (x.gstAmount || 0), 0);
  const currentChart   = CHART_OPTIONS.find(c => c.key === activeChart)!;

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
            { label: "Total Sales",      value: formatINR(totalSales),     color: "#2563eb", icon: "trending-up" },
            { label: "Total Purchases",  value: formatINR(totalPurchases), color: "#7c3aed", icon: "trending-down" },
            { label: "Output GST",       value: formatINR(totalOutputGST), color: "#dc2626", icon: "cash" },
            { label: "ITC Claimed",      value: formatINR(totalITC),       color: "#16a34a", icon: "shield-checkmark" },
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

        {/* Chart Card */}
        <View style={[styles.chartCard, { borderTopColor: currentChart.color, borderTopWidth: 3 }]}>

          {/* ── GST Trend ── */}
          {activeChart === "trend" && (
            <>
              <View style={styles.chartHeader}>
                <Ionicons name="trending-up" size={18} color="#2563eb" />
                <Text style={[styles.chartTitle, { color: "#2563eb" }]}>GST Trend</Text>
                <ChartToggle mode={trendMode} onChange={setTrendMode} />
              </View>
              <Text style={styles.chartSub}>Monthly net GST payable over last 6 months</Text>
              {trendMode === "bar" && (
                <BarChart data={monthlyData.map(m => ({ label: m.label, value: Math.max(m.netGST, 0) }))} color="#2563eb" />
              )}
              {trendMode === "line" && (
                <LineChart
                  data={monthlyData.map(m => ({ label: m.label, value: Math.max(m.netGST, 0) }))}
                  color="#2563eb" label1="Net GST"
                />
              )}
              {trendMode === "pie" && (
                <PieChart slices={monthlyData.filter(m => m.netGST > 0).map((m, i) => ({
                  label: m.label,
                  value: m.netGST,
                  color: ["#2563eb","#3b82f6","#60a5fa","#93c5fd","#bfdbfe","#dbeafe"][i % 6],
                }))} />
              )}
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

          {/* ── Sales vs Purchases ── */}
          {activeChart === "salespurchases" && (
            <>
              <View style={styles.chartHeader}>
                <Ionicons name="bar-chart" size={18} color="#7c3aed" />
                <Text style={[styles.chartTitle, { color: "#7c3aed" }]}>Sales vs Purchases</Text>
                <ChartToggle mode={spMode} onChange={setSpMode} />
              </View>
              <Text style={styles.chartSub}>Monthly comparison of sales and purchases</Text>
              {spMode === "bar" && (
                <BarChart
                  data={monthlyData.map(m => ({ label: m.label, value: m.salesTotal, value2: m.purchaseTotal, color2: "#7c3aed" }))}
                  color="#2563eb"
                />
              )}
              {spMode === "line" && (
                <LineChart
                  data={monthlyData.map(m => ({ label: m.label, value: m.salesTotal, value2: m.purchaseTotal }))}
                  color="#2563eb" color2="#7c3aed" label1="Sales" label2="Purchases"
                />
              )}
              {spMode === "pie" && (
                <PieChart slices={[
                  { label: "Total Sales",     value: totalSales,     color: "#2563eb" },
                  { label: "Total Purchases", value: totalPurchases, color: "#7c3aed" },
                ]} />
              )}
              <View style={styles.legend}>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: "#2563eb" }]} /><Text style={styles.legendText}>Sales</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: "#7c3aed" }]} /><Text style={styles.legendText}>Purchases</Text></View>
              </View>
            </>
          )}

          {/* ── Top Suppliers ── */}
          {activeChart === "suppliers" && (
            <>
              <View style={styles.chartHeader}>
                <Ionicons name="business" size={18} color="#d97706" />
                <Text style={[styles.chartTitle, { color: "#d97706" }]}>Top Suppliers</Text>
              </View>
              <Text style={styles.chartSub}>Your highest-value suppliers by purchase amount</Text>
              {topSuppliers.length === 0 ? (
                <Text style={styles.noData}>No purchase data yet</Text>
              ) : (
                <>
                  {topSuppliers.map((s, i) => (
                    <HBar key={i} label={s.name} value={s.value} max={topSuppliers[0].value}
                      color={["#d97706","#f59e0b","#fbbf24","#fcd34d","#fde68a","#fef3c7"][i]}
                      sublabel={`#${i + 1} supplier`}
                    />
                  ))}
                  <PieChart slices={topSuppliers.slice(0, 5).map((s, i) => ({
                    label: s.name,
                    value: s.value,
                    color: ["#d97706","#f59e0b","#fbbf24","#7c3aed","#2563eb"][i],
                  }))} />
                </>
              )}
            </>
          )}

          {/* ── ITC Utilisation ── */}
          {activeChart === "itc" && (
            <>
              <View style={styles.chartHeader}>
                <Ionicons name="pie-chart" size={18} color="#16a34a" />
                <Text style={[styles.chartTitle, { color: "#16a34a" }]}>ITC Utilisation</Text>
                <ChartToggle mode={itcMode} onChange={setItcMode} hidePie />
              </View>
              <Text style={styles.chartSub}>How much of your available ITC you are using</Text>

              {itcMode === "bar" && (
                <>
                  <View style={styles.itcCenter}>
                    <View style={styles.itcCircle}>
                      <Text style={styles.itcPct}>{itcData.utilPct.toFixed(0)}%</Text>
                      <Text style={styles.itcPctLabel}>Utilised</Text>
                    </View>
                  </View>
                  <HBar label="Output GST"  value={itcData.outputGST} max={Math.max(itcData.outputGST, itcData.usedITC)} color="#dc2626" sublabel="Tax on sales" />
                  <HBar label="ITC Used"    value={itcData.usedITC}   max={Math.max(itcData.outputGST, itcData.usedITC)} color="#16a34a" sublabel="From purchases" />
                  <HBar label="GSTR-2B ITC" value={itcData.totalITC}  max={Math.max(itcData.outputGST, itcData.usedITC)} color="#2563eb" sublabel="Available credit" />
                </>
              )}
              {itcMode === "line" && (
                <LineChart
                  data={monthlyData.map(m => ({ label: m.label, value: m.salesGST, value2: m.purchaseGST }))}
                  color="#dc2626" color2="#16a34a" label1="Output GST" label2="ITC"
                />
              )}

              <PieChart slices={[
                { label: "Output GST",  value: itcData.outputGST,  color: "#dc2626" },
                { label: "ITC Used",    value: itcData.usedITC,    color: "#16a34a" },
                { label: "Net Payable", value: itcData.netPayable, color: "#f59e0b" },
              ]} />

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
  chartTitle: { fontSize: 15, fontWeight: "700", flex: 1 },
  chartSub: { fontSize: 12, color: "#6b7280", marginBottom: 12 },
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
  itcCenter: { alignItems: "center", marginBottom: 16 },
  itcCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: "#eff6ff", borderWidth: 7, borderColor: "#2563eb", justifyContent: "center", alignItems: "center" },
  itcPct: { fontSize: 22, fontWeight: "800", color: "#2563eb" },
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