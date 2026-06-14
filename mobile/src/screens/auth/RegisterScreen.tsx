import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { AuthApi } from '../../services/api/auth';
import { useAuthStore } from '../../store/useAuthStore';
import { colors, spacing, typography } from '../../theme';

type RegisterScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Register'>;

interface Props {
  navigation: RegisterScreenNavigationProp;
}

export default function RegisterScreen({ navigation }: Props) {
  // Step tracker (1 = Personal Info, 2 = Medical & Emergency)
  const [step, setStep] = useState(1);
  
  // Step 1: Personal Info States
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');

  // Step 2: Medical & Emergency States
  const [bloodType, setBloodType] = useState('');
  const [allergies, setAllergies] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleNextStep = () => {
    if (!fullName || !email || !password) {
      setError('Compila tutti i campi obbligatori (Nome, Email, Password).');
      return;
    }
    if (password.length < 8) {
      setError('La password deve contenere almeno 8 caratteri.');
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleRegister = async () => {
    if (!emergencyName || !emergencyPhone) {
      setError('Il contatto di emergenza (Nome e Telefono) è obbligatorio per la sicurezza in montagna.');
      return;
    }

    setError(null);
    setLoading(true);

    // Prepare JSON payload matching backend structure
    const payload = {
      email: email.trim().toLowerCase(),
      password,
      fullName: fullName.trim(),
      phone: phone.trim() || undefined,
      emergencyContactName: emergencyName.trim(),
      emergencyContactPhone: emergencyPhone.trim(),
      medicalProfile: {
        blood_type: bloodType.trim() || undefined,
        allergies: allergies.trim() ? [allergies.trim()] : [],
        conditions: [],
        medications: [],
      },
    };

    try {
      const authData = await AuthApi.register(payload);
      // Save user session in store (triggers conditional routing update)
      await setAuth(authData.user, authData.tokens.accessToken, authData.tokens.refreshToken);
      console.log('✅ User registered successfully:', authData.user.email);
    } catch (err: any) {
      console.error('❌ Registration error:', err.message);
      setError(err.message || 'Errore durante la registrazione. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          <View style={styles.header}>
            <Text style={styles.logoTitle}>🏔️ Registrazione</Text>
            <Text style={styles.logoSubtitle}>Step {step} di 2: {step === 1 ? 'Dati Personali' : 'Sicurezza & Dati Medici'}</Text>
          </View>

          <View style={styles.formCard}>
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {step === 1 ? (
              // ── STEP 1: PERSONAL DETAILS ──
              <View>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>NOME E COGNOME *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Mario Rossi"
                    placeholderTextColor={colors.textMuted}
                    value={fullName}
                    onChangeText={setFullName}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>EMAIL *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="escursionista@email.it"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>PASSWORD (MIN 8 CARATTERI) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry
                    autoCapitalize="none"
                    value={password}
                    onChangeText={setPassword}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>CELLULARE (PER SMS ALLERTE)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="+39 333 1234567"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                  />
                </View>

                <TouchableOpacity 
                  style={styles.button} 
                  activeOpacity={0.8}
                  onPress={handleNextStep}
                >
                  <Text style={styles.buttonText}>Avanti</Text>
                </TouchableOpacity>
              </View>
            ) : (
              // ── STEP 2: SAFETY & MEDICAL INFO ──
              <View>
                <Text style={styles.sectionSubtitle}>Dati Medici (Facoltativi, GDPR conformi)</Text>
                
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>GRUPPO SANGUIGNO</Text>
                  <View style={styles.bloodGrid}>
                    {bloodTypes.map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.bloodBtn,
                          bloodType === type && styles.bloodBtnActive
                        ]}
                        onPress={() => setBloodType(type)}
                      >
                        <Text style={[
                          styles.bloodBtnText,
                          bloodType === type && styles.bloodBtnTextActive
                        ]}>{type}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>ALLERGIE O CONDIZIONI MEDICHE</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Allergia a penicillina, asma, ecc."
                    placeholderTextColor={colors.textMuted}
                    multiline
                    numberOfLines={3}
                    value={allergies}
                    onChangeText={setAllergies}
                  />
                </View>

                <Text style={styles.sectionSubtitle}>Contatto Emergenza (Obbligatorio per SOS)</Text>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>NOME CONTATTO EMERGENZA *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Luigi Rossi (es. Padre)"
                    placeholderTextColor={colors.textMuted}
                    value={emergencyName}
                    onChangeText={setEmergencyName}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>TELEFONO CONTATTO EMERGENZA *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="+39 333 9876543"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                    value={emergencyPhone}
                    onChangeText={setEmergencyPhone}
                  />
                </View>

                <View style={styles.rowButtons}>
                  <TouchableOpacity 
                    style={[styles.button, styles.backBtn]} 
                    activeOpacity={0.8}
                    onPress={() => setStep(1)}
                  >
                    <Text style={styles.backBtnText}>Indietro</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.button, styles.flexBtn, loading && styles.buttonDisabled]} 
                    activeOpacity={0.8}
                    onPress={handleRegister}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.buttonText}>Registrati</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Hai già un account?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.footerLink}>Accedi qui</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.md,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  logoTitle: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    letterSpacing: 0.5,
  },
  logoSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  formCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  sectionSubtitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.success,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 4,
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
  inputContainer: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.textMuted,
    marginBottom: 6,
    letterSpacing: 1,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 10,
    height: 48,
    paddingHorizontal: spacing.sm,
    color: colors.text,
    fontSize: typography.sizes.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    height: 80,
    paddingVertical: spacing.sm,
    textAlignVertical: 'top',
  },
  bloodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  bloodBtn: {
    width: '23%',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  bloodBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.success,
  },
  bloodBtnText: {
    color: colors.textMuted,
    fontWeight: typography.weights.bold,
    fontSize: typography.sizes.sm,
  },
  bloodBtnTextActive: {
    color: '#fff',
  },
  button: {
    backgroundColor: colors.primaryLight,
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  rowButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  backBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
    width: '35%',
    marginTop: 0,
  },
  backBtnText: {
    color: colors.textMuted,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  flexBtn: {
    width: '60%',
    marginTop: 0,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  footerText: {
    color: colors.textMuted,
    marginRight: 6,
    fontSize: typography.sizes.sm,
  },
  footerLink: {
    color: colors.success,
    fontWeight: typography.weights.bold,
    fontSize: typography.sizes.sm,
  },
});
