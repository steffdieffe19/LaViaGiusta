import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, SafeAreaView, Alert, Animated, BackHandler } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useHikeStore } from '../../store/useHikeStore';
import { SessionsApi } from '../../services/api/sessions';
import { colors, spacing, typography } from '../../theme';

type AlertScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Alert'>;

interface Props {
  navigation: AlertScreenNavigationProp;
}

export default function AlertScreen({ navigation }: Props) {
  const { activeHikeSessionId, status, setStatus, setExpectedEndAt, clearActiveSession } = useHikeStore();
  const [secondsLeft, setSecondsLeft] = useState(180); // 3 minutes grace period
  const [loading, setLoading] = useState(false);
  const [selectedExtension, setSelectedExtension] = useState<'30m' | '60m' | null>(null);
  const [showExtensionSelector, setShowExtensionSelector] = useState(false);

  const flashAnim = useRef(new Animated.Value(0)).current;
  const timerIntervalRef = useRef<any>(null);

  // Prevent back navigation on Android during watchdog safety alert
  useEffect(() => {
    const backAction = () => true;
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, []);

  // Automatic routing if status changes in background (e.g. timeout resolution)
  useEffect(() => {
    if (status === 'active' || status === 'checked_in') {
      navigation.replace('ActiveHike');
    } else if (!status || status === 'completed') {
      navigation.replace('Home');
    }
  }, [status, navigation]);

  // Background flashing visual impact (alternates between warning red/orange and dark gray)
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(flashAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: false,
        }),
        Animated.timing(flashAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: false,
        }),
      ])
    ).start();

    return () => flashAnim.stopAnimation();
  }, [flashAnim]);

  // Grace Period 180 seconds countdown timer
  useEffect(() => {
    const updateCountdown = () => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          handleTimeoutAlertTrigger();
          return 0;
        }
        return prev - 1;
      });
    };

    timerIntervalRef.current = setInterval(updateCountdown, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  const handleTimeoutAlertTrigger = () => {
    setStatus('emergency');
    Alert.alert(
      'Tempo Scaduto 🚨',
      'Non hai risposto all\'allerta in tempo. La segnalazione di emergenza è stata trasmessa alla Protezione Civile.'
    );
  };

  // Sto Bene (Chiudi) -> Tell the watchdog we are OK and check out of the hike session
  const handleStoBene = async () => {
    if (!activeHikeSessionId) return;
    setLoading(true);
    try {
      // 1. Tell watchdog we are safe (restores status to active temporarily)
      await SessionsApi.respondAlert(activeHikeSessionId, 'ok');
      
      // 2. Perform check-out to safely complete the session
      const summary = await SessionsApi.complete(activeHikeSessionId);
      
      // Clear local active hike session state
      clearActiveSession();

      // Navigate to home first, but show the completion passaporto stamp
      navigation.replace('Summary', {
        trailName: summary.trailName || 'Sentiero Completato',
        durationMinutes: summary.durationMinutes,
        distanceKm: summary.distanceKm,
        avgSpeedKmh: summary.avgSpeedKmh,
        stampEarned: summary.stampEarned,
      });
    } catch (err: any) {
      Alert.alert('Errore', err.message || 'Impossibile registrare la risposta.');
    } finally {
      setLoading(false);
    }
  };

  // Extend active session timer (mapped to backend: ok (+30m) or extend (+60m))
  const handleExtend = async (choice: '30m' | '60m') => {
    if (!activeHikeSessionId) return;
    setLoading(true);
    try {
      const responseType = choice === '30m' ? 'ok' : 'extend';
      const session = await SessionsApi.respondAlert(activeHikeSessionId, responseType);
      
      // Update store with new session properties
      setStatus(session.status);
      if (session.expectedEndAt) {
        setExpectedEndAt(session.expectedEndAt);
      }

      Alert.alert(
        'Tempo Esteso ✅',
        `Il tuo tempo limite in sicurezza è stato aumentato di ${choice === '30m' ? '30 minuti' : '1 ora'}.`,
        [{ text: 'OK', onPress: () => navigation.replace('ActiveHike') }]
      );
    } catch (err: any) {
      Alert.alert('Errore estensione', err.message || 'Impossibile estendere il cammino.');
    } finally {
      setLoading(false);
      setShowExtensionSelector(false);
    }
  };

  // Immediate manual SOS acceleration
  const handleSOSImmediato = async () => {
    if (!activeHikeSessionId) return;
    
    Alert.alert(
      'Confermi SOS Immediato?',
      'Le squadre di soccorso della Protezione Civile verranno inviate immediatamente al tuo ultimo punto GPS noto.',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Invia Soccorsi NOW',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const session = await SessionsApi.sos(activeHikeSessionId);
              setStatus(session.status);
              Alert.alert(
                'Richiesta Inviata 🚨',
                'I soccorsi sono stati allertati. Rimani fermo e attendi aggiornamenti.'
              );
            } catch (err: any) {
              Alert.alert('Errore SOS', err.message || 'Impossibile trasmettere SOS.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // Interpolate flashing background color
  const backgroundColor = flashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#121212', '#2d0a0a'] // Flashes deep charcoal and safety dark red
  });

  const borderColor = flashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.accent]
  });

  // Helper formatting for seconds to MM:SS
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Animated.View style={[styles.container, { backgroundColor }]}>
      <SafeAreaView style={styles.safeArea}>
        
        {/* Warning Indicator */}
        <Animated.View style={[styles.alertHeader, { borderColor }]}>
          <Text style={styles.alertEmoji}>🚨</Text>
          <Text style={styles.alertTitle}>ALLERTA SICUREZZA</Text>
          <Text style={styles.alertSubtitle}>Watchdog Valle Castellana</Text>
        </Animated.View>

        {/* Warning Description */}
        <View style={styles.descCard}>
          <Text style={styles.descTitle}>Il tempo limite è scaduto!</Text>
          <Text style={styles.descText}>
            Hai superato l'orario di rientro stimato. Se non rispondi o non effettui il check-out entro il conto alla rovescia, scatterà l'allarme automatico alla Protezione Civile tramite SMS/Chiamata Twilio.
          </Text>
        </View>

        {/* Big Pulsing Grace Countdown Timer */}
        <View style={styles.countdownContainer}>
          <Text style={styles.countdownLabel}>ALLARME AI SOCCORSI TRA:</Text>
          <Text style={[
            styles.countdownValue, 
            secondsLeft < 60 ? styles.countdownValueUrgent : null
          ]}>
            {formatTime(secondsLeft)}
          </Text>
          <Text style={styles.secondsText}>{secondsLeft} secondi rimanenti</Text>
        </View>

        {loading && (
          <ActivityIndicator size="large" color={colors.accent} style={styles.loader} />
        )}

        {/* Extension Dialog Modal overlay options */}
        {showExtensionSelector ? (
          <View style={styles.extensionPanel}>
            <Text style={styles.extensionTitle}>Di quanto vuoi estendere il percorso?</Text>
            <View style={styles.extensionGrid}>
              <TouchableOpacity 
                style={styles.extensionOptionBtn}
                onPress={() => handleExtend('30m')}
              >
                <Text style={styles.extensionOptionText}>+30 Minuti</Text>
                <Text style={styles.extensionOptionSubtext}>Standard</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.extensionOptionBtn}
                onPress={() => handleExtend('60m')}
              >
                <Text style={styles.extensionOptionText}>+60 Minuti</Text>
                <Text style={styles.extensionOptionSubtext}>Lungo</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity 
              style={styles.cancelExtensionBtn}
              onPress={() => setShowExtensionSelector(false)}
            >
              <Text style={styles.cancelExtensionText}>Indietro</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Main Alert Actions Drawer */
          <View style={styles.actionsContainer}>
            
            {/* 1. Sto Bene - completes hike and checks out */}
            <TouchableOpacity
              style={[styles.btn, styles.btnSuccess]}
              activeOpacity={0.8}
              onPress={handleStoBene}
              disabled={loading}
            >
              <Text style={styles.btnText}>🟢 Sto Bene (Chiudi Cammino)</Text>
            </TouchableOpacity>

            {/* 2. Estendi Percorso - extends duration */}
            <TouchableOpacity
              style={[styles.btn, styles.btnWarning]}
              activeOpacity={0.8}
              onPress={() => setShowExtensionSelector(true)}
              disabled={loading}
            >
              <Text style={styles.btnText}>⏰ Estendi Tempo di Percorso</Text>
            </TouchableOpacity>

            {/* 3. SOS Immediato - triggers emergency immediately */}
            <TouchableOpacity
              style={[styles.btn, styles.btnDanger]}
              activeOpacity={0.8}
              onPress={handleSOSImmediato}
              disabled={loading}
            >
              <Text style={styles.btnText}>🚨 SOS IMMEDIATO (Allerta Ora)</Text>
            </TouchableOpacity>

          </View>
        )}

      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    padding: spacing.md,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertHeader: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderWidth: 2,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 107, 53, 0.05)',
    marginTop: spacing.md,
  },
  alertEmoji: {
    fontSize: 42,
    marginBottom: 6,
  },
  alertTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.accent,
    letterSpacing: 1,
  },
  alertSubtitle: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  descCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  descTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  descText: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    lineHeight: 18,
    textAlign: 'center',
  },
  countdownContainer: {
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  countdownLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  countdownValue: {
    fontSize: 54,
    fontWeight: typography.weights.bold,
    color: colors.accent,
    marginVertical: spacing.xs,
  },
  countdownValueUrgent: {
    color: colors.danger,
  },
  secondsText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  loader: {
    marginVertical: spacing.xs,
  },
  actionsContainer: {
    width: '100%',
    paddingBottom: spacing.md,
  },
  btn: {
    height: 54,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  btnSuccess: {
    backgroundColor: colors.success,
  },
  btnWarning: {
    backgroundColor: colors.primaryLight,
  },
  btnDanger: {
    backgroundColor: colors.danger,
  },
  btnText: {
    color: '#fff',
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  extensionPanel: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.md,
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  extensionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  extensionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  extensionOptionBtn: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.sm,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  extensionOptionText: {
    color: colors.text,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  extensionOptionSubtext: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  cancelExtensionBtn: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  cancelExtensionText: {
    color: colors.textMuted,
    fontSize: typography.sizes.sm,
  },
});
