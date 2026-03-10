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

export default function SupplierEditScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ key: string; supplierName: string; supplierGSTIN: string }>();
  const { purchases, updateSupplierAcrossPurchases } = useGST();

  const [supplierName, setSupplierName] = useState(params.supplierName || "");
  const [supplierGSTIN, setSupplierGSTIN] = useState(params.supplierGSTIN || "");
  const [isSaving, setIsSaving] = useState(false);

  const key = params.key || "";

  // Get all invoices for this supplier
  const supplierInvoices = purchases.filter((p) => (p.supplierGSTIN || p.supplierName) === key);
  const totalAmount = supplierInvoices.reduce((s, p) => s + p.totalAmount, 0);
  const totalGST = supplierInvoices.reduce((s, p) => s + p.gstAmount, 0);

  const handleSave = async () => {
    if (!supplierName.trim()) { Alert.alert("Required", "Supplier name is required"); return; }
    setIsSaving(true);
    try {
      await updateSupplierAcrossPurchases(key, {
        supplierName: supplierName.trim(),
        supplierGSTIN: supplierGSTIN.trim(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Alert.alert("Error", "Failed to update supplier");
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
        <Text style={styles.headerTitle}>Edit Supplier</Text>
        <TouchableOpacity style={[styles.saveBtn, isSaving && { opacity: 0.6 }]} onPress={handleSave} disabled={isSaving}>
          {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Update</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, Platform.OS === "web" && { paddingBottom: 34 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.noteCard}>
          <Ionicons name="information-circle" size={18} color={Colors.primary} />
          <Text style={styles.noteText}>Changes will be applied to all {supplierInvoices.length} invoice{supplierInvoices.length !== 1 ? "s" : ""} for this supplier.</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{supplierInvoices.length}</Text>
            <Text style={styles.statLabel}>Invoices</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.primary }]}>{formatINR(totalGST)}</Text>
            <Text style={styles.statLabel}>GST Paid</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatINR(totalAmount)}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>

        <Text style={styles.section}>Supplier Details</Text>
        <View style={styles.field}>
          <Text style={styles.label}>Supplier Name *</Text>
          <TextInput style={styles.input} placeholder="e.g. ABC Steel Co." placeholderTextColor={Colors.textMuted} value={supplierName} onChangeText={setSupplierName} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>GSTIN</Text>
          <TextInput style={styles.input} placeholder="e.g. 29ABCDE1234F1Z5" placeholderTextColor={Colors.textMuted} value={supplierGSTIN} onChangeText={(v) => setSupplierGSTIN(v.toUpperCase())} autoCapitalize="characters" maxLength={15} />
        </View>

        <Text style={styles.section}>Purchase History</Text>
        {supplierInvoices.map((inv) => (
          <View key={inv.id} style={styles.invCard}>
            <View style={styles.invLeft}>
              <Text style={styles.invNumber}>{inv.invoiceNumber}</Text>
              <Text style={styles.invDate}>{inv.invoiceDate}</Text>
            </View>
            <View style={styles.invRight}>
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
  saveBtn: { backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  saveBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  scrollContent: { padding: 16, gap: 12, paddingBottom: 60 },
  noteCard: { flexDirection: "row", gap: 10, backgroundColor: "#EFF6FF", borderRadius: 12, padding: 14, alignItems: "flex-start" },
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
  invLeft: {},
  invNumber: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textPrimary },
  invDate: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2 },
  invRight: { alignItems: "flex-end" },
  invGST: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.primary, marginBottom: 2 },
  invTotal: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.textPrimary },
});
