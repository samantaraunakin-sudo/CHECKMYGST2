import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, Share, Dimensions, Modal, Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useGST, getMonthKey, parseInvoiceDate } from "@/contexts/GSTContext";
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

const GLOSSARY: Record<string, { title: string; plain: string; example?: string }> = {
  "GSTR-1": {
    title: "GSTR-1 — Sales Return",
    plain: "A monthly report you file with the government listing every sale you made. Think of it as telling the government: 'Here's everyone I sold to this month.'",
    example: "If you sold goods worth ₹5L in March, you file GSTR-1 by 11th April listing those sales.",
  },
  "GSTR-3B": {
    title: "GSTR-3B — Summary + Payment",
    plain: "A monthly summary where you pay your actual GST. You report total sales GST collected, subtract purchase GST credits, and pay the difference.",
    example: "Collected ₹50,000 GST on sales, spent ₹30,000 on purchases = pay ₹20,000 to govt by 20th.",
  },
  "GSTR-2B": {
    title: "GSTR-2B — Purchase Credit Statement",
    plain: "A government-generated statement showing which of your suppliers have filed their returns. Only the tax credit in GSTR-2B is available for you to claim.",
    example: "Your supplier filed ₹10,000 GST — it appears in your GSTR-2B. You can now deduct ₹10,000 from your payment.",
  },
  "ITC": {
    title: "ITC — Input Tax Credit",
    plain: "The GST you already paid on your purchases. You can subtract this from the GST you owe on sales. It prevents double taxation.",
    example: "Paid ₹18,000 GST while buying raw materials. Collected ₹25,000 GST on sales. You only pay ₹7,000 (₹25K − ₹18K).",
  },
  "Output Tax": {
    title: "Output Tax",
    plain: "The GST you charge your customers when you sell something. You collect this on behalf of the government and must deposit it.",
    example: "You sell goods for ₹1,00,000 + 18% GST = ₹18,000 output tax you must pay the govt.",
  },
  "HSN Code": {
    title: "HSN Code — Product Classification",
    plain: "A 4–8 digit number that classifies every product. The government uses it to determine the GST rate that applies to your product.",
    example: "Rice = HSN 1006, taxed at 5%. Chocolate = HSN 1806, taxed at 28%.",
  },
  "GSTIN": {
    title: "GSTIN — Your GST ID Number",
    plain: "Your 15-digit unique GST registration number. Like a PAN card but for GST. You must quote it on every invoice.",
    example: "Format: 29ABCDE1234F1Z5 — first 2 digits are state code, next 10 are your PAN.",
  },
  "Reconciliation": {
    title: "Reconciliation — Matching Your Records",
    plain: "Comparing your recorded purchases against GSTR-2B to make sure they match. If they don't match, you might lose tax credits.",
    example: "You recorded ₹50,000 purchase from Supplier A. GSTR-2B shows ₹48,000. You need to investigate the ₹2,000 gap.",
  },
};

type GlossaryKey = keyof typeof GLOSSARY;

function GlossaryTooltip({ term, children }: { term: GlossaryKey; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const entry = GLOSSARY[term];
  return (
    <>
      <TouchableOpacity onPress={() => setVisible(true)} style={styles.glossaryTrigger} activeOpacity={0.7}>
        {children}
        <Ionicons name="information-circle-outline" size={13} color="#2563eb" style={{ marginLeft: 2, marginTop: 1 }} />
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.glossaryOverlay} onPress={() => setVisible(false)}>
          <Pressable style={styles.glossaryCard} onPress={e => e.stopPropagation()}>
            <View style={styles.glossaryHeader}>
              <Text style={styles.glossaryTitle}>{entry.title}</Text>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Ionicons name="close-circle" size={22} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            <Text style={styles.glossaryPlain}>{entry.plain}</Text>
            {entry.example && (
              <View style={styles.glossaryExample}>
                <Text style={styles.glossaryExampleLabel}>Example</Text>
                <Text style={styles.glossaryExampleText}>{entry.example}</Text>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

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

const CHECKLIST_STEPS = [
  { id: "purchases", label: "Record all purchases", desc: "Add every supplier invoice for the month", icon: "arrow-down-circle-outline", iconColor: "#2563eb" },
  { id: "sales",     label: "Record all sales",     desc: "Add every customer invoice for the month", icon: "arrow-up-circle-outline", iconColor: "#16a34a" },
  { id: "gstr2b",    label: "Upload GSTR-2B",        desc: "Download from gst.gov.in and upload here", icon: "cloud-upload-outline", iconColor: "#d97706" },
  { id: "reconcile", label: "Check reconciliation",  desc: "Make sure your records match GSTR-2B", icon: "git-compare-outline", iconColor: "#7c3aed" },
  { id: "gstr1",     label: "File GSTR-1",           desc: "Submit sales return by 11th on gst.gov.in", icon: "send-outline", iconColor: "#0284c7" },
  { id: "pay",       label: "Pay GST & file GSTR-3B", desc: "Pay balance and file summary by 20th", icon: "checkmark-circle-outline", iconColor: "#16a34a" },
];

function MonthlyChecklist({ purchases, sales, gstr2bEntries }: { purchases: any[]; sales: any[]; gstr2bEntries: any[] }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const autoChecked = useMemo(() => ({
    purchases: purchases.length > 0,
    sales: sales.length > 0,
    gstr2b: gstr2bEntries.length > 0,
    reconcile: false,
    gstr1: false,
    pay: false,
  }), [purchases, sales, gstr2bEntries]);
  const isChecked = (id: string) => autoChecked[id as keyof typeof autoChecked] || checked[id] || false;
  const doneCount = CHECKLIST_STEPS.filter(s => isChecked(s.id)).length;
  const toggle = (id: string) => {
    if (autoChecked[id as keyof typeof autoChecked]) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setChecked(c => ({ ...c, [id]: !c[id] }));
  };
  return (
    <View style={styles.checklistCard}>
      <View style={styles.checklistHeader}>
        <View>
          <Text style={styles.checklistTitle}>📋 Monthly Filing Checklist</Text>
          <Text style={styles.checklistSub}>Complete these 6 steps every month</Text>
        </View>
        <View style={styles.checklistBadge}>
          <Text style={styles.checklistBadgeText}>{doneCount}/6</Text>
        </View>
      </View>
      <View style={styles.checklistProgress}>
        <View style={[styles.checklistProgressFill, { width: `${(doneCount/6)*100}%` as any }]} />
      </View>
      {CHECKLIST_STEPS.map((step, i) => {
        const done = isChecked(step.id);
        const auto = autoChecked[step.id as keyof typeof autoChecked];
        return (
          <TouchableOpacity key={step.id} style={styles.checklistRow} onPress={() => toggle(step.id)} activeOpacity={0.7}>
            <View style={[styles.checklistCheck, done && styles.checklistCheckDone]}>
              {done ? <Ionicons name="checkmark" size={14} color="#fff" /> : <Text style={styles.checklistNum}>{i+1}</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.checklistLabel, done && styles.checklistLabelDone]}>{step.label}</Text>
              <Text style={styles.checklistDesc}>{auto && done ? "✅ Auto-detected from your data" : step.desc}</Text>
            </View>
            <View style={[styles.checklistIcon, { backgroundColor: step.iconColor + "15" }]}>
              <Ionicons name={step.icon as any} size={16} color={step.iconColor} />
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function SmartPrompt({ purchases, sales, gstr2bEntries, netGST, monthPurchaseGST }: {
  purchases: any[]; sales: any[]; gstr2bEntries: any[]; netGST: number; monthPurchaseGST: number;
}) {
  const now = new Date();
  const prompt = useMemo(() => {
    if (gstr2bEntries.length === 0 && purchases.length > 0) {
      const itcAtRisk = monthPurchaseGST;
      return {
        icon: "shield-half-outline", color: "#d97706", bg: "#fffbeb", border: "#fde68a",
        text: `You have ${purchases.length} purchase${purchases.length>1?"s":""} but no GSTR-2B uploaded${itcAtRisk > 0 ? ` — upload it to claim ${formatINR(itcAtRisk)} in tax credits` : " — upload it to verify your tax credits"}.`,
        action: "Upload GSTR-2B now", route: "/gstr2b/upload",
      };
    }
    const gstr3bDue = new Date(now.getFullYear(), now.getMonth(), 20);
    if (now > gstr3bDue) {
      return {
        icon: "alarm-outline", color: "#dc2626", bg: "#fef2f2", border: "#fecaca",
        text: "GSTR-3B is overdue. Late fees are accumulating at ₹50/day. File now to stop the penalty.",
        action: "View filing deadlines", route: "/(tabs)/filings",
      };
    }
    if (netGST > 0 && purchases.length === 0 && now.getDate() > 5) {
      return {
        icon: "bulb-outline", color: "#7c3aed", bg: "#fdf4ff", border: "#e9d5ff",
        text: `You owe ${formatINR(netGST)} GST but have no purchase invoices. Record purchases to reduce your tax bill.`,
        action: "Add a purchase", route: "/purchase/add",
      };
    }
    if (sales.length === 0 && now.getDate() > 10) {
      return {
        icon: "create-outline", color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe",
        text: "No sales recorded this month yet. Add your invoices so your GSTR-1 filing is ready on time.",
        action: "Add a sale", route: "/sale/add",
      };
    }
    if (purchases.length > 0 && sales.length > 0 && gstr2bEntries.length > 0) {
      return {
        icon: "checkmark-circle-outline", color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0",
        text: "Great work! Your records look complete. Make sure to file GSTR-1 by the 11th and pay by the 20th.",
        action: "View filing schedule", route: "/(tabs)/filings",
      };
    }
    return null;
  }, [purchases, sales, gstr2bEntries, netGST, monthPurchaseGST]);
  if (!prompt) return null;
  return (
    <TouchableOpacity
      style={[styles.smartPromptCard, { backgroundColor: prompt.bg, borderColor: prompt.border }]}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push(prompt.route as any); }}
      activeOpacity={0.85}
    >
      <View style={[styles.smartPromptIcon, { backgroundColor: prompt.color + "20" }]}>
        <Ionicons name={prompt.icon as any} size={22} color={prompt.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.smartPromptLabel}>Your next action</Text>
        <Text style={[styles.smartPromptText, { color: prompt.color === "#dc2626" ? "#7f1d1d" : "#111827" }]}>{prompt.text}</Text>
        <Text style={[styles.smartPromptAction, { color: prompt.color }]}>{prompt.action} →</Text>
      </View>
    </TouchableOpacity>
  );
}

type DashTab = "overview" | "analytics" | "risk";

export default function DashboardScreen() {
  const { profile, purchases, sales, gstr2bEntries } = useGST();
  const [activeTab, setActiveTab] = useState<DashTab>("overview");
  const now = new Date();
  const todayKey = getTodayKey();
  const currentMonthKey = getMonthKeyFromDate(now);
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthKey = getMonthKeyFromDate(prevMonth);
  const prevMonthLabel = prevMonth.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const todayPurchases = useMemo(() => purchases.filter(p => isSameDay(p.invoiceDate, todayKey)), [purchases, todayKey]);
  const todaySales = useMemo(() => sales.filter(s => isSameDay(s.invoiceDate, todayKey)), [sales, todayKey]);
  const monthPurchases = useMemo(() => purchases.filter(p => getMonthKey(p.invoiceDate) === currentMonthKey), [purchases, currentMonthKey]);
  const monthSales = useMemo(() => sales.filter(s => getMonthKey(s.invoiceDate) === currentMonthKey), [sales, currentMonthKey]);
  const monthPurchaseGST = monthPurchases.reduce((s, p) => s + (p.gstAmount || 0), 0);
  const monthSalesGST = monthSales.reduce((s, p) => s + (p.gstAmount || 0), 0);
  const netGST = monthSalesGST - monthPurchaseGST;
  const totalITC = gstr2bEntries.reduce((s, g) => s + (g.totalITC || 0), 0);
  const chartData = useMemo(() => {
    const result = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = getMonthKeyFromDate(d);
      const mp = purchases.filter(p => getMonthKey(p.invoiceDate) === key);
      const ms = sales.filter(s => getMonthKey(s.invoiceDate) === key);
      result.push({ label: d.toLocaleDateString("en-IN", { month: "short" }), v1: ms.reduce((s, x) => s + (x.totalAmount || 0), 0), v2: mp.reduce((s, x) => s + (x.totalAmount || 0), 0) });
    }
    return result;
  }, [purchases, sales]);
  const topSuppliers = useMemo(() => {
    const map = new Map<string, number>();
    purchases.forEach(p => { const k = (p as any).supplierName || "Unknown"; map.set(k, (map.get(k) || 0) + (p.totalAmount || 0)); });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [purchases]);
  const riskData = useMemo(() => {
    let score = 0;
    const issues: { text: string; severity: "high" | "medium" | "low" }[] = [];
    const tips: string[] = [];
    if (gstr2bEntries.length === 0 && purchases.length > 0) { score += 25; issues.push({ text: "GSTR-2B not uploaded — your tax credits are unverified", severity: "high" }); tips.push("Upload your GSTR-2B from gst.gov.in to verify your tax credits"); }
    const gstr3bDueR = new Date(now.getFullYear(), now.getMonth(), 20);
    const daysToGSTR3BR = Math.ceil((gstr3bDueR.getTime() - now.getTime()) / 86400000);
    if (daysToGSTR3BR < 0) { score += 30; issues.push({ text: "GSTR-3B filing is overdue — late fees are accumulating", severity: "high" }); tips.push("File GSTR-3B immediately on gst.gov.in to stop late fees"); }
    else if (daysToGSTR3BR <= 5) { score += 15; issues.push({ text: `GSTR-3B due in ${daysToGSTR3BR} days — file soon`, severity: "medium" }); tips.push("File GSTR-3B before the 20th of this month"); }
    if (netGST > 50000) { score += 10; issues.push({ text: `High GST payable this month: ${formatINR(netGST)}`, severity: "medium" }); tips.push("Make sure you have enough cash to pay your GST liability"); }
    if (monthPurchases.length === 0 && now.getDate() > 10) { score += 10; issues.push({ text: "No purchases recorded this month", severity: "low" }); tips.push("Record your purchase invoices to claim Input Tax Credit (ITC)"); }
    if (monthSales.length === 0 && now.getDate() > 10) { score += 10; issues.push({ text: "No sales recorded this month", severity: "low" }); tips.push("Record your sales invoices for accurate GST filing"); }
    const level = score === 0 ? "All Good" : score <= 20 ? "Low Risk" : score <= 40 ? "Needs Attention" : "Urgent Action Needed";
    const color = score === 0 ? "#16a34a" : score <= 20 ? "#65a30d" : score <= 40 ? "#d97706" : "#dc2626";
    const emoji = score === 0 ? "✅" : score <= 20 ? "🟡" : score <= 40 ? "⚠️" : "🔴";
    return { score: Math.min(score, 100), level, color, emoji, issues, tips };
  }, [purchases, sales, gstr2bEntries, netGST, monthPurchases, monthSales]);
  const gstr1Due = new Date(now.getFullYear(), now.getMonth(), 11);
  const gstr3bDue = new Date(now.getFullYear(), now.getMonth(), 20);
  const daysToGSTR1 = Math.ceil((gstr1Due.getTime() - now.getTime()) / 86400000);
  const daysToGSTR3B = Math.ceil((gstr3bDue.getTime() - now.getTime()) / 86400000);

  return (
    <View style={styles.container}>
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

        <SmartPrompt purchases={monthPurchases} sales={monthSales} gstr2bEntries={gstr2bEntries} netGST={netGST} monthPurchaseGST={monthPurchaseGST} />

        {(daysToGSTR1 >= 0 && daysToGSTR1 <= 7) && (
          <TouchableOpacity style={styles.alertBanner} onPress={() => router.push("/(tabs)/filings" as any)}>
            <Ionicons name="alarm" size={18} color="#dc2626" />
            <Text style={styles.alertText}>{`GSTR-1 for ${prevMonthLabel} due in ${daysToGSTR1} day${daysToGSTR1 !== 1 ? "s" : ""} (${gstr1Due.toLocaleDateString("en-IN", { day: "numeric", month: "short" })})`}</Text>
            <Ionicons name="chevron-forward" size={16} color="#dc2626" />
          </TouchableOpacity>
        )}
        {(daysToGSTR3B >= 0 && daysToGSTR3B <= 7) && (
          <TouchableOpacity style={[styles.alertBanner, { borderColor: "#d97706", backgroundColor: "#fffbeb" }]} onPress={() => router.push("/(tabs)/filings" as any)}>
            <Ionicons name="alarm" size={18} color="#d97706" />
            <Text style={[styles.alertText, { color: "#92400e" }]}>{`GSTR-3B for ${prevMonthLabel} due in ${daysToGSTR3B} day${daysToGSTR3B !== 1 ? "s" : ""} (${gstr3bDue.toLocaleDateString("en-IN", { day: "numeric", month: "short" })})`}</Text>
            <Ionicons name="chevron-forward" size={16} color="#d97706" />
          </TouchableOpacity>
        )}

        <View style={styles.dashTabs}>
          {([{ key: "overview", label: "📊 Overview" }, { key: "analytics", label: "📈 Analytics" }, { key: "risk", label: `${riskData.emoji} GST Risk` }] as { key: DashTab; label: string }[]).map(t => (
            <TouchableOpacity key={t.key} style={[styles.dashTab, activeTab === t.key && styles.dashTabActive]} onPress={() => setActiveTab(t.key)}>
              <Text style={[styles.dashTabText, activeTab === t.key && styles.dashTabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

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
                  <View style={[styles.statIcon, { backgroundColor: s.color + "15" }]}><Ionicons name={s.icon as any} size={20} color={s.color} /></View>
                  <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                  <Text style={styles.statSub}>{s.sub}</Text>
                </View>
              ))}
            </View>

            <View style={[styles.netGSTCard, { borderColor: netGST > 0 ? "#fecaca" : "#bbf7d0", backgroundColor: netGST > 0 ? "#fef2f2" : "#f0fdf4" }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.netGSTLabel}>Net GST You Need to Pay</Text>
                <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
                  <GlossaryTooltip term="Output Tax"><Text style={styles.glossaryLinkText}>Output Tax</Text></GlossaryTooltip>
                  <Text style={styles.netGSTExplain}> − </Text>
                  <GlossaryTooltip term="ITC"><Text style={styles.glossaryLinkText}>ITC</Text></GlossaryTooltip>
                  <Text style={styles.netGSTExplain}> = amount to deposit with govt</Text>
                </View>
              </View>
              <Text style={[styles.netGSTValue, { color: netGST > 0 ? "#dc2626" : "#16a34a" }]}>{formatINR(Math.abs(netGST))}</Text>
            </View>

            {totalITC > 0 && (
              <View style={styles.itcCard}>
                <Ionicons name="checkmark-shield-outline" size={20} color="#16a34a" />
                <View style={{ flex: 1 }}>
                  <GlossaryTooltip term="GSTR-2B"><Text style={[styles.itcTitle, { color: "#166534" }]}>Verified Tax Credit (GSTR-2B)</Text></GlossaryTooltip>
                  <Text style={styles.itcSub}>Confirmed by your suppliers — use this to reduce your GST payment.</Text>
                </View>
                <Text style={styles.itcValue}>{formatINR(totalITC)}</Text>
              </View>
            )}

            <MonthlyChecklist purchases={monthPurchases} sales={monthSales} gstr2bEntries={gstr2bEntries} />

            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionsGrid}>
              {[
                { label: "Record a Purchase", icon: "arrow-down-circle-outline", color: "#eff6ff", iconColor: "#2563eb", route: "/purchase/add", desc: "Add supplier invoice" },
                { label: "Record a Sale", icon: "arrow-up-circle-outline", color: "#f0fdf4", iconColor: "#16a34a", route: "/sale/add", desc: "Add customer invoice" },
                { label: "Upload GSTR-2B", icon: "cloud-upload-outline", color: "#fffbeb", iconColor: "#d97706", route: "/gstr2b/upload", desc: "Verify your tax credits" },
                { label: "View Filings", icon: "calendar-outline", color: "#fdf4ff", iconColor: "#9333ea", route: "/(tabs)/filings", desc: "Check due dates" },
                { label: "Analytics", icon: "stats-chart-outline", color: "#f0f9ff", iconColor: "#0284c7", route: "/(tabs)/analytics", desc: "Sales & GST trends" },
                { label: "Reports", icon: "document-text-outline", color: "#fdf2f8", iconColor: "#db2777", route: "/(tabs)/reports", desc: "Download PDF report" },
              ].map(a => (
                <TouchableOpacity key={a.label} style={styles.actionCard} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(a.route as any); }} activeOpacity={0.8}>
                  <View style={[styles.actionIcon, { backgroundColor: a.color }]}><Ionicons name={a.icon as any} size={22} color={a.iconColor} /></View>
                  <Text style={styles.actionLabel}>{a.label}</Text>
                  <Text style={styles.actionDesc}>{a.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.glossaryQuickCard}>
              <Text style={styles.glossaryQuickTitle}>📖 Tap any term to learn what it means</Text>
              <View style={styles.glossaryQuickRow}>
                {(["GSTR-1","GSTR-3B","GSTR-2B","ITC","HSN Code","GSTIN"] as GlossaryKey[]).map(term => (
                  <GlossaryTooltip key={term} term={term}>
                    <View style={styles.glossaryChip}><Text style={styles.glossaryChipText}>{term}</Text></View>
                  </GlossaryTooltip>
                ))}
              </View>
            </View>
          </>
        )}

        {activeTab === "analytics" && (
          <>
            <View style={styles.analyticsCard}>
              <Text style={styles.analyticsTitle}>📈 Sales vs Purchases — Last 6 Months</Text>
              <Text style={styles.analyticsSub}>Green = Sales | Blue = Purchases</Text>
              <MiniBar data={chartData} colors={["#16a34a", "#2563eb"]} />
              <View style={styles.chartLegend}>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: "#16a34a" }]} /><Text style={styles.legendText}>Sales</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: "#2563eb" }]} /><Text style={styles.legendText}>Purchases</Text></View>
              </View>
            </View>
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
            {topSuppliers.length > 0 && (
              <View style={styles.analyticsCard}>
                <Text style={styles.analyticsTitle}>🏪 Top Suppliers by Purchase Value</Text>
                {topSuppliers.map(([name, val], i) => (
                  <View key={i} style={styles.supplierRow}>
                    <View style={[styles.supplierRank, { backgroundColor: ["#fef3c7","#f3f4f6","#fdf4ff","#f0fdf4"][i] }]}><Text style={styles.supplierRankText}>#{i+1}</Text></View>
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

        {activeTab === "risk" && (
          <>
            <View style={styles.riskExplainCard}>
              <Text style={styles.riskExplainTitle}>What is the GST Risk Meter?</Text>
              <Text style={styles.riskExplainText}>This shows how likely you are to face GST penalties or notices. Like a car dashboard warning light — green means everything is fine, red means you need to take action immediately.</Text>
            </View>
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
              <View style={styles.riskScale}>
                {[{ label: "0–20\nSafe", color: "#16a34a" }, { label: "21–40\nLow Risk", color: "#65a30d" }, { label: "41–60\nAttention", color: "#d97706" }, { label: "61–100\nUrgent", color: "#dc2626" }].map(s => (
                  <View key={s.label} style={styles.riskScaleItem}>
                    <View style={[styles.riskScaleDot, { backgroundColor: s.color }]} />
                    <Text style={styles.riskScaleText}>{s.label}</Text>
                  </View>
                ))}
              </View>
            </View>
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
                  <View key={i} style={[styles.issueCard, { borderLeftColor: issue.severity === "high" ? "#dc2626" : issue.severity === "medium" ? "#d97706" : "#65a30d", backgroundColor: issue.severity === "high" ? "#fef2f2" : issue.severity === "medium" ? "#fffbeb" : "#f7fee7" }]}>
                    <Ionicons name={issue.severity === "high" ? "close-circle" : issue.severity === "medium" ? "warning" : "information-circle"} size={18} color={issue.severity === "high" ? "#dc2626" : issue.severity === "medium" ? "#d97706" : "#65a30d"} />
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
  smartPromptCard: { borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1.5, flexDirection: "row", alignItems: "flex-start", gap: 12 },
  smartPromptIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  smartPromptLabel: { fontSize: 10, fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 },
  smartPromptText: { fontSize: 13, fontWeight: "600", lineHeight: 19, marginBottom: 6 },
  smartPromptAction: { fontSize: 12, fontWeight: "700" },
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
  netGSTCard: { borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1.5, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  netGSTLabel: { fontSize: 13, fontWeight: "700", color: "#111827", marginBottom: 4 },
  netGSTExplain: { fontSize: 11, color: "#6b7280" },
  netGSTValue: { fontSize: 22, fontWeight: "800" },
  itcCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#f0fdf4", borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#bbf7d0" },
  itcTitle: { fontSize: 13, fontWeight: "700" },
  itcSub: { fontSize: 11, color: "#16a34a", marginTop: 2, lineHeight: 16 },
  itcValue: { fontSize: 18, fontWeight: "800", color: "#16a34a" },
  checklistCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#e5e7eb" },
  checklistHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  checklistTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
  checklistSub: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  checklistBadge: { backgroundColor: Colors.primary, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  checklistBadgeText: { fontSize: 12, fontWeight: "800", color: "#fff" },
  checklistProgress: { height: 4, backgroundColor: "#f3f4f6", borderRadius: 2, marginBottom: 14, overflow: "hidden" },
  checklistProgressFill: { height: 4, backgroundColor: Colors.primary, borderRadius: 2 },
  checklistRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f9fafb" },
  checklistCheck: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: "#d1d5db", justifyContent: "center", alignItems: "center" },
  checklistCheckDone: { backgroundColor: "#16a34a", borderColor: "#16a34a" },
  checklistNum: { fontSize: 11, fontWeight: "700", color: "#9ca3af" },
  checklistLabel: { fontSize: 13, fontWeight: "600", color: "#111827" },
  checklistLabelDone: { color: "#9ca3af", textDecorationLine: "line-through" },
  checklistDesc: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  checklistIcon: { width: 30, height: 30, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  actionCard: { width: "47%", backgroundColor: "#fff", borderRadius: 14, padding: 14, alignItems: "center", gap: 6, borderWidth: 1, borderColor: "#e5e7eb" },
  actionIcon: { width: 48, height: 48, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  actionLabel: { fontSize: 12, fontWeight: "700", color: "#111827", textAlign: "center" },
  actionDesc: { fontSize: 10, color: "#9ca3af", textAlign: "center" },
  glossaryQuickCard: { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#e5e7eb" },
  glossaryQuickTitle: { fontSize: 12, fontWeight: "600", color: "#6b7280", marginBottom: 10 },
  glossaryQuickRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  glossaryChip: { backgroundColor: "#eff6ff", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: "#bfdbfe" },
  glossaryChipText: { fontSize: 12, fontWeight: "600", color: "#2563eb" },
  glossaryTrigger: { flexDirection: "row", alignItems: "center" },
  glossaryLinkText: { fontSize: 11, color: "#2563eb", fontWeight: "600", textDecorationLine: "underline" },
  glossaryOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 24 },
  glossaryCard: { backgroundColor: "#fff", borderRadius: 20, padding: 20, width: "100%", maxWidth: 420, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 10 },
  glossaryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  glossaryTitle: { fontSize: 15, fontWeight: "800", color: "#111827", flex: 1, marginRight: 8 },
  glossaryPlain: { fontSize: 14, color: "#374151", lineHeight: 22, marginBottom: 12 },
  glossaryExample: { backgroundColor: "#f0fdf4", borderRadius: 10, padding: 12, borderLeftWidth: 3, borderLeftColor: "#16a34a" },
  glossaryExampleLabel: { fontSize: 10, fontWeight: "700", color: "#16a34a", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  glossaryExampleText: { fontSize: 13, color: "#166534", lineHeight: 20 },
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