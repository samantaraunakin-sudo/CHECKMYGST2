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

  const purchaseGST = (purchases as any[]).reduce((sum, p) => sum + (p.gstAmount || p.totalGST || 0), 0);
  const salesGST = (sales as any[]).reduce((sum, s) => sum + (s.gstAmount || s.totalGST || 0), 0);
  const netGST = salesGST - purchaseGST;

  return (
    <TouchableOpacity style={styles.card} onPress={() => router.push("/(tabs)/calculator" as any)} activeOpacity={0.85}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>GST Summary — This Month</Text>
        <Text style={styles.hint}>Details →</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Sales GST (Output)</Text>
        <Text style={[styles.value, { color: "#ef4444" }]}>{formatINR(salesGST)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Purchase GST (ITC)</Text>
        <Text style={[styles.value, { color: "#22c55e" }]}>{formatINR(purchaseGST)}</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.row}>
        <Text style={styles.netLabel}>Net GST Payable</Text>
        <Text style={[styles.netValue, { color: netGST > 0 ? "#ef4444" : "#22c55e" }]}>{formatINR(netGST)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { fontSize: 15, fontWeight: "700", color: Colors.textPrimary },
  hint: { fontSize: 12, color: Colors.primary },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  label: { fontSize: 13, color: Colors.textSecondary },
  value: { fontSize: 13, fontWeight: "600" },
  divider: { height: 1, backgroundColor: "#eee", marginVertical: 8 },
  netLabel: { fontSize: 14, fontWeight: "700", color: Colors.textPrimary },
  netValue: { fontSize: 14, fontWeight: "800" },
});
