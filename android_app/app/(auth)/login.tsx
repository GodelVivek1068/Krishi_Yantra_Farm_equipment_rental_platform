import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing Fields', 'Please enter email and password.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Login Failed', e.message || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>🚜 KrishiYantra</Text>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to your farmer account</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.label}>Email Address</Text>
          <View style={styles.inputWrapper}>
            <FontAwesome5 name="envelope" size={14} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={Colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrapper}>
            <FontAwesome5 name="lock" size={14} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Your password"
              placeholderTextColor={Colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
              autoComplete="password"
            />
            <TouchableOpacity onPress={() => setShowPass(!showPass)} style={{ padding: 4 }}>
              <FontAwesome5 name={showPass ? 'eye-slash' : 'eye'} size={14} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.btn, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <FontAwesome5 name="sign-in-alt" size={15} color={Colors.white} />
                <Text style={styles.btnText}>Login</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text style={styles.footerLink}>Register here</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.footer}>
          <Text style={styles.footerText}>Want to list equipment? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/register-owner')}>
            <Text style={styles.footerLink}>Register as Owner</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingTop: Spacing.xxl },
  header: { alignItems: 'center', marginBottom: Spacing.xl },
  logo: { fontSize: FontSize.xxxl, fontWeight: 'bold', color: Colors.primary, marginBottom: 8 },
  title: { fontSize: FontSize.xxl, fontWeight: 'bold', color: Colors.text },
  subtitle: { fontSize: FontSize.md, color: Colors.textMuted, marginTop: 4 },
  form: { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.lg, gap: 4, elevation: 4, shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 8 },
  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text, marginBottom: 4, marginTop: Spacing.sm },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceAlt, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, marginBottom: 4 },
  inputIcon: { marginRight: 8 },
  input: { paddingVertical: 11, fontSize: FontSize.md, color: Colors.text, flex: 1 },
  btn: { backgroundColor: Colors.primary, borderRadius: Radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8, marginTop: Spacing.md },
  btnText: { color: Colors.white, fontWeight: 'bold', fontSize: FontSize.lg },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: Spacing.md },
  footerText: { fontSize: FontSize.sm, color: Colors.textMuted },
  footerLink: { fontSize: FontSize.sm, fontWeight: 'bold', color: Colors.primary },
});
