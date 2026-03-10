import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useGST } from "@/contexts/GSTContext";
import Colors from "@/constants/colors";

const BUSINESS_TYPES = [
  "Retailer", "Wholesaler", "Manufacturer", "Distributor",
  "Service Provider", "Trader", "Builder", "Other",
];

export default function AddClientScreen() {
  const insets = useSafeAreaInsets();
  const { addClient } = useGST();

  const [form, setForm] = useState({
    businessName: "",
    ownerName: "",
    gstin: "",
    phone: "",
    email: "",
    businessType: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  const update = (key: string, val: string) => setForm((p) => ({ ...p, [key]: val }));

  const handleSave = async () => {
    if (!form.businessName.trim()) {
      Alert.alert("Required", "Business name is required");
      return;
    }
    setIsSaving(true);
    try {
      await addClient(form);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Alert.alert("Error", "Failed to add client");
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
        <Text style={styles.headerTitle}>New Client</Text>
        <TouchableOpacity
          style={[styles.saveBtn, isSaving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, Platform.OS === "web" && { paddingBottom: 34 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.section}>Business Info</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Business Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Sharma Building Materials"
            placeholderTextColor={Colors.textMuted}
            value={form.businessName}
            onChangeText={(v) => update("businessName", v)}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Owner Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Ramesh Sharma"
            placeholderTextColor={Colors.textMuted}
            value={form.ownerName}
            onChangeText={(v) => update("ownerName", v)}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>GSTIN</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 29ABCDE1234F1Z5"
            placeholderTextColor={Colors.textMuted}
            value={form.gstin}
            onChangeText={(v) => update("gstin", v.toUpperCase())}
            autoCapitalize="characters"
            maxLength={15}
          />
        </View>

        <Text style={styles.section}>Contact</Text>

        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              placeholder="10-digit number"
              placeholderTextColor={Colors.textMuted}
              value={form.phone}
              onChangeText={(v) => update("phone", v)}
              keyboardType="phone-pad"
              maxLength={10}
            />
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="email@domain.com"
              placeholderTextColor={Colors.textMuted}
              value={form.email}
              onChangeText={(v) => update("email", v)}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        </View>

        <Text style={styles.section}>Business Type</Text>
        <View style={styles.typeGrid}>
          {BUSINESS_TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.typeChip, form.businessType === type && styles.typeChipActive]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); update("businessType", type); }}
            >
              <Text style={[styles.typeChipText, form.businessType === type && styles.typeChipTextActive]}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
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
  content: { padding: 16, gap: 4, paddingBottom: 60 },
  section: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary, marginTop: 8, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  field: { marginBottom: 12 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary, marginBottom: 6 },
  input: { backgroundColor: Colors.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border },
  row: { flexDirection: "row", gap: 12 },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  typeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeChipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  typeChipTextActive: { color: "#fff" },
});
