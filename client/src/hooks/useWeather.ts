import { useState, useEffect, useCallback } from 'react';
import { WeatherService, WeatherData, DriftAssessment } from '../utils/weatherService';

export function useWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [driftAssessment, setDriftAssessment] = useState<DriftAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const loadWeather = useCallback(async () => {
    try {
      setLoading(true);
      const data = await WeatherService.getCurrentWeather();
      const assessment = WeatherService.assessDriftConditions(data);
      setWeather(data);
      setDriftAssessment(assessment);
    } catch (err) {
      console.error('Weather load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWeather();
    if (autoRefresh) {
      const interval = setInterval(loadWeather, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, loadWeather]);

  const isGo =
    weather?.sprayRecommendation === 'optimal' ||
    weather?.sprayRecommendation === 'acceptable';

  return {
    weather,
    driftAssessment,
    loading,
    autoRefresh,
    setAutoRefresh,
    loadWeather,
    isGo,
  };
}
