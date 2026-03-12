import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useGST } from "@/contexts/GSTContext";
import Colors from "@/constants/colors";

function formatINR(n: number) {
  return "₹" + Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const GST_RATES = [0, 5, 12, 18, 28];

export default function GSTCalculator() {
  const { purchases, sales } = useGST();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [additionalLiability, setAdditionalLiability] = useState("");
  const [additionalITC, setAdditionalITC] = useState("");

  const filtered = useMemo(() => {
    const filterByMonth = (entries: any[]) =>
      entries.filter(e => {
        const d = new Date(e.invoiceDate || e.date || e.created_at || "");
        return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
      });
    return {
      purchases: filterByMonth(purchases || []),
      sales: filterByMonth(sales || []),
    };
  }, [purchases, sales, selectedMonth, selectedYear]);

  // Calculate GST by rate slab
  const slabData = useMemo(() => {
    return GST_RATES.map(rate => {
      const salesAtRate = filtered.sales
        .filter(s => (s.gstRate || 18) === rate)
        .reduce((sum: number, s: any) => sum + (s.gstAmount || (s.taxableAmount * rate / 100) || 0), 0);
      const purchaseAtRate = filtered.purchases
        .filter(p => (p.gstRate || 18) === rate)
        .reduce((sum: number, p: any) => sum + (p.gstAmount || (p.taxableAmount * rate / 100) || 0), 0);
      return { rate, salesGST: salesAtRate, purchaseGST: purchaseAtRate, net: salesAtRate - purchaseAtRate };
    }).filter(s => s.salesGST > 0 || s.purchaseGST > 0);
  }, [filtered]);

  const totalSalesGST = filtered.sales.reduce((sum: number, s: any) => sum + (s.gstAmount || 0), 0);
  const totalPurchaseGST = filtered.purchases.reduce((sum: number, p: any) => sum + (p.gstAmount || 0), 0);
  const totalSalesTaxable = filtered.sales.reduce((sum: number, s: any) => sum + (s.taxableAmount || 0), 0);
  const totalPurchaseTaxable = filtered.purchases.reduce((sum: number, p: any) => sum + (p.taxableAmount || 0), 0);
  const addLiab = parseFloat(additionalLiability) || 0;
  const addITC = parseFloat(additionalITC) || 0;
  const outputTax = totalSalesGST + addLiab;
  const inputTax = totalPurchaseGST + addITC;
  const netPayable = outputTax - inputTax;

  // Filing due date (20th of next month)
  const dueDate = new Date(selectedYear, selectedMonth + 1, 20);
  const today = new Date();
  const daysLeft = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const isOverdue = daysLeft < 0;
  const isUrgent = daysLeft >= 0 && daysLeft <= 5;

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>GST Liability Calculator</Text>
        <TouchableOpacity style={styles.monthBtn} onPress={() => setShowMonthPicker(true)}>
          <Ionicons name="calendar-outline" size={16} color={Colors.primary} />
          <Text style={styles.monthBtnText}>{MONTHS[selectedMonth]} {selectedYear}</Text>
          <Ionicons name="chevron-down" size={14} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

        {/* Filing Due Date Banner */}
        <View style={[styles.dueBanner, isOverdue ? styles.dueOverdue : isUrgent ? styles.dueUrgent : styles.dueOk]}>
          <Ionicons
            name={isOverdue ? "warning" : isUrgent ? "alarm" : "checkmark-circle"}
            size={18}
            color={isOverdue ? "#dc2626" : isUrgent ? "#d97706" : "#16a34a"}
          />
          <Text style={[styles.dueText, { color: isOverdue ? "#dc2626" : isUrgent ? "#d97706" : "#16a34a" }]}>
            {isOverdue
              ? `GSTR-3B overdue by ${Math.abs(daysLeft)} days! Due was ${dueDate.toLocaleDateString("en-IN")}`
              : `GSTR-3B due: ${dueDate.toLocaleDateString("en-IN")} — ${daysLeft} days left`}
          </Text>
        </View>

        {/* Summary Cards Row */}
        <View style={styles.cardRow}>
          <View style={[styles.summaryCard, { borderLeftColor: "#ef4444" }]}>
            <Text style={styles.cardLabel}>Output Tax{"\n"}(Sales GST)</Text>
            <Text style={[styles.cardAmount, { color: "#ef4444" }]}>{formatINR(outputTax)}</Text>
            <Text style={styles.cardSub}>{filtered.sales.length} invoices</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: "#22c55e" }]}>
            <Text style={styles.cardLabel}>Input Tax{"\n"}Credit (ITC)</Text>
            <Text style={[styles.cardAmount, { color: "#22c55e" }]}>{formatINR(inputTax)}</Text>
            <Text style={styles.cardSub}>{filtered.purchases.length} invoices</Text>
          </View>
        </View>

        {/* Net Payable Big Card */}
        <View style={[styles.netCard, { backgroundColor: netPayable > 0 ? "#fef2f2" : "#f0fdf4" }]}>
          <Text style={styles.netLabel}>Net GST Payable to Government</Text>
          <Text style={[styles.netAmount, { color: netPayable > 0 ? "#dc2626" : "#16a34a" }]}>
            {netPayable >= 0 ? "" : "– "}{formatINR(netPayable)}
          </Text>
          <Text style={styles.netSub}>
            {netPayable > 0
              ? `You owe ₹${formatINR(netPayable)} in taxes this month`
              : netPayable < 0
              ? `You have ₹${formatINR(netPayable)} ITC carry forward`
              : "No GST payable this month 🎉"}
          </Text>
          <View style={styles.netBreakdown}>
            <Text style={styles.netBreakdownText}>₹{formatINR(outputTax)} output − ₹{formatINR(inputTax)} ITC = ₹{netPayable >= 0 ? "" : "-"}{formatINR(netPayable)}</Text>
          </View>
        </View>

        {/* Taxable Value Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Taxable Value Summary</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableCell, styles.tableHead, { flex: 2 }]}>Type</Text>
              <Text style={[styles.tableCell, styles.tableHead]}>Taxable Amt</Text>
              <Text style={[styles.tableCell, styles.tableHead]}>GST</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 2, color: "#ef4444" }]}>Sales (Output)</Text>
              <Text style={styles.tableCell}>{formatINR(totalSalesTaxable)}</Text>
              <Text style={styles.tableCell}>{formatINR(totalSalesGST)}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 2, color: "#22c55e" }]}>Purchases (ITC)</Text>
              <Text style={styles.tableCell}>{formatINR(totalPurchaseTaxable)}</Text>
              <Text style={styles.tableCell}>{formatINR(totalPurchaseGST)}</Text>
            </View>
          </View>
        </View>

        {/* GST Slab Breakdown */}
        {slabData.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>GST Slab Breakdown</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableCell, styles.tableHead]}>Rate</Text>
                <Text style={[styles.tableCell, styles.tableHead]}>Sales GST</Text>
                <Text style={[styles.tableCell, styles.tableHead]}>Purchase GST</Text>
                <Text style={[styles.tableCell, styles.tableHead]}>Net</Text>
              </View>
              {slabData.map(s => (
                <View key={s.rate} style={styles.tableRow}>
                  <Text style={styles.tableCell}>{s.rate}%</Text>
                  <Text style={[styles.tableCell, { color: "#ef4444" }]}>{formatINR(s.salesGST)}</Text>
                  <Text style={[styles.tableCell, { color: "#22c55e" }]}>{formatINR(s.purchaseGST)}</Text>
                  <Text style={[styles.tableCell, { color: s.net > 0 ? "#ef4444" : "#22c55e", fontWeight: "700" }]}>
                    {formatINR(s.net)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Additional Adjustments */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Manual Adjustments</Text>
          <Text style={styles.sectionSub}>Add any GST not yet recorded in the app</Text>
          <View style={styles.adjustRow}>
            <View style={styles.adjustField}>
              <Text style={styles.adjustLabel}>Additional Liability (₹)</Text>
              <TextInput
                style={styles.adjustInput}
                placeholder="0"
                keyboardType="numeric"
                value={additionalLiability}
                onChangeText={setAdditionalLiability}
              />
            </View>
            <View style={styles.adjustField}>
              <Text style={styles.adjustLabel}>Additional ITC (₹)</Text>
              <TextInput
                style={styles.adjustInput}
                placeholder="0"
                keyboardType="numeric"
                value={additionalITC}
                onChangeText={setAdditionalITC}
              />
            </View>
          </View>
        </View>

        {/* No data state */}
        {filtered.sales.length === 0 && filtered.purchases.length === 0 && (
          <View style={styles.emptyBox}>
            <Ionicons name="calculator-outline" size={48} color={Colors.textMuted || "#9ca3af"} />
            <Text style={styles.emptyText}>No data for {MONTHS[selectedMonth]} {selectedYear}</Text>
            <Text style={styles.emptySubText}>Add purchases and sales to see your GST liability</Text>
          </View>
        )}

      </ScrollView>

      {/* Month Picker Modal */}
      <Modal visible={showMonthPicker} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowMonthPicker(false)} activeOpacity={1}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Select Period</Text>
            <View style={styles.yearRow}>
              {years.map(y => (
                <TouchableOpacity
                  key={y}
                  style={[styles.yearBtn, selectedYear === y && styles.yearBtnActive]}
                  onPress={() => setSelectedYear(y)}
                >
                  <Text style={[styles.yearBtnText, selectedYear === y && styles.yearBtnTextActive]}>{y}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.monthGrid}>
              {MONTHS.map((m, i) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.monthItem, selectedMonth === i && styles.monthItemActive]}
                  onPress={() => { setSelectedMonth(i); setShowMonthPicker(false); }}
                >
                  <Text style={[styles.monthItemText, selectedMonth === i && styles.monthItemTextActive]}>
                    {m.substring(0, 3)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
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
  monthBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#eff6ff", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  monthBtnText: { fontSize: 13, fontWeight: "600", color: Colors.primary },
  dueBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10, marginBottom: 16 },
  dueOk: { backgroundColor: "#f0fdf4" },
  dueUrgent: { backgroundColor: "#fffbeb" },
  dueOverdue: { backgroundColor: "#fef2f2" },
  dueText: { fontSize: 13, fontWeight: "600", flex: 1 },
  cardRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  summaryCard: { flex: 1, backgroundColor: "#fff", borderRadius: 14, padding: 16, borderLeftWidth: 4, elevation: 1 },
  cardLabel: { fontSize: 12, color: "#6b7280", marginBottom: 8, lineHeight: 18 },
  cardAmount: { fontSize: 20, fontWeight: "800" },
  cardSub: { fontSize: 11, color: "#9ca3af", marginTop: 4 },
  netCard: { borderRadius: 16, padding: 20, marginBottom: 20, alignItems: "center" },
  netLabel: { fontSize: 14, color: "#374151", fontWeight: "600", marginBottom: 8 },
  netAmount: { fontSize: 36, fontWeight: "900", marginBottom: 6 },
  netSub: { fontSize: 13, color: "#6b7280", textAlign: "center", marginBottom: 12 },
  netBreakdown: { backgroundColor: "rgba(0,0,0,0.05)", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  netBreakdownText: { fontSize: 12, color: "#374151" },
  section: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#111827", marginBottom: 4 },
  sectionSub: { fontSize: 12, color: "#9ca3af", marginBottom: 12 },
  table: { borderRadius: 8, overflow: "hidden", borderWidth: 1, borderColor: "#e5e7eb" },
  tableHeader: { flexDirection: "row", backgroundColor: "#f9fafb", padding: 10 },
  tableRow: { flexDirection: "row", padding: 10, borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  tableCell: { flex: 1, fontSize: 12, color: "#374151" },
  tableHead: { fontWeight: "700", color: "#6b7280", fontSize: 11 },
  adjustRow: { flexDirection: "row", gap: 12 },
  adjustField: { flex: 1 },
  adjustLabel: { fontSize: 12, color: "#6b7280", marginBottom: 6 },
  adjustInput: { backgroundColor: "#f9fafb", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8, padding: 10, fontSize: 14 },
  emptyBox: { alignItems: "center", paddingVertical: 40 },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#6b7280", marginTop: 12 },
  emptySubText: { fontSize: 13, color: "#9ca3af", marginTop: 6, textAlign: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalBox: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: "700", textAlign: "center", marginBottom: 20 },
  yearRow: { flexDirection: "row", justifyContent: "center", gap: 12, marginBottom: 20 },
  yearBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#e5e7eb" },
  yearBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  yearBtnText: { fontSize: 14, color: "#374151" },
  yearBtnTextActive: { color: "#fff", fontWeight: "700" },
  monthGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  monthItem: { width: "22%", paddingVertical: 12, alignItems: "center", borderRadius: 10, borderWidth: 1, borderColor: "#e5e7eb" },
  monthItemActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  monthItemText: { fontSize: 13, color: "#374151" },
  monthItemTextActive: { color: "#fff", fontWeight: "700" },
});
