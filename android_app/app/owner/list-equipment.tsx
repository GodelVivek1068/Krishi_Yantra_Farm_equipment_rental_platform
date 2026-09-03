import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { FontAwesome5 } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Colors';
import { equipmentApi } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';

const CATEGORIES = ['tractor', 'harvester', 'rotavator', 'sprayer', 'thresher', 'plough', 'seeder', 'pump'];

export default function ListEquipmentScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    name: '', category: 'tractor', location: '', price_per_day: '',
    description: '', model: '', year: '', condition: 'good',
  });
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const set = (k: string) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant photo library access.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      setImage(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!form.name || !form.location || !form.price_per_day) {
      Alert.alert('Missing Fields', 'Please fill name, location, and price per day.');
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => formData.append(k, v));
      if (image) {
        const filename = image.split('/').pop()!;
        const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
        formData.append('image', { uri: image, name: filename, type: `image/${ext}` } as any);
      }
      await equipmentApi.create(formData);
      Alert.alert('Equipment Listed! 🎉', 'Your equipment is now visible to farmers.', [
        { text: 'View Dashboard', onPress: () => router.replace('/owner/dashboard') },
        { text: 'List Another', onPress: () => { setForm({ name: '', category: 'tractor', location: '', price_per_day: '', description: '', model: '', year: '', condition: 'good' }); setImage(null); } },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not list equipment.');
    } finally { setLoading(false); }
  };

  if (!user || user.role !== 'owner') {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Owner Access Only</Text>
      </View>
    );
  }

  if (user.kyc_status !== 'approved') {
    return (
      <View style={styles.centered}>
        <FontAwesome5 name="id-card" size={48} color={Colors.warning} />
        <Text style={styles.errorTitle}>KYC Required</Text>
        <Text style={styles.errorDesc}>Complete KYC verification before listing equipment.</Text>
        <TouchableOpacity style={styles.kycBtn} onPress={() => router.push('/owner/kyc')}>
          <Text style={styles.kycBtnText}>Complete KYC</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          {/* Image picker */}
          <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
            {image ? (
              <Image source={{ uri: image }} style={styles.pickedImage} resizeMode="cover" />
            ) : (
              <>
                <FontAwesome5 name="camera" size={28} color={Colors.primary} />
                <Text style={styles.imagePickerText}>Add Equipment Photo</Text>
                <Text style={styles.imagePickerSub}>(optional)</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Name */}
          <Text style={styles.label}>Equipment Name *</Text>
          <View style={styles.inputWrapper}>
            <TextInput style={styles.input} placeholder="e.g. Mahindra 575 DI Tractor" placeholderTextColor={Colors.textMuted} value={form.name} onChangeText={set('name')} />
          </View>

          {/* Category */}
          <Text style={styles.label}>Category *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.catChip, form.category === cat && styles.catChipActive]}
                onPress={() => set('category')(cat)}
              >
                <Text style={[styles.catChipText, form.category === cat && styles.catChipTextActive]}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Location */}
          <Text style={styles.label}>Location *</Text>
          <View style={styles.inputWrapper}>
            <FontAwesome5 name="map-marker-alt" size={13} color={Colors.textMuted} style={{ marginRight: 8 }} />
            <TextInput style={styles.input} placeholder="Village / City / District" placeholderTextColor={Colors.textMuted} value={form.location} onChangeText={set('location')} />
          </View>

          {/* Price */}
          <Text style={styles.label}>Price per Day (₹) *</Text>
          <View style={styles.inputWrapper}>
            <FontAwesome5 name="rupee-sign" size={13} color={Colors.textMuted} style={{ marginRight: 8 }} />
            <TextInput style={styles.input} placeholder="e.g. 1500" placeholderTextColor={Colors.textMuted} value={form.price_per_day} onChangeText={set('price_per_day')} keyboardType="numeric" />
          </View>

          {/* Optional fields */}
          {[
            { label: 'Model / Make', key: 'model', placeholder: 'e.g. Mahindra 575 DI' },
            { label: 'Year of Manufacture', key: 'year', placeholder: 'e.g. 2020', keyboardType: 'numeric' as any },
          ].map(({ label, key, placeholder, keyboardType }) => (
            <View key={key}>
              <Text style={styles.label}>{label}</Text>
              <View style={styles.inputWrapper}>
                <TextInput style={styles.input} placeholder={placeholder} placeholderTextColor={Colors.textMuted} value={(form as any)[key]} onChangeText={set(key)} keyboardType={keyboardType} />
              </View>
            </View>
          ))}

          {/* Condition */}
          <Text style={styles.label}>Condition</Text>
          <View style={styles.conditionRow}>
            {['excellent', 'good', 'fair'].map((c) => (
              <TouchableOpacity key={c} style={[styles.condChip, form.condition === c && styles.condChipActive]} onPress={() => set('condition')(c)}>
                <Text style={[styles.condChipText, form.condition === c && styles.condChipTextActive]}>{c.charAt(0).toUpperCase() + c.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Description */}
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={styles.textarea}
            placeholder="Any additional details about the equipment..."
            placeholderTextColor={Colors.textMuted}
            value={form.description}
            onChangeText={set('description')}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.7 }]} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color={Colors.white} /> : (
              <>
                <FontAwesome5 name="plus-circle" size={15} color={Colors.white} />
                <Text style={styles.submitBtnText}>List Equipment</Text>
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
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  errorTitle: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.text, marginTop: Spacing.md },
  errorDesc: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', marginTop: 4, marginBottom: Spacing.lg },
  kycBtn: { backgroundColor: Colors.warning, borderRadius: Radius.md, paddingHorizontal: 24, paddingVertical: 12 },
  kycBtnText: { color: Colors.white, fontWeight: 'bold', fontSize: FontSize.md },
  form: { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.lg, elevation: 3 },
  imagePicker: { height: 150, backgroundColor: Colors.primaryLight, borderRadius: Radius.md, borderWidth: 2, borderColor: Colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md, overflow: 'hidden' },
  pickedImage: { width: '100%', height: '100%' },
  imagePickerText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.primary, marginTop: 8 },
  imagePickerSub: { fontSize: FontSize.xs, color: Colors.textMuted },
  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text, marginBottom: 5, marginTop: Spacing.sm },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceAlt, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, marginBottom: 4 },
  input: { paddingVertical: 11, fontSize: FontSize.md, color: Colors.text, flex: 1 },
  catScroll: { marginBottom: 4 },
  catChip: { backgroundColor: Colors.surfaceAlt, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8, borderWidth: 1, borderColor: Colors.border },
  catChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catChipText: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: '600' },
  catChipTextActive: { color: Colors.white },
  conditionRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  condChip: { flex: 1, backgroundColor: Colors.surfaceAlt, borderRadius: Radius.sm, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  condChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  condChipText: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: '600' },
  condChipTextActive: { color: Colors.white },
  textarea: { backgroundColor: Colors.surfaceAlt, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: FontSize.md, color: Colors.text, height: 90, marginBottom: 4 },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8, marginTop: Spacing.md },
  submitBtnText: { color: Colors.white, fontWeight: 'bold', fontSize: FontSize.lg },
});
