import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/useAuthStore';
import { useHikeStore } from '../store/useHikeStore';
import { SessionsApi } from '../services/api/sessions';
import { TrailsApi } from '../services/api/trails';
import HomeScreen from '../screens/HomeScreen';
import DetailScreen from '../screens/trail/DetailScreen';
import CheckInScreen from '../screens/session/CheckInScreen';
import MapScreen from '../screens/MapScreen';
import ActiveHikeScreen from '../screens/session/ActiveHikeScreen';
import AlertScreen from '../screens/session/AlertScreen';
import SummaryScreen from '../screens/session/SummaryScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import { colors } from '../theme';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { isAuthenticated, isLoading, initializeAuth } = useAuthStore();
  const { setActiveSession, clearActiveSession } = useHikeStore();

  // Load user session on initial component mounting
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Try to load any active hiking session on successful authentication
  useEffect(() => {
    if (isAuthenticated) {
      const restoreSession = async () => {
        try {
          const session = await SessionsApi.getActive();
          if (session) {
            const trail = await TrailsApi.fetchById(session.trailId);
            setActiveSession(session.id, trail, session.status, session.expectedEndAt);
            console.log('🏔️ Active hike session restored from backend:', session.id);
          } else {
            clearActiveSession();
          }
        } catch (err) {
          console.warn('⚠️ Could not restore active session from backend:', err);
        }
      };
      restoreSession();
    }
  }, [isAuthenticated, setActiveSession, clearActiveSession]);

  // Render a clean dark splash loading view while reading SecureStore
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.success} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      {isAuthenticated ? (
        // ── PROTECTED MAIN STACK ──
        <>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="TrailDetail" component={DetailScreen} />
          <Stack.Screen name="CheckIn" component={CheckInScreen} />
          <Stack.Screen name="Map" component={MapScreen} />
          <Stack.Screen name="ActiveHike" component={ActiveHikeScreen} />
          <Stack.Screen name="Alert" component={AlertScreen} />
          <Stack.Screen name="Summary" component={SummaryScreen} />
        </>
      ) : (
        // ── PUBLIC AUTH STACK ──
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
