import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useGST } from "@/contexts/GSTContext";
import Colors from "@/constants/colors";

function formatINR(n: number) {
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

type SearchResult = {
  id: string;
  type: "purchase" | "sale";
  title: string;
  subtitle: string;
  meta: string;
  amount: number;
  gstAmount: number;
  date: string;
};

const FILTERS = ["All", "Purchases", "Sales"] as const;
type Filter = typeof FILTERS[number];

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { purchases, sales } = useGST();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("All");

  const topPad = Platform.OS === "web" ? insets.top + 67 : insets.top;

  const results = useMemo<SearchResult[]>(() => {
    const q = query.toLowerCase().trim();
    if (!q) return [];

    const out: SearchResult[] = [];

    if (filter !== "Sales") {
      for (const p of purchases) {
        if (
          p.supplierName.toLowerCase().includes(q) ||
          p.invoiceNumber.toLowerCase().includes(q) ||
          p.supplierGSTIN.toLowerCase().includes(q) ||
          p.hsn.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
        ) {
          out.push({
            id: p.id,
            type: "purchase",
            title: p.supplierName || "Unknown Supplier",
            subtitle: `Invoice: ${p.invoiceNumber}`,
            meta: p.supplierGSTIN || p.hsn ? `GSTIN: ${p.supplierGSTIN || "—"}${p.hsn ? ` • HSN: ${p.hsn}` : ""}` : "",
            amount: p.totalAmount,
            gstAmount: p.gstAmount,
            date: p.invoiceDate,
          });
        }
      }
    }

    if (filter !== "Purchases") {
      for (const s of sales) {
        if (
          s.customerName.toLowerCase().includes(q) ||
          s.invoiceNumber.toLowerCase().includes(q) ||
          s.customerGSTIN.toLowerCase().includes(q) ||
          s.hsn.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q)
        ) {
          out.push({
            id: s.id,
            type: "sale",
            title: s.customerName || "Unknown Customer",
            subtitle: `Invoice: ${s.invoiceNumber}`,
            meta: s.customerGSTIN || s.hsn ? `GSTIN: ${s.customerGSTIN || "—"}${s.hsn ? ` • HSN: ${s.hsn}` : ""}` : "",
            amount: s.totalAmount,
            gstAmount: s.gstAmount,
            date: s.invoiceDate,
          });
        }
      }
    }

    return out.sort((a, b) => b.date.localeCompare(a.date));
  }, [query, filter, purchases, sales]);

  const purchaseCount = results.filter((r) => r.type === "purchase").length;
  const saleCount = results.filter((r) => r.type === "sale").length;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={17} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Supplier, customer, GSTIN, HSN, invoice..."
            placeholderTextColor={Colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")} hitSlop={8}>
              <Ionicons name="close-circle" size={17} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {query.length === 0 ? (
        <View style={styles.placeholder}>
          <View style={styles.placeholderIcon}>
            <Ionicons name="search" size={40} color={Colors.textMuted} />
          </View>
          <Text style={styles.placeholderTitle}>Search Records</Text>
          <Text style={styles.placeholderText}>
            Search by supplier or customer name, GSTIN, invoice number, or HSN/SAC code
          </Text>
          <View style={styles.tipRow}>
            <Text style={styles.tipItem}>Supplier names</Text>
            <Text style={styles.tipItem}>GSTIN numbers</Text>
            <Text style={styles.tipItem}>Invoice numbers</Text>
            <Text style={styles.tipItem}>HSN codes</Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.listContent, Platform.OS === "web" && { paddingBottom: 34 }]}
          ListHeaderComponent={
            results.length > 0 ? (
              <Text style={styles.resultCount}>
                {results.length} result{results.length !== 1 ? "s" : ""}
                {purchaseCount > 0 && saleCount > 0 ? ` (${purchaseCount} purchases, ${saleCount} sales)` : ""}
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <View style={[styles.resultCard, { borderLeftColor: item.type === "purchase" ? Colors.primary : Colors.success }]}>
              <View style={styles.resultTop}>
                <View style={[styles.typeBadge, { backgroundColor: item.type === "purchase" ? "#EFF6FF" : "#F0FDF4" }]}>
                  <Ionicons
                    name={item.type === "purchase" ? "download-outline" : "cloud-upload-outline"}
                    size={13}
                    color={item.type === "purchase" ? Colors.primary : Colors.success}
                  />
                  <Text style={[styles.typeText, { color: item.type === "purchase" ? Colors.primary : Colors.success }]}>
                    {item.type === "purchase" ? "Purchase" : "Sale"}
                  </Text>
                </View>
                <Text style={styles.resultDate}>{item.date}</Text>
              </View>
              <Text style={styles.resultTitle}>{item.title}</Text>
              <Text style={styles.resultSubtitle}>{item.subtitle}</Text>
              {item.meta ? <Text style={styles.resultMeta}>{item.meta}</Text> : null}
              <View style={styles.resultAmounts}>
                <Text style={styles.resultGST}>GST {formatINR(item.gstAmount)}</Text>
                <Text style={[styles.resultTotal, { color: item.type === "purchase" ? Colors.primary : Colors.success }]}>
                  Total {formatINR(item.amount)}
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={40} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No results for "{query}"</Text>
              <Text style={styles.emptyText}>Try different keywords or check your spelling</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  searchBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.surfaceAlt, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.textPrimary },
  filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  filterTextActive: { color: "#fff" },
  placeholder: { flex: 1, alignItems: "center", paddingTop: 60, paddingHorizontal: 40 },
  placeholderIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.surfaceAlt, justifyContent: "center", alignItems: "center", marginBottom: 16 },
  placeholderTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.textPrimary, marginBottom: 8 },
  placeholderText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center", lineHeight: 20, marginBottom: 24 },
  tipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  tipItem: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.primary, backgroundColor: "#EFF6FF", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  listContent: { paddingHorizontal: 16, paddingBottom: 100, paddingTop: 4, gap: 8 },
  resultCount: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, paddingBottom: 8 },
  resultCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, borderLeftWidth: 4, shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2 },
  resultTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  typeBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  typeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  resultDate: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  resultTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary },
  resultSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2 },
  resultMeta: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 3 },
  resultAmounts: { flexDirection: "row", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  resultGST: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  resultTotal: { fontSize: 14, fontFamily: "Inter_700Bold" },
  empty: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
});
