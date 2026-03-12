import GSTSummary from "../../../components/GSTSummary";
import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useGST, getMonthKey, getMonthLabel } from "@/contexts/GSTContext";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

function formatINR(n: number) {
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function getTodayLabel() {
  return new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { profile, purchases, sales, gstr2bEntries } = useGST();
  const topPad = Platform.OS === "web" ? insets.top + 67 : insets.top;

  // Today's stats
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, "0");
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const yyyy = today.getFullYear();
  const todayStr = `${dd}/${mm}/${yyyy}`;

  const todayPurchases = purchases.filter((p) => p.invoiceDate === todayStr);
  const todaySales = sales.filter((s) => s.invoiceDate === todayStr);
  const todayPurchaseTotal = todayPurchases.reduce((s, p) => s + p.totalAmount, 0);
  const todaySaleTotal = todaySales.reduce((s, p) => s + p.totalAmount, 0);

  // Current month stats
  const currentMonthKey = `${yyyy}-${mm}`;
  const monthPurchases = purchases.filter((p) => getMonthKey(p.invoiceDate) === currentMonthKey);
  const monthSales = sales.filter((s) => getMonthKey(s.invoiceDate) === currentMonthKey);
  const monthPurchaseTotal = monthPurchases.reduce((s, p) => s + p.totalAmount, 0);
  const monthSaleTotal = monthSales.reduce((s, p) => s + p.totalAmount, 0);

  const totalITC = gstr2bEntries.reduce((s, g) => s + g.totalITC, 0);

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const msg = `*CheckMyGST Report*\n${profile?.businessName || "My Business"}\n${getTodayLabel()}\n\nToday:\n• Purchases: ${formatINR(todayPurchaseTotal)}\n• Sales: ${formatINR(todaySaleTotal)}\n\nThis Month:\n• Purchases: ${formatINR(monthPurchaseTotal)}\n• Sales: ${formatINR(monthSaleTotal)}\n\nITC Available: ${formatINR(totalITC)}\n\nGenerated via CheckMyGST`;
    Share.share({ message: msg });
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>CheckMyGST</Text>
          {profile?.businessName ? (
            <Text style={styles.subtitle}>{profile.businessName}</Text>
          ) : (
            <TouchableOpacity onPress={() => router.push("/profile/edit")}>
              <Text style={styles.setupText}>Set up business profile →</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/search"); }}
          >
            <Ionicons name="search" size={20} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={handleShare}>
            <Ionicons name="share-outline" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.scroll, Platform.OS === "web" && { paddingBottom: 34 + 84 }]}
      >
        <GSTSummary />
        
        {/* Today Card */}
        <LinearGradient colors={["#0A1628", "#0D7377"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.todayCard}>
          <View style={styles.todayHeader}>
            <View style={styles.todayDateBadge}>
              <Ionicons name="calendar" size={13} color="rgba(255,255,255,0.8)" />
              <Text style={styles.todayDateText}>{getTodayLabel()}</Text>
            </View>
            <Text style={styles.todayHeading}>Today</Text>
          </View>
          <View style={styles.todayRow}>
            <View style={styles.todayStat}>
              <Text style={styles.todayStatLabel}>Purchases</Text>
              <Text style={styles.todayStatValue}>{formatINR(todayPurchaseTotal)}</Text>
              <Text style={styles.todayStatCount}>{todayPurchases.length} invoices</Text>
            </View>
            <View style={styles.todayDivider} />
            <View style={styles.todayStat}>
              <Text style={styles.todayStatLabel}>Sales</Text>
              <Text style={styles.todayStatValue}>{formatINR(todaySaleTotal)}</Text>
              <Text style={styles.todayStatCount}>{todaySales.length} invoices</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Monthly Summary */}
        <Text style={styles.sectionTitle}>
          {getMonthLabel(currentMonthKey)}
        </Text>
        <View style={styles.monthGrid}>
          <View style={[styles.monthCard, { borderLeftColor: Colors.primary }]}>
            <Text style={styles.monthCardLabel}>Total Purchases</Text>
            <Text style={[styles.monthCardValue, { color: Colors.primary }]}>{formatINR(monthPurchaseTotal)}</Text>
            <Text style={styles.monthCardSub}>{monthPurchases.length} invoices</Text>
          </View>
          <View style={[styles.monthCard, { borderLeftColor: Colors.success }]}>
            <Text style={styles.monthCardLabel}>Total Sales</Text>
            <Text style={[styles.monthCardValue, { color: Colors.success }]}>{formatINR(monthSaleTotal)}</Text>
            <Text style={styles.monthCardSub}>{monthSales.length} invoices</Text>
          </View>
          <View style={[styles.monthCard, { borderLeftColor: Colors.warning }]}>
            <Text style={styles.monthCardLabel}>ITC Available</Text>
            <Text style={[styles.monthCardValue, { color: Colors.warning }]}>{formatINR(totalITC)}</Text>
            <Text style={styles.monthCardSub}>{gstr2bEntries.length} entries</Text>
          </View>
          <View style={[styles.monthCard, { borderLeftColor: "#8B5CF6" }]}>
            <Text style={styles.monthCardLabel}>Net GST</Text>
            <Text style={[styles.monthCardValue, { color: "#8B5CF6" }]}>
              {formatINR(
                monthSales.reduce((s, p) => s + p.gstAmount, 0) -
                monthPurchases.reduce((s, p) => s + p.gstAmount, 0)
              )}
            </Text>
            <Text style={styles.monthCardSub}>Sales - Purchases GST</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {[
            { label: "Add Purchase", icon: "download-outline" as const, color: "#EFF6FF", iconColor: Colors.primary, route: "/purchase/add" },
            { label: "Add Sale", icon: "cloud-upload-outline" as const, color: "#F0FDF4", iconColor: Colors.success, route: "/sale/add" },
            { label: "Upload GSTR-2B", icon: "cloud-upload-outline" as const, color: "#FFF7ED", iconColor: Colors.warning, route: "/gstr2b/upload" },
            { label: "Reconcile GST", icon: "git-compare-outline" as const, color: "#FFF1F2", iconColor: Colors.danger, route: "/(tabs)/reconciliation" },
          ].map((a) => (
            <TouchableOpacity
              key={a.label}
              style={styles.actionCard}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(a.route as any); }}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIcon, { backgroundColor: a.color }]}>
                <Ionicons name={a.icon} size={22} color={a.iconColor} />
              </View>
              <Text style={styles.actionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: 20, paddingVertical: 12 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", color: Colors.textPrimary },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2 },
  setupText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.primary, marginTop: 2 },
  headerActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  headerBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.surface, justifyContent: "center", alignItems: "center", shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 3, elevation: 2 },
  scroll: { paddingHorizontal: 16, paddingBottom: 120 },
  todayCard: { borderRadius: 20, padding: 22, marginBottom: 24 },
  todayHeader: { marginBottom: 18 },
  todayDateBadge: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 6 },
  todayDateText: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)" },
  todayHeading: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff" },
  todayRow: { flexDirection: "row", backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 14, padding: 16 },
  todayStat: { flex: 1, alignItems: "center" },
  todayStatLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)", marginBottom: 4 },
  todayStatValue: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff" },
  todayStatCount: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)", marginTop: 2 },
  todayDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.2)", marginHorizontal: 8 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.textPrimary, marginBottom: 12 },
  monthGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
  monthCard: { width: "47%", backgroundColor: Colors.surface, borderRadius: 14, padding: 14, borderLeftWidth: 4, shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2 },
  monthCardLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginBottom: 6 },
  monthCardValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  monthCardSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 3 },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionCard: { width: "47%", backgroundColor: Colors.surface, borderRadius: 16, padding: 16, alignItems: "center", gap: 8, shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2 },
  actionIcon: { width: 48, height: 48, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  actionLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary, textAlign: "center" },
});
