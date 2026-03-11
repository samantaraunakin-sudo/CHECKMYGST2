import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useGST } from "@/contexts/GSTContext";
import { LinearGradient } from "expo-linear-gradient";

export default function ProfileScreen() {
  const { profile, currentUserEmail } = useGST();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (Platform.OS === "web") {
      const confirmed = window.confirm("Are you sure you want to log out?");
      if (!confirmed) return;
    }
    setLoggingOut(true);
    await supabase.auth.signOut();
    setLoggingOut(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <LinearGradient colors={["#0A1628", "#0D3B6E"]} style={styles.header}>
        <View style={styles.avatarCircle}>
          <Ionicons name="person" size={36} color="#fff" />
        </View>
        <Text style={styles.businessName}>{profile?.businessName || "Your Business"}</Text>
        <Text style={styles.emailText}>{currentUserEmail}</Text>
      </LinearGradient>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Business Details</Text>
        <View style={styles.row}>
          <Ionicons name="business-outline" size={18} color="#666" />
          <Text style={styles.rowLabel}>Business Name</Text>
          <Text style={styles.rowValue}>{profile?.businessName || "—"}</Text>
        </View>
        <View style={styles.row}>
          <Ionicons name="person-outline" size={18} color="#666" />
          <Text style={styles.rowLabel}>Owner Name</Text>
          <Text style={styles.rowValue}>{profile?.ownerName || "—"}</Text>
        </View>
        <View style={styles.row}>
          <Ionicons name="card-outline" size={18} color="#666" />
          <Text style={styles.rowLabel}>GSTIN</Text>
          <Text style={styles.rowValue}>{profile?.gstin || "—"}</Text>
        </View>
        <View style={styles.row}>
          <Ionicons name="call-outline" size={18} color="#666" />
          <Text style={styles.rowLabel}>Phone</Text>
          <Text style={styles.rowValue}>{profile?.phone || "—"}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.row}>
          <Ionicons name="mail-outline" size={18} color="#666" />
          <Text style={styles.rowLabel}>Email</Text>
          <Text style={styles.rowValue}>{currentUserEmail || "—"}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} disabled={loggingOut}>
        {loggingOut ? <ActivityIndicator color="#fff" /> : (
          <>
            <Ionicons name="log-out-outline" size={20} color="#fff" />
            <Text style={styles.logoutText}>Log Out</Text>
          </>
        )}
      </TouchableOpacity>
      <Text style={styles.version}>CheckMyGST v1.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  content: { paddingBottom: 48 },
  header: { alignItems: "center", paddingTop: 64, paddingBottom: 32, paddingHorizontal: 24 },
  avatarCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center", marginBottom: 12 },
  businessName: { fontSize: 22, fontWeight: "700", color: "#fff", marginBottom: 4 },
  emailText: { fontSize: 14, color: "rgba(255,255,255,0.7)" },
  section: { backgroundColor: "#fff", marginHorizontal: 16, marginTop: 16, borderRadius: 16, padding: 16, elevation: 2 },
  sectionTitle: { fontSize: 13, fontWeight: "600", color: "#999", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F0F0F0", gap: 10 },
  rowLabel: { fontSize: 14, color: "#666", flex: 1 },
  rowValue: { fontSize: 14, fontWeight: "500", color: "#0A1628", maxWidth: "50%", textAlign: "right" },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#EF4444", marginHorizontal: 16, marginTop: 24, borderRadius: 14, height: 52 },
  logoutText: { fontSize: 16, fontWeight: "600", color: "#fff" },
  version: { textAlign: "center", fontSize: 12, color: "#bbb", marginTop: 24 },
});