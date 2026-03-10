import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import Colors from "@/constants/colors";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) { Alert.alert("Error", "Please enter email and password"); return; }
    if (password.length < 6) { Alert.alert("Error", "Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        Alert.alert("Success", "Account created! You can now log in.", [{ text: "OK", onPress: () => setIsLogin(true) }]);
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.logoSection}>
          <View style={styles.logoBox}><Text style={styles.logoText}>₹</Text></View>
          <Text style={styles.appName}>CheckMyGST</Text>
          <Text style={styles.tagline}>GST reconciliation made simple</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{isLogin ? "Welcome back" : "Create account"}</Text>
          <Text style={styles.cardSub}>{isLogin ? "Sign in to your account" : "Start managing your GST today"}</Text>
          <Text style={styles.label}>Email</Text>
          <TextInput style={styles.input} placeholder="you@example.com" placeholderTextColor="#94A3B8" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholder="Min. 6 characters" placeholderTextColor="#94A3B8" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoCapitalize="none" />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
              <Text style={styles.eyeText}>{showPassword ? "Hide" : "Show"}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleAuth} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{isLogin ? "Sign In" : "Create Account"}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.switchBtn} onPress={() => setIsLogin(!isLogin)}>
            <Text style={styles.switchText}>{isLogin ? "Don't have an account? " : "Already have an account? "}<Text style={styles.switchLink}>{isLogin ? "Sign Up" : "Sign In"}</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 24 },
  logoSection: { alignItems: "center", marginBottom: 40 },
  logoBox: { width: 72, height: 72, borderRadius: 20, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  logoText: { fontSize: 36, color: "#fff", fontWeight: "bold" },
  appName: { fontSize: 28, fontWeight: "700", color: "#0F172A", marginBottom: 6 },
  tagline: { fontSize: 14, color: "#64748B" },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  cardTitle: { fontSize: 22, fontWeight: "700", color: "#0F172A", marginBottom: 4 },
  cardSub: { fontSize: 14, color: "#64748B", marginBottom: 24 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 10, padding: 14, fontSize: 15, color: "#0F172A", backgroundColor: "#F8FAFC", marginBottom: 16 },
  passwordRow: { flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 8 },
  eyeBtn: { paddingHorizontal: 12, paddingVertical: 14 },
  eyeText: { color: Colors.primary, fontSize: 13, fontWeight: "600" },
  button: { backgroundColor: Colors.primary, borderRadius: 10, padding: 16, alignItems: "center", marginTop: 8 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  switchBtn: { alignItems: "center", marginTop: 20 },
  switchText: { fontSize: 14, color: "#64748B" },
  switchLink: { color: Colors.primary, fontWeight: "600" },
});