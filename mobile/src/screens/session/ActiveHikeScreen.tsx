import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, SafeAreaView, ScrollView, Animated, Alert, BackHandler } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useHikeStore } from '../../store/useHikeStore';
import { useAuthStore } from '../../store/useAuthStore';
import { SessionsApi } from '../../services/api/sessions';
import { TrailsApi } from '../../services/api/trails';
import { colors, spacing, typography } from '../../theme';

type ActiveHikeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ActiveHike'>;

interface Props {
  navigation: ActiveHikeScreenNavigationProp;
}

export default function ActiveHikeScreen({ navigation }: Props) {
  const { activeHikeSessionId, currentTrail, status, expectedEndAt, isOffline, setStatus, setExpectedEndAt, clearActiveSession } = useHikeStore();
  const user = useAuthStore((state) => state.user);

  const [timeLeftStr, setTimeLeftStr] = useState('00h 00m 00s');
  const [isUrgent, setIsUrgent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [isPressingSOS, setIsPressingSOS] = useState(false);

  // Animation values for SOS and Watchdog Shield
  const sosProgress = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerIntervalRef = useRef<any>(null);
  const pollIntervalRef = useRef<any>(null);

  // Pulse animation for active watchdog shield
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    return () => pulseAnim.stopAnimation();
  }, [pulseAnim]);

  // Real-time Countdown Timer Logic
  useEffect(() => {
    if (!expectedEndAt || status === 'completed') return;

    const updateTimer = () => {
      const now = Date.now();
      const end = new Date(expectedEndAt).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeftStr('00h 00m 00s');
        setIsUrgent(true);
        // Force refresh from backend to see if watchdog alert is active
        triggerBackendStatusSync();
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      const formatted = `${hours.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
      setTimeLeftStr(formatted);

      // Mark as urgent if less than 30 minutes remain
      if (diff < 30 * 60 * 1000) {
        setIsUrgent(true);
      } else {
        setIsUrgent(false);
      }
    };

    updateTimer();
    timerIntervalRef.current = setInterval(updateTimer, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [expectedEndAt, status]);

  // Backend state polling to handle background status transitions (e.g. watchdog triggers)
  useEffect(() => {
    const pollStatus = async () => {
      if (!activeHikeSessionId) return;
      try {
        const session = await SessionsApi.getActive();
        if (session) {
          if (session.status !== status) {
            setStatus(session.status);
          }
          if (session.expectedEndAt && session.expectedEndAt !== expectedEndAt) {
            setExpectedEndAt(session.expectedEndAt);
          }
        } else {
          // If no active session returned, clear local store
          clearActiveSession();
        }
      } catch (err) {
        console.warn('⚠️ Errore nel polling dello stato del cammino:', err);
      }
    };

    pollStatus();
    pollIntervalRef.current = setInterval(pollStatus, 15000); // Poll every 15 seconds

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [activeHikeSessionId, status, expectedEndAt]);

  // Prevent back navigation on Android while active watchdog is tracking
  useEffect(() => {
    const backAction = () => true;
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, []);

  // Force redirect to safety alert screen if watchdog alert triggers
  useEffect(() => {
    if (status === 'watchdog_alert') {
      navigation.replace('Alert');
    }
  }, [status, navigation]);

  const triggerBackendStatusSync = async () => {
    if (!activeHikeSessionId) return;
    try {
      const session = await SessionsApi.getActive();
      if (session && session.status !== status) {
        setStatus(session.status);
      }
    } catch (e) {
      console.warn('Backend sync failed', e);
    }
  };

  // Start active hike API trigger (transitions from checked_in to active)
  const handleStartHike = async () => {
    if (!activeHikeSessionId) return;
    setStarting(true);
    try {
      const session = await SessionsApi.start(activeHikeSessionId);
      setStatus(session.status);
      if (session.expectedEndAt) {
        setExpectedEndAt(session.expectedEndAt);
      }
      Alert.alert('Buon Cammino!', 'Il tracciamento di sicurezza Watchdog è ora attivo.');
    } catch (err: any) {
      Alert.alert('Errore', err.message || 'Impossibile avviare il cammino.');
    } finally {
      setStarting(false);
    }
  };

  // SOS button animations
  const handleSOSPressIn = () => {
    setIsPressingSOS(true);
    Animated.timing(sosProgress, {
      toValue: 1,
      duration: 2000, // 2 seconds hold
      useNativeDriver: false,
    }).start();
  };

  const handleSOSPressOut = () => {
    setIsPressingSOS(false);
    Animated.timing(sosProgress, {
      toValue: 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
  };

  const triggerSOS = async () => {
    if (!activeHikeSessionId) return;
    setLoading(true);
    try {
      const session = await SessionsApi.sos(activeHikeSessionId);
      setStatus(session.status);
      Alert.alert(
        'Soccorsi Allertati 🚨',
        'La tua richiesta di emergenza è stata trasmessa alla Protezione Civile con la tua ultima posizione nota.'
      );
    } catch (err: any) {
      Alert.alert('Errore SOS', err.message || 'Impossibile inviare SOS via API. Cerca copertura cellulare!');
    } finally {
      setLoading(false);
    }
  };

  // Watchdog checkout API trigger
  const handleCheckOut = async () => {
    if (!activeHikeSessionId) return;
    
    Alert.alert(
      'Terminare il cammino?',
      'Confermando, disattiverai il Watchdog di sicurezza per questa sessione.',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Conferma Check-Out',
          onPress: async () => {
            setLoading(true);
            try {
              const summary = await SessionsApi.complete(activeHikeSessionId);
              
              // Clear active session state
              clearActiveSession();

              // Navigate to summary details
              navigation.replace('Summary', {
                trailName: summary.trailName || currentTrail?.name || 'Sentiero Completato',
                durationMinutes: summary.durationMinutes,
                distanceKm: summary.distanceKm,
                avgSpeedKmh: summary.avgSpeedKmh,
                stampEarned: summary.stampEarned,
              });
            } catch (err: any) {
              Alert.alert('Errore Check-Out', err.message || 'Impossibile completare il check-out.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // SOS button fill-up animations mapping
  const sosBgColor = sosProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.danger, colors.accent]
  });

  const sosWidth = sosProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%']
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* State Banner - Checked In vs Active */}
        {status === 'checked_in' && (
          <View style={styles.startBanner}>
            <Text style={styles.startBannerTitle}>Pronto a partire?</Text>
            <Text style={styles.startBannerText}>
              Sei registrato al punto di partenza. Clicca "AVVIA CAMMINO" sotto per far scattare il timer attivo del Watchdog.
            </Text>
          </View>
        )}

        {isOffline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineBannerText}>⚠️ Dispositivo Offline. I tuoi dati GPS sono salvati localmente.</Text>
          </View>
        )}

        {/* Trail Info Header */}
        <View style={styles.header}>
          <Text style={styles.trailName}>{currentTrail?.name || 'Sentiero Valle Castellana'}</Text>
          <Text style={styles.sectionSubtitle}>Sessione ID: {activeHikeSessionId?.slice(0, 8)}...</Text>
        </View>

        {/* Watchdog Status Circle Indicator */}
        <View style={styles.statusSection}>
          <Animated.View style={[
            styles.shieldPulse,
            {
              transform: [{ scale: pulseAnim }],
              borderColor: status === 'emergency' ? colors.danger : isUrgent ? colors.accent : colors.success,
            }
          ]}>
            <View style={[
              styles.shieldContainer,
              { backgroundColor: status === 'emergency' ? 'rgba(230,57,70,0.1)' : isUrgent ? 'rgba(255,107,53,0.1)' : 'rgba(82,183,136,0.1)' }
            ]}>
              <Text style={styles.shieldEmoji}>🛡️</Text>
              <Text style={[
                styles.shieldText,
                { color: status === 'emergency' ? colors.danger : isUrgent ? colors.accent : colors.success }
              ]}>
                {status === 'emergency' ? 'EMERGENZA' : 'PROTETTO'}
              </Text>
            </View>
          </Animated.View>
          <Text style={styles.watchdogStatusText}>
            Il Watchdog di Valle Castellana sta monitorando il tuo cammino in background.
          </Text>
        </View>

        {/* Dynamic Warning Card */}
        {isUrgent && status === 'active' && (
          <View style={styles.warningCard}>
            <Text style={styles.warningCardTitle}>⚠️ RIENTRO IN SICUREZZA IN SCADENZA</Text>
            <Text style={styles.warningCardText}>
              Stai per superare il tempo limite stimato più tolleranza. Per evitare un falso allarme alle squadre di soccorso, effettua il Check-Out o preparati a rispondere all'allerta.
            </Text>
          </View>
        )}

        {/* Timer Panel */}
        <View style={[styles.card, isUrgent && styles.cardUrgent]}>
          <Text style={styles.cardLabel}>TEMPO RESIDUO IN SICUREZZA</Text>
          <Text style={[styles.timerValue, isUrgent && styles.timerValueUrgent]}>
            {timeLeftStr}
          </Text>
          <Text style={styles.etaText}>
            Rientro previsto entro le: {expectedEndAt ? new Date(expectedEndAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
          </Text>
        </View>

        {/* Details Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Dettagli Sessione</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Escursionista:</Text>
            <Text style={styles.detailValue}>{user?.fullName || 'Utente'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Contatto Emergenza:</Text>
            <Text style={styles.detailValue}>{user?.emergencyContactName || 'N/A'} ({user?.emergencyContactPhone || 'N/A'})</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Stato Watchdog:</Text>
            <Text style={[styles.detailValue, { fontWeight: 'bold', textTransform: 'capitalize' }]}>{status}</Text>
          </View>
        </View>

        {/* Navigation Map Action */}
        <TouchableOpacity
          style={styles.mapButton}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('Map', { 
            trailId: currentTrail?.id || '', 
            trailName: currentTrail?.name || '' 
          })}
        >
          <Text style={styles.mapButtonText}>🗺️ Visualizza Mappa & Tracciato</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Footer controls */}
      <View style={styles.footer}>
        
        {/* Avvia Cammino trigger (Only shown when checked_in) */}
        {status === 'checked_in' && (
          <TouchableOpacity
            style={styles.startButton}
            activeOpacity={0.8}
            onPress={handleStartHike}
            disabled={starting}
          >
            {starting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.startButtonText}>AVVIA CAMMINO NOW 🚀</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Safe Checkout Button */}
        <TouchableOpacity
          style={[styles.checkoutButton, loading && styles.disabledButton]}
          activeOpacity={0.8}
          onPress={handleCheckOut}
          disabled={loading || status === 'checked_in'}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.checkoutButtonText}>Termina Cammino (Check-Out)</Text>
          )}
        </TouchableOpacity>

        {/* Prominent SOS Button - Long Press (2 seconds) */}
        <View style={styles.sosContainer}>
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.sosButton}
            onPressIn={handleSOSPressIn}
            onPressOut={handleSOSPressOut}
            onLongPress={triggerSOS}
            delayLongPress={2000}
            disabled={loading}
          >
            {/* Animated background bar indicating long-press progress */}
            <Animated.View style={[
              styles.sosProgressFill, 
              { 
                width: sosWidth, 
                backgroundColor: sosBgColor 
              }
            ]} />
            
            <View style={styles.sosContent}>
              <Text style={styles.sosText}>
                {isPressingSOS ? 'TIENI PREMUTO...' : '🆘 SOS MANUALE'}
              </Text>
              <Text style={styles.sosSubtext}>
                Tieni premuto per 2 secondi per allertare soccorsi
              </Text>
            </View>
          </TouchableOpacity>
        </View>

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
  },
  header: {
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  trailName: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    textAlign: 'center',
  },
  sectionSubtitle: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 4,
  },
  startBanner: {
    backgroundColor: 'rgba(76, 201, 240, 0.15)',
    borderWidth: 1,
    borderColor: colors.info,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  startBannerTitle: {
    color: colors.info,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    marginBottom: 4,
  },
  startBannerText: {
    color: colors.text,
    fontSize: typography.sizes.sm,
    lineHeight: 18,
  },
  offlineBanner: {
    backgroundColor: colors.warning,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  offlineBannerText: {
    color: '#000',
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    textAlign: 'center',
  },
  statusSection: {
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  shieldPulse: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  shieldContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shieldEmoji: {
    fontSize: 36,
  },
  shieldText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    marginTop: 4,
  },
  watchdogStatusText: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    lineHeight: 16,
  },
  warningCard: {
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  warningCardTitle: {
    color: colors.accent,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    marginBottom: 4,
  },
  warningCardText: {
    color: colors.text,
    fontSize: typography.sizes.xs,
    lineHeight: 16,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardUrgent: {
    borderColor: colors.accent,
    borderWidth: 1.5,
  },
  cardTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  cardLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 4,
  },
  timerValue: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.success,
    textAlign: 'center',
    marginVertical: 4,
  },
  timerValueUrgent: {
    color: colors.accent,
  },
  etaText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    textAlign: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  detailValue: {
    fontSize: typography.sizes.sm,
    color: colors.text,
  },
  mapButton: {
    backgroundColor: colors.primary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  mapButtonText: {
    color: colors.text,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  startButton: {
    backgroundColor: colors.info,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  startButtonText: {
    color: '#fff',
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  checkoutButton: {
    backgroundColor: colors.primaryLight,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  checkoutButtonText: {
    color: '#fff',
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  sosContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    height: 60,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  sosButton: {
    flex: 1,
    backgroundColor: 'rgba(230, 57, 70, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  sosProgressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  sosContent: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  sosText: {
    color: colors.danger,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  sosSubtext: {
    color: colors.textMuted,
    fontSize: 9,
    marginTop: 2,
  },
  disabledButton: {
    opacity: 0.5,
  },
});
