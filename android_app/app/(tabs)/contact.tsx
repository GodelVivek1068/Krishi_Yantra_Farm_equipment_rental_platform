import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Colors';
import { contactApi } from '../../lib/api';

export default function ContactScreen() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [loading, setLoading] = useState(false);
  const set = (k: string) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.message) {
      Alert.alert('Missing Fields', 'Please fill in name, email, and message.');
      return;
    }
    setLoading(true);
    try {
      await contactApi.submit(form);
      Alert.alert('Message Sent! ✅', 'We will get back to you shortly.');
      setForm({ name: '', email: '', phone: '', message: '' });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not send message.');
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Contact Info */}
        <View style={styles.infoSection}>
          {[
            { icon: 'envelope', label: 'support@krishiyantra.in' },
            { icon: 'phone', label: '+91 98765 43210' },
            { icon: 'map-marker-alt', label: 'Pune, Maharashtra, India' },
          ].map((item, i) => (
            <View key={i} style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <FontAwesome5 name={item.icon} size={16} color={Colors.primary} />
              </View>
              <Text style={styles.infoText}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.formTitle}>Send Us a Message</Text>
          {[
            { label: 'Name *', key: 'name', icon: 'user', placeholder: 'Your name' },
            { label: 'Email *', key: 'email', icon: 'envelope', placeholder: 'you@example.com', keyboardType: 'email-address' as any, autoCapitalize: 'none' as any },
            { label: 'Phone', key: 'phone', icon: 'phone', placeholder: 'Mobile number', keyboardType: 'phone-pad' as any },
          ].map(({ label, key, icon, placeholder, keyboardType, autoCapitalize }) => (
            <View key={key}>
              <Text style={styles.label}>{label}</Text>
              <View style={styles.inputWrapper}>
                <FontAwesome5 name={icon} size={13} color={Colors.textMuted} style={{ marginRight: 8 }} />
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

          <Text style={styles.label}>Message *</Text>
          <TextInput
            style={styles.textarea}
            placeholder="How can we help you?"
            placeholderTextColor={Colors.textMuted}
            value={form.message}
            onChangeText={set('message')}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.btn, loading && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color={Colors.white} /> : (
              <>
                <FontAwesome5 name="paper-plane" size={14} color={Colors.white} />
                <Text style={styles.btnText}>Send Message</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md },
  infoSection: { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md, gap: Spacing.sm, elevation: 2 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  infoIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  infoText: { fontSize: FontSize.md, color: Colors.text },
  form: { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.lg, elevation: 3 },
  formTitle: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.text, marginBottom: Spacing.sm },
  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text, marginBottom: 4, marginTop: Spacing.sm },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceAlt, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12 },
  input: { paddingVertical: 11, fontSize: FontSize.md, color: Colors.text, flex: 1 },
  textarea: { backgroundColor: Colors.surfaceAlt, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: FontSize.md, color: Colors.text, height: 100, marginBottom: 4 },
  btn: { backgroundColor: Colors.primary, borderRadius: Radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8, marginTop: Spacing.md },
  btnText: { color: Colors.white, fontWeight: 'bold', fontSize: FontSize.lg },
});
