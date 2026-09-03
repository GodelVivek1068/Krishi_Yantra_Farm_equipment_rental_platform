import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Colors';
import { rentalsApi } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  confirmed: '#16a34a',
  active: '#3b82f6',
  completed: '#6b7280',
  cancelled: '#dc2626',
};

function RentalCard({ rental, onCancel, onReview }: { rental: any; onCancel: (id: string) => void; onReview: (rental: any) => void }) {
  const status = rental.status || 'pending';
  const color = STATUS_COLORS[status] || '#6b7280';
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.equipmentName}>{rental.equipment_name || 'Equipment'}</Text>
        <View style={[styles.statusBadge, { backgroundColor: color }]}>
          <Text style={styles.statusText}>{status.toUpperCase()}</Text>
        </View>
      </View>
      <View style={styles.cardMeta}>
        <View style={styles.metaItem}>
          <FontAwesome5 name="calendar" size={12} color={Colors.textMuted} />
          <Text style={styles.metaText}>{rental.start_date} → {rental.end_date}</Text>
        </View>
        <View style={styles.metaItem}>
          <FontAwesome5 name="rupee-sign" size={12} color={Colors.primary} />
          <Text style={styles.metaText}>₹{rental.total_amount}</Text>
        </View>
        {rental.owner_name && (
          <View style={styles.metaItem}>
            <FontAwesome5 name="user" size={12} color={Colors.textMuted} />
            <Text style={styles.metaText}>Owner: {rental.owner_name}</Text>
          </View>
        )}
      </View>
      <View style={styles.cardActions}>
        {(status === 'pending' || status === 'confirmed') && (
          <TouchableOpacity style={styles.cancelBtn} onPress={() => onCancel(rental._id)}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        )}
        {status === 'completed' && !rental.reviewed && (
          <TouchableOpacity style={styles.reviewBtn} onPress={() => onReview(rental)}>
            <FontAwesome5 name="star" size={12} color={Colors.white} />
            <Text style={styles.reviewBtnText}>Leave Review</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function MyRentalsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [rentals, setRentals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadRentals = async () => {
    try {
      const res = await rentalsApi.myRentals();
      setRentals(res.rentals || res.data || []);
    } catch { setRentals([]); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => {
    if (user) loadRentals();
    else { setLoading(false); }
  }, [user]);

  const handleCancel = (id: string) => {
    Alert.alert('Cancel Booking', 'Are you sure you want to cancel this rental?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel', style: 'destructive', onPress: async () => {
          try {
            await rentalsApi.cancel(id);
            loadRentals();
          } catch (e: any) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  };

  const handleReview = (rental: any) => {
    Alert.prompt(
      'Leave a Review',
      `Rate and review your experience with ${rental.equipment_name}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit', onPress: async (text) => {
            try {
              await rentalsApi.review(rental._id, 4, text || '');
              loadRentals();
              Alert.alert('Review Submitted! ⭐', 'Thank you for your feedback.');
            } catch (e: any) { Alert.alert('Error', e.message); }
          }
        },
      ],
      'plain-text',
    );
  };

  if (!user) {
    return (
      <View style={styles.centered}>
        <FontAwesome5 name="user-lock" size={48} color={Colors.textLight} />
        <Text style={styles.emptyTitle}>Login Required</Text>
        <Text style={styles.emptyDesc}>Please login to view your rentals.</Text>
        <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.loginBtnText}>Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) return <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />;

  return (
    <FlatList
      data={rentals}
      keyExtractor={(item) => item._id}
      renderItem={({ item }) => (
        <RentalCard rental={item} onCancel={handleCancel} onReview={handleReview} />
      )}
      contentContainerStyle={{ padding: Spacing.md, paddingBottom: 80 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRentals(); }} colors={[Colors.primary]} />
      }
      ListEmptyComponent={
        <View style={styles.centered}>
          <Text style={{ fontSize: 52 }}>📋</Text>
          <Text style={styles.emptyTitle}>No Rentals Yet</Text>
          <Text style={styles.emptyDesc}>Browse equipment and make your first booking!</Text>
          <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/(tabs)/equipment/index')}>
            <Text style={styles.loginBtnText}>Browse Equipment</Text>
          </TouchableOpacity>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, marginTop: 60 },
  card: { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md, elevation: 3, shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  equipmentName: { fontSize: FontSize.lg, fontWeight: 'bold', color: Colors.text, flex: 1 },
  statusBadge: { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { color: Colors.white, fontSize: FontSize.xs, fontWeight: 'bold' },
  cardMeta: { gap: 5, marginBottom: Spacing.sm },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: FontSize.sm, color: Colors.textMuted },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  cancelBtn: { borderWidth: 1, borderColor: Colors.error, borderRadius: Radius.sm, paddingHorizontal: 12, paddingVertical: 6 },
  cancelBtnText: { color: Colors.error, fontSize: FontSize.sm, fontWeight: '600' },
  reviewBtn: { backgroundColor: Colors.accent, borderRadius: Radius.sm, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 5 },
  reviewBtnText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: '600' },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.text, marginTop: Spacing.md },
  emptyDesc: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', marginTop: 4, marginBottom: Spacing.lg },
  loginBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: 24, paddingVertical: 12 },
  loginBtnText: { color: Colors.white, fontWeight: 'bold', fontSize: FontSize.md },
});
