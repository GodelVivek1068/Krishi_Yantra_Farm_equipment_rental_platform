import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, FlatList, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Colors';
import { equipmentApi } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import EquipmentCard from '../../components/EquipmentCard';

const CATEGORIES = ['All', 'tractor', 'harvester', 'rotavator', 'sprayer', 'thresher', 'plough', 'seeder', 'pump'];

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [featured, setFeatured] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const stats = [
    { icon: 'tractor', value: '500+', label: 'Equipment Listed' },
    { icon: 'users', value: '2000+', label: 'Farmers Served' },
    { icon: 'map-marker-alt', value: '50+', label: 'Districts Covered' },
  ];

  const loadFeatured = async () => {
    try {
      const res = await equipmentApi.list({ limit: '6' });
      setFeatured(res.equipment || res.data || []);
    } catch { setFeatured([]); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { loadFeatured(); }, []);

  const handleSearch = () => {
    router.push({ pathname: '/(tabs)/equipment/index', params: { search, location } });
  };

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadFeatured(); }} colors={[Colors.primary]} />}
    >
      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>🚜 KrishiYantra</Text>
        <Text style={styles.heroSubtitle}>Rent farm equipment near you — affordable, easy, trusted.</Text>

        {/* Search Bar */}
        <View style={styles.searchCard}>
          <View style={styles.inputRow}>
            <FontAwesome5 name="search" size={14} color={Colors.textMuted} style={styles.inputIcon} />
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
            <FontAwesome5 name="map-marker-alt" size={14} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Location (city / district)"
              placeholderTextColor={Colors.textMuted}
              value={location}
              onChangeText={setLocation}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
          </View>
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
            <FontAwesome5 name="search" size={14} color={Colors.white} />
            <Text style={styles.searchBtnText}>Search Equipment</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        {stats.map((s, i) => (
          <View key={i} style={styles.statCard}>
            <FontAwesome5 name={s.icon} size={22} color={Colors.primary} />
            <Text style={styles.statValue}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Categories */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Browse by Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
          {CATEGORIES.slice(1).map((cat) => (
            <TouchableOpacity
              key={cat}
              style={styles.catChip}
              onPress={() => router.push({ pathname: '/(tabs)/equipment/index', params: { category: cat } })}
            >
              <Text style={styles.catChipText}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Featured Equipment */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Featured Equipment</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/equipment/index')}>
            <Text style={styles.seeAll}>See All →</Text>
          </TouchableOpacity>
        </View>
        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginVertical: 30 }} />
        ) : featured.length === 0 ? (
          <Text style={styles.emptyText}>No equipment found.</Text>
        ) : (
          featured.map((eq) => <EquipmentCard key={eq._id} equipment={eq} />)
        )}
      </View>

      {/* How It Works */}
      <View style={styles.howSection}>
        <Text style={styles.sectionTitle}>How It Works</Text>
        {[
          { icon: 'search', step: '1', title: 'Search Equipment', desc: 'Find tractors, harvesters & more near your location.' },
          { icon: 'calendar-check', step: '2', title: 'Book Online', desc: 'Select dates and confirm your rental instantly.' },
          { icon: 'truck', step: '3', title: 'Use & Return', desc: 'Owner delivers to your farm. Use and return on time.' },
        ].map((item) => (
          <View key={item.step} style={styles.howStep}>
            <View style={styles.howNum}><Text style={styles.howNumText}>{item.step}</Text></View>
            <View style={styles.howContent}>
              <Text style={styles.howTitle}>{item.title}</Text>
              <Text style={styles.howDesc}>{item.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Testimonials */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Farmer Stories</Text>
        {[
          { text: '"Saved ₹40,000 this season by renting a tractor instead of hiring a contractor."', name: 'Rajesh Patil, Solapur' },
          { text: '"Listed my harvester and earned ₹18,000 in one month during idle season!"', name: 'Suresh Yadav, Nashik' },
          { text: '"The booking process is so simple. Got a tractor delivered to my field!"', name: 'Priya Devi, Pune' },
        ].map((t, i) => (
          <View key={i} style={styles.testimonialCard}>
            <Text style={styles.testimonialText}>{t.text}</Text>
            <Text style={styles.testimonialName}>— {t.name}</Text>
          </View>
        ))}
      </View>

      {/* CTA for owners */}
      {!user && (
        <View style={styles.ctaSection}>
          <Text style={styles.ctaTitle}>Own farm equipment?</Text>
          <Text style={styles.ctaDesc}>List it on KrishiYantra and earn during idle season.</Text>
          <TouchableOpacity style={styles.ctaBtn} onPress={() => router.push('/(auth)/register')}>
            <Text style={styles.ctaBtnText}>Get Started →</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  hero: { backgroundColor: Colors.navBackground, padding: Spacing.lg, paddingTop: Spacing.xl },
  heroTitle: { fontSize: FontSize.xxxl, fontWeight: 'bold', color: Colors.white, textAlign: 'center' },
  heroSubtitle: { fontSize: FontSize.md, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: 6, marginBottom: Spacing.md },
  searchCard: { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, gap: 10 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceAlt, borderRadius: Radius.sm, paddingHorizontal: 10, borderWidth: 1, borderColor: Colors.border },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, paddingVertical: 10, fontSize: FontSize.md, color: Colors.text },
  searchBtn: { backgroundColor: Colors.primary, borderRadius: Radius.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 8 },
  searchBtnText: { color: Colors.white, fontWeight: 'bold', fontSize: FontSize.md },
  statsRow: { flexDirection: 'row', padding: Spacing.md, gap: Spacing.sm },
  statCard: { flex: 1, backgroundColor: Colors.white, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', shadowColor: Colors.cardShadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 4, elevation: 3 },
  statValue: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.primary, marginTop: 4 },
  statLabel: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', marginTop: 2 },
  section: { padding: Spacing.md },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  sectionTitle: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.text, marginBottom: Spacing.sm },
  seeAll: { color: Colors.primary, fontWeight: '600', fontSize: FontSize.sm },
  catScroll: { flexDirection: 'row' },
  catChip: { backgroundColor: Colors.primaryLight, borderRadius: Radius.full, paddingHorizontal: 16, paddingVertical: 8, marginRight: 8, borderWidth: 1, borderColor: Colors.border },
  catChipText: { color: Colors.primaryDark, fontWeight: '600', fontSize: FontSize.sm },
  emptyText: { color: Colors.textMuted, textAlign: 'center', marginVertical: 20 },
  howSection: { backgroundColor: Colors.primaryLight, padding: Spacing.md, margin: Spacing.md, borderRadius: Radius.lg },
  howStep: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.md },
  howNum: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.sm },
  howNumText: { color: Colors.white, fontWeight: 'bold', fontSize: FontSize.md },
  howContent: { flex: 1 },
  howTitle: { fontSize: FontSize.md, fontWeight: 'bold', color: Colors.text },
  howDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  testimonialCard: { backgroundColor: Colors.white, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderLeftWidth: 4, borderLeftColor: Colors.primary, elevation: 2 },
  testimonialText: { fontSize: FontSize.sm, color: Colors.text, fontStyle: 'italic', lineHeight: 20 },
  testimonialName: { fontSize: FontSize.sm, fontWeight: 'bold', color: Colors.primary, marginTop: 8 },
  ctaSection: { backgroundColor: Colors.primary, margin: Spacing.md, borderRadius: Radius.lg, padding: Spacing.lg, alignItems: 'center' },
  ctaTitle: { fontSize: FontSize.xl, fontWeight: 'bold', color: Colors.white },
  ctaDesc: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.85)', marginTop: 4, textAlign: 'center' },
  ctaBtn: { marginTop: Spacing.md, backgroundColor: Colors.white, borderRadius: Radius.sm, paddingHorizontal: 24, paddingVertical: 12 },
  ctaBtnText: { color: Colors.primary, fontWeight: 'bold', fontSize: FontSize.md },
});
