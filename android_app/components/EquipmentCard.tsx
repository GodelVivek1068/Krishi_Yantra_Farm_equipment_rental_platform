import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../constants/Colors';

interface Props {
  equipment: any;
}

const CATEGORY_EMOJI: Record<string, string> = {
  tractor: '🚜', harvester: '🌾', rotavator: '⚙️',
  sprayer: '💧', thresher: '🌿', plough: '🔧', seeder: '🌱', pump: '🪣',
};

export default function EquipmentCard({ equipment: eq }: Props) {
  const router = useRouter();
  const isAvailable = eq.available !== false;
  const emoji = CATEGORY_EMOJI[eq.category] || '🚜';
  const ratingAvg = Number(eq.rating_avg || 0);
  const ratingCount = Number(eq.rating_count || 0);

  const handlePress = () => {
    router.push({ pathname: '/equipment/[id]', params: { id: eq._id } });
  };

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.85}>
      {/* Image or emoji */}
      <View style={styles.imageContainer}>
        {eq.image_url ? (
          <Image source={{ uri: eq.image_url }} style={styles.image} resizeMode="cover" />
        ) : (
          <Text style={styles.emoji}>{emoji}</Text>
        )}
        {/* Availability badge */}
        <View style={[styles.badge, isAvailable ? styles.badgeGreen : styles.badgeRed]}>
          <Text style={styles.badgeText}>{isAvailable ? 'Available' : 'Booked'}</Text>
        </View>
      </View>

      {/* Body */}
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{eq.name}</Text>

        <View style={styles.metaRow}>
          <FontAwesome5 name="map-marker-alt" size={11} color={Colors.textMuted} />
          <Text style={styles.metaText}>{eq.location}</Text>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.catTag}>
            <Text style={styles.catTagText}>{eq.category}</Text>
          </View>
          {ratingCount > 0 && (
            <View style={styles.ratingRow}>
              <FontAwesome5 name="star" size={11} color={Colors.accent} solid />
              <Text style={styles.ratingText}>{ratingAvg.toFixed(1)} ({ratingCount})</Text>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.price}>₹{eq.price_per_day}<Text style={styles.perDay}>/day</Text></Text>
          <TouchableOpacity style={styles.bookBtn} onPress={handlePress}>
            <FontAwesome5 name="calendar-check" size={12} color={Colors.white} />
            <Text style={styles.bookBtnText}>{isAvailable ? 'Book' : 'View'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    marginBottom: Spacing.md,
    overflow: 'hidden',
    shadowColor: Colors.cardShadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 4,
  },
  imageContainer: { height: 160, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  image: { width: '100%', height: '100%' },
  emoji: { fontSize: 64 },
  badge: { position: 'absolute', top: 10, right: 10, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  badgeGreen: { backgroundColor: Colors.success },
  badgeRed: { backgroundColor: Colors.error },
  badgeText: { color: Colors.white, fontSize: FontSize.xs, fontWeight: 'bold' },
  body: { padding: Spacing.md },
  name: { fontSize: FontSize.lg, fontWeight: 'bold', color: Colors.text, marginBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  metaText: { fontSize: FontSize.sm, color: Colors.textMuted, flex: 1 },
  catTag: { backgroundColor: Colors.primaryLight, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  catTagText: { fontSize: FontSize.xs, color: Colors.primaryDark, fontWeight: '600' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.sm },
  price: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.primary },
  perDay: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: 'normal' },
  bookBtn: { backgroundColor: Colors.primary, borderRadius: Radius.sm, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, gap: 6 },
  bookBtnText: { color: Colors.white, fontWeight: 'bold', fontSize: FontSize.sm },
});
