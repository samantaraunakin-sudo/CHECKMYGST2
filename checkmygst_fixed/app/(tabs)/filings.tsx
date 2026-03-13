import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, Modal, ActivityIndicator
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useGST } from "@/contexts/GSTContext";
import { getApiUrl } from "@/lib/query-client";
import { supabase } from "@/lib/supabase";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const RETURN_TYPES = ["GSTR-1", "GSTR-3B"];
const RETURN_PLAIN = {
  "GSTR-1": "Sales Return (GSTR-1)",
  "GSTR-3B": "Tax Payment Return (GSTR-3B)",
};
const RETURN_DESC = {
  "GSTR-1": "Report all your sales invoices to the government",
  "GSTR-3B": "Pay your final GST after deducting purchase tax credits",
};

function getDueDate(year: number, month: number, returnType: string) {
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  if (returnType === "GSTR-1") return new Date(nextYear, nextMonth, 11);
  if (returnType === "GSTR-3B") return new Date(nextYear, nextMonth, 20);
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

function getStatusLabel(daysLeft: number, filed: boolean, filedDate?: string) {
  if (filed) return filedDate ? `Filed ✓ ${filedDate}` : "Filed ✓";
  if (daysLeft < 0) return `Overdue by ${Math.abs(daysLeft)}d`;
  if (daysLeft === 0) return "Due Today!";
  if (daysLeft <= 3) return `Due in ${daysLeft}d ⚠️`;
  if (daysLeft <= 7) return `Due in ${daysLeft}d`;
  return `Due in ${daysLeft}d`;
}

export default function FilingsScreen() {
  const { profile, purchases, sales } = useGST();
  const now = new Date();

  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const [selectedPeriods, setSelectedPeriods] = useState<{year: number, month: number}[]>([
    { year: prevMonth.getFullYear(), month: prevMonth.getMonth() },
    { year: now.getFullYear(), month: now.getMonth() },
  ]);

  // filedStatus now stores { filed: boolean, filedDate: string, filedBy: string }
  const [filedStatus, setFiledStatus] = useState<Record<string, { filed: boolean; filedDate: string; filedBy: string }>>({});
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(now.getFullYear());
  const [showInfo, setShowInfo] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [showFiledModal, setShowFiledModal] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [filedByInput, setFiledByInput] = useState("CA");

  // Load filing status from Supabase on mount
  useEffect(() => {
    if (profile?.id) loadFilingStatus();
  }, [profile?.id]);

  const loadFilingStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) { setIsLoadingStatus(false); return; }
      const { data, error } = await supabase
        .from("filing_status")
        .select("*")
        .eq("user_id", user.id);
      if (data) {
        const statusMap: Record<string, { filed: boolean; filedDate: string; filedBy: string }> = {};
        data.forEach((row: any) => {
          statusMap[row.filing_key] = {
            filed: row.filed,
            filedDate: row.filed_date || "",
            filedBy: row.filed_by || "",
          };
        });
        setFiledStatus(statusMap);
      }
    } catch (e) {
      console.error("Error loading filing status:", e);
    }
    setIsLoadingStatus(false);
  };

  const toggleFiled = async (key: string) => {
    const current = filedStatus[key];
    if (current?.filed) {
      // Unmark filed
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const newStatus = { filed: false, filedDate: "", filedBy: "" };
      setFiledStatus(prev => ({ ...prev, [key]: newStatus }));
      if (profile?.id) {
        await supabase.from("filing_status").upsert({
          user_id: profile.id,
          filing_key: key,
          filed: false,
          filed_date: null,
          filed_by: null,
          updated_at: new Date().toISOString(),
        });
      }
    } else {
      // Show modal to confirm who filed
      setPendingKey(key);
      setFiledByInput("CA");
      setShowFiledModal(true);
    }
  };

  const confirmFiled = async () => {
    if (!pendingKey) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    const newStatus = { filed: true, filedDate: today, filedBy: filedByInput };
    setFiledStatus(prev => ({ ...prev, [pendingKey]: newStatus }));
    setShowFiledModal(false);
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      await supabase.from("filing_status").upsert({
        user_id: user.id,
        filing_key: pendingKey,
        filed: true,
        filed_date: today,
        filed_by: filedByInput,
        updated_at: new Date().toISOString(),
      });
    }
    setPendingKey(null);
  };

  const enableBrowserNotifications = async () => {
    if (typeof Notification === "undefined") { alert("Browser notifications not supported"); return; }
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      setNotifEnabled(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      new Notification("CheckMyGST Reminders Enabled", {
        body: "You will receive GST filing reminders in your browser.",
        icon: "/favicon.ico",
      });
    }
  };

  const sendEmailReminder = async () => {
    if (!profile?.id) { alert("Please complete your profile first"); return; }
    setIsSendingEmail(true);
    try {
      const upcomingReminders: any[] = [];
      selectedPeriods.forEach(({ year, month }) => {
        ["GSTR-1", "GSTR-3B"].forEach(rt => {
          const key = year + "-" + month + "-" + rt;
          if (!filedStatus[key]?.filed) {
            const nextMonth = month === 11 ? 0 : month + 1;
            const nextYear = month === 11 ? year + 1 : year;
            const dueDate = new Date(nextYear, nextMonth, rt === "GSTR-1" ? 11 : 20);
            const daysLeft = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (daysLeft >= 0 && daysLeft <= 10) {
              upcomingReminders.push({
                returnType: rt,
                period: MONTHS[month] + " " + year,
                dueDate: dueDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
                daysLeft,
              });
            }
          }
        });
      });
      if (upcomingReminders.length === 0) { alert("No upcoming deadlines in the next 10 days!"); setIsSendingEmail(false); return; }
      const apiBase = getApiUrl();
      const res = await fetch(new URL("/api/send-reminder", apiBase).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: (profile as any).email || "",
          businessName: profile?.businessName,
          gstin: profile?.gstin,
          reminders: upcomingReminders,
        }),
      });
      if (res.ok) { setEmailSent(true); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
      else { const d = await res.json(); alert("Failed: " + (d.error || "Unknown error")); }
    } catch (e: any) { alert("Error: " + e.message); }
    finally { setIsSendingEmail(false); }
  };

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  const addPeriod = (year: number, month: number) => {
    const exists = selectedPeriods.some(p => p.year === year && p.month === month);
    if (!exists) {
      setSelectedPeriods(prev => [...prev, { year, month }].sort((a, b) =>
        b.year !== a.year ? b.year - a.year : b.month - a.month
      ));
    }
    setShowPicker(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const removePeriod = (year: number, month: number) => {
    if (selectedPeriods.length === 1) return;
    setSelectedPeriods(prev => prev.filter(p => !(p.year === year && p.month === month)));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const getMonthStats = (year: number, month: number) => {
    const mm = String(month + 1).padStart(2, "0");
    const key = `${year}-${mm}`;
    const getKey = (dateStr: string) => {
      if (!dateStr) return "";
      const parts = dateStr.split("/");
      if (parts.length === 3) return `${parts[2]}-${parts[1]}`;
      return dateStr.substring(0, 7);
    };
    const mp = (purchases as any[]).filter(p => getKey(p.invoiceDate) === key);
    const ms = (sales as any[]).filter(s => getKey(s.invoiceDate) === key);
    const salesGST = ms.reduce((s: number, x: any) => s + (x.gstAmount || 0), 0);
    const purchaseGST = mp.reduce((s: number, x: any) => s + (x.gstAmount || 0), 0);
    return { purchases: mp.length, sales: ms.length, netGST: salesGST - purchaseGST };
  };

  const urgentCount = useMemo(() => {
    let count = 0;
    selectedPeriods.forEach(({ year, month }) => {
      RETURN_TYPES.forEach(rt => {
        const key = `${year}-${month}-${rt}`;
        const due = getDueDate(year, month, rt);
        const days = getDaysLeft(due);
        if (!filedStatus[key]?.filed && days >= 0 && days <= 7) count++;
      });
    });
    return count;
  }, [selectedPeriods, filedStatus]);

  // CA Watch summary — how many returns CA has filed vs total
  const caWatchStats = useMemo(() => {
    let total = 0, filedByCa = 0, overdue = 0;
    selectedPeriods.forEach(({ year, month }) => {
      RETURN_TYPES.forEach(rt => {
        const key = `${year}-${month}-${rt}`;
        const due = getDueDate(year, month, rt);
        const days = getDaysLeft(due);
        total++;
        const status = filedStatus[key];
        if (status?.filed && status.filedBy?.toLowerCase().includes("ca")) filedByCa++;
        if (!status?.filed && days < 0) overdue++;
      });
    });
    return { total, filedByCa, overdue };
  }, [selectedPeriods, filedStatus]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>GST Filings</Text>
          <Text style={styles.headerSub}>
            {profile?.gstin ? `GSTIN: ${profile.gstin}` : "Add GSTIN in Profile"}
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

        {/* CA Watch Banner */}
        <View style={styles.caWatchCard}>
          <View style={styles.caWatchHeader}>
            <Ionicons name="eye-outline" size={18} color="#7c3aed" />
            <Text style={styles.caWatchTitle}>CA Watch</Text>
            <Text style={styles.caWatchSub}>Track whether your CA is filing on time</Text>
          </View>
          <View style={styles.caWatchRow}>
            <View style={styles.caWatchStat}>
              <Text style={styles.caWatchStatValue}>{caWatchStats.total}</Text>
              <Text style={styles.caWatchStatLabel}>Total Returns</Text>
            </View>
            <View style={[styles.caWatchStat, { borderLeftWidth: 1, borderLeftColor: "#e9d5ff" }]}>
              <Text style={[styles.caWatchStatValue, { color: "#16a34a" }]}>{caWatchStats.filedByCa}</Text>
              <Text style={styles.caWatchStatLabel}>Filed by CA</Text>
            </View>
            <View style={[styles.caWatchStat, { borderLeftWidth: 1, borderLeftColor: "#e9d5ff" }]}>
              <Text style={[styles.caWatchStatValue, { color: caWatchStats.overdue > 0 ? "#dc2626" : "#9ca3af" }]}>{caWatchStats.overdue}</Text>
              <Text style={styles.caWatchStatLabel}>Overdue</Text>
            </View>
          </View>
          {caWatchStats.overdue > 0 && (
            <View style={styles.caWatchAlert}>
              <Ionicons name="warning-outline" size={14} color="#dc2626" />
              <Text style={styles.caWatchAlertText}>
                {caWatchStats.overdue} return{caWatchStats.overdue > 1 ? "s are" : " is"} overdue — contact your CA immediately
              </Text>
            </View>
          )}
          {caWatchStats.overdue === 0 && caWatchStats.filedByCa === caWatchStats.total && (
            <View style={[styles.caWatchAlert, { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }]}>
              <Ionicons name="checkmark-circle-outline" size={14} color="#16a34a" />
              <Text style={[styles.caWatchAlertText, { color: "#166534" }]}>Your CA is on track — all returns filed ✓</Text>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickBtn} onPress={() => router.push("/gstr2b/upload" as any)}>
            <Ionicons name="cloud-upload-outline" size={18} color={Colors.primary} />
            <Text style={styles.quickBtnText}>Upload GSTR-2B</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={() => router.push("/(tabs)/calculator" as any)}>
            <Ionicons name="calculator-outline" size={18} color="#16a34a" />
            <Text style={[styles.quickBtnText, { color: "#16a34a" }]}>GST Calculator</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={() => router.push("/(tabs)/reconciliation" as any)}>
            <Ionicons name="git-compare-outline" size={18} color="#8b5cf6" />
            <Text style={[styles.quickBtnText, { color: "#8b5cf6" }]}>Reconcile</Text>
          </TouchableOpacity>
        </View>

        {/* Add Period Button */}
        <TouchableOpacity style={styles.addPeriodBtn} onPress={() => setShowPicker(true)}>
          <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
          <Text style={styles.addPeriodText}>Add Month to Track</Text>
        </TouchableOpacity>

        {/* Reminder Actions */}
        <View style={styles.reminderRow}>
          <TouchableOpacity
            style={[styles.reminderBtn, notifEnabled && { backgroundColor: "#f0fdf4", borderColor: "#16a34a" }]}
            onPress={enableBrowserNotifications}
          >
            <Ionicons name={notifEnabled ? "notifications" : "notifications-outline"} size={16} color={notifEnabled ? "#16a34a" : Colors.primary} />
            <Text style={[styles.reminderBtnText, notifEnabled && { color: "#16a34a" }]}>
              {notifEnabled ? "Notifs ON ✓" : "Enable Alerts"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.reminderBtn, emailSent && { backgroundColor: "#f0fdf4", borderColor: "#16a34a" }, isSendingEmail && { opacity: 0.6 }]}
            onPress={sendEmailReminder}
            disabled={isSendingEmail}
          >
            <Ionicons name="mail-outline" size={16} color={emailSent ? "#16a34a" : "#7c3aed"} />
            <Text style={[styles.reminderBtnText, { color: emailSent ? "#16a34a" : "#7c3aed" }]}>
              {isSendingEmail ? "Sending..." : emailSent ? "Email Sent ✓" : "Email Reminder"}
            </Text>
          </TouchableOpacity>
        </View>

        {isLoadingStatus && (
          <View style={{ alignItems: "center", paddingVertical: 12 }}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>Loading filing status...</Text>
          </View>
        )}

        {/* Period Cards */}
        {selectedPeriods.map(({ year, month }) => {
          const stats = getMonthStats(year, month);
          const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
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
                {!isCurrentMonth && (
                  <TouchableOpacity onPress={() => removePeriod(year, month)} style={styles.removeBtn}>
                    <Ionicons name="close" size={16} color="#9ca3af" />
                  </TouchableOpacity>
                )}
              </View>

              {RETURN_TYPES.map(rt => {
                const key = `${year}-${month}-${rt}`;
                const due = getDueDate(year, month, rt);
                const daysLeft = getDaysLeft(due);
                const status = filedStatus[key];
                const filed = status?.filed || false;
                const statusColor = getStatusColor(daysLeft, filed);
                return (
                  <View key={rt} style={styles.returnRow}>
                    <View style={[styles.returnIcon, {
                      backgroundColor: filed ? "#f0fdf4" : daysLeft < 0 ? "#fef2f2" : daysLeft <= 7 ? "#fffbeb" : "#eff6ff"
                    }]}>
                      <Ionicons
                        name={filed ? "checkmark-circle" : daysLeft < 0 ? "close-circle" : daysLeft <= 7 ? "alarm" : "document-text-outline"}
                        size={20} color={statusColor}
                      />
                    </View>
                    <View style={styles.returnInfo}>
                      <Text style={styles.returnName}>{RETURN_PLAIN[rt as keyof typeof RETURN_PLAIN] || rt}</Text>
                      <Text style={styles.returnDesc}>{RETURN_DESC[rt as keyof typeof RETURN_DESC]}</Text>
                      <Text style={styles.returnDue}>
                        Due: {due.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </Text>
                      {filed && status?.filedBy && (
                        <Text style={styles.filedByLabel}>Filed by: {status.filedBy} on {status.filedDate}</Text>
                      )}
                    </View>
                    <View style={styles.returnRight}>
                      <Text style={[styles.statusLabel, { color: statusColor }]}>
                        {getStatusLabel(daysLeft, filed)}
                      </Text>
                      <TouchableOpacity
                        style={[styles.filedBtn, {
                          backgroundColor: filed ? "#f0fdf4" : "#f9fafb",
                          borderColor: filed ? "#16a34a" : "#e5e7eb"
                        }]}
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

        {/* Penalty Info */}
        <View style={styles.penaltyCard}>
          <Text style={styles.penaltyTitle}>⚠️ Late Filing Penalties</Text>
          {[
            { label: "GSTR-1 late fee", value: "₹50/day (nil return: ₹20/day)" },
            { label: "GSTR-3B late fee", value: "₹50/day + 18% interest" },
            { label: "Maximum penalty", value: "₹10,000 per return" },
          ].map(p => (
            <View key={p.label} style={styles.penaltyRow}>
              <Text style={styles.penaltyLabel}>{p.label}</Text>
              <Text style={styles.penaltyValue}>{p.value}</Text>
            </View>
          ))}
        </View>

      </ScrollView>

      {/* Mark Filed Modal */}
      <Modal visible={showFiledModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowFiledModal(false)} activeOpacity={1}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Who filed this return?</Text>
            <Text style={styles.modalSub}>This will be saved and shown in CA Watch</Text>
            <View style={styles.filedByOptions}>
              {["CA", "Self", "Tax Consultant", "Other"].map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.filedByOption, filedByInput === opt && styles.filedByOptionActive]}
                  onPress={() => setFiledByInput(opt)}
                >
                  <Text style={[styles.filedByOptionText, filedByInput === opt && { color: "#fff" }]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.confirmBtn} onPress={confirmFiled}>
              <Text style={styles.confirmBtnText}>Confirm Filed ✓</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowFiledModal(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Month Picker Modal */}
      <Modal visible={showPicker} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowPicker(false)} activeOpacity={1}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Select Month & Year</Text>
            <View style={styles.yearRow}>
              {years.map(y => (
                <TouchableOpacity
                  key={y}
                  style={[styles.yearBtn, pickerYear === y && styles.yearBtnActive]}
                  onPress={() => setPickerYear(y)}
                >
                  <Text style={[styles.yearBtnText, pickerYear === y && styles.yearBtnTextActive]}>{y}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.monthGrid}>
              {MONTHS.map((m, i) => {
                const already = selectedPeriods.some(p => p.year === pickerYear && p.month === i);
                return (
                  <TouchableOpacity
                    key={m}
                    style={[styles.monthItem, already && styles.monthItemAdded]}
                    onPress={() => !already && addPeriod(pickerYear, i)}
                    disabled={already}
                  >
                    <Text style={[styles.monthItemText, already && styles.monthItemAddedText]}>
                      {m.substring(0, 3)}
                    </Text>
                    {already && <Text style={styles.monthItemAddedText}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Info Modal */}
      <Modal visible={showInfo} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowInfo(false)} activeOpacity={1}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>GST Return Due Dates</Text>
            {[
              { name: "GSTR-1", desc: "Outward supplies — your sales", due: "11th of next month" },
              { name: "GSTR-2B", desc: "Auto-drafted ITC from purchases", due: "Available by 14th" },
              { name: "GSTR-3B", desc: "Monthly summary return + tax payment", due: "20th of next month" },
            ].map(r => (
              <View key={r.name} style={styles.infoRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoName}>{r.name}</Text>
                  <Text style={styles.infoDesc}>{r.desc}</Text>
                </View>
                <Text style={styles.infoDue}>{r.due}</Text>
              </View>
            ))}
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowInfo(false)}>
              <Text style={styles.modalCloseText}>Got it</Text>
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
  caWatchCard: { backgroundColor: "#fdf4ff", borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1.5, borderColor: "#e9d5ff" },
  caWatchHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  caWatchTitle: { fontSize: 15, fontWeight: "800", color: "#7c3aed" },
  caWatchSub: { fontSize: 11, color: "#9ca3af", flex: 1 },
  caWatchRow: { flexDirection: "row", marginBottom: 10 },
  caWatchStat: { flex: 1, alignItems: "center", paddingVertical: 4 },
  caWatchStatValue: { fontSize: 22, fontWeight: "800", color: "#7c3aed" },
  caWatchStatLabel: { fontSize: 11, color: "#9ca3af", marginTop: 2 },
  caWatchAlert: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fef2f2", borderRadius: 8, padding: 8, borderWidth: 1, borderColor: "#fecaca" },
  caWatchAlertText: { fontSize: 12, color: "#dc2626", fontWeight: "600", flex: 1 },
  quickActions: { flexDirection: "row", gap: 8, marginBottom: 12 },
  quickBtn: { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 10, alignItems: "center", gap: 4, borderWidth: 1, borderColor: "#e5e7eb" },
  quickBtnText: { fontSize: 11, fontWeight: "600", color: Colors.primary, textAlign: "center" },
  reminderRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  reminderBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: "#e5e7eb", backgroundColor: "#fff" },
  reminderBtnText: { fontSize: 12, fontWeight: "600", color: Colors.primary },
  addPeriodBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#eff6ff", borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "#bfdbfe", borderStyle: "dashed" },
  addPeriodText: { fontSize: 14, fontWeight: "600", color: Colors.primary },
  monthBlock: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#e5e7eb" },
  monthBlockCurrent: { borderColor: Colors.primary, borderWidth: 2 },
  monthHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  monthName: { fontSize: 16, fontWeight: "700", color: "#111827" },
  currentTag: { color: Colors.primary, fontWeight: "600" },
  monthStats: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  removeBtn: { padding: 4, backgroundColor: "#f3f4f6", borderRadius: 8 },
  returnRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  returnIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  returnInfo: { flex: 1 },
  returnName: { fontSize: 14, fontWeight: "700", color: "#111827" },
  returnDue: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  returnDesc: { fontSize: 11, color: "#9ca3af", marginTop: 1, lineHeight: 15 },
  filedByLabel: { fontSize: 11, color: "#7c3aed", marginTop: 3, fontWeight: "600" },
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
  modalTitle: { fontSize: 18, fontWeight: "700", textAlign: "center", marginBottom: 6, color: "#111827" },
  modalSub: { fontSize: 13, color: "#6b7280", textAlign: "center", marginBottom: 20 },
  filedByOptions: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center", marginBottom: 20 },
  filedByOption: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5, borderColor: "#e5e7eb", backgroundColor: "#f9fafb" },
  filedByOptionActive: { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },
  filedByOptionText: { fontSize: 14, fontWeight: "600", color: "#374151" },
  confirmBtn: { backgroundColor: "#16a34a", borderRadius: 12, padding: 14, alignItems: "center", marginBottom: 10 },
  confirmBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  cancelBtn: { alignItems: "center", padding: 10 },
  cancelBtnText: { color: "#9ca3af", fontSize: 14 },
  yearRow: { flexDirection: "row", justifyContent: "center", gap: 12, marginBottom: 20 },
  yearBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#e5e7eb" },
  yearBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  yearBtnText: { fontSize: 14, color: "#374151" },
  yearBtnTextActive: { color: "#fff", fontWeight: "700" },
  monthGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  monthItem: { width: "22%", paddingVertical: 12, alignItems: "center", borderRadius: 10, borderWidth: 1, borderColor: "#e5e7eb" },
  monthItemAdded: { backgroundColor: "#f0fdf4", borderColor: "#16a34a" },
  monthItemText: { fontSize: 13, color: "#374151" },
  monthItemAddedText: { fontSize: 11, color: "#16a34a", fontWeight: "700" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 12, borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  infoName: { fontSize: 15, fontWeight: "700", color: "#111827" },
  infoDesc: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  infoDue: { fontSize: 12, fontWeight: "600", color: Colors.primary, textAlign: "right" },
  modalClose: { backgroundColor: Colors.primary, borderRadius: 12, padding: 14, marginTop: 20, alignItems: "center" },
  modalCloseText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});