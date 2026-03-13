import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import Colors from "@/constants/colors";

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: Colors.primary,
      tabBarInactiveTintColor: "#9ca3af",
      tabBarStyle: { backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#e5e7eb", elevation: 0, height: 60, paddingBottom: 8 },
      tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
    }}>
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="purchases" options={{ title: "Purchases", tabBarIcon: ({ color, size }) => <Ionicons name="arrow-down-circle-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="sales" options={{ title: "Sales", tabBarIcon: ({ color, size }) => <Ionicons name="arrow-up-circle-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="filings" options={{ title: "Filings", tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="analytics" options={{ href: null }} />
      <Tabs.Screen name="reports" options={{ href: null }} />
      <Tabs.Screen name="reconciliation" options={{ href: null }} />
      <Tabs.Screen name="clients" options={{ href: null }} />
      <Tabs.Screen name="calculator" options={{ href: null }} />
    </Tabs>
  );
}
