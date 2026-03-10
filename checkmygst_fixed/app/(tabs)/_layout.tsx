import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import { BlurView } from "expo-blur";
import { SymbolView } from "expo-symbols";
import { Platform, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import Colors from "@/constants/colors";

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "chart.bar", selected: "chart.bar.fill" }} />
        <Label>Dashboard</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="purchases">
        <Icon sf={{ default: "arrow.down.doc", selected: "arrow.down.doc.fill" }} />
        <Label>Purchases</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="sales">
        <Icon sf={{ default: "arrow.up.doc", selected: "arrow.up.doc.fill" }} />
        <Label>Sales</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="reconciliation">
        <Icon sf={{ default: "arrow.left.arrow.right", selected: "arrow.left.arrow.right" }} />
        <Label>Reconcile</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="clients">
        <Icon sf={{ default: "person.2", selected: "person.2.fill" }} />
        <Label>Clients</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.tabIconDefault,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : "#fff",
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: Colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={100} tint="light" style={StyleSheet.absoluteFill} />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "#fff" }]} />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) =>
            Platform.OS === "ios" ? (
              <SymbolView name="chart.bar.fill" tintColor={color} size={size} />
            ) : (
              <Ionicons name="bar-chart" size={size} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="purchases"
        options={{
          title: "Purchases",
          tabBarIcon: ({ color, size }) =>
            Platform.OS === "ios" ? (
              <SymbolView name="arrow.down.doc.fill" tintColor={color} size={size} />
            ) : (
              <Ionicons name="cloud-download-outline" size={size} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="sales"
        options={{
          title: "Sales",
          tabBarIcon: ({ color, size }) =>
            Platform.OS === "ios" ? (
              <SymbolView name="arrow.up.doc.fill" tintColor={color} size={size} />
            ) : (
              <Ionicons name="cloud-upload-outline" size={size} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="reconciliation"
        options={{
          title: "Reconcile",
          tabBarIcon: ({ color, size }) =>
            Platform.OS === "ios" ? (
              <SymbolView name="arrow.left.arrow.right" tintColor={color} size={size} />
            ) : (
              <Ionicons name="swap-horizontal" size={size} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: "Clients",
          tabBarIcon: ({ color, size }) =>
            Platform.OS === "ios" ? (
              <SymbolView name="person.2.fill" tintColor={color} size={size} />
            ) : (
              <Ionicons name="people" size={size} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
