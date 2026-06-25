import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface WeatherData {
  current: {
    temperature: number;
    relativeHumidity: number;
    apparentTemperature: number;
    isDay: number;
    precipitation: number;
    weatherCode: number;
    windSpeed: number;
  };
  hourly: Array<{
    time: string;
    temperature: number;
    precipitationProbability: number;
    weatherCode: number;
  }>;
  daily: Array<{
    time: string;
    temperatureMax: number;
    temperatureMin: number;
    weatherCode: number;
    precipitationProbabilityMax: number;
  }>;
}

@Injectable({
  providedIn: 'root',
})
export class WeatherService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:3000/api/v1';

  /**
   * Fetch weather forecast for a specific trail ID
   */
  public getTrailWeather(trailId: string): Observable<{ success: boolean; data: WeatherData }> {
    return this.http.get<{ success: boolean; data: WeatherData }>(
      `${this.baseUrl}/trails/${trailId}/weather`
    );
  }
}
