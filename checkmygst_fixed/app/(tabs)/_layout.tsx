import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import Colors from "@/constants/colors";

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: Colors.primary, tabBarInactiveTintColor: Colors.tabIconDefault, tabBarStyle: { backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: Colors.border, elevation: 0 } }}>
      <Tabs.Screen name="index" options={{ title: "Dashboard", tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart" size={size} color={color} /> }} />
      <Tabs.Screen name="purchases" options={{ title: "Purchases", tabBarIcon: ({ color, size }) => <Ionicons name="cloud-download-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="sales" options={{ title: "Sales", tabBarIcon: ({ color, size }) => <Ionicons name="cloud-upload-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="reconciliation" options={{ title: "Reconcile", tabBarIcon: ({ color, size }) => <Ionicons name="swap-horizontal" size={size} color={color} /> }} />
      <Tabs.Screen name="calculator" options={{ title: "GST Calc", tabBarIcon: ({ color, size }) => <Ionicons name="calculator" size={size} color={color} /> }} />
      <Tabs.Screen name="clients" options={{ title: "Clients", tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" size={size} color={color} /> }} />
    </Tabs>
  );
}
