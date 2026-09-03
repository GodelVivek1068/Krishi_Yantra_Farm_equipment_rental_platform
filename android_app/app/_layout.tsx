import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '../context/AuthContext';
import { Colors } from '../constants/Colors';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({});

  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: Colors.navBackground },
              headerTintColor: Colors.white,
              headerTitleStyle: { fontWeight: 'bold', fontSize: 18 },
              headerBackTitle: 'Back',
              contentStyle: { backgroundColor: Colors.background },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)/login" options={{ title: 'Login', presentation: 'modal' }} />
            <Stack.Screen name="(auth)/register" options={{ title: 'Register', presentation: 'modal' }} />
            <Stack.Screen name="(auth)/register-owner" options={{ title: 'Register as Owner' }} />
            <Stack.Screen name="equipment/[id]" options={{ title: 'Equipment Details' }} />
            <Stack.Screen name="owner/dashboard" options={{ title: 'Owner Dashboard' }} />
            <Stack.Screen name="owner/kyc" options={{ title: 'KYC Verification' }} />
            <Stack.Screen name="owner/list-equipment" options={{ title: 'List Equipment' }} />
            <Stack.Screen name="admin/panel" options={{ title: 'Admin Panel' }} />
          </Stack>
          <StatusBar style="light" />
        </ThemeProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
