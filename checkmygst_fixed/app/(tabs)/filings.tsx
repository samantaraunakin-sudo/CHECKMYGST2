import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, Alert, Modal
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useGST } from "@/contexts/GSTContext";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const SHORT_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function getDueDate(year: number, month: number, returnType: string) {
  // month is 0-indexed
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  if (returnType === "GSTR-1") return new Date(nextYear, nextMonth, 11);
  if (returnType === "GSTR-3B") return new Date(nextYear, nextMonth, 20);
  if (returnType === "GSTR-2B") return new Date(nextYear, nextMonth, 14); // available by 14th
  return new Date(nextYear, nextMonth, 20);
}

function getDaysLeft(dueDate: Date) {
  const today = new Date();
  today.setHours(0,0,0,0);
  return Math.ceil((dueDate.getTime() - today.getTime()) / (1000*60*60*24));
}

function getStatusColor(daysLeft: number, filed: boolean) {
  if (filed) return "#16a34a";
  if (daysLeft < 0) return "#dc2626";
  if (daysLeft <= 3) return "#dc2626";
  if (daysLeft <= 7) return "#d97706";
  return "#2563eb";
}

function getStatusLabel(daysLeft: number, filed: boolean) {
  if (filed) return "Filed ✓";
  if (daysLeft < 0) return `Overdue by ${Math.abs(daysLeft)}d`;
  if (daysLeft === 0) return "Due Today!";
  if (daysLeft <= 3) return `Due in ${daysLeft}d ⚠️`;
  if (daysLeft <= 7) return `Due in ${daysLeft}d`;
  return `Due in ${daysLeft}d`;
}

const RETURN_TYPES = ["GSTR-1", "GSTR-3B"];

export default function FilingsScreen() {
  const { profile, purchases, sales } = useGST();
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [filedStatus, setFiledStatus] = useState<Record<string, boolean>>({});
  const [showInfo, setShowInfo] = useState(false);

  // Generate last 6 months + next 2 months
  const periods = useMemo(() => {
    const result = [];
    for (let i = -5; i <= 2; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      result.push({ year: d.getFullYear(), month: d.getMonth() });
    }
    return result.reverse();
  }, []);

  const getMonthStats = (year: number, month: number) => {
    const mm = String(month + 1).padStart(2, "0");
    const key = `${year}-${mm}`;
    const getMonthKey = (dateStr: string) => {
      if (!dateStr) return "";
      const parts = dateStr.split("/");
      if (parts.length === 3) return `${parts[2]}-${parts[1]}`;
      return dateStr.substring(0, 7);
    };
    const mp = (purchases as any[]).filter(p => getMonthKey(p.invoiceDate) === key);
    const ms = (sales as any[]).filter(s => getMonthKey(s.invoiceDate) === key);
    const salesGST = ms.reduce((s: number, x: any) => s + (x.gstAmount || 0), 0);
    const purchaseGST = mp.reduce((s: number, x: any) => s + (x.gstAmount || 0), 0);
    return { purchases: mp.length, sales: ms.length, netGST: salesGST - purchaseGST, salesGST, purchaseGST };
  };

  const toggleFiled = (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFiledStatus(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Count urgent filings
  const urgentCount = useMemo(() => {
    let count = 0;
    periods.forEach(({ year, month }) => {
      RETURN_TYPES.forEach(rt => {
        const key = `${year}-${month}-${rt}`;
        const due = getDueDate(year, month, rt);
        const days = getDaysLeft(due);
        if (!filedStatus[key] && days >= 0 && days <= 7) count++;
      });
    });
    return count;
  }, [periods, filedStatus]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>GST Filing Tracker</Text>
          <Text style={styles.headerSub}>
            {profile?.gstin ? `GSTIN: ${profile.gstin}` : "Set GSTIN in Profile →"}
          </Text>
        </View>
        <View style={styles.headerRight}>
          {urgentCount > 0 && (
            <View style={styles.urgentBadge}>
              <Text style={styles.urgentBadgeText}>{urgentCount} urgent</Text>
            </View>
          )}
          <TouchableOpacity onPress={() => setShowInfo(true)} style={styles.infoBtn}>
            <Ionicons name="information-circle-outline" size={24} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* GSTIN Warning */}
        {!profile?.gstin && (
          <TouchableOpacity style={styles.warningBanner} onPress={() => router.push("/(tabs)/profile" as any)}>
            <Ionicons name="warning-outline" size={18} color="#d97706" />
            <Text style={styles.warningText}>Add your GSTIN in Profile to get personalized reminders</Text>
            <Ionicons name="chevron-forward" size={16} color="#d97706" />
          </TouchableOpacity>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickBtn} onPress={() => router.push("/gstr2b/upload" as any)}>
            <Ionicons name="cloud-upload-outline" size={20} color={Colors.primary} />
            <Text style={styles.quickBtnText}>Upload GSTR-2B</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={() => router.push("/(tabs)/reconciliation" as any)}>
            <Ionicons name="git-compare-outline" size={20} color="#8b5cf6" />
            <Text style={[styles.quickBtnText, { color: "#8b5cf6" }]}>Reconcile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={() => router.push("/(tabs)/calculator" as any)}>
            <Ionicons name="calculator-outline" size={20} color="#16a34a" />
            <Text style={[styles.quickBtnText, { color: "#16a34a" }]}>Calculator</Text>
          </TouchableOpacity>
        </View>

        {/* Filing Calendar */}
        {periods.map(({ year, month }) => {
          const stats = getMonthStats(year, month);
          const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
          const isFuture = new Date(year, month, 1) > new Date(now.getFullYear(), now.getMonth(), 1);
          return (
            <View key={`${year}-${month}`} style={[styles.monthBlock, isCurrentMonth && styles.monthBlockCurrent]}>
              <View style={styles.monthHeader}>
                <View>
                  <Text style={styles.monthName}>
                    {MONTHS[month]} {year}
                    {isCurrentMonth && <Text style={styles.currentTag}> · Current</Text>}
                  </Text>
                  <Text style={styles.monthStats}>
                    {stats.purchases} purchases · {stats.sales} sales ·{" "}
                    <Text style={{ color: stats.netGST > 0 ? "#ef4444" : "#16a34a" }}>
                      Net GST: ₹{Math.abs(stats.netGST).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </Text>
                  </Text>
                </View>
                {isFuture && (
                  <View style={styles.futureBadge}>
                    <Text style={styles.futureBadgeText}>Upcoming</Text>
                  </View>
                )}
              </View>

              {/* Returns */}
              {RETURN_TYPES.map(rt => {
                const key = `${year}-${month}-${rt}`;
                const due = getDueDate(year, month, rt);
                const daysLeft = getDaysLeft(due);
                const filed = filedStatus[key] || false;
                const statusColor = getStatusColor(daysLeft, filed);
                const statusLabel = getStatusLabel(daysLeft, filed);
                return (
                  <View key={rt} style={styles.returnRow}>
                    <View style={[styles.returnIcon, { backgroundColor: filed ? "#f0fdf4" : daysLeft < 0 ? "#fef2f2" : daysLeft <= 7 ? "#fffbeb" : "#eff6ff" }]}>
                      <Ionicons
                        name={filed ? "checkmark-circle" : daysLeft < 0 ? "close-circle" : daysLeft <= 7 ? "alarm" : "document-text-outline"}
                        size={20}
                        color={statusColor}
                      />
                    </View>
                    <View style={styles.returnInfo}>
                      <Text style={styles.returnName}>{rt}</Text>
                      <Text style={styles.returnDue}>
                        Due: {due.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </Text>
                    </View>
                    <View style={styles.returnRight}>
                      <Text style={[styles.statusLabel, { color: statusColor }]}>{statusLabel}</Text>
                      <TouchableOpacity
                        style={[styles.filedBtn, { backgroundColor: filed ? "#f0fdf4" : "#f9fafb", borderColor: filed ? "#16a34a" : "#e5e7eb" }]}
                        onPress={() => toggleFiled(key)}
                      >
                        <Text style={[styles.filedBtnText, { color: filed ? "#16a34a" : "#6b7280" }]}>
                          {filed ? "✓ Filed" : "Mark Filed"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })}

        {/* Late Filing Penalty Info */}
        <View style={styles.penaltyCard}>
          <Text style={styles.penaltyTitle}>⚠️ Late Filing Penalties</Text>
          <View style={styles.penaltyRow}>
            <Text style={styles.penaltyLabel}>GSTR-1 late fee</Text>
            <Text style={styles.penaltyValue}>₹50/day (nil return: ₹20/day)</Text>
          </View>
          <View style={styles.penaltyRow}>
            <Text style={styles.penaltyLabel}>GSTR-3B late fee</Text>
            <Text style={styles.penaltyValue}>₹50/day + 18% interest on tax</Text>
          </View>
          <View style={styles.penaltyRow}>
            <Text style={styles.penaltyLabel}>Maximum penalty</Text>
            <Text style={styles.penaltyValue}>₹10,000 per return</Text>
          </View>
        </View>

      </ScrollView>

      {/* Info Modal */}
      <Modal visible={showInfo} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowInfo(false)} activeOpacity={1}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>GST Return Due Dates</Text>
            {[
              { name: "GSTR-1", desc: "Outward supplies (your sales)", due: "11th of next month" },
              { name: "GSTR-2B", desc: "Auto-drafted ITC statement", due: "Available by 14th" },
              { name: "GSTR-3B", desc: "Monthly summary return", due: "20th of next month" },
            ].map(r => (
              <View key={r.name} style={styles.modalRow}>
                <View style={styles.modalRowLeft}>
                  <Text style={styles.modalReturnName}>{r.name}</Text>
                  <Text style={styles.modalReturnDesc}>{r.desc}</Text>
                </View>
                <Text style={styles.modalDue}>{r.due}</Text>
              </View>
            ))}
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowInfo(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: { backgroundColor: "#fff", paddingTop: Platform.OS === "ios" ? 56 : 48, paddingBottom: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: "#e5e7eb", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#111827" },
  headerSub: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  urgentBadge: { backgroundColor: "#fef2f2", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: "#fecaca" },
  urgentBadgeText: { fontSize: 12, fontWeight: "700", color: "#dc2626" },
  infoBtn: { padding: 4 },
  scroll: { padding: 16, paddingBottom: 40 },
  warningBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fffbeb", borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: "#fde68a" },
  warningText: { flex: 1, fontSize: 13, color: "#92400e" },
  quickActions: { flexDirection: "row", gap: 8, marginBottom: 16 },
  quickBtn: { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 12, alignItems: "center", gap: 6, borderWidth: 1, borderColor: "#e5e7eb" },
  quickBtnText: { fontSize: 12, fontWeight: "600", color: Colors.primary },
  monthBlock: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#e5e7eb" },
  monthBlockCurrent: { borderColor: Colors.primary, borderWidth: 2 },
  monthHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  monthName: { fontSize: 16, fontWeight: "700", color: "#111827" },
  currentTag: { fontSize: 13, color: Colors.primary, fontWeight: "600" },
  monthStats: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  futureBadge: { backgroundColor: "#eff6ff", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  futureBadgeText: { fontSize: 11, color: "#2563eb", fontWeight: "600" },
  returnRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  returnIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  returnInfo: { flex: 1 },
  returnName: { fontSize: 14, fontWeight: "700", color: "#111827" },
  returnDue: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  returnRight: { alignItems: "flex-end", gap: 6 },
  statusLabel: { fontSize: 12, fontWeight: "700" },
  filedBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  filedBtnText: { fontSize: 12, fontWeight: "600" },
  penaltyCard: { backgroundColor: "#fffbeb", borderRadius: 14, padding: 16, marginTop: 4, borderWidth: 1, borderColor: "#fde68a" },
  penaltyTitle: { fontSize: 14, fontWeight: "700", color: "#92400e", marginBottom: 10 },
  penaltyRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  penaltyLabel: { fontSize: 12, color: "#78350f" },
  penaltyValue: { fontSize: 12, fontWeight: "600", color: "#92400e" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalBox: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: "700", textAlign: "center", marginBottom: 20, color: "#111827" },
  modalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 12, borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  modalRowLeft: { flex: 1 },
  modalReturnName: { fontSize: 15, fontWeight: "700", color: "#111827" },
  modalReturnDesc: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  modalDue: { fontSize: 12, fontWeight: "600", color: Colors.primary, textAlign: "right" },
  modalClose: { backgroundColor: Colors.primary, borderRadius: 12, padding: 14, marginTop: 20, alignItems: "center" },
  modalCloseText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
