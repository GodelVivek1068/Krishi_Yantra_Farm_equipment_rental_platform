import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../lib/api';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, setCurrentUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '', phone: user?.phone || '', location: user?.location || '' });
  const [saving, setSaving] = useState(false);
  const set = (k: string) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  if (!user) {
    return (
      <View style={styles.centered}>
        <FontAwesome5 name="user-circle" size={64} color={Colors.textLight} />
        <Text style={styles.title}>Not Logged In</Text>
        <Text style={styles.subtitle}>Login to manage your profile.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.btnText}>Login</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.outlineBtn]} onPress={() => router.push('/(auth)/register')}>
          <Text style={styles.outlineBtnText}>Create Account</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const roleLabel = user.role === 'owner' ? 'Owner' : user.role === 'admin' ? 'Admin' : 'Farmer';
  const kycStatus = user.kyc_status;
  const initials = (user.name || 'U').trim().split(/\s+/).slice(0, 2).map((p) => p[0].toUpperCase()).join('');

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await authApi.updateMe(form);
      setCurrentUser(res.user);
      setEditing(false);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not update profile.');
    } finally { setSaving(false); }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => { logout(); router.replace('/(tabs)'); } },
    ]);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Avatar */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
        <Text style={styles.userName}>{user.name}</Text>
        <View style={styles.roleBadge}><Text style={styles.roleText}>{roleLabel}</Text></View>
        {user.role === 'owner' && kycStatus && (
          <View style={[styles.kycBadge, { backgroundColor: kycStatus === 'approved' ? Colors.success : kycStatus === 'pending' ? Colors.warning : Colors.error }]}>
            <Text style={styles.kycText}>KYC: {kycStatus.toUpperCase()}</Text>
          </View>
        )}
      </View>

      {/* Profile Info / Edit */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Profile Details</Text>
          <TouchableOpacity onPress={() => setEditing(!editing)}>
            <FontAwesome5 name={editing ? 'times' : 'edit'} size={16} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {editing ? (
          <>
            {[
              { label: 'Name', key: 'name', icon: 'user' },
              { label: 'Email', key: 'email', icon: 'envelope', keyboardType: 'email-address' as any, autoCapitalize: 'none' as any },
              { label: 'Phone', key: 'phone', icon: 'phone', keyboardType: 'phone-pad' as any },
              { label: 'Location', key: 'location', icon: 'map-marker-alt' },
            ].map(({ label, key, icon, keyboardType, autoCapitalize }) => (
              <View key={key}>
                <Text style={styles.fieldLabel}>{label}</Text>
                <View style={styles.inputWrapper}>
                  <FontAwesome5 name={icon} size={13} color={Colors.textMuted} style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.input}
                    value={(form as any)[key]}
                    onChangeText={set(key)}
                    keyboardType={keyboardType}
                    autoCapitalize={autoCapitalize ?? 'words'}
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
              </View>
            ))}
            <TouchableOpacity style={[styles.btn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.btnText}>Save Changes</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            {[
              { icon: 'user', label: 'Name', value: user.name },
              { icon: 'envelope', label: 'Email', value: user.email },
              { icon: 'phone', label: 'Phone', value: user.phone },
              { icon: 'map-marker-alt', label: 'Location', value: user.location || '—' },
            ].map((item, i) => (
              <View key={i} style={styles.infoRow}>
                <FontAwesome5 name={item.icon} size={13} color={Colors.primary} style={{ width: 20 }} />
                <View>
                  <Text style={styles.infoLabel}>{item.label}</Text>
                  <Text style={styles.infoValue}>{item.value}</Text>
                </View>
              </View>
            ))}
          </>
        )}
      </View>

      {/* Quick Links */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Links</Text>
        {user.role === 'owner' && (
          <>
            <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/owner/dashboard')}>
              <FontAwesome5 name="tractor" size={16} color={Colors.primary} />
              <Text style={styles.linkText}>Owner Dashboard</Text>
              <FontAwesome5 name="chevron-right" size={12} color={Colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/owner/kyc')}>
              <FontAwesome5 name="id-card" size={16} color={Colors.primary} />
              <Text style={styles.linkText}>KYC Verification</Text>
              <FontAwesome5 name="chevron-right" size={12} color={Colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/owner/list-equipment')}>
              <FontAwesome5 name="plus-circle" size={16} color={Colors.primary} />
              <Text style={styles.linkText}>List New Equipment</Text>
              <FontAwesome5 name="chevron-right" size={12} color={Colors.textMuted} />
            </TouchableOpacity>
          </>
        )}
        {user.role === 'admin' && (
          <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/admin/panel')}>
            <FontAwesome5 name="shield-alt" size={16} color={Colors.primary} />
            <Text style={styles.linkText}>Admin Panel</Text>
            <FontAwesome5 name="chevron-right" size={12} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <FontAwesome5 name="sign-out-alt" size={15} color={Colors.error} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  avatarSection: { backgroundColor: Colors.navBackground, padding: Spacing.xl, alignItems: 'center' },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  avatarText: { fontSize: FontSize.xxl, fontWeight: 'bold', color: Colors.white },
  userName: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.white, marginBottom: 6 },
  roleBadge: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 4 },
  roleText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: '600' },
  kycBadge: { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3, marginTop: 4 },
  kycText: { color: Colors.white, fontSize: FontSize.xs, fontWeight: 'bold' },
  section: { backgroundColor: Colors.white, borderRadius: Radius.lg, margin: Spacing.md, marginBottom: 0, padding: Spacing.md, elevation: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: 'bold', color: Colors.text },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.borderMuted },
  infoLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  infoValue: { fontSize: FontSize.md, color: Colors.text, fontWeight: '500' },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text, marginBottom: 4, marginTop: Spacing.sm },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceAlt, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, marginBottom: 4 },
  input: { paddingVertical: 11, fontSize: FontSize.md, color: Colors.text, flex: 1 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderMuted },
  linkText: { flex: 1, fontSize: FontSize.md, color: Colors.text },
  btn: { backgroundColor: Colors.primary, borderRadius: Radius.md, alignItems: 'center', paddingVertical: 12, marginTop: Spacing.sm },
  btnText: { color: Colors.white, fontWeight: 'bold', fontSize: FontSize.md },
  title: { fontSize: FontSize.xxl, fontWeight: 'bold', color: Colors.text, marginTop: Spacing.md },
  subtitle: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 4, marginBottom: Spacing.lg },
  outlineBtn: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.primary, marginTop: 8 },
  outlineBtnText: { color: Colors.primary, fontWeight: 'bold', fontSize: FontSize.md },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.errorLight, borderRadius: Radius.md, margin: Spacing.md, paddingVertical: 14 },
  logoutText: { color: Colors.error, fontWeight: 'bold', fontSize: FontSize.md },
});
