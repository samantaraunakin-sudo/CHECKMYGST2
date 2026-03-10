import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from "@expo-google-fonts/inter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { GSTProvider } from "@/contexts/GSTContext";
import { supabase } from "@/lib/supabase";

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
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
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
  });
  const [session, setSession] = useState<any>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if ((fontsLoaded || fontError) && session !== undefined) {
      SplashScreen.hideAsync();
      if (!session) {
        router.replace("/login");
      }
    }
  }, [fontsLoaded, fontError, session]);

  if ((!fontsLoaded && !fontError) || session === undefined) return null;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <GSTProvider>
          <GestureHandlerRootView>
            <KeyboardProvider>
              <RootLayoutNav />
            </KeyboardProvider>
          </GestureHandlerRootView>
        </GSTProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
