import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Image, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, TextInput, Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Colors';
import { equipmentApi, rentalsApi } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

const CATEGORY_EMOJI: Record<string, string> = {
  tractor: '🚜', harvester: '🌾', rotavator: '⚙️',
  sprayer: '💧', thresher: '🌿', plough: '🔧', seeder: '🌱', pump: '🪣',
};

export default function EquipmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [equipment, setEquipment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [bookingModal, setBookingModal] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [totalCost, setTotalCost] = useState(0);

  useEffect(() => {
    loadEquipment();
  }, [id]);

  useEffect(() => {
    if (startDate && endDate && equipment) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      setTotalCost(days * equipment.price_per_day);
    }
  }, [startDate, endDate, equipment]);

  const loadEquipment = async () => {
    try {
      const res = await equipmentApi.detail(id);
      setEquipment(res.equipment || res);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load equipment.');
    } finally {
      setLoading(false);
    }
  };

  const handleBook = async () => {
    if (!user) {
      Alert.alert('Login Required', 'Please login to book equipment.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Login', onPress: () => router.push('/(auth)/login') },
      ]);
      return;
    }
    if (user.role === 'owner') {
      Alert.alert('Not Allowed', 'Owners cannot book equipment. Please use a farmer account.');
      return;
    }
    if (!startDate || !endDate) {
      Alert.alert('Missing Dates', 'Please enter both start and end dates (YYYY-MM-DD).');
      return;
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      Alert.alert('Invalid Dates', 'Please enter valid dates in YYYY-MM-DD format.');
      return;
    }
    if (end <= start) {
      Alert.alert('Invalid Dates', 'End date must be after start date.');
      return;
    }

    setBookingLoading(true);
    try {
      const res = await rentalsApi.create({
        equipment_id: equipment._id,
        start_date: startDate,
        end_date: endDate,
      });
      setBookingModal(false);
      Alert.alert('Booking Confirmed! 🎉', `Your booking is confirmed. Total: ₹${totalCost}`, [
        { text: 'View My Rentals', onPress: () => router.push('/(tabs)/rentals') },
        { text: 'OK' },
      ]);
    } catch (e: any) {
      Alert.alert('Booking Failed', e.message || 'Could not create booking.');
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!equipment) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Equipment not found.</Text>
      </View>
    );
  }

  const isAvailable = equipment.available !== false;
  const emoji = CATEGORY_EMOJI[equipment.category] || '🚜';
  const ratingAvg = Number(equipment.rating_avg || 0);
  const ratingCount = Number(equipment.rating_count || 0);

  return (
    <>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Image */}
        <View style={styles.imageContainer}>
          {equipment.image_url ? (
            <Image source={{ uri: equipment.image_url }} style={styles.image} resizeMode="cover" />
          ) : (
            <Text style={styles.emoji}>{emoji}</Text>
          )}
          <View style={[styles.availBadge, isAvailable ? styles.availGreen : styles.availRed]}>
            <Text style={styles.availText}>{isAvailable ? '✓ Available' : '✗ Unavailable'}</Text>
          </View>
        </View>

        <View style={styles.content}>
          {/* Name & Price */}
          <View style={styles.nameRow}>
            <Text style={styles.name}>{equipment.name}</Text>
            <Text style={styles.price}>₹{equipment.price_per_day}<Text style={styles.perDay}>/day</Text></Text>
          </View>

          {/* Meta */}
          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <FontAwesome5 name="map-marker-alt" size={14} color={Colors.primary} />
              <Text style={styles.metaText}>{equipment.location}</Text>
            </View>
            <View style={styles.metaItem}>
              <FontAwesome5 name="tag" size={14} color={Colors.primary} />
              <Text style={styles.metaText}>{equipment.category}</Text>
            </View>
            {ratingCount > 0 && (
              <View style={styles.metaItem}>
                <FontAwesome5 name="star" size={14} color={Colors.accent} solid />
                <Text style={styles.metaText}>{ratingAvg.toFixed(1)} ({ratingCount} reviews)</Text>
              </View>
            )}
            {equipment.owner_name && (
              <View style={styles.metaItem}>
                <FontAwesome5 name="user" size={14} color={Colors.primary} />
                <Text style={styles.metaText}>Owner: {equipment.owner_name}</Text>
              </View>
            )}
          </View>

          {/* Description */}
          {equipment.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>{equipment.description}</Text>
            </View>
          )}

          {/* Specs */}
          {(equipment.model || equipment.year || equipment.condition) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Specifications</Text>
              {equipment.model && <Text style={styles.specText}>Model: {equipment.model}</Text>}
              {equipment.year && <Text style={styles.specText}>Year: {equipment.year}</Text>}
              {equipment.condition && <Text style={styles.specText}>Condition: {equipment.condition}</Text>}
            </View>
          )}

          {/* Reviews */}
          {equipment.reviews && equipment.reviews.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Reviews</Text>
              {equipment.reviews.map((r: any, i: number) => (
                <View key={i} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <Text style={styles.reviewerName}>{r.farmer_name || 'Farmer'}</Text>
                    <View style={styles.ratingRow}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <FontAwesome5
                          key={star}
                          name="star"
                          size={11}
                          color={star <= r.rating ? Colors.accent : Colors.textLight}
                          solid={star <= r.rating}
                        />
                      ))}
                    </View>
                  </View>
                  {r.review && <Text style={styles.reviewText}>{r.review}</Text>}
                </View>
              ))}
            </View>
          )}

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* Sticky Book Button */}
      <View style={styles.stickyBar}>
        <View style={styles.stickyPrice}>
          <Text style={styles.stickyPriceText}>₹{equipment.price_per_day}</Text>
          <Text style={styles.stickyPriceLabel}>/day</Text>
        </View>
        <TouchableOpacity
          style={[styles.bookBtn, !isAvailable && styles.bookBtnDisabled]}
          onPress={() => isAvailable ? setBookingModal(true) : null}
          disabled={!isAvailable}
        >
          <FontAwesome5 name="calendar-check" size={15} color={Colors.white} />
          <Text style={styles.bookBtnText}>{isAvailable ? 'Book Now' : 'Unavailable'}</Text>
        </TouchableOpacity>
      </View>

      {/* Booking Modal */}
      <Modal visible={bookingModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Book: {equipment.name}</Text>
            <TouchableOpacity onPress={() => setBookingModal(false)}>
              <FontAwesome5 name="times" size={20} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.fieldLabel}>Start Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="e.g. 2025-01-15"
              placeholderTextColor={Colors.textMuted}
              value={startDate}
              onChangeText={setStartDate}
            />

            <Text style={styles.fieldLabel}>End Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="e.g. 2025-01-20"
              placeholderTextColor={Colors.textMuted}
              value={endDate}
              onChangeText={setEndDate}
            />

            {totalCost > 0 && (
              <View style={styles.costBox}>
                <Text style={styles.costLabel}>Estimated Total</Text>
                <Text style={styles.costAmount}>₹{totalCost}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.confirmBtn, bookingLoading && { opacity: 0.7 }]}
              onPress={handleBook}
              disabled={bookingLoading}
            >
              {bookingLoading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.confirmBtnText}>Confirm Booking</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: FontSize.lg, color: Colors.textMuted },
  imageContainer: { height: 240, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  image: { width: '100%', height: '100%' },
  emoji: { fontSize: 80 },
  availBadge: { position: 'absolute', bottom: 12, right: 12, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 5 },
  availGreen: { backgroundColor: Colors.success },
  availRed: { backgroundColor: Colors.error },
  availText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: 'bold' },
  content: { padding: Spacing.md },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md },
  name: { fontSize: FontSize.xxl, fontWeight: 'bold', color: Colors.text, flex: 1, marginRight: 8 },
  price: { fontSize: FontSize.xxl, fontWeight: 'bold', color: Colors.primary },
  perDay: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: 'normal' },
  metaGrid: { backgroundColor: Colors.white, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md, gap: 8, elevation: 2 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: { fontSize: FontSize.sm, color: Colors.text },
  section: { marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: 'bold', color: Colors.text, marginBottom: 8 },
  description: { fontSize: FontSize.md, color: Colors.textSecondary, lineHeight: 22 },
  specText: { fontSize: FontSize.sm, color: Colors.text, marginBottom: 4 },
  reviewCard: { backgroundColor: Colors.white, borderRadius: Radius.md, padding: Spacing.sm, marginBottom: 8, elevation: 1 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  reviewerName: { fontSize: FontSize.sm, fontWeight: 'bold', color: Colors.text },
  ratingRow: { flexDirection: 'row', gap: 2 },
  reviewText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic' },
  stickyBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.border, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, elevation: 10 },
  stickyPrice: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  stickyPriceText: { fontSize: FontSize.xxl, fontWeight: 'bold', color: Colors.primary },
  stickyPriceLabel: { fontSize: FontSize.sm, color: Colors.textMuted },
  bookBtn: { flex: 1, backgroundColor: Colors.primary, borderRadius: Radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
  bookBtnDisabled: { backgroundColor: Colors.textLight },
  bookBtnText: { color: Colors.white, fontWeight: 'bold', fontSize: FontSize.lg },
  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: FontSize.lg, fontWeight: 'bold', color: Colors.text, flex: 1 },
  modalBody: { padding: Spacing.md },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text, marginBottom: 6, marginTop: Spacing.sm },
  fieldInput: { backgroundColor: Colors.white, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: FontSize.md, color: Colors.text },
  costBox: { backgroundColor: Colors.primaryLight, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', marginVertical: Spacing.md },
  costLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  costAmount: { fontSize: FontSize.xxxl, fontWeight: 'bold', color: Colors.primary },
  confirmBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center', marginTop: Spacing.sm },
  confirmBtnText: { color: Colors.white, fontWeight: 'bold', fontSize: FontSize.lg },
});
