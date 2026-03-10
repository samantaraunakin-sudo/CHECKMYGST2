import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  Platform, ActivityIndicator, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useGST } from "@/contexts/GSTContext";
import Colors from "@/constants/colors";

const BUSINESS_TYPES = ["Proprietorship", "Partnership", "Private Ltd", "LLP", "Others"];

export default function ProfileEditScreen() {
  const insets = useSafeAreaInsets();
  const { profile, saveProfile } = useGST();

  const [form, setForm] = useState({
    businessName: profile?.businessName || "",
    ownerName: profile?.ownerName || "",
    gstin: profile?.gstin || "",
    phone: profile?.phone || "",
    email: profile?.email || "",
    businessType: profile?.businessType || "Proprietorship",
  });
  const [isSaving, setIsSaving] = useState(false);

  const update = (key: string, value: string) => setForm((p) => ({ ...p, [key]: value }));

  const handleSave = async () => {
    if (!form.businessName.trim()) { Alert.alert("Required", "Business name is required"); return; }
    setIsSaving(true);
    try {
      await saveProfile({
        businessName: form.businessName.trim(),
        ownerName: form.ownerName.trim(),
        gstin: form.gstin.trim().toUpperCase(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        businessType: form.businessType,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Alert.alert("Error", "Failed to save profile");
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
        <Text style={styles.headerTitle}>Business Profile</Text>
        <TouchableOpacity style={[styles.saveBtn, isSaving && { opacity: 0.6 }]} onPress={handleSave} disabled={isSaving}>
          {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, Platform.OS === "web" && { paddingBottom: 34 }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.section}>Business Information</Text>
        <View style={styles.field}>
          <Text style={styles.label}>Business Name *</Text>
          <TextInput style={styles.input} placeholder="e.g. Sharma Enterprises" placeholderTextColor={Colors.textMuted} value={form.businessName} onChangeText={(v) => update("businessName", v)} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Owner / Proprietor Name</Text>
          <TextInput style={styles.input} placeholder="e.g. Rajesh Sharma" placeholderTextColor={Colors.textMuted} value={form.ownerName} onChangeText={(v) => update("ownerName", v)} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>GSTIN</Text>
          <TextInput style={styles.input} placeholder="e.g. 29ABCDE1234F1Z5" placeholderTextColor={Colors.textMuted} value={form.gstin} onChangeText={(v) => update("gstin", v.toUpperCase())} autoCapitalize="characters" maxLength={15} />
        </View>

        <Text style={styles.section}>Business Type</Text>
        <View style={styles.typeGrid}>
          {BUSINESS_TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.typeChip, form.businessType === type && styles.typeChipActive]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); update("businessType", type); }}
            >
              <Text style={[styles.typeText, form.businessType === type && styles.typeTextActive]}>{type}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.section}>Contact</Text>
        <View style={styles.field}>
          <Text style={styles.label}>Phone</Text>
          <TextInput style={styles.input} placeholder="e.g. 9876543210" placeholderTextColor={Colors.textMuted} value={form.phone} onChangeText={(v) => update("phone", v)} keyboardType="phone-pad" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput style={styles.input} placeholder="e.g. info@business.com" placeholderTextColor={Colors.textMuted} value={form.email} onChangeText={(v) => update("email", v)} keyboardType="email-address" autoCapitalize="none" />
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
  scrollContent: { padding: 16, gap: 12, paddingBottom: 60 },
  section: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 8 },
  field: {},
  label: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary, marginBottom: 6 },
  input: { backgroundColor: Colors.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  typeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  typeTextActive: { color: "#fff" },
});
