import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Platform, TextInput, Alert
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useGST } from "@/contexts/GSTContext";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

export default function ProfileScreen() {
  const { profile, currentUserEmail, saveProfile } = useGST();
  const [loggingOut, setLoggingOut] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    businessName: profile?.businessName || "",
    ownerName: profile?.ownerName || "",
    gstin: profile?.gstin || "",
    phone: profile?.phone || "",
    email: profile?.email || currentUserEmail || "",
    businessType: profile?.businessType || "",
  });

  const startEdit = () => {
    setForm({
      businessName: profile?.businessName || "",
      ownerName: profile?.ownerName || "",
      gstin: profile?.gstin || "",
      phone: profile?.phone || "",
      email: profile?.email || currentUserEmail || "",
      businessType: profile?.businessType || "",
    });
    setEditing(true);
  };

  const handleSave = async () => {
    if (!form.businessName.trim()) {
      Alert.alert("Required", "Business name is required");
      return;
    }
    setSaving(true);
    try {
      await saveProfile({
        businessName: form.businessName.trim(),
        ownerName: form.ownerName.trim(),
        gstin: form.gstin.trim().toUpperCase(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        businessType: form.businessType.trim(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditing(false);
    } catch (e) {
      Alert.alert("Error", "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    if (Platform.OS === "web") {
      const confirmed = window.confirm("Are you sure you want to log out?");
      if (!confirmed) return;
    }
    setLoggingOut(true);
    await supabase.auth.signOut();
    setLoggingOut(false);
  };

  const isProfileEmpty = !profile?.businessName;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <LinearGradient colors={["#1d4ed8", "#2563eb"]} style={styles.header}>
        <View style={styles.avatarCircle}>
          <Ionicons name="business" size={32} color="#fff" />
        </View>
        <Text style={styles.businessName}>
          {profile?.businessName || "Set Up Your Business"}
        </Text>
        <Text style={styles.emailText}>{currentUserEmail}</Text>
        {profile?.gstin ? (
          <View style={styles.gstinBadge}>
            <Text style={styles.gstinText}>GSTIN: {profile.gstin}</Text>
          </View>
        ) : null}
      </LinearGradient>

      {/* Setup prompt if profile empty */}
      {isProfileEmpty && !editing && (
        <TouchableOpacity style={styles.setupBanner} onPress={startEdit}>
          <Ionicons name="warning-outline" size={20} color="#d97706" />
          <View style={{ flex: 1 }}>
            <Text style={styles.setupBannerTitle}>Complete your business profile</Text>
            <Text style={styles.setupBannerSub}>Add your GSTIN and business name to use all features</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#d97706" />
        </TouchableOpacity>
      )}

      {/* View Mode */}
      {!editing && (
        <>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Business Details</Text>
              <TouchableOpacity style={styles.editBtn} onPress={startEdit}>
                <Ionicons name="pencil-outline" size={16} color="#2563eb" />
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
            </View>
            {[
              { icon: "business-outline", label: "Business Name", value: profile?.businessName },
              { icon: "person-outline", label: "Owner Name", value: profile?.ownerName },
              { icon: "card-outline", label: "GSTIN", value: profile?.gstin },
              { icon: "call-outline", label: "Phone", value: profile?.phone },
              { icon: "briefcase-outline", label: "Business Type", value: profile?.businessType },
              { icon: "mail-outline", label: "Email", value: profile?.email || currentUserEmail },
            ].map(row => (
              <View key={row.label} style={styles.row}>
                <Ionicons name={row.icon as any} size={18} color="#6b7280" />
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text style={[styles.rowValue, !row.value && styles.rowValueEmpty]}>
                  {row.value || "Not set"}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Edit Mode */}
      {editing && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Edit Business Profile</Text>
            <TouchableOpacity onPress={() => setEditing(false)}>
              <Ionicons name="close" size={22} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          {[
            { key: "businessName", label: "Business Name *", placeholder: "e.g. Kaku Traders", icon: "business-outline" },
            { key: "ownerName", label: "Owner Name", placeholder: "e.g. Ramesh Kumar", icon: "person-outline" },
            { key: "gstin", label: "GSTIN", placeholder: "e.g. 19ABCDE1234F1Z5", icon: "card-outline", upper: true },
            { key: "phone", label: "Phone Number", placeholder: "e.g. 9876543210", icon: "call-outline", numeric: true },
            { key: "businessType", label: "Business Type", placeholder: "e.g. Building Materials, Retail", icon: "briefcase-outline" },
            { key: "email", label: "Email for Reminders", placeholder: "your@email.com", icon: "mail-outline" },
          ].map(field => (
            <View key={field.key} style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{field.label}</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name={field.icon as any} size={18} color="#9ca3af" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={field.placeholder}
                  placeholderTextColor="#d1d5db"
                  value={form[field.key as keyof typeof form]}
                  onChangeText={v => setForm(p => ({
                    ...p,
                    [field.key]: field.upper ? v.toUpperCase() : v
                  }))}
                  keyboardType={field.numeric ? "phone-pad" : "default"}
                  autoCapitalize={field.upper ? "characters" : "words"}
                />
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                  <Text style={styles.saveBtnText}>Save Profile</Text>
                </>
            }
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} disabled={loggingOut}>
        {loggingOut
          ? <ActivityIndicator color="#fff" />
          : <>
              <Ionicons name="log-out-outline" size={20} color="#fff" />
              <Text style={styles.logoutText}>Log Out</Text>
            </>
        }
      </TouchableOpacity>
      <Text style={styles.version}>CheckMyGST v1.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { paddingBottom: 48 },
  header: { alignItems: "center", paddingTop: Platform.OS === "ios" ? 64 : 56, paddingBottom: 28, paddingHorizontal: 24 },
  avatarCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center", marginBottom: 12 },
  businessName: { fontSize: 20, fontWeight: "800", color: "#fff", marginBottom: 4, textAlign: "center" },
  emailText: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginBottom: 8 },
  gstinBadge: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4 },
  gstinText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  setupBanner: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fffbeb", margin: 16, borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: "#fde68a" },
  setupBannerTitle: { fontSize: 14, fontWeight: "700", color: "#92400e" },
  setupBannerSub: { fontSize: 12, color: "#b45309", marginTop: 2 },
  section: { backgroundColor: "#fff", marginHorizontal: 16, marginTop: 16, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#e5e7eb" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.8 },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#eff6ff", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: "#bfdbfe" },
  editBtnText: { fontSize: 13, fontWeight: "600", color: "#2563eb" },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f9fafb", gap: 10 },
  rowLabel: { fontSize: 13, color: "#6b7280", flex: 1 },
  rowValue: { fontSize: 13, fontWeight: "600", color: "#111827", maxWidth: "55%", textAlign: "right" },
  rowValueEmpty: { color: "#d1d5db", fontWeight: "400" },
  inputGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 12, fontWeight: "600", color: "#374151", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  inputWrapper: { flexDirection: "row", alignItems: "center", backgroundColor: "#f9fafb", borderRadius: 12, borderWidth: 1.5, borderColor: "#e5e7eb", paddingHorizontal: 12 },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, height: 46, fontSize: 14, color: "#111827" },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#2563eb", borderRadius: 14, height: 52, marginTop: 8 },
  saveBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#ef4444", marginHorizontal: 16, marginTop: 20, borderRadius: 14, height: 52 },
  logoutText: { fontSize: 16, fontWeight: "600", color: "#fff" },
  version: { textAlign: "center", fontSize: 12, color: "#9ca3af", marginTop: 20 },
});