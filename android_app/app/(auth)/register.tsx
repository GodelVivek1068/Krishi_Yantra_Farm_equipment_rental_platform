import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Colors';
import { authApi } from '../../lib/api';
import { setAuth } from '../../lib/auth';
import { useAuth } from '../../context/AuthContext';

export default function RegisterScreen() {
  const router = useRouter();
  const { setCurrentUser } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', phone: '', location: '', password: '', confirmPassword: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k: string) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleRegister = async () => {
    if (!form.name || !form.email || !form.phone || !form.password) {
      Alert.alert('Missing Fields', 'Please fill all required fields.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return;
    }
    if (form.password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.register({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        location: form.location.trim(),
        password: form.password,
        role: 'farmer',
      });
      await setAuth(res.token, res.user);
      setCurrentUser(res.user);
      Alert.alert('Welcome! 🌾', 'Your account has been created.', [
        { text: 'Start Exploring', onPress: () => router.replace('/(tabs)') },
      ]);
    } catch (e: any) {
      Alert.alert('Registration Failed', e.message || 'Could not create account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.logo}>🌾 Join KrishiYantra</Text>
          <Text style={styles.subtitle}>Create your farmer account</Text>
        </View>

        <View style={styles.form}>
          {[
            { label: 'Full Name *', key: 'name', icon: 'user', placeholder: 'Your full name' },
            { label: 'Email *', key: 'email', icon: 'envelope', placeholder: 'you@example.com', keyboardType: 'email-address' as any, autoCapitalize: 'none' as any },
            { label: 'Phone *', key: 'phone', icon: 'phone', placeholder: '10-digit mobile number', keyboardType: 'phone-pad' as any },
            { label: 'Location', key: 'location', icon: 'map-marker-alt', placeholder: 'City / District' },
          ].map(({ label, key, icon, placeholder, keyboardType, autoCapitalize }) => (
            <View key={key}>
              <Text style={styles.label}>{label}</Text>
              <View style={styles.inputWrapper}>
                <FontAwesome5 name={icon} size={13} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={placeholder}
                  placeholderTextColor={Colors.textMuted}
                  value={(form as any)[key]}
                  onChangeText={set(key)}
                  keyboardType={keyboardType}
                  autoCapitalize={autoCapitalize ?? 'words'}
                />
              </View>
            </View>
          ))}

          <Text style={styles.label}>Password *</Text>
          <View style={styles.inputWrapper}>
            <FontAwesome5 name="lock" size={13} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Min. 6 characters"
              placeholderTextColor={Colors.textMuted}
              value={form.password}
              onChangeText={set('password')}
              secureTextEntry={!showPass}
            />
            <TouchableOpacity onPress={() => setShowPass(!showPass)}>
              <FontAwesome5 name={showPass ? 'eye-slash' : 'eye'} size={13} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Confirm Password *</Text>
          <View style={styles.inputWrapper}>
            <FontAwesome5 name="lock" size={13} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Repeat password"
              placeholderTextColor={Colors.textMuted}
              value={form.confirmPassword}
              onChangeText={set('confirmPassword')}
              secureTextEntry={!showPass}
            />
          </View>

          <TouchableOpacity
            style={[styles.btn, loading && { opacity: 0.7 }]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.btnText}>Create Account</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.footerLink}>Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingTop: Spacing.xl },
  header: { alignItems: 'center', marginBottom: Spacing.lg },
  logo: { fontSize: FontSize.xxl, fontWeight: 'bold', color: Colors.primary },
  subtitle: { fontSize: FontSize.md, color: Colors.textMuted, marginTop: 4 },
  form: { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.lg, gap: 4, elevation: 4 },
  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text, marginBottom: 4, marginTop: Spacing.sm },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceAlt, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, marginBottom: 4 },
  inputIcon: { marginRight: 8 },
  input: { paddingVertical: 11, fontSize: FontSize.md, color: Colors.text, flex: 1 },
  btn: { backgroundColor: Colors.primary, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, marginTop: Spacing.md },
  btnText: { color: Colors.white, fontWeight: 'bold', fontSize: FontSize.lg },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.md },
  footerText: { fontSize: FontSize.sm, color: Colors.textMuted },
  footerLink: { fontSize: FontSize.sm, fontWeight: 'bold', color: Colors.primary },
});
