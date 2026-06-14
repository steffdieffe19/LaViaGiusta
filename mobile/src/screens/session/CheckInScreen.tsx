import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { SessionsApi } from '../../services/api/sessions';
import { useHikeStore } from '../../store/useHikeStore';
import { colors, spacing, typography } from '../../theme';

type CheckInScreenRouteProp = RouteProp<RootStackParamList, 'CheckIn'>;
type CheckInScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'CheckIn'>;

interface Props {
  route: CheckInScreenRouteProp;
  navigation: CheckInScreenNavigationProp;
}

export default function CheckInScreen({ route, navigation }: Props) {
  const { trailId, trailName, avgDurationMinutes } = route.params;

  // State parameters
  const [tolerance, setTolerance] = useState(40); // Default 40%
  const [groupSize, setGroupSize] = useState(1);
  const [notes, setNotes] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setActiveSession = useHikeStore((state) => state.setActiveSession);

  // Dynamic Time Calculations
  const nominalHours = Math.floor(avgDurationMinutes / 60);
  const nominalMins = avgDurationMinutes % 60;

  const totalMinutesWithTolerance = Math.round(avgDurationMinutes * (1 + tolerance / 100));
  const maxHours = Math.floor(totalMinutesWithTolerance / 60);
  const maxMins = totalMinutesWithTolerance % 60;

  const handleIncrementGroup = () => setGroupSize(prev => prev + 1);
  const handleDecrementGroup = () => setGroupSize(prev => Math.max(1, prev - 1));

  const handleCheckIn = async () => {
    setError(null);
    setLoading(true);

    try {
      const result = await SessionsApi.checkIn(trailId, tolerance, groupSize, notes.trim() || undefined);
      
      // Save in local Zustand hike store
      setActiveSession(result.sessionId, {
        id: trailId,
        code: '',
        name: trailName,
        description: '',
        distanceMeters: 0,
        elevationGain: 0,
        difficulty: '',
        avgDurationMinutes,
      }, 'checked_in', result.expectedEndAt);

      console.log('✅ Check-in completed successfully. Session ID:', result.sessionId);

      // Navigate to Map (active view)
      navigation.replace('Map', { trailId, trailName });
    } catch (err: any) {
      console.error('❌ Check-in error:', err.message);
      setError(err.message || 'Impossibile completare il Check-In. Controlla la connessione.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Custom Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBackBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.headerBackBtnText}>←</Text>
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>{trailName}</Text>
            <Text style={styles.headerSubtitle}>Preparazione Check-In</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* 1. Watchdog Tolerance Selector */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>1. Tolleranza Watchdog (Sicurezza)</Text>
            <Text style={styles.sectionDescription}>
              Seleziona quanta tolleranza applicare prima che il sistema consideri scaduto il tempo stimato e invii i soccorsi.
            </Text>

            <View style={styles.toleranceGrid}>
              {[20, 40, 60].map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[
                    styles.toleranceBtn,
                    tolerance === val && styles.toleranceBtnActive
                  ]}
                  onPress={() => setTolerance(val)}
                >
                  <Text style={[
                    styles.toleranceBtnText,
                    tolerance === val && styles.toleranceBtnTextActive
                  ]}>+{val}%</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Dynamic calculations panel */}
            <View style={styles.calcPanel}>
              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>Tempo Nominale:</Text>
                <Text style={styles.calcVal}>
                  {nominalHours > 0 ? `${nominalHours}h ` : ''}{nominalMins}m
                </Text>
              </View>
              <View style={[styles.calcRow, styles.calcRowHighlighted]}>
                <Text style={styles.calcLabelAlert}>Allerta Watchdog dopo:</Text>
                <Text style={styles.calcValAlert}>
                  {maxHours > 0 ? `${maxHours}h ` : ''}{maxMins}m
                </Text>
              </View>
            </View>
          </View>

          {/* 2. Group Size Selector */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>2. Dimensione del Gruppo</Text>
            <Text style={styles.sectionDescription}>
              Indica quante persone parteciperanno all'escursione.
            </Text>

            <View style={styles.counterRow}>
              <TouchableOpacity style={styles.counterBtn} onPress={handleDecrementGroup}>
                <Text style={styles.counterBtnText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.counterValue}>{groupSize}</Text>
              <TouchableOpacity style={styles.counterBtn} onPress={handleIncrementGroup}>
                <Text style={styles.counterBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 3. Rescue Notes */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>3. Note Aggiuntive per i Soccorsi</Text>
            <Text style={styles.sectionDescription}>
              Inserisci informazioni che potrebbero essere fondamentali per le squadre di salvataggio (es. presenza di minori, attrezzatura speciale).
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Esempio: In viaggio con un minore. Attrezzatura da pioggia inclusa."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
              value={notes}
              onChangeText={setNotes}
            />
          </View>

        </ScrollView>

        {/* Submit Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            activeOpacity={0.8}
            onPress={handleCheckIn}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Avvia Watchdog e Inizia Cammino</Text>
            )}
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
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
  titleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  errorBanner: {
    backgroundColor: 'rgba(230, 57, 70, 0.15)',
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    lineHeight: 16,
    marginBottom: spacing.md,
  },
  toleranceGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  toleranceBtn: {
    flex: 1,
    height: 44,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  toleranceBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.success,
  },
  toleranceBtnText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.textMuted,
  },
  toleranceBtnTextActive: {
    color: '#fff',
  },
  calcPanel: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  calcRowHighlighted: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 4,
    paddingTop: 8,
  },
  calcLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  calcVal: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  calcLabelAlert: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  calcValAlert: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.accent,
  },
  counterRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: spacing.xs,
  },
  counterBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterBtnText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  counterValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginHorizontal: spacing.xl,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    color: colors.text,
    fontSize: typography.sizes.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    height: 90,
    paddingVertical: spacing.sm,
    textAlignVertical: 'top',
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  submitButton: {
    backgroundColor: colors.accent,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
});
