import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Slot, Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { GSTProvider } from "@/contexts/GSTContext";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";

SplashScreen.preventAutoHideAsync();

function RootLayoutNav({ session }: { session: Session | null }) {
  useEffect(() => {
    if (session) {
      router.replace("/(tabs)");
    } else {
      router.replace("/login");
    }
  }, [session]);

  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="purchase/add" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="sale/add" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="gstr2b/upload" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="supplier/edit" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="customer/edit" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="profile/edit" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="search" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if ((fontsLoaded || fontError) && !authLoading) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, authLoading]);

  if ((!fontsLoaded && !fontError) || authLoading) return null;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <GSTProvider>
          <GestureHandlerRootView>
            <KeyboardProvider>
              <RootLayoutNav session={session} />
            </KeyboardProvider>
          </GestureHandlerRootView>
        </GSTProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
