import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useGST } from "@/contexts/GSTContext";
import { router } from "expo-router";
import Colors from "@/constants/colors";

function formatINR(n: number) {
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export default function GSTSummary() {
  const { purchases, sales } = useGST();
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  const currentMonthKey = `${yyyy}-${mm}`;

  const getMonthKey = (dateStr: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split("/");
    if (parts.length === 3) return `${parts[2]}-${parts[1]}`;
    return dateStr.substring(0, 7);
  };

  const monthPurchases = purchases.filter(p => getMonthKey(p.invoiceDate) === currentMonthKey);
  const monthSales = sales.filter(s => getMonthKey(s.invoiceDate) === currentMonthKey);

  const salesGST = monthSales.reduce((sum, s) => sum + (s.gstAmount || 0), 0);
  const purchaseGST = monthPurchases.reduce((sum, p) => sum + (p.gstAmount || 0), 0);
  const netGST = salesGST - purchaseGST;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push("/(tabs)/calculator")}
      activeOpacity={0.85}
    >
      <View style={styles.titleRow}>
        <Text style={styles.title}>GST Summary — This Month</Text>
        <Text style={styles.tapHint}>View Calculator →</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Output Tax (Sales)</Text>
        <Text style={[styles.value, { color: "#ef4444" }]}>{formatINR(salesGST)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>ITC (Purchases)</Text>
        <Text style={[styles.value, { color: "#22c55e" }]}>{formatINR(purchaseGST)}</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.row}>
        <Text style={styles.netLabel}>Net GST Payable</Text>
        <Text style={[styles.netValue, { color: netGST > 0 ? "#ef4444" : "#22c55e" }]}>
          {formatINR(netGST)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 20, elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { fontSize: 15, fontWeight: "700", color: Colors.textPrimary },
  tapHint: { fontSize: 12, color: Colors.primary },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  label: { fontSize: 13, color: Colors.textSecondary },
  value: { fontSize: 13, fontWeight: "600" },
  divider: { height: 1, backgroundColor: "#e5e7eb", marginVertical: 8 },
  netLabel: { fontSize: 14, fontWeight: "700", color: Colors.textPrimary },
  netValue: { fontSize: 14, fontWeight: "800" },
});
