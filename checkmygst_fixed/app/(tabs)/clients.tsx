import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useGST, SupplierSummary, CustomerSummary } from "@/contexts/GSTContext";
import Colors from "@/constants/colors";

function formatINR(n: number) {
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

const ENTITY_COLORS = [
  "#0D7377", "#6366F1", "#EC4899", "#F59E0B",
  "#10B981", "#3B82F6", "#8B5CF6", "#EF4444",
];

function getColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return ENTITY_COLORS[Math.abs(hash) % ENTITY_COLORS.length];
}

function initials(name: string) {
  return (name || "?").split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function SupplierCard({ item, onEdit }: { item: SupplierSummary; onEdit: () => void }) {
  const color = getColor(item.supplierName);
  return (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <View style={[styles.avatar, { backgroundColor: color }]}>
          <Text style={styles.avatarText}>{initials(item.supplierName)}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{item.supplierName}</Text>
          {item.supplierGSTIN ? <Text style={styles.gstin}>{item.supplierGSTIN}</Text> : null}
          <View style={styles.statsRow}>
            <Text style={styles.statText}>{item.invoiceCount} invoices</Text>
            <Text style={styles.statDot}>•</Text>
            <Text style={styles.statText}>GST {formatINR(item.totalGST)}</Text>
          </View>
        </View>
      </View>
      <View style={styles.cardRight}>
        <Text style={styles.totalAmt}>{formatINR(item.totalAmount)}</Text>
        <Text style={styles.totalLabel}>Total</Text>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onEdit(); }}
          hitSlop={8}
        >
          <Ionicons name="pencil-outline" size={16} color={Colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function CustomerCard({ item, onEdit }: { item: CustomerSummary; onEdit: () => void }) {
  const color = getColor(item.customerName);
  return (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <View style={[styles.avatar, { backgroundColor: color }]}>
          <Text style={styles.avatarText}>{initials(item.customerName)}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{item.customerName}</Text>
          {item.customerGSTIN ? <Text style={styles.gstin}>{item.customerGSTIN}</Text> : null}
          <View style={styles.statsRow}>
            <Text style={styles.statText}>{item.invoiceCount} invoices</Text>
            <Text style={styles.statDot}>•</Text>
            <Text style={[styles.statText, { color: Colors.success }]}>GST {formatINR(item.totalGST)}</Text>
          </View>
        </View>
      </View>
      <View style={styles.cardRight}>
        <Text style={[styles.totalAmt, { color: Colors.success }]}>{formatINR(item.totalAmount)}</Text>
        <Text style={styles.totalLabel}>Total</Text>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onEdit(); }}
          hitSlop={8}
        >
          <Ionicons name="pencil-outline" size={16} color={Colors.success} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ClientsScreen() {
  const insets = useSafeAreaInsets();
  const { getSuppliers, getCustomers, purchases, sales } = useGST();
  const [tab, setTab] = useState<"suppliers" | "customers">("suppliers");
  const topPad = Platform.OS === "web" ? insets.top + 67 : insets.top;

  const suppliers = getSuppliers();
  const customers = getCustomers();

  const supplierTotalGST = suppliers.reduce((s, x) => s + x.totalGST, 0);
  const supplierTotalAmt = suppliers.reduce((s, x) => s + x.totalAmount, 0);
  const customerTotalGST = customers.reduce((s, x) => s + x.totalGST, 0);
  const customerTotalAmt = customers.reduce((s, x) => s + x.totalAmount, 0);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Clients</Text>
        <TouchableOpacity
          style={styles.profileBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/profile/edit"); }}
          hitSlop={8}
        >
          <Ionicons name="settings-outline" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Segmented Control */}
      <View style={styles.segmentedControl}>
        <TouchableOpacity
          style={[styles.segment, tab === "suppliers" && styles.segmentActive]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTab("suppliers"); }}
        >
          <Ionicons name="cloud-download-outline" size={15} color={tab === "suppliers" ? "#fff" : Colors.textSecondary} />
          <Text style={[styles.segmentText, tab === "suppliers" && styles.segmentTextActive]}>
            Suppliers ({suppliers.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, tab === "customers" && styles.segmentActiveGreen]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTab("customers"); }}
        >
          <Ionicons name="cloud-upload-outline" size={15} color={tab === "customers" ? "#fff" : Colors.textSecondary} />
          <Text style={[styles.segmentText, tab === "customers" && styles.segmentTextActive]}>
            Customers ({customers.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Summary */}
      {tab === "suppliers" && suppliers.length > 0 && (
        <View style={styles.summaryBanner}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Suppliers</Text>
            <Text style={styles.summaryValue}>{suppliers.length}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total GST Paid</Text>
            <Text style={[styles.summaryValue, { color: Colors.primary }]}>{formatINR(supplierTotalGST)}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Purchases</Text>
            <Text style={styles.summaryValue}>{formatINR(supplierTotalAmt)}</Text>
          </View>
        </View>
      )}
      {tab === "customers" && customers.length > 0 && (
        <View style={styles.summaryBanner}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Customers</Text>
            <Text style={styles.summaryValue}>{customers.length}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total GST Collected</Text>
            <Text style={[styles.summaryValue, { color: Colors.success }]}>{formatINR(customerTotalGST)}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Sales</Text>
            <Text style={styles.summaryValue}>{formatINR(customerTotalAmt)}</Text>
          </View>
        </View>
      )}

      {tab === "suppliers" ? (
        <FlatList
          data={suppliers}
          keyExtractor={(item) => item.supplierGSTIN || item.supplierName}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.listContent, Platform.OS === "web" && { paddingBottom: 34 + 84 }]}
          renderItem={({ item }) => (
            <SupplierCard
              item={item}
              onEdit={() => router.push({
                pathname: "/supplier/edit",
                params: {
                  key: item.supplierGSTIN || item.supplierName,
                  supplierName: item.supplierName,
                  supplierGSTIN: item.supplierGSTIN,
                },
              })}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="business-outline" size={36} color={Colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No Suppliers Yet</Text>
              <Text style={styles.emptyText}>Add purchase invoices to see your suppliers here</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push("/purchase/add")}>
                <Text style={styles.emptyBtnText}>Add Purchase</Text>
              </TouchableOpacity>
            </View>
          }
        />
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(item) => item.customerGSTIN || item.customerName}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.listContent, Platform.OS === "web" && { paddingBottom: 34 + 84 }]}
          renderItem={({ item }) => (
            <CustomerCard
              item={item}
              onEdit={() => router.push({
                pathname: "/customer/edit",
                params: {
                  key: item.customerGSTIN || item.customerName,
                  customerName: item.customerName,
                  customerGSTIN: item.customerGSTIN,
                },
              })}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="people-outline" size={36} color={Colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No Customers Yet</Text>
              <Text style={styles.emptyText}>Add sales invoices to see your customers here</Text>
              <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: Colors.success }]} onPress={() => router.push("/sale/add")}>
                <Text style={styles.emptyBtnText}>Add Sale</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  headerTitle: { fontSize: 26, fontFamily: "Inter_700Bold", color: Colors.textPrimary },
  profileBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.surface, justifyContent: "center", alignItems: "center" },
  segmentedControl: { flexDirection: "row", marginHorizontal: 16, marginBottom: 12, backgroundColor: Colors.surfaceAlt, borderRadius: 12, padding: 4, gap: 4 },
  segment: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10 },
  segmentActive: { backgroundColor: Colors.primary },
  segmentActiveGreen: { backgroundColor: Colors.success },
  segmentText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
  segmentTextActive: { color: "#fff" },
  summaryBanner: { flexDirection: "row", backgroundColor: Colors.surface, marginHorizontal: 16, borderRadius: 12, padding: 12, marginBottom: 8, shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 3, elevation: 1 },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginBottom: 3 },
  summaryValue: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.textPrimary },
  summaryDivider: { width: 1, backgroundColor: Colors.border, marginHorizontal: 4 },
  listContent: { paddingHorizontal: 16, paddingBottom: 100, gap: 8 },
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center", shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 5, elevation: 2 },
  cardLeft: { flex: 1, flexDirection: "row", gap: 12, alignItems: "center" },
  avatar: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  avatarText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },
  info: { flex: 1 },
  name: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary },
  gstin: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 2 },
  statsRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  statText: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  statDot: { fontSize: 11, color: Colors.textMuted },
  cardRight: { alignItems: "flex-end", gap: 2 },
  totalAmt: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.primary },
  totalLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  editBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.surfaceAlt, justifyContent: "center", alignItems: "center", marginTop: 4 },
  empty: { alignItems: "center", paddingTop: 60, paddingHorizontal: 40 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.surfaceAlt, justifyContent: "center", alignItems: "center", marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary, marginBottom: 8 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center", lineHeight: 20, marginBottom: 20 },
  emptyBtn: { backgroundColor: Colors.primary, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  emptyBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
