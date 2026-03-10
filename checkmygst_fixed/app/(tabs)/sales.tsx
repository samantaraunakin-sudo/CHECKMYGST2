import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, SectionList, TouchableOpacity, TextInput, Platform, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useGST, SalesInvoice, getMonthKey, getMonthLabel, parseInvoiceDate } from "@/contexts/GSTContext";
import Colors from "@/constants/colors";

function formatINR(n: number) {
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function SaleCard({ item, onDelete }: { item: SalesInvoice; onDelete: () => void }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardLeft}>
          <Text style={styles.customerName} numberOfLines={1}>{item.customerName || "—"}</Text>
          <Text style={styles.invoiceMeta}>{item.invoiceNumber} • {item.invoiceDate}</Text>
          {item.customerGSTIN ? <Text style={styles.gstin}>{item.customerGSTIN}</Text> : null}
        </View>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            Alert.alert("Delete Invoice", "Are you sure?", [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: onDelete },
            ]);
          }}
          hitSlop={8}
        >
          <Ionicons name="trash-outline" size={18} color={Colors.danger} />
        </TouchableOpacity>
      </View>
      <View style={styles.cardFooter}>
        <View>
          <Text style={styles.amtLabel}>Taxable</Text>
          <Text style={styles.amtValue}>{formatINR(item.taxableAmount)}</Text>
        </View>
        <View style={styles.rateChip}>
          <Text style={styles.rateText}>GST {item.gstRate}%</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.amtLabel}>GST Amt</Text>
          <Text style={[styles.amtValue, { color: Colors.success }]}>{formatINR(item.gstAmount)}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.amtLabel}>Total</Text>
          <Text style={[styles.amtValue, { color: Colors.textPrimary }]}>{formatINR(item.totalAmount)}</Text>
        </View>
      </View>
      {item.hsn ? <Text style={styles.hsnTag}>HSN: {item.hsn}</Text> : null}
    </View>
  );
}

export default function SalesScreen() {
  const insets = useSafeAreaInsets();
  const { sales, deleteSale } = useGST();
  const [search, setSearch] = useState("");
  const topPad = Platform.OS === "web" ? insets.top + 67 : insets.top;

  const filtered = useMemo(() => {
    if (!search.trim()) return sales;
    const q = search.toLowerCase();
    return sales.filter(
      (s) =>
        s.customerName.toLowerCase().includes(q) ||
        s.invoiceNumber.toLowerCase().includes(q) ||
        s.customerGSTIN.toLowerCase().includes(q) ||
        s.hsn.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
    );
  }, [sales, search]);

  const sections = useMemo(() => {
    const monthMap = new Map<string, SalesInvoice[]>();
    for (const s of filtered) {
      const key = getMonthKey(s.invoiceDate);
      if (!monthMap.has(key)) monthMap.set(key, []);
      monthMap.get(key)!.push(s);
    }
    return Array.from(monthMap.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, data]) => {
        const sorted = [...data].sort((a, b) => {
          try {
            return parseInvoiceDate(b.invoiceDate).getTime() - parseInvoiceDate(a.invoiceDate).getTime();
          } catch { return 0; }
        });
        const total = data.reduce((s, p) => s + p.totalAmount, 0);
        const gstTotal = data.reduce((s, p) => s + p.gstAmount, 0);
        return {
          title: getMonthLabel(key),
          totalAmount: total,
          gstTotal,
          count: data.length,
          data: sorted,
        };
      });
  }, [filtered]);

  const grandTotal = sales.reduce((s, p) => s + p.totalAmount, 0);
  const grandGST = sales.reduce((s, p) => s + p.gstAmount, 0);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sales</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/sale/add"); }}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {sales.length > 0 && (
        <View style={styles.totalsBanner}>
          <View style={styles.totalItem}>
            <Text style={styles.totalLabel}>All Time Total</Text>
            <Text style={[styles.totalValue, { color: Colors.success }]}>{formatINR(grandTotal)}</Text>
          </View>
          <View style={styles.totalDivider} />
          <View style={styles.totalItem}>
            <Text style={styles.totalLabel}>Total GST Collected</Text>
            <Text style={[styles.totalValue, { color: Colors.warning }]}>{formatINR(grandGST)}</Text>
          </View>
          <View style={styles.totalDivider} />
          <View style={styles.totalItem}>
            <Text style={styles.totalLabel}>Invoices</Text>
            <Text style={styles.totalValue}>{sales.length}</Text>
          </View>
        </View>
      )}

      <View style={styles.searchBox}>
        <Ionicons name="search" size={17} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search customer, invoice, GSTIN, HSN..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
            <Ionicons name="close-circle" size={17} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, Platform.OS === "web" && { paddingBottom: 34 + 84 }]}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionMonth}>{section.title}</Text>
            <Text style={styles.sectionTotalText}>{section.count} inv • GST {formatINR(section.gstTotal)} • Total {formatINR(section.totalAmount)}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <SaleCard item={item} onDelete={() => deleteSale(item.id)} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="cloud-upload-outline" size={36} color={Colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No Sales Invoices</Text>
            <Text style={styles.emptyText}>Tap + to add a sales invoice for your customers</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  headerTitle: { fontSize: 26, fontFamily: "Inter_700Bold", color: Colors.textPrimary },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.success, justifyContent: "center", alignItems: "center" },
  totalsBanner: { flexDirection: "row", backgroundColor: Colors.surface, marginHorizontal: 16, borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2 },
  totalItem: { flex: 1, alignItems: "center" },
  totalLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginBottom: 4 },
  totalValue: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.textPrimary },
  totalDivider: { width: 1, backgroundColor: Colors.border, marginHorizontal: 4 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.surface, marginHorizontal: 16, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8, shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 3, elevation: 1 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textPrimary },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  sectionHeader: { backgroundColor: Colors.background, paddingVertical: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionMonth: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.textPrimary },
  sectionTotalText: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  card: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 8, shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 5, elevation: 2 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  cardLeft: { flex: 1, marginRight: 8 },
  customerName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary },
  invoiceMeta: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2 },
  gstin: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 2 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  amtLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginBottom: 2 },
  amtValue: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.textPrimary },
  rateChip: { backgroundColor: "#F0FDF4", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  rateText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.success },
  hsnTag: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 6 },
  empty: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 40 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.surfaceAlt, justifyContent: "center", alignItems: "center", marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary, marginBottom: 8 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },
});
