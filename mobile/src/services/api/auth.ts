import { apiClient } from './client';
import { UserProfile } from '../../store/useAuthStore';

export interface AuthResponseData {
  user: UserProfile;
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

export class AuthApi {
  /**
   * Logs in a user with email and password
   */
  public static async login(email: string, password: string): Promise<AuthResponseData> {
    const response = await apiClient.post('/auth/login', { email, password });
    if (response.data && response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data?.error || 'Login failed');
  }

  /**
   * Registers a new user with personal and medical details
   */
  public static async register(data: any): Promise<AuthResponseData> {
    const response = await apiClient.post('/auth/register', data);
    if (response.data && response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data?.error || 'Registration failed');
  }
}
