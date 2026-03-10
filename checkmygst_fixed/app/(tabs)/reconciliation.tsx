import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Platform, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useGST, ReconciliationStatus, ReconciliationResult } from "@/contexts/GSTContext";
import Colors from "@/constants/colors";

function formatINR(n: number) {
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

const STATUS_CONFIG = {
  matched: { label: "Matched", bg: "#D1FAE5", text: "#065F46", icon: "checkmark-circle" as const, iconColor: "#059669" },
  amount_mismatch: { label: "Amount Mismatch", bg: "#FEF3C7", text: "#92400E", icon: "warning" as const, iconColor: "#D97706" },
  missing_from_register: { label: "Missing in Register", bg: "#FEE2E2", text: "#7F1D1D", icon: "close-circle" as const, iconColor: "#DC2626" },
  supplier_not_filed: { label: "Supplier Not Filed", bg: "#FEE2E2", text: "#7F1D1D", icon: "time" as const, iconColor: "#DC2626" },
};

const FILTERS: { key: ReconciliationStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "matched", label: "Matched" },
  { key: "amount_mismatch", label: "Mismatch" },
  { key: "supplier_not_filed", label: "Not Filed" },
  { key: "missing_from_register", label: "Missing" },
];

const RISK_CONFIG = {
  green: { colors: ["#065F46", "#059669"] as [string, string], icon: "checkmark-circle" as const, label: "Safe to File GST", sub: "All records match. No issues found." },
  yellow: { colors: ["#92400E", "#D97706"] as [string, string], icon: "warning" as const, label: "Review Before Filing", sub: "Some amount mismatches found. Check before filing." },
  red: { colors: ["#7F1D1D", "#DC2626"] as [string, string], icon: "close-circle" as const, label: "Do Not File Yet", sub: "Critical issues detected. Resolve them first." },
};

export default function ReconciliationScreen() {
  const insets = useSafeAreaInsets();
  const { purchases, gstr2bEntries, getReconciliation, getRiskLevel, getITCSummary } = useGST();
  const [filter, setFilter] = useState<ReconciliationStatus | "all">("all");
  const [isReconciling, setIsReconciling] = useState(false);
  const [results, setResults] = useState<ReconciliationResult[] | null>(null);

  const topPad = Platform.OS === "web" ? insets.top + 67 : insets.top;

  const hasPurchases = purchases.length > 0;
  const hasGSTR2B = gstr2bEntries.length > 0;

  const handleReconcile = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsReconciling(true);
    // Slight delay for visual feedback
    setTimeout(() => {
      const r = getReconciliation();
      setResults(r);
      setIsReconciling(false);
    }, 800);
  };

  const riskLevel = results ? getRiskLevel(results) : "green";
  const itc = results ? getITCSummary(results) : null;
  const riskConfig = RISK_CONFIG[riskLevel];

  const filtered = results
    ? (filter === "all" ? results : results.filter((r) => r.status === filter))
    : [];

  const counts = results
    ? {
        all: results.length,
        matched: results.filter((r) => r.status === "matched").length,
        amount_mismatch: results.filter((r) => r.status === "amount_mismatch").length,
        supplier_not_filed: results.filter((r) => r.status === "supplier_not_filed").length,
        missing_from_register: results.filter((r) => r.status === "missing_from_register").length,
      }
    : { all: 0, matched: 0, amount_mismatch: 0, supplier_not_filed: 0, missing_from_register: 0 };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reconciliation</Text>
        {results && (
          <TouchableOpacity style={styles.rerunBtn} onPress={handleReconcile} disabled={isReconciling}>
            <Ionicons name="refresh" size={16} color={Colors.primary} />
            <Text style={styles.rerunText}>Re-run</Text>
          </TouchableOpacity>
        )}
      </View>

      {!results ? (
        // Pre-reconcile state
        <View style={styles.preState}>
          <View style={styles.checklistCard}>
            <Text style={styles.checklistTitle}>Before Reconciling</Text>
            <View style={styles.checkItem}>
              <Ionicons name={hasPurchases ? "checkmark-circle" : "ellipse-outline"} size={20} color={hasPurchases ? Colors.success : Colors.textMuted} />
              <View style={styles.checkText}>
                <Text style={[styles.checkLabel, !hasPurchases && { color: Colors.textMuted }]}>Purchase Register</Text>
                <Text style={styles.checkSub}>{hasPurchases ? `${purchases.length} invoices added` : "Add purchase invoices first"}</Text>
              </View>
              {!hasPurchases && (
                <TouchableOpacity onPress={() => router.push("/purchase/add")}>
                  <Text style={styles.checkAction}>Add</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.checkItem}>
              <Ionicons name={hasGSTR2B ? "checkmark-circle" : "ellipse-outline"} size={20} color={hasGSTR2B ? Colors.success : Colors.textMuted} />
              <View style={styles.checkText}>
                <Text style={[styles.checkLabel, !hasGSTR2B && { color: Colors.textMuted }]}>GSTR-2B Data</Text>
                <Text style={styles.checkSub}>{hasGSTR2B ? `${gstr2bEntries.length} entries uploaded` : "Upload GSTR-2B data first"}</Text>
              </View>
              {!hasGSTR2B && (
                <TouchableOpacity onPress={() => router.push("/gstr2b/upload")}>
                  <Text style={styles.checkAction}>Upload</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.reconcileBtn, (!hasPurchases || !hasGSTR2B) && styles.reconcileBtnDisabled]}
            onPress={handleReconcile}
            disabled={isReconciling || !hasPurchases || !hasGSTR2B}
            activeOpacity={0.8}
          >
            {isReconciling ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.reconcileBtnText}>Reconciling...</Text>
              </>
            ) : (
              <>
                <Ionicons name="git-compare" size={20} color="#fff" />
                <Text style={styles.reconcileBtnText}>Run Reconciliation</Text>
              </>
            )}
          </TouchableOpacity>

          {(!hasPurchases || !hasGSTR2B) && (
            <Text style={styles.requirementText}>
              Add purchase invoices and upload GSTR-2B data to enable reconciliation
            </Text>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.listContent, Platform.OS === "web" && { paddingBottom: 34 + 84 }]}
          ListHeaderComponent={
            <>
              {/* Risk Card */}
              <LinearGradient colors={riskConfig.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.riskCard}>
                <View style={styles.riskTop}>
                  <Ionicons name={riskConfig.icon} size={28} color="#fff" />
                  <Text style={styles.riskLabel}>{riskConfig.label}</Text>
                </View>
                <Text style={styles.riskSub}>{riskConfig.sub}</Text>
                {itc && (
                  <View style={styles.itcRow}>
                    <View style={styles.itcItem}><Text style={styles.itcLabel}>Available</Text><Text style={styles.itcValue}>{formatINR(itc.totalITCAvailable)}</Text></View>
                    <View style={styles.itcItem}><Text style={styles.itcLabel}>Matched</Text><Text style={styles.itcValue}>{formatINR(itc.itcMatched)}</Text></View>
                    <View style={styles.itcItem}><Text style={styles.itcLabel}>At Risk</Text><Text style={[styles.itcValue, { color: "#FCA5A5" }]}>{formatINR(itc.itcAtRisk)}</Text></View>
                    <View style={styles.itcItem}><Text style={styles.itcLabel}>Recoverable</Text><Text style={[styles.itcValue, { color: "#FDE68A" }]}>{formatINR(itc.itcRecoverable)}</Text></View>
                  </View>
                )}
              </LinearGradient>

              {/* Filters */}
              <View style={styles.filterRow}>
                {FILTERS.map((f) => (
                  <TouchableOpacity
                    key={f.key}
                    style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setFilter(f.key); }}
                  >
                    <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
                      {f.label}{counts[f.key] > 0 ? ` (${counts[f.key]})` : ""}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          }
          renderItem={({ item }) => {
            const sc = STATUS_CONFIG[item.status];
            return (
              <View style={styles.recCard}>
                <View style={styles.recTop}>
                  <Ionicons name={sc.icon} size={20} color={sc.iconColor} />
                  <View style={styles.recInfo}>
                    <Text style={styles.recSupplier} numberOfLines={1}>{item.supplierName || "Unknown"}</Text>
                    <Text style={styles.recInvoice}>{item.invoiceNumber} • {item.invoiceDate}</Text>
                    {item.supplierGSTIN ? <Text style={styles.recGSTIN}>{item.supplierGSTIN}</Text> : null}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.statusText, { color: sc.text }]}>{sc.label}</Text>
                  </View>
                </View>
                {(item.purchaseAmount !== undefined || item.gstr2bAmount !== undefined) && (
                  <View style={styles.amountsRow}>
                    {item.purchaseAmount !== undefined && (
                      <View style={styles.amtBox}><Text style={styles.amtBoxLabel}>Purchase ITC</Text><Text style={styles.amtBoxValue}>{formatINR(item.purchaseAmount)}</Text></View>
                    )}
                    {item.gstr2bAmount !== undefined && (
                      <View style={styles.amtBox}><Text style={styles.amtBoxLabel}>GSTR-2B ITC</Text><Text style={styles.amtBoxValue}>{formatINR(item.gstr2bAmount)}</Text></View>
                    )}
                    {item.difference !== undefined && item.difference > 0 && (
                      <View style={styles.amtBox}><Text style={styles.amtBoxLabel}>Difference</Text><Text style={[styles.amtBoxValue, { color: Colors.warning }]}>{formatINR(item.difference)}</Text></View>
                    )}
                  </View>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.filterEmpty}>
              <Ionicons name="checkmark-circle-outline" size={32} color={Colors.success} />
              <Text style={styles.filterEmptyText}>No records for this filter</Text>
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
  rerunBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: "#EFF6FF" },
  rerunText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.primary },
  preState: { flex: 1, paddingHorizontal: 16 },
  checklistCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 20, marginBottom: 20, gap: 16, shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2 },
  checklistTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.textPrimary, marginBottom: 4 },
  checkItem: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  checkText: { flex: 1 },
  checkLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary },
  checkSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2 },
  checkAction: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.primary, paddingTop: 2 },
  reconcileBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  reconcileBtnDisabled: { backgroundColor: Colors.textMuted },
  reconcileBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  requirementText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center", marginTop: 14, lineHeight: 18 },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  riskCard: { borderRadius: 18, padding: 20, marginBottom: 16 },
  riskTop: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  riskLabel: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff" },
  riskSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)", marginBottom: 16 },
  itcRow: { flexDirection: "row", backgroundColor: "rgba(0,0,0,0.15)", borderRadius: 12, padding: 12 },
  itcItem: { flex: 1, alignItems: "center" },
  itcLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)" },
  itcValue: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff", marginTop: 3 },
  filterRow: { flexDirection: "row", gap: 6, marginBottom: 12, flexWrap: "wrap" },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  filterTextActive: { color: "#fff" },
  recCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 8, shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 5, elevation: 2 },
  recTop: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  recInfo: { flex: 1 },
  recSupplier: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary },
  recInvoice: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2 },
  recGSTIN: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 2 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: "flex-start" },
  statusText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  amountsRow: { flexDirection: "row", gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  amtBox: { flex: 1 },
  amtBoxLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  amtBoxValue: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.textPrimary, marginTop: 2 },
  filterEmpty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  filterEmptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
});
