import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useGST } from "@/contexts/GSTContext";
import Colors from "@/constants/colors";

function formatINR(n: number) {
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export default function GSTSummary() {
  const { purchases, sales } = useGST();

  const purchaseGST = purchases.reduce((sum, p) => sum + (p.gstAmount || 0), 0);
  const salesGST = sales.reduce((sum, s) => sum + (s.gstAmount || 0), 0);

  const netGST = salesGST - purchaseGST;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>GST Summary</Text>

      <View style={styles.row}>
        <Text style={styles.label}>Sales GST</Text>
        <Text style={styles.value}>{formatINR(salesGST)}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Purchase GST</Text>
        <Text style={styles.value}>{formatINR(purchaseGST)}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.row}>
        <Text style={styles.netLabel}>Net GST Payable</Text>
        <Text style={styles.netValue}>{formatINR(netGST)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
    color: Colors.textPrimary,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  value: {
    fontSize: 13,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: "#eee",
    marginVertical: 8,
  },
  netLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  netValue: {
    fontSize: 14,
    fontWeight: "700",
  },
});