import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, SafeAreaView } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { TrailsApi, Trail } from '../../services/api/trails';
import { colors, spacing, typography } from '../../theme';

type DetailScreenRouteProp = RouteProp<RootStackParamList, 'TrailDetail'>;
type DetailScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'TrailDetail'>;

interface Props {
  route: DetailScreenRouteProp;
  navigation: DetailScreenNavigationProp;
}

// Temporary POI representation
interface POI {
  name: string;
  category: string;
  distanceFromStart: string;
}

export default function DetailScreen({ route, navigation }: Props) {
  const { trailId } = route.params;
  const [trail, setTrail] = useState<Trail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTrail() {
      try {
        const data = await TrailsApi.fetchAll();
        const selected = data.find((t) => t.id === trailId);
        setTrail(selected || null);
      } catch (err) {
        console.error('Error fetching trail details', err);
      } finally {
        setLoading(false);
      }
    }
    loadTrail();
  }, [trailId]);

  const formatDistance = (meters: number) => {
    return (meters / 1000).toFixed(1) + ' km';
  };

  const getDifficultyText = (difficulty: string) => {
    switch (difficulty) {
      case 'T': return 'Turistico (Facile)';
      case 'E': return 'Escursionistico (Medio)';
      case 'EE': return 'Escursionisti Esperti (Difficile)';
      case 'EEA': return 'Escursionisti Esperti Attrezzati (Molto Difficile)';
      default: return 'Non Specificato';
    }
  };

  // Mock POIs for display
  const pois: POI[] = [
    { name: 'Sorgente d\'Acqua Limpida', category: 'Fontana', distanceFromStart: '1.2 km' },
    { name: 'Belvedere Gran Sasso', category: 'Punto Panoramico', distanceFromStart: '3.5 km' },
    { name: 'Rifugio Valle Castellana', category: 'Rifugio', distanceFromStart: '5.8 km' },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.success} />
        <Text style={styles.loadingText}>Caricamento dettagli...</Text>
      </View>
    );
  }

  if (!trail) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Sentiero non trovato.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Torna alla lista</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBackBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.headerBackBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{trail.name}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Technical Specs Dashboard */}
        <View style={styles.specsGrid}>
          <View style={styles.specBox}>
            <Text style={styles.specLabel}>LUNGHEZZA</Text>
            <Text style={styles.specValue}>{formatDistance(trail.distanceMeters)}</Text>
          </View>
          <View style={styles.specBox}>
            <Text style={styles.specLabel}>DISLIVELLO</Text>
            <Text style={styles.specValue}>+{trail.elevationGain}m</Text>
          </View>
          <View style={styles.specBox}>
            <Text style={styles.specLabel}>TEMPO MEDIO</Text>
            <Text style={styles.specValue}>{trail.avgDurationMinutes}m</Text>
          </View>
        </View>

        {/* Difficulty Details */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>DIFFICOLTÀ CAI</Text>
          <Text style={styles.difficultyValue}>{getDifficultyText(trail.difficulty)} ({trail.difficulty})</Text>
        </View>

        {/* Trail Description */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>DESCRIZIONE DEL PERCORSO</Text>
          <Text style={styles.descriptionText}>
            {trail.description || 'Nessuna descrizione dettagliata disponibile per questo percorso. Si raccomanda prudenza e abbigliamento consono per escursioni in montagna.'}
          </Text>
        </View>

        {/* Points of Interest (POIs) */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>PUNTI DI INTERESSE (POI)</Text>
          {pois.map((poi, idx) => (
            <View key={idx} style={styles.poiItem}>
              <View style={styles.poiDot} />
              <View style={styles.poiTextContainer}>
                <Text style={styles.poiName}>{poi.name}</Text>
                <Text style={styles.poiMeta}>{poi.category} • a {poi.distanceFromStart} dalla partenza</Text>
              </View>
            </View>
          ))}
        </View>

      </ScrollView>

      {/* Prominent Footer Button */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.primaryButton}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('CheckIn', { 
            trailId: trail.id,
            trailName: trail.name,
            avgDurationMinutes: trail.avgDurationMinutes
          })}
        >
          <Text style={styles.primaryButtonText}>Prepara Check-In di Sicurezza</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    color: colors.textMuted,
    marginTop: spacing.sm,
    fontSize: typography.sizes.sm,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.sizes.md,
    marginBottom: spacing.md,
  },
  backBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  backBtnText: {
    color: colors.text,
    fontWeight: typography.weights.bold,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerBackBtnText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  specsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  specBox: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.sm,
    marginHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  specLabel: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: colors.textMuted,
    marginBottom: 4,
  },
  specValue: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.success,
  },
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    letterSpacing: 1,
  },
  difficultyValue: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  descriptionText: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    lineHeight: 22,
  },
  poiItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  poiDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: spacing.sm,
  },
  poiTextContainer: {
    flex: 1,
  },
  poiName: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  poiMeta: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  primaryButton: {
    backgroundColor: colors.primaryLight,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
});
