import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      setErrorMsg("Please enter email and password.");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        Alert.alert(
          "Account Created!",
          "Check your email to confirm your account, then log in.",
          [{ text: "OK", onPress: () => setIsSignUp(false) }]
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        // Navigation handled automatically by _layout.tsx auth listener
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <LinearGradient
        colors={["#0A1628", "#0D3B6E"]}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={styles.logoArea}>
            <View style={styles.logoCircle}>
              <Ionicons name="document-text" size={36} color="#fff" />
            </View>
            <Text style={styles.appName}>CheckMyGST</Text>
            <Text style={styles.tagline}>Smart GST Reconciliation for Indian SMEs</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {isSignUp ? "Create Account" : "Welcome Back"}
            </Text>
            <Text style={styles.cardSubtitle}>
              {isSignUp
                ? "Sign up to get started"
                : "Log in to your account"}
            </Text>

            {/* Email */}
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputRow}>
              <Ionicons name="mail-outline" size={18} color="#999" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor="#aaa"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                editable={!loading}
              />
            </View>

            {/* Password */}
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={18} color="#999" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Min. 6 characters"
                placeholderTextColor="#aaa"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                editable={!loading}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color="#999"
                />
              </TouchableOpacity>
            </View>

            {/* Error */}
            {errorMsg ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={15} color="#EF4444" />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            {/* Button */}
            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleAuth}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>
                  {isSignUp ? "Create Account" : "Log In"}
                </Text>
              )}
            </TouchableOpacity>

            {/* Toggle */}
            <TouchableOpacity
              style={styles.toggleBtn}
              onPress={() => { setIsSignUp(!isSignUp); setErrorMsg(""); }}
            >
              <Text style={styles.toggleText}>
                {isSignUp
                  ? "Already have an account? "
                  : "Don't have an account? "}
                <Text style={styles.toggleLink}>
                  {isSignUp ? "Log In" : "Sign Up"}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  logoArea: { alignItems: "center", marginBottom: 32 },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  appName: { fontSize: 30, fontFamily: "Inter_700Bold", color: "#fff", marginBottom: 6 },
  tagline: { fontSize: 13, color: "rgba(255,255,255,0.65)", textAlign: "center" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  cardTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#0A1628", marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: "#888", marginBottom: 24 },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#444", marginBottom: 6 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F6FA",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    marginBottom: 16,
    height: 52,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15, color: "#1a1a1a" },
  eyeBtn: { padding: 4 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  errorText: { fontSize: 13, color: "#EF4444", flex: 1 },
  btn: {
    backgroundColor: "#0A1628",
    borderRadius: 14,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 16,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
  toggleBtn: { alignItems: "center" },
  toggleText: { fontSize: 14, color: "#888" },
  toggleLink: { color: "#0A1628", fontFamily: "Inter_600SemiBold" },
});
