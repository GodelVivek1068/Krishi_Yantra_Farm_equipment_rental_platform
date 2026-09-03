import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, RefreshControl, ScrollView,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../../../constants/Colors';
import { equipmentApi } from '../../../lib/api';
import EquipmentCard from '../../../components/EquipmentCard';

const CATEGORIES = ['All', 'tractor', 'harvester', 'rotavator', 'sprayer', 'thresher', 'plough', 'seeder', 'pump'];

export default function EquipmentListScreen() {
  const params = useLocalSearchParams<{ search?: string; location?: string; category?: string }>();

  const [equipment, setEquipment] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState(params.search || '');
  const [location, setLocation] = useState(params.location || '');
  const [category, setCategory] = useState(params.category || 'All');

  const fetchEquipment = useCallback(async () => {
    try {
      const queryParams: Record<string, string> = {};
      if (search) queryParams.search = search;
      if (location) queryParams.location = location;
      if (category && category !== 'All') queryParams.category = category;
      const res = await equipmentApi.list(queryParams);
      setEquipment(res.equipment || res.data || []);
    } catch {
      setEquipment([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, location, category]);

  useEffect(() => { fetchEquipment(); }, [fetchEquipment]);

  const handleSearch = () => {
    setLoading(true);
    fetchEquipment();
  };

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <View style={styles.inputRow}>
          <FontAwesome5 name="search" size={13} color={Colors.textMuted} style={{ marginRight: 6 }} />
          <TextInput
            style={styles.input}
            placeholder="Search equipment..."
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
        </View>
        <View style={styles.inputRow}>
          <FontAwesome5 name="map-marker-alt" size={13} color={Colors.textMuted} style={{ marginRight: 6 }} />
          <TextInput
            style={styles.input}
            placeholder="Location..."
            placeholderTextColor={Colors.textMuted}
            value={location}
            onChangeText={setLocation}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
        </View>
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
          <Text style={styles.searchBtnText}>Search</Text>
        </TouchableOpacity>
      </View>

      {/* Category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.catScroll}
        contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingVertical: 8 }}
      >
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.catChip, category === cat && styles.catChipActive]}
            onPress={() => { setCategory(cat); setLoading(true); }}
          >
            <Text style={[styles.catChipText, category === cat && styles.catChipTextActive]}>
              {cat === 'All' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Results */}
      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={equipment}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => <EquipmentCard equipment={item} />}
          contentContainerStyle={{ padding: Spacing.md, paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchEquipment(); }}
              colors={[Colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🚜</Text>
              <Text style={styles.emptyTitle}>No Equipment Found</Text>
              <Text style={styles.emptyDesc}>Try adjusting your search or category filter.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  searchBar: { backgroundColor: Colors.white, padding: Spacing.md, gap: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceAlt, borderRadius: Radius.sm, paddingHorizontal: 10, borderWidth: 1, borderColor: Colors.border },
  input: { flex: 1, paddingVertical: 9, fontSize: FontSize.md, color: Colors.text },
  searchBtn: { backgroundColor: Colors.primary, borderRadius: Radius.sm, paddingVertical: 10, alignItems: 'center' },
  searchBtnText: { color: Colors.white, fontWeight: 'bold', fontSize: FontSize.md },
  catScroll: { backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border, maxHeight: 54 },
  catChip: { backgroundColor: Colors.surfaceAlt, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 6, marginRight: 8, borderWidth: 1, borderColor: Colors.border },
  catChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catChipText: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: '600' },
  catChipTextActive: { color: Colors.white },
  empty: { alignItems: 'center', marginTop: 60, paddingHorizontal: Spacing.lg },
  emptyEmoji: { fontSize: 56, marginBottom: Spacing.sm },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.text },
  emptyDesc: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', marginTop: 6 },
});
