import { useState, useEffect, useCallback } from 'react';
import { Linking, Platform, Alert } from 'react-native';
import * as Location from 'expo-location';

export interface LocationPermissionsState {
  foregroundStatus: Location.PermissionStatus | null;
  backgroundStatus: Location.PermissionStatus | null;
  hasForeground: boolean;
  hasBackground: boolean;
  loading: boolean;
}

export function useLocationPermissions() {
  const [state, setState] = useState<LocationPermissionsState>({
    foregroundStatus: null,
    backgroundStatus: null,
    hasForeground: false,
    hasBackground: false,
    loading: true,
  });

  const checkPermissions = useCallback(async () => {
    try {
      const fgResult = await Location.getForegroundPermissionsAsync();
      const bgResult = await Location.getBackgroundPermissionsAsync();

      setState({
        foregroundStatus: fgResult.status,
        backgroundStatus: bgResult.status,
        hasForeground: fgResult.status === Location.PermissionStatus.GRANTED,
        hasBackground: bgResult.status === Location.PermissionStatus.GRANTED,
        loading: false,
      });
    } catch (error) {
      console.warn('⚠️ Errore durante la verifica dei permessi di posizione:', error);
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  const requestPermissions = async (): Promise<boolean> => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      // 1. Request Foreground location first
      const fgResult = await Location.requestForegroundPermissionsAsync();
      if (fgResult.status !== Location.PermissionStatus.GRANTED) {
        setState({
          foregroundStatus: fgResult.status,
          backgroundStatus: Location.PermissionStatus.DENIED,
          hasForeground: false,
          hasBackground: false,
          loading: false,
        });
        showSettingsAlert('Permesso in Primo Piano Negato', 'LaViaGiusta richiede l\'accesso alla posizione in primo piano per mostrare la mappa e calcolare il percorso.');
        return false;
      }

      // 2. Explain to the hiker why Background location is critical (Google/Apple requirements)
      const requestBg = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Protezione Watchdog in Background 🛡️',
          'Per proteggerti quando il telefono è in tasca o lo schermo è bloccato, il Watchdog di Valle Castellana deve accedere alla tua posizione "Sempre".\n\nNella schermata successiva, seleziona "Consenti sempre" per attivare la protezione continua.',
          [
            { text: 'Annulla', onPress: () => resolve(false), style: 'cancel' },
            { text: 'Procedi', onPress: () => resolve(true) }
          ]
        );
      });

      if (!requestBg) {
        const bgStatus = await Location.getBackgroundPermissionsAsync();
        setState({
          foregroundStatus: fgResult.status,
          backgroundStatus: bgStatus.status,
          hasForeground: true,
          hasBackground: bgStatus.status === Location.PermissionStatus.GRANTED,
          loading: false,
        });
        return fgResult.status === Location.PermissionStatus.GRANTED && bgStatus.status === Location.PermissionStatus.GRANTED;
      }

      // 3. Request Background location
      const bgResult = await Location.requestBackgroundPermissionsAsync();
      
      const hasFg = fgResult.status === Location.PermissionStatus.GRANTED;
      const hasBg = bgResult.status === Location.PermissionStatus.GRANTED;

      setState({
        foregroundStatus: fgResult.status,
        backgroundStatus: bgResult.status,
        hasForeground: hasFg,
        hasBackground: hasBg,
        loading: false,
      });

      if (!hasBg) {
        showSettingsAlert(
          'Permesso in Background Negato',
          'Senza l\'accesso alla posizione "Sempre" (Background), il Watchdog NON potrà proteggerti a schermo spento.'
        );
      }

      return hasFg && hasBg;
    } catch (error) {
      console.error('❌ Errore durante la richiesta dei permessi:', error);
      setState(prev => ({ ...prev, loading: false }));
      return false;
    }
  };

  const showSettingsAlert = (title: string, message: string) => {
    Alert.alert(
      title,
      `${message}\n\nSi prega di abilitare i permessi manualmente nelle impostazioni del dispositivo per continuare.`,
      [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Apri Impostazioni', onPress: openSettings }
      ]
    );
  };

  const openSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  return {
    ...state,
    requestPermissions,
    checkPermissions,
    openSettings,
  };
}
