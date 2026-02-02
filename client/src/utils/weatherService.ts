export interface LocationData {
  latitude: number;
  longitude: number;
  city: string;
  state: string;
  county: string;
  timezone: string;
}

export interface WeatherStation {
  id: string;
  name: string;
  distance: number; // miles from farm
  latitude: number;
  longitude: number;
  elevation: number;
}

export interface WeatherData {
  temperature: number;
  humidity: number;
  windSpeed: number;
  windGust?: number;
  windDirection: string;
  pressure: number;
  dewPoint: number;
  timestamp: string;
  driftRisk: 'low' | 'moderate' | 'high' | 'extreme';
  sprayRecommendation: 'optimal' | 'acceptable' | 'caution' | 'avoid';
  temperatureInversion: boolean;
  gustFactor: number;
  location: LocationData;
  source: string;
  elevation: number;
  visibility?: number;
  uvIndex?: number;
}

export interface FieldLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  elevation: number;
  microclimate?: string; // 'sheltered', 'exposed', 'valley', 'hilltop'
}

export interface DriftAssessment {
  overall: 'low' | 'moderate' | 'high' | 'extreme';
  factors: {
    wind: { score: number; impact: string };
    gusts: { score: number; impact: string };
    temperature: { score: number; impact: string };
    humidity: { score: number; impact: string };
    inversion: { score: number; impact: string };
  };
  recommendations: string[];
}

export function getCurrentPosition(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  });
}

export class WeatherService {

  static async getCurrentWeather(coords?: { latitude: number; longitude: number }): Promise<WeatherData> {
    try {
      const loc = coords || LocationWeatherService.getFarmLocation();
      const response = await fetch(`/api/weather/location?lat=${loc.latitude}&lon=${loc.longitude}`);
      const data = await response.json();
      return this.enhanceWeatherData(data);
    } catch (error) {
      console.error('Weather fetch error:', error);
      return this.getMockWeather();
    }
  }

  static enhanceWeatherData(rawData: any): WeatherData {
    const gustFactor = rawData.windGust ? (rawData.windGust - rawData.windSpeed) : 0;
    const temperatureInversion = rawData.temperatureInversion || this.detectTemperatureInversion(rawData);

    return {
      ...rawData,
      gustFactor,
      temperatureInversion,
      location: rawData.location || LocationWeatherService.getFarmLocation(),
      elevation: rawData.elevation || 700,
      source: rawData.source || 'Weather Service',
      driftRisk: this.calculateDriftRisk(rawData, gustFactor, temperatureInversion),
      sprayRecommendation: this.getSprayRecommendation(rawData, gustFactor, temperatureInversion)
    };
  }

  static calculateDriftRisk(
    weather: any,
    gustFactor: number,
    temperatureInversion: boolean
  ): 'low' | 'moderate' | 'high' | 'extreme' {
    let riskScore = 0;

    if (weather.windSpeed > 15) riskScore += 4;
    else if (weather.windSpeed > 10) riskScore += 3;
    else if (weather.windSpeed > 7) riskScore += 2;
    else if (weather.windSpeed > 3) riskScore += 1;

    if (gustFactor > 10) riskScore += 3;
    else if (gustFactor > 5) riskScore += 2;
    else if (gustFactor > 3) riskScore += 1;

    if (weather.temperature > 90) riskScore += 2;
    else if (weather.temperature > 85) riskScore += 1;

    if (weather.humidity < 40) riskScore += 2;
    else if (weather.humidity < 50) riskScore += 1;

    if (temperatureInversion) riskScore += 3;

    if (riskScore >= 8) return 'extreme';
    if (riskScore >= 5) return 'high';
    if (riskScore >= 3) return 'moderate';
    return 'low';
  }

  static getSprayRecommendation(
    weather: any,
    gustFactor: number,
    temperatureInversion: boolean
  ): 'optimal' | 'acceptable' | 'caution' | 'avoid' {
    if (weather.windSpeed > 15 ||
        gustFactor > 15 ||
        weather.temperature > 95 ||
        temperatureInversion) {
      return 'avoid';
    }

    if (weather.windSpeed > 10 ||
        gustFactor > 8 ||
        weather.temperature > 85 ||
        weather.humidity < 45) {
      return 'caution';
    }

    if (weather.windSpeed > 7 ||
        gustFactor > 5 ||
        weather.temperature > 80 ||
        weather.humidity < 55) {
      return 'acceptable';
    }

    return 'optimal';
  }

  static detectTemperatureInversion(weather: any): boolean {
    const hour = new Date().getHours();
    const dewPointSpread = weather.temperature - weather.dewPoint;

    return (hour >= 5 && hour <= 8 && dewPointSpread < 5) ||
           (weather.windSpeed < 3 && dewPointSpread < 3);
  }

  static getMockWeather(): WeatherData {
    return {
      temperature: 72,
      humidity: 65,
      windSpeed: 8,
      windGust: 12,
      windDirection: 'SW',
      pressure: 30.15,
      dewPoint: 58,
      timestamp: new Date().toISOString(),
      driftRisk: 'moderate',
      sprayRecommendation: 'acceptable',
      temperatureInversion: false,
      gustFactor: 4,
      location: LocationWeatherService.getFarmLocation(),
      source: 'Mock Weather Service',
      elevation: 700
    };
  }

  static assessDriftConditions(weather: WeatherData): DriftAssessment {
    const assessment: DriftAssessment = {
      overall: weather.driftRisk,
      factors: {
        wind: this.assessWindFactor(weather.windSpeed),
        gusts: this.assessGustFactor(weather.gustFactor),
        temperature: this.assessTemperatureFactor(weather.temperature),
        humidity: this.assessHumidityFactor(weather.humidity),
        inversion: this.assessInversionFactor(weather.temperatureInversion)
      },
      recommendations: [],
    };

    assessment.recommendations = this.generateRecommendations(assessment.factors, weather);

    return assessment;
  }

  private static assessWindFactor(windSpeed: number) {
    if (windSpeed > 15) return { score: 4, impact: 'Excessive - Do not spray' };
    if (windSpeed > 10) return { score: 3, impact: 'High drift potential' };
    if (windSpeed > 7) return { score: 2, impact: 'Moderate drift risk' };
    if (windSpeed > 3) return { score: 1, impact: 'Low drift risk' };
    return { score: 0, impact: 'Minimal wind movement' };
  }

  private static assessGustFactor(gustFactor: number) {
    if (gustFactor > 15) return { score: 4, impact: 'Dangerous gusts' };
    if (gustFactor > 10) return { score: 3, impact: 'High variability' };
    if (gustFactor > 5) return { score: 2, impact: 'Moderate gusts' };
    return { score: 1, impact: 'Steady winds' };
  }

  private static assessTemperatureFactor(temperature: number) {
    if (temperature > 95) return { score: 3, impact: 'Excessive volatilization' };
    if (temperature > 85) return { score: 2, impact: 'High volatilization risk' };
    if (temperature > 75) return { score: 1, impact: 'Good conditions' };
    return { score: 0, impact: 'Optimal temperature' };
  }

  private static assessHumidityFactor(humidity: number) {
    if (humidity < 40) return { score: 3, impact: 'Very dry - high drift' };
    if (humidity < 50) return { score: 2, impact: 'Low humidity increases drift' };
    if (humidity < 60) return { score: 1, impact: 'Acceptable humidity' };
    return { score: 0, impact: 'Good humidity levels' };
  }

  private static assessInversionFactor(hasInversion: boolean) {
    return hasInversion
      ? { score: 4, impact: 'Temperature inversion - avoid spraying' }
      : { score: 0, impact: 'No inversion detected' };
  }

  private static generateRecommendations(factors: any, weather: WeatherData): string[] {
    const recommendations: string[] = [];

    if (factors.wind.score >= 3) {
      recommendations.push('Wind too high - delay spraying');
    } else if (factors.wind.score >= 2) {
      recommendations.push('Use larger droplet size nozzles');
      recommendations.push('Lower boom height');
    }

    if (factors.gusts.score >= 3) {
      recommendations.push('Wind gusts too variable - wait for steadier conditions');
    }

    if (factors.temperature.score >= 2) {
      recommendations.push('High temperature - spray early morning or evening');
      recommendations.push('Increase carrier volume');
    }

    if (factors.humidity.score >= 2) {
      recommendations.push('Low humidity increases drift - monitor closely');
      recommendations.push('Consider drift reduction adjuvant');
    }

    if (factors.inversion.score >= 3) {
      recommendations.push('Temperature inversion detected - do not spray');
    }

    if (weather.gustFactor > 8) {
      recommendations.push(`Wind gusts ${weather.windGust} mph - monitor continuously`);
    }

    return recommendations;
  }

}

export class LocationWeatherService {
  private static readonly DEFAULT_FARM_LOCATION: LocationData = {
    latitude: 41.4389,
    longitude: -84.3558,
    city: 'Defiance',
    state: 'Ohio',
    county: 'Defiance County',
    timezone: 'America/New_York'
  };

  private static farmLocation: LocationData = LocationWeatherService.DEFAULT_FARM_LOCATION;
  private static fieldLocations: FieldLocation[] = [];

  static setFarmLocation(location: LocationData) {
    this.farmLocation = location;
    localStorage.setItem('farmLocation', JSON.stringify(location));
  }

  static getFarmLocation(): LocationData {
    const stored = localStorage.getItem('farmLocation');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return this.DEFAULT_FARM_LOCATION;
      }
    }
    return this.farmLocation;
  }

  static async getCurrentWeatherByLocation(location?: LocationData): Promise<WeatherData> {
    const targetLocation = location || this.getFarmLocation();

    try {
      const response = await fetch(`/api/weather/location?lat=${targetLocation.latitude}&lon=${targetLocation.longitude}`);

      if (response.ok) {
        const data = await response.json();
        return this.enhanceLocationWeatherData(data, targetLocation);
      } else {
        throw new Error('Location weather API failed');
      }
    } catch (error) {
      console.error('Location weather fetch error:', error);
      return this.getMockLocationWeather(targetLocation);
    }
  }

  static async getFieldWeather(fieldId: string): Promise<WeatherData> {
    const field = this.fieldLocations.find(f => f.id === fieldId);

    if (field) {
      const fieldLocation: LocationData = {
        latitude: field.latitude,
        longitude: field.longitude,
        city: this.farmLocation.city,
        state: this.farmLocation.state,
        county: this.farmLocation.county,
        timezone: this.farmLocation.timezone
      };

      const weather = await this.getCurrentWeatherByLocation(fieldLocation);
      return this.adjustForMicroclimate(weather, field);
    }

    return this.getCurrentWeatherByLocation();
  }

  static addFieldLocation(field: FieldLocation) {
    this.fieldLocations = [...this.fieldLocations.filter(f => f.id !== field.id), field];
    localStorage.setItem('fieldLocations', JSON.stringify(this.fieldLocations));
  }

  static getFieldLocations(): FieldLocation[] {
    const stored = localStorage.getItem('fieldLocations');
    if (stored) {
      try {
        this.fieldLocations = JSON.parse(stored);
      } catch {
        this.fieldLocations = [];
      }
    }
    return this.fieldLocations;
  }

  static async getNearbyWeatherStations(location?: LocationData): Promise<WeatherStation[]> {
    const targetLocation = location || this.getFarmLocation();

    try {
      const response = await fetch(`/api/weather/stations?lat=${targetLocation.latitude}&lon=${targetLocation.longitude}&radius=25`);

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Weather stations fetch error:', error);
    }

    return this.getMockWeatherStations(targetLocation);
  }

  private static enhanceLocationWeatherData(rawData: any, location: LocationData): WeatherData {
    const gustFactor = rawData.windGust ? (rawData.windGust - rawData.windSpeed) : 0;
    const temperatureInversion = this.detectLocationTemperatureInversion(rawData, location);

    return {
      ...rawData,
      gustFactor,
      temperatureInversion,
      location,
      elevation: rawData.elevation || this.getElevationForLocation(location),
      driftRisk: this.calculateLocationDriftRisk(rawData, gustFactor, temperatureInversion, location),
      sprayRecommendation: this.getLocationSprayRecommendation(rawData, gustFactor, temperatureInversion, location)
    };
  }

  private static adjustForMicroclimate(weather: WeatherData, field: FieldLocation): WeatherData {
    const adjusted = { ...weather };

    switch (field.microclimate) {
      case 'sheltered':
        adjusted.windSpeed *= 0.7;
        if (adjusted.windGust) adjusted.windGust *= 0.8;
        break;

      case 'exposed':
        adjusted.windSpeed *= 1.3;
        if (adjusted.windGust) adjusted.windGust *= 1.4;
        break;

      case 'valley':
        adjusted.windSpeed *= 0.8;
        adjusted.temperatureInversion = true;
        break;

      case 'hilltop':
        adjusted.windSpeed *= 1.2;
        adjusted.humidity *= 0.9;
        break;
    }

    adjusted.gustFactor = adjusted.windGust ? (adjusted.windGust - adjusted.windSpeed) : 0;
    adjusted.driftRisk = this.calculateLocationDriftRisk(adjusted, adjusted.gustFactor, adjusted.temperatureInversion, weather.location);
    adjusted.sprayRecommendation = this.getLocationSprayRecommendation(adjusted, adjusted.gustFactor, adjusted.temperatureInversion, weather.location);

    return adjusted;
  }

  private static detectLocationTemperatureInversion(weather: any, location: LocationData): boolean {
    const hour = new Date().getHours();
    const dewPointSpread = weather.temperature - weather.dewPoint;

    const isEarlyMorning = hour >= 5 && hour <= 8;
    const isEvening = hour >= 18 && hour <= 21;
    const lowWind = weather.windSpeed < 3;
    const lowDewPointSpread = dewPointSpread < 5;

    const highPressure = weather.pressure > 30.2;

    return (isEarlyMorning || isEvening) && lowWind && (lowDewPointSpread || highPressure);
  }

  private static calculateLocationDriftRisk(
    weather: any,
    gustFactor: number,
    temperatureInversion: boolean,
    location: LocationData
  ): 'low' | 'moderate' | 'high' | 'extreme' {
    let riskScore = 0;

    if (weather.windSpeed > 15) riskScore += 4;
    else if (weather.windSpeed > 10) riskScore += 3;
    else if (weather.windSpeed > 7) riskScore += 2;
    else if (weather.windSpeed > 3) riskScore += 1;

    if (gustFactor > 10) riskScore += 3;
    else if (gustFactor > 5) riskScore += 2;
    else if (gustFactor > 3) riskScore += 1;

    if (weather.temperature > 90) riskScore += 2;
    else if (weather.temperature > 85) riskScore += 1;

    if (weather.humidity < 40) riskScore += 2;
    else if (weather.humidity < 50) riskScore += 1;

    if (temperatureInversion) riskScore += 3;

    const hour = new Date().getHours();
    if (hour >= 13 && hour <= 16 && weather.temperature > 80) {
      riskScore += 1;
    }

    if (riskScore >= 9) return 'extreme';
    if (riskScore >= 6) return 'high';
    if (riskScore >= 3) return 'moderate';
    return 'low';
  }

  private static getLocationSprayRecommendation(
    weather: any,
    gustFactor: number,
    temperatureInversion: boolean,
    location: LocationData
  ): 'optimal' | 'acceptable' | 'caution' | 'avoid' {
    if (weather.windSpeed > 15 ||
        gustFactor > 15 ||
        weather.temperature > 95 ||
        temperatureInversion ||
        (weather.visibility && weather.visibility < 3)) {
      return 'avoid';
    }

    const hour = new Date().getHours();
    const isAfternoonThermal = hour >= 13 && hour <= 16 && weather.temperature > 82;

    if (weather.windSpeed > 10 ||
        gustFactor > 8 ||
        weather.temperature > 87 ||
        weather.humidity < 45 ||
        isAfternoonThermal) {
      return 'caution';
    }

    if (weather.windSpeed > 7 ||
        gustFactor > 5 ||
        weather.temperature > 80 ||
        weather.humidity < 55) {
      return 'acceptable';
    }

    return 'optimal';
  }

  private static getElevationForLocation(location: LocationData): number {
    if (location.county === 'Defiance County') {
      return 700;
    }
    return 800;
  }

  private static getMockLocationWeather(location: LocationData): WeatherData {
    const hour = new Date().getHours();
    const month = new Date().getMonth();

    const seasonalTemp = month < 3 || month > 10 ? 45 : 75;
    const temperature = seasonalTemp + (Math.random() * 20 - 10);

    const humidity = 55 + Math.random() * 30;

    const windSpeed = 3 + Math.random() * 10;
    const windGust = windSpeed + (Math.random() > 0.6 ? 2 + Math.random() * 8 : 0);

    return {
      temperature,
      humidity,
      windSpeed,
      windGust: windGust > windSpeed ? windGust : undefined,
      windDirection: ['SW', 'W', 'NW', 'S'][Math.floor(Math.random() * 4)],
      pressure: 29.9 + Math.random() * 0.4,
      dewPoint: temperature - (10 + Math.random() * 15),
      timestamp: new Date().toISOString(),
      location,
      elevation: this.getElevationForLocation(location),
      source: 'Mock Weather Service',
      visibility: 8 + Math.random() * 2,
      uvIndex: Math.max(0, 6 + Math.random() * 4),
      driftRisk: 'moderate',
      sprayRecommendation: 'acceptable',
      temperatureInversion: hour >= 5 && hour <= 8 && Math.random() > 0.7,
      gustFactor: windGust > windSpeed ? windGust - windSpeed : 0
    };
  }

  private static getMockWeatherStations(location: LocationData): WeatherStation[] {
    return [
      {
        id: 'KDEFK',
        name: 'Defiance County Airport',
        distance: 2.3,
        latitude: 41.4389,
        longitude: -84.3558,
        elevation: 695
      },
      {
        id: 'KTOL',
        name: 'Toledo Express Airport',
        distance: 23.7,
        latitude: 41.5868,
        longitude: -83.8078,
        elevation: 683
      },
      {
        id: 'KFWA',
        name: 'Fort Wayne International',
        distance: 31.2,
        latitude: 40.9785,
        longitude: -85.1951,
        elevation: 815
      },
      {
        id: 'KPCW',
        name: 'Paulding County Airport',
        distance: 18.5,
        latitude: 41.2342,
        longitude: -84.5858,
        elevation: 712
      }
    ];
  }
}
