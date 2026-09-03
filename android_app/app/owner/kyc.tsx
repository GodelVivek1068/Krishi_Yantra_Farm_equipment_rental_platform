import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { FontAwesome5 } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Colors';
import { kycApi } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';

export default function OwnerKycScreen() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [kycStatus, setKycStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ full_name: '', aadhaar: '', pan: '', bank_account: '', ifsc: '', bank_name: '' });
  const [idImage, setIdImage] = useState<string | null>(null);
  const set = (k: string) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    loadKycStatus();
  }, []);

  const loadKycStatus = async () => {
    try {
      const res = await kycApi.status();
      setKycStatus(res);
    } catch { setKycStatus(null); }
    finally { setLoading(false); }
  };

  const pickIdImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled && result.assets[0]) setIdImage(result.assets[0].uri);
  };

  const handleSubmit = async () => {
    if (!form.full_name || !form.aadhaar || !form.pan || !form.bank_account || !form.ifsc) {
      Alert.alert('Missing Fields', 'Please fill all required fields.');
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => formData.append(k, v));
      if (idImage) {
        const filename = idImage.split('/').pop()!;
        formData.append('id_document', { uri: idImage, name: filename, type: 'image/jpeg' } as any);
      }
      await kycApi.submit(formData);
      await refreshUser();
      Alert.alert('KYC Submitted! ✅', 'Your KYC is under review. You will be notified once approved.', [
        { text: 'OK', onPress: () => router.replace('/owner/dashboard') },
      ]);
    } catch (e: any) {
      Alert.alert('Submission Failed', e.message || 'Could not submit KYC.');
    } finally { setSubmitting(false); }
  };

  if (loading) return <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />;

  const status = user?.kyc_status || kycStatus?.kyc_status || 'not_submitted';

  if (status === 'approved') {
    return (
      <View style={styles.centered}>
        <FontAwesome5 name="check-circle" size={64} color={Colors.success} />
        <Text style={styles.statusTitle}>KYC Approved ✅</Text>
        <Text style={styles.statusDesc}>Your identity has been verified. You can now list equipment.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.push('/owner/list-equipment')}>
          <Text style={styles.btnText}>List Equipment</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (status === 'pending') {
    return (
      <View style={styles.centered}>
        <FontAwesome5 name="clock" size={64} color={Colors.warning} />
        <Text style={styles.statusTitle}>Under Review ⏳</Text>
        <Text style={styles.statusDesc}>Your KYC is being reviewed. This usually takes 24–48 hours.</Text>
      </View>
    );
  }

  if (status === 'rejected') {
    return (
      <View style={styles.centered}>
        <FontAwesome5 name="times-circle" size={64} color={Colors.error} />
        <Text style={styles.statusTitle}>KYC Rejected</Text>
        <Text style={styles.statusDesc}>{kycStatus?.rejection_reason || 'Your KYC was rejected. Please re-submit with correct documents.'}</Text>
        <TouchableOpacity style={styles.btn} onPress={() => setKycStatus({ kyc_status: 'not_submitted' })}>
          <Text style={styles.btnText}>Re-submit KYC</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.infoBox}>
          <FontAwesome5 name="info-circle" size={16} color={Colors.primary} />
          <Text style={styles.infoText}>KYC verification is required to start listing equipment on KrishiYantra. This helps build trust with farmers.</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.formTitle}>Identity Verification</Text>

          {[
            { label: 'Full Name (as per Aadhaar) *', key: 'full_name', placeholder: 'Your legal full name' },
            { label: 'Aadhaar Number *', key: 'aadhaar', placeholder: '12-digit Aadhaar number', keyboardType: 'numeric' as any },
            { label: 'PAN Number *', key: 'pan', placeholder: 'ABCDE1234F', autoCapitalize: 'characters' as any },
          ].map(({ label, key, placeholder, keyboardType, autoCapitalize }) => (
            <View key={key}>
              <Text style={styles.label}>{label}</Text>
              <View style={styles.inputWrapper}>
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

          <Text style={styles.sectionDivider}>Bank Details</Text>

          {[
            { label: 'Account Number *', key: 'bank_account', placeholder: 'Bank account number', keyboardType: 'numeric' as any },
            { label: 'IFSC Code *', key: 'ifsc', placeholder: 'e.g. SBIN0001234', autoCapitalize: 'characters' as any },
            { label: 'Bank Name', key: 'bank_name', placeholder: 'e.g. State Bank of India' },
          ].map(({ label, key, placeholder, keyboardType, autoCapitalize }) => (
            <View key={key}>
              <Text style={styles.label}>{label}</Text>
              <View style={styles.inputWrapper}>
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

          <Text style={styles.label}>ID Document (optional)</Text>
          <TouchableOpacity style={styles.imagePicker} onPress={pickIdImage}>
            {idImage ? (
              <Image source={{ uri: idImage }} style={styles.pickedImage} resizeMode="cover" />
            ) : (
              <>
                <FontAwesome5 name="upload" size={24} color={Colors.primary} />
                <Text style={styles.imagePickerText}>Upload Aadhaar / ID Photo</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.7 }]} onPress={handleSubmit} disabled={submitting}>
            {submitting ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.submitBtnText}>Submit KYC</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  statusTitle: { fontSize: FontSize.xxl, fontWeight: 'bold', color: Colors.text, marginTop: Spacing.md, textAlign: 'center' },
  statusDesc: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', marginTop: 8, marginBottom: Spacing.lg, lineHeight: 20 },
  btn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: 24, paddingVertical: 12 },
  btnText: { color: Colors.white, fontWeight: 'bold', fontSize: FontSize.md },
  infoBox: { flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.primaryLight, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md, alignItems: 'flex-start' },
  infoText: { flex: 1, fontSize: FontSize.sm, color: Colors.primaryDark, lineHeight: 20 },
  form: { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.lg, elevation: 3 },
  formTitle: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.text, marginBottom: Spacing.sm },
  sectionDivider: { fontSize: FontSize.md, fontWeight: 'bold', color: Colors.textSecondary, marginTop: Spacing.lg, marginBottom: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.borderMuted, paddingTop: Spacing.md },
  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text, marginBottom: 4, marginTop: Spacing.sm },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceAlt, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, marginBottom: 4 },
  input: { paddingVertical: 11, fontSize: FontSize.md, color: Colors.text, flex: 1 },
  imagePicker: { height: 120, backgroundColor: Colors.primaryLight, borderRadius: Radius.md, borderWidth: 2, borderColor: Colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginBottom: 4, overflow: 'hidden' },
  pickedImage: { width: '100%', height: '100%' },
  imagePickerText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.primary, marginTop: 6 },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, alignItems: 'center', paddingVertical: 14, marginTop: Spacing.md },
  submitBtnText: { color: Colors.white, fontWeight: 'bold', fontSize: FontSize.lg },
});
