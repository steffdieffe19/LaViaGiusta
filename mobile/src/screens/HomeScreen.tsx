import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator, SafeAreaView, StatusBar } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { TrailsApi, Trail } from '../services/api/trails';
import { useHikeStore } from '../store/useHikeStore';
import { colors, spacing, typography } from '../theme';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

interface Props {
  navigation: HomeScreenNavigationProp;
}

export default function HomeScreen({ navigation }: Props) {
  const [trails, setTrails] = useState<Trail[]>([]);
  const [loading, setLoading] = useState(true);
  
  const status = useHikeStore((state) => state.status);

  // Auto-redirect if an active or alert hike session is detected
  useEffect(() => {
    if (status === 'watchdog_alert') {
      navigation.replace('Alert');
    } else if (status === 'active' || status === 'checked_in') {
      navigation.replace('ActiveHike');
    }
  }, [status, navigation]);

  useEffect(() => {
    async function loadTrails() {
      try {
        const data = await TrailsApi.fetchAll();
        setTrails(data);
      } catch (err) {
        console.error('Error loading trails', err);
      } finally {
        setLoading(false);
      }
    }
    loadTrails();
  }, []);

  const formatDistance = (meters: number) => {
    return (meters / 1000).toFixed(1) + ' km';
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'T': return '#52b788'; // Easy Green
      case 'E': return '#ffb703'; // Moderate Yellow
      case 'EE': return '#ff6b35'; // Hard Orange
      case 'EEA': return '#e63946'; // Expert Red
      default: return colors.primaryLight;
    }
  };

  const renderTrailItem = ({ item }: { item: Trail }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.8}
      onPress={() => navigation.navigate('TrailDetail', { trailId: item.id })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.trailName} numberOfLines={1}>{item.name}</Text>
        <View style={[styles.badge, { backgroundColor: getDifficultyColor(item.difficulty) }]}>
          <Text style={styles.badgeText}>{item.difficulty}</Text>
        </View>
      </View>
      
      <Text style={styles.description} numberOfLines={2}>
        {item.description || 'Nessuna descrizione disponibile per questo sentiero.'}
      </Text>

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Distanza</Text>
          <Text style={styles.statValue}>{formatDistance(item.distanceMeters)}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Dislivello</Text>
          <Text style={styles.statValue}>+{item.elevationGain}m</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Durata</Text>
          <Text style={styles.statValue}>{item.avgDurationMinutes}m</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <View style={styles.header}>
        <Text style={styles.title}>LaViaGiusta</Text>
        <Text style={styles.subtitle}>Valle Castellana — Sicurezza & Territorio</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.success} />
          <Text style={styles.loadingText}>Caricamento sentieri...</Text>
        </View>
      ) : (
        <FlatList
          data={trails}
          keyExtractor={(item) => item.id}
          renderItem={renderTrailItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Nessun sentiero trovato.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textMuted,
    marginTop: spacing.sm,
    fontSize: typography.sizes.sm,
  },
  listContent: {
    padding: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  trailName: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 32,
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontWeight: typography.weights.bold,
    fontSize: typography.sizes.xs,
  },
  description: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginBottom: 2,
  },
  statValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: typography.sizes.md,
  },
});
