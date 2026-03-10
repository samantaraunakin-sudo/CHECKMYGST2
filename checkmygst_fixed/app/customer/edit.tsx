import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  Platform, ActivityIndicator, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { useGST } from "@/contexts/GSTContext";
import Colors from "@/constants/colors";

function formatINR(n: number) {
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export default function CustomerEditScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ key: string; customerName: string; customerGSTIN: string }>();
  const { sales, updateCustomerAcrossSales } = useGST();

  const [customerName, setCustomerName] = useState(params.customerName || "");
  const [customerGSTIN, setCustomerGSTIN] = useState(params.customerGSTIN || "");
  const [isSaving, setIsSaving] = useState(false);

  const key = params.key || "";

  const customerInvoices = sales.filter((s) => (s.customerGSTIN || s.customerName) === key);
  const totalAmount = customerInvoices.reduce((s, p) => s + p.totalAmount, 0);
  const totalGST = customerInvoices.reduce((s, p) => s + p.gstAmount, 0);

  const handleSave = async () => {
    if (!customerName.trim()) { Alert.alert("Required", "Customer name is required"); return; }
    setIsSaving(true);
    try {
      await updateCustomerAcrossSales(key, {
        customerName: customerName.trim(),
        customerGSTIN: customerGSTIN.trim(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Alert.alert("Error", "Failed to update customer");
    } finally {
      setIsSaving(false);
    }
  };

  const topPad = Platform.OS === "web" ? insets.top + 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="close" size={26} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Customer</Text>
        <TouchableOpacity style={[styles.saveBtn, isSaving && { opacity: 0.6 }]} onPress={handleSave} disabled={isSaving}>
          {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Update</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, Platform.OS === "web" && { paddingBottom: 34 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.noteCard}>
          <Ionicons name="information-circle" size={18} color={Colors.success} />
          <Text style={styles.noteText}>Changes will be applied to all {customerInvoices.length} invoice{customerInvoices.length !== 1 ? "s" : ""} for this customer.</Text>
        </View>

        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{customerInvoices.length}</Text>
            <Text style={styles.statLabel}>Invoices</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.success }]}>{formatINR(totalGST)}</Text>
            <Text style={styles.statLabel}>GST Collected</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatINR(totalAmount)}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>

        <Text style={styles.section}>Customer Details</Text>
        <View style={styles.field}>
          <Text style={styles.label}>Customer Name *</Text>
          <TextInput style={styles.input} placeholder="e.g. Verma Traders" placeholderTextColor={Colors.textMuted} value={customerName} onChangeText={setCustomerName} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>GSTIN (optional)</Text>
          <TextInput style={styles.input} placeholder="e.g. 29ABCDE1234F1Z5" placeholderTextColor={Colors.textMuted} value={customerGSTIN} onChangeText={(v) => setCustomerGSTIN(v.toUpperCase())} autoCapitalize="characters" maxLength={15} />
        </View>

        <Text style={styles.section}>Sales History</Text>
        {customerInvoices.map((inv) => (
          <View key={inv.id} style={styles.invCard}>
            <View>
              <Text style={styles.invNumber}>{inv.invoiceNumber}</Text>
              <Text style={styles.invDate}>{inv.invoiceDate}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.invGST}>GST {formatINR(inv.gstAmount)}</Text>
              <Text style={styles.invTotal}>{formatINR(inv.totalAmount)}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  headerTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary },
  saveBtn: { backgroundColor: Colors.success, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  saveBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  scrollContent: { padding: 16, gap: 12, paddingBottom: 60 },
  noteCard: { flexDirection: "row", gap: 10, backgroundColor: "#F0FDF4", borderRadius: 12, padding: 14, alignItems: "flex-start" },
  noteText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, lineHeight: 18 },
  statsCard: { flexDirection: "row", backgroundColor: Colors.surface, borderRadius: 14, padding: 16, shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2 },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.textPrimary },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 3 },
  statDivider: { width: 1, backgroundColor: Colors.border, marginHorizontal: 8 },
  section: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 },
  field: {},
  label: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary, marginBottom: 6 },
  input: { backgroundColor: Colors.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border },
  invCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: Colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border },
  invNumber: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary },
  invDate: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2 },
  invGST: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.success, marginBottom: 2 },
  invTotal: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.textPrimary },
});
