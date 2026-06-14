import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  medicalProfile?: {
    blood_type?: string;
    allergies?: string[];
    conditions?: string[];
    medications?: string[];
  };
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: UserProfile, accessToken: string, refreshToken: string) => Promise<void>;
  updateTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: UserProfile) => Promise<void>;
  initializeAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,

  /**
   * Sets user and token data upon successful registration/login
   */
  setAuth: async (user, accessToken, refreshToken) => {
    try {
      await SecureStore.setItemAsync('accessToken', accessToken);
      await SecureStore.setItemAsync('refreshToken', refreshToken);
      await SecureStore.setItemAsync('userProfile', JSON.stringify(user));
      
      set({
        user,
        accessToken,
        refreshToken,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      console.error('❌ SecureStore saving error:', error);
    }
  },

  /**
   * Helper to silently update tokens (used by Axios refresh interceptor)
   */
  updateTokens: async (accessToken, refreshToken) => {
    try {
      await SecureStore.setItemAsync('accessToken', accessToken);
      await SecureStore.setItemAsync('refreshToken', refreshToken);
      
      set({ accessToken, refreshToken });
    } catch (error) {
      console.error('❌ SecureStore tokens update error:', error);
    }
  },

  /**
   * Clears session and logs out
   */
  logout: async () => {
    try {
      await SecureStore.deleteItemAsync('accessToken');
      await SecureStore.deleteItemAsync('refreshToken');
      await SecureStore.deleteItemAsync('userProfile');
      
      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
    } catch (error) {
      console.error('❌ SecureStore logout error:', error);
    }
  },

  /**
   * Updates user profile data in state and storage
   */
  updateUser: async (user) => {
    try {
      await SecureStore.setItemAsync('userProfile', JSON.stringify(user));
      set({ user });
    } catch (error) {
      console.error('❌ SecureStore profile update error:', error);
    }
  },

  /**
   * Loads persisted session on app startup
   */
  initializeAuth: async () => {
    try {
      const accessToken = await SecureStore.getItemAsync('accessToken');
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      const userProfileStr = await SecureStore.getItemAsync('userProfile');

      if (accessToken && refreshToken && userProfileStr) {
        const user = JSON.parse(userProfileStr);
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
        });
        console.log('✅ Restored active user session:', user.email);
      } else {
        set({ isAuthenticated: false, isLoading: false });
        console.log('ℹ️ No active user session found.');
      }
    } catch (error) {
      console.error('❌ Failed to initialize auth session:', error);
      set({ isAuthenticated: false, isLoading: false });
    }
  },
}));
