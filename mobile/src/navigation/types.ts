export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined;
  TrailDetail: { trailId: string };
  CheckIn: { trailId: string; trailName: string; avgDurationMinutes: number };
  ActiveHike: undefined;
  Alert: undefined;
  Summary: {
    trailName: string;
    durationMinutes: number;
    distanceKm: number;
    avgSpeedKmh: number;
    stampEarned: boolean;
  };
  Map: { trailId: string; trailName: string };
};
