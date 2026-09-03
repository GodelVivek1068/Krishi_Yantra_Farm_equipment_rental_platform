import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Colors';
import { equipmentApi, rentalsApi } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b', confirmed: '#16a34a', active: '#3b82f6',
  completed: '#6b7280', cancelled: '#dc2626',
};

export default function OwnerDashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [myEquipment, setMyEquipment] = useState<any[]>([]);
  const [myRentals, setMyRentals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'equipment' | 'rentals'>('equipment');

  const loadData = async () => {
    try {
      const [eqRes, rentRes] = await Promise.all([
        equipmentApi.myEquipment(),
        rentalsApi.ownerRentals(),
      ]);
      setMyEquipment(eqRes.equipment || eqRes.data || []);
      setMyRentals(rentRes.rentals || rentRes.data || []);
    } catch { }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { loadData(); }, []);

  const handleDeleteEquipment = (id: string, name: string) => {
    Alert.alert('Delete Equipment', `Remove "${name}" from listings?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try { await equipmentApi.delete(id); loadData(); }
          catch (e: any) { Alert.alert('Error', e.message); }
        }
      },
    ]);
  };

  const stats = [
    { label: 'Listed', value: myEquipment.length, icon: 'tractor', color: Colors.primary },
    { label: 'Bookings', value: myRentals.length, icon: 'calendar-check', color: Colors.accent },
    { label: 'Active', value: myRentals.filter((r) => r.status === 'active').length, icon: 'play-circle', color: Colors.info },
    { label: 'Earnings', value: `₹${myRentals.filter(r => r.status === 'completed').reduce((s, r) => s + (r.total_amount || 0), 0)}`, icon: 'rupee-sign', color: Colors.success },
  ];

  if (!user || user.role !== 'owner') {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Owner Access Only</Text>
        <Text style={styles.errorDesc}>This section is for equipment owners.</Text>
      </View>
    );
  }

  if (loading) return <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />;

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} colors={[Colors.primary]} />}
    >
      {/* Stats */}
      <View style={styles.statsGrid}>
        {stats.map((s, i) => (
          <View key={i} style={styles.statCard}>
            <FontAwesome5 name={s.icon} size={20} color={s.color} />
            <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Add Equipment Button */}
      <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/owner/list-equipment')}>
        <FontAwesome5 name="plus" size={14} color={Colors.white} />
        <Text style={styles.addBtnText}>Add New Equipment</Text>
      </TouchableOpacity>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'equipment' && styles.tabActive]}
          onPress={() => setTab('equipment')}
        >
          <Text style={[styles.tabText, tab === 'equipment' && styles.tabTextActive]}>My Equipment</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'rentals' && styles.tabActive]}
          onPress={() => setTab('rentals')}
        >
          <Text style={[styles.tabText, tab === 'rentals' && styles.tabTextActive]}>Rental Requests</Text>
        </TouchableOpacity>
      </View>

      {tab === 'equipment' ? (
        myEquipment.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 48 }}>🚜</Text>
            <Text style={styles.emptyTitle}>No Equipment Listed</Text>
            <Text style={styles.emptyDesc}>Add your first equipment to start earning!</Text>
          </View>
        ) : (
          myEquipment.map((eq) => (
            <View key={eq._id} style={styles.eqCard}>
              <View style={styles.eqHeader}>
                <Text style={styles.eqName}>{eq.name}</Text>
                <View style={[styles.statusBadge, { backgroundColor: eq.available !== false ? Colors.success : Colors.error }]}>
                  <Text style={styles.statusText}>{eq.available !== false ? 'Active' : 'Inactive'}</Text>
                </View>
              </View>
              <Text style={styles.eqMeta}>📍 {eq.location} • ₹{eq.price_per_day}/day • {eq.category}</Text>
              <View style={styles.eqActions}>
                <TouchableOpacity style={styles.eqEditBtn} onPress={() => Alert.alert('Edit Equipment', 'Edit functionality coming soon.')}>
                  <FontAwesome5 name="edit" size={12} color={Colors.primary} />
                  <Text style={styles.eqEditText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.eqDeleteBtn} onPress={() => handleDeleteEquipment(eq._id, eq.name)}>
                  <FontAwesome5 name="trash" size={12} color={Colors.error} />
                  <Text style={styles.eqDeleteText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )
      ) : (
        myRentals.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 48 }}>📋</Text>
            <Text style={styles.emptyTitle}>No Rental Requests</Text>
            <Text style={styles.emptyDesc}>Bookings will appear here once farmers rent your equipment.</Text>
          </View>
        ) : (
          myRentals.map((r) => (
            <View key={r._id} style={styles.rentalCard}>
              <View style={styles.rentalHeader}>
                <Text style={styles.rentalName}>{r.equipment_name}</Text>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[r.status] || '#6b7280' }]}>
                  <Text style={styles.statusText}>{(r.status || '').toUpperCase()}</Text>
                </View>
              </View>
              <Text style={styles.rentalMeta}>👤 {r.farmer_name} • 📅 {r.start_date} → {r.end_date}</Text>
              <Text style={styles.rentalMeta}>💰 ₹{r.total_amount}</Text>
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
  errorTitle: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.text },
  errorDesc: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 4 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: Spacing.md, gap: Spacing.sm },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: Colors.white, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', elevation: 3 },
  statValue: { fontSize: FontSize.xxl, fontWeight: 'bold', marginTop: 4 },
  statLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  addBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: Spacing.md, paddingVertical: 12, marginBottom: Spacing.sm },
  addBtnText: { color: Colors.white, fontWeight: 'bold', fontSize: FontSize.md },
  tabs: { flexDirection: 'row', backgroundColor: Colors.white, borderRadius: Radius.lg, margin: Spacing.md, marginBottom: 0, overflow: 'hidden', elevation: 2 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textMuted },
  tabTextActive: { color: Colors.white },
  empty: { alignItems: 'center', padding: Spacing.xl, marginTop: Spacing.md },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: 'bold', color: Colors.text, marginTop: Spacing.sm },
  emptyDesc: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', marginTop: 4 },
  eqCard: { backgroundColor: Colors.white, borderRadius: Radius.md, margin: Spacing.md, marginBottom: 0, padding: Spacing.md, elevation: 2 },
  eqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  eqName: { fontSize: FontSize.md, fontWeight: 'bold', color: Colors.text, flex: 1 },
  statusBadge: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { color: Colors.white, fontSize: FontSize.xs, fontWeight: 'bold' },
  eqMeta: { fontSize: FontSize.sm, color: Colors.textMuted, marginBottom: Spacing.sm },
  eqActions: { flexDirection: 'row', gap: 8 },
  eqEditBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: Colors.primary, borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 5 },
  eqEditText: { color: Colors.primary, fontSize: FontSize.xs, fontWeight: '600' },
  eqDeleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: Colors.error, borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 5 },
  eqDeleteText: { color: Colors.error, fontSize: FontSize.xs, fontWeight: '600' },
  rentalCard: { backgroundColor: Colors.white, borderRadius: Radius.md, margin: Spacing.md, marginBottom: 0, padding: Spacing.md, elevation: 2 },
  rentalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  rentalName: { fontSize: FontSize.md, fontWeight: 'bold', color: Colors.text, flex: 1 },
  rentalMeta: { fontSize: FontSize.sm, color: Colors.textMuted, marginBottom: 2 },
});
