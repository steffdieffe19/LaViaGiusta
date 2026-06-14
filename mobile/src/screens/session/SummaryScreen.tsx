import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, ScrollView, Animated } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { colors, spacing, typography } from '../../theme';

type SummaryScreenRouteProp = RouteProp<RootStackParamList, 'Summary'>;
type SummaryScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Summary'>;

interface Props {
  route: SummaryScreenRouteProp;
  navigation: SummaryScreenNavigationProp;
}

export default function SummaryScreen({ route, navigation }: Props) {
  const { trailName, durationMinutes, distanceKm, avgSpeedKmh, stampEarned } = route.params;

  // Spring animation values for the physical stamp effect
  const stampScale = useRef(new Animated.Value(3)).current;
  const stampOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (stampEarned) {
      // Delay slightly for dramatic effect when screen mounts
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.spring(stampScale, {
            toValue: 1,
            friction: 5,
            tension: 40,
            useNativeDriver: true,
          }),
          Animated.timing(stampOpacity, {
            toValue: 0.85, // Mimics vintage ink transparency
            duration: 350,
            useNativeDriver: true,
          }),
        ]).start();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [stampEarned]);

  const handleReturnHome = () => {
    navigation.replace('Home');
  };

  // Helper formatting for minutes to hours + minutes
  const formatDuration = (totalMinutes: number) => {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const currentDateStr = new Date().toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Celebration Header */}
        <View style={styles.header}>
          <Text style={styles.congratsEmoji}>🏔️</Text>
          <Text style={styles.title}>Cammino Completato!</Text>
          <Text style={styles.subtitle}>Sei rientrato in sicurezza. Watchdog disattivato.</Text>
        </View>

        {/* Trail Card */}
        <View style={styles.trailCard}>
          <Text style={styles.trailLabel}>SENTIERO PERCORSO</Text>
          <Text style={styles.trailName}>{trailName}</Text>
        </View>

        {/* Key Metrics Grid */}
        <View style={styles.grid}>
          
          <View style={styles.metricCard}>
            <Text style={styles.metricEmoji}>⏱️</Text>
            <Text style={styles.metricLabel}>Tempo Impiegato</Text>
            <Text style={styles.metricValue}>{formatDuration(durationMinutes)}</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricEmoji}>🏃</Text>
            <Text style={styles.metricLabel}>Distanza Stimata</Text>
            <Text style={styles.metricValue}>{distanceKm.toFixed(1)} km</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricEmoji}>⚡</Text>
            <Text style={styles.metricLabel}>Velocità Media</Text>
            <Text style={styles.metricValue}>{avgSpeedKmh.toFixed(1)} km/h</Text>
          </View>

        </View>

        {/* Digital Passport Stamp Panel */}
        {stampEarned ? (
          <View style={styles.passportCard}>
            <Text style={styles.passportTitle}>📖 Passaporto del Camminatore</Text>
            <Text style={styles.passportDesc}>
              Nuovo Timbro Digitale sbloccato sul tuo passaporto! Completando il sentiero in sicurezza, hai guadagnato il timbro ufficiale di Valle Castellana.
            </Text>

            {/* Vintage Ink Stamp Graphic Component */}
            <View style={styles.stampCanvas}>
              <Animated.View style={[
                styles.stampOuterRing,
                {
                  opacity: stampOpacity,
                  transform: [
                    { scale: stampScale },
                    { rotate: '-8deg' } // Slight angle for realistic human stamp placement
                  ]
                }
              ]}>
                <View style={styles.stampInnerRing}>
                  <Text style={styles.stampHeader}>PARCO NAZIONALE</Text>
                  <Text style={styles.stampCenter}>V. CASTELLANA</Text>
                  <Text style={styles.stampFooter}>{currentDateStr}</Text>
                  <Text style={styles.stampBadgeCode}>LA VIA GIUSTA</Text>
                </View>
              </Animated.View>
            </View>
          </View>
        ) : (
          <View style={styles.passportCard}>
            <Text style={styles.passportTitle}>📖 Passaporto del Camminatore</Text>
            <Text style={styles.passportDesc}>
              Hai completato la sessione in sicurezza. (Timbro già collezionato per questo tracciato).
            </Text>
          </View>
        )}

      </ScrollView>

      {/* Action Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.homeButton}
          activeOpacity={0.8}
          onPress={handleReturnHome}
        >
          <Text style={styles.homeButtonText}>Torna alla Home</Text>
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
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  congratsEmoji: {
    fontSize: 48,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: spacing.md,
  },
  trailCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.md,
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  trailLabel: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: colors.primaryLight,
    letterSpacing: 1,
    marginBottom: 4,
  },
  trailName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: spacing.md,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.sm,
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 9,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  passportCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.md,
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  passportTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 6,
  },
  passportDesc: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    lineHeight: 16,
    marginBottom: spacing.md,
  },
  stampCanvas: {
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: spacing.xs,
  },
  stampOuterRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    borderColor: colors.primaryLight, // Sage green stamp ink color
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 3,
    shadowColor: colors.primaryLight,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  stampInnerRing: {
    width: 122,
    height: 122,
    borderRadius: 61,
    borderWidth: 2,
    borderColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  stampHeader: {
    color: colors.primaryLight,
    fontSize: 8,
    fontWeight: '900',
    position: 'absolute',
    top: 15,
    letterSpacing: 0.5,
  },
  stampCenter: {
    color: colors.primaryLight,
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  stampFooter: {
    color: colors.primaryLight,
    fontSize: 9,
    fontWeight: 'bold',
    marginVertical: 2,
  },
  stampBadgeCode: {
    color: colors.primaryLight,
    fontSize: 8,
    fontWeight: '900',
    position: 'absolute',
    bottom: 15,
    letterSpacing: 0.5,
  },
  footer: {
    padding: spacing.md,
    width: '100%',
    backgroundColor: colors.background,
  },
  homeButton: {
    backgroundColor: colors.primary,
    borderColor: colors.border,
    borderWidth: 1,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  homeButtonText: {
    color: '#fff',
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
});
