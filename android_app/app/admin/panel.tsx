import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Colors';
import { adminApi } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';

export default function AdminPanelScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<'kyc' | 'equipment' | 'stats'>('stats');
  const [stats, setStats] = useState<any>(null);
  const [pendingKyc, setPendingKyc] = useState<any[]>([]);
  const [allEquipment, setAllEquipment] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [statsRes, kycRes, eqRes] = await Promise.all([
        adminApi.stats(),
        adminApi.pendingKyc(),
        adminApi.allEquipment(),
      ]);
      setStats(statsRes);
      setPendingKyc(kycRes.owners || kycRes.data || []);
      setAllEquipment(eqRes.equipment || eqRes.data || []);
    } catch { }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { loadData(); }, []);

  if (!user || user.role !== 'admin') {
    return (
      <View style={styles.centered}>
        <FontAwesome5 name="shield-alt" size={48} color={Colors.textLight} />
        <Text style={styles.errorTitle}>Admin Access Only</Text>
      </View>
    );
  }

  const handleApproveKyc = (ownerId: string, ownerName: string) => {
    Alert.alert('Approve KYC', `Approve KYC for ${ownerName}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: async () => {
        try { await adminApi.approveKyc(ownerId); loadData(); Alert.alert('✅ Approved', `${ownerName}'s KYC approved.`); }
        catch (e: any) { Alert.alert('Error', e.message); }
      }},
    ]);
  };

  const handleRejectKyc = (ownerId: string, ownerName: string) => {
    Alert.prompt('Reject KYC', `Reason for rejecting ${ownerName}'s KYC?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: async (reason) => {
        try { await adminApi.rejectKyc(ownerId, reason || 'Documents not valid'); loadData(); }
        catch (e: any) { Alert.alert('Error', e.message); }
      }},
    ]);
  };

  const handleToggleEquipment = (id: string, name: string) => {
    Alert.alert('Toggle Equipment', `Toggle visibility of "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Toggle', onPress: async () => {
        try { await adminApi.toggleEquipment(id); loadData(); }
        catch (e: any) { Alert.alert('Error', e.message); }
      }},
    ]);
  };

  if (loading) return <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />;

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} colors={[Colors.primary]} />}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🛡️ Admin Panel</Text>
        <Text style={styles.headerSub}>KrishiYantra Administration</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['stats', 'kyc', 'equipment'] as const).map((t) => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'stats' ? '📊 Stats' : t === 'kyc' ? `✅ KYC (${pendingKyc.length})` : '🚜 Equipment'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'stats' && stats && (
        <View style={styles.statsGrid}>
          {[
            { label: 'Total Users', value: stats.total_users || 0, icon: 'users', color: Colors.info },
            { label: 'Owners', value: stats.total_owners || 0, icon: 'user-tie', color: Colors.primary },
            { label: 'Equipment', value: stats.total_equipment || 0, icon: 'tractor', color: Colors.success },
            { label: 'Rentals', value: stats.total_rentals || 0, icon: 'calendar-check', color: Colors.accent },
            { label: 'Pending KYC', value: stats.pending_kyc || pendingKyc.length, icon: 'clock', color: Colors.warning },
            { label: 'Revenue', value: `₹${stats.total_revenue || 0}`, icon: 'rupee-sign', color: Colors.success },
          ].map((s, i) => (
            <View key={i} style={styles.statCard}>
              <FontAwesome5 name={s.icon} size={22} color={s.color} />
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      )}

      {tab === 'kyc' && (
        pendingKyc.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyText}>No pending KYC requests 🎉</Text></View>
        ) : (
          pendingKyc.map((owner) => (
            <View key={owner._id} style={styles.kycCard}>
              <Text style={styles.kycName}>{owner.name}</Text>
              <Text style={styles.kycMeta}>{owner.email} • {owner.phone}</Text>
              {owner.kyc_data?.aadhaar && <Text style={styles.kycMeta}>Aadhaar: {owner.kyc_data.aadhaar}</Text>}
              {owner.kyc_data?.pan && <Text style={styles.kycMeta}>PAN: {owner.kyc_data.pan}</Text>}
              <View style={styles.kycActions}>
                <TouchableOpacity style={styles.approveBtn} onPress={() => handleApproveKyc(owner._id, owner.name)}>
                  <FontAwesome5 name="check" size={12} color={Colors.white} />
                  <Text style={styles.approveBtnText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.rejectBtn} onPress={() => handleRejectKyc(owner._id, owner.name)}>
                  <FontAwesome5 name="times" size={12} color={Colors.white} />
                  <Text style={styles.rejectBtnText}>Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )
      )}

      {tab === 'equipment' && (
        allEquipment.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyText}>No equipment found</Text></View>
        ) : (
          allEquipment.map((eq) => (
            <View key={eq._id} style={styles.eqCard}>
              <View style={styles.eqHeader}>
                <Text style={styles.eqName}>{eq.name}</Text>
                <View style={[styles.badge, { backgroundColor: eq.available !== false ? Colors.success : Colors.error }]}>
                  <Text style={styles.badgeText}>{eq.available !== false ? 'Active' : 'Hidden'}</Text>
                </View>
              </View>
              <Text style={styles.eqMeta}>👤 {eq.owner_name} • 📍 {eq.location} • ₹{eq.price_per_day}/day</Text>
              <TouchableOpacity style={styles.toggleBtn} onPress={() => handleToggleEquipment(eq._id, eq.name)}>
                <Text style={styles.toggleBtnText}>Toggle Visibility</Text>
              </TouchableOpacity>
            </View>
          ))
        )
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  errorTitle: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.text, marginTop: Spacing.md },
  header: { backgroundColor: Colors.navBackground, padding: Spacing.lg, alignItems: 'center' },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: 'bold', color: Colors.white },
  headerSub: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  tabs: { flexDirection: 'row', backgroundColor: Colors.white, elevation: 2 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 3, borderBottomColor: Colors.primary },
  tabText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textMuted },
  tabTextActive: { color: Colors.primary },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: Spacing.md, gap: Spacing.sm },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: Colors.white, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', elevation: 2 },
  statValue: { fontSize: FontSize.xxl, fontWeight: 'bold', marginTop: 4 },
  statLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2, textAlign: 'center' },
  empty: { alignItems: 'center', padding: Spacing.xl },
  emptyText: { fontSize: FontSize.md, color: Colors.textMuted },
  kycCard: { backgroundColor: Colors.white, borderRadius: Radius.md, margin: Spacing.md, marginBottom: 0, padding: Spacing.md, elevation: 2, borderLeftWidth: 4, borderLeftColor: Colors.warning },
  kycName: { fontSize: FontSize.md, fontWeight: 'bold', color: Colors.text },
  kycMeta: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  kycActions: { flexDirection: 'row', gap: 8, marginTop: Spacing.sm },
  approveBtn: { flex: 1, backgroundColor: Colors.success, borderRadius: Radius.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, gap: 6 },
  approveBtnText: { color: Colors.white, fontWeight: 'bold', fontSize: FontSize.sm },
  rejectBtn: { flex: 1, backgroundColor: Colors.error, borderRadius: Radius.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, gap: 6 },
  rejectBtnText: { color: Colors.white, fontWeight: 'bold', fontSize: FontSize.sm },
  eqCard: { backgroundColor: Colors.white, borderRadius: Radius.md, margin: Spacing.md, marginBottom: 0, padding: Spacing.md, elevation: 2 },
  eqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  eqName: { fontSize: FontSize.md, fontWeight: 'bold', color: Colors.text, flex: 1 },
  badge: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: Colors.white, fontSize: FontSize.xs, fontWeight: 'bold' },
  eqMeta: { fontSize: FontSize.sm, color: Colors.textMuted, marginBottom: 8 },
  toggleBtn: { borderWidth: 1, borderColor: Colors.primary, borderRadius: Radius.sm, paddingVertical: 6, alignItems: 'center' },
  toggleBtnText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '600' },
});
