import { useState, useEffect, useCallback, useRef } from 'react';
import { WeatherService, WeatherData, DriftAssessment, getCurrentPosition, LocationWeatherService } from '../utils/weatherService';

export type LocationSource = 'gps' | 'farm' | 'loading';

export function useWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [driftAssessment, setDriftAssessment] = useState<DriftAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [locationSource, setLocationSource] = useState<LocationSource>('loading');
  const coordsRef = useRef<{ latitude: number; longitude: number } | null>(null);

  // Resolve geolocation once on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pos = await getCurrentPosition();
      if (cancelled) return;
      if (pos) {
        coordsRef.current = pos;
        setLocationSource('gps');
      } else {
        const farm = await LocationWeatherService.getFarmLocation();
        if (cancelled) return;
        coordsRef.current = { latitude: farm.latitude, longitude: farm.longitude };
        setLocationSource('farm');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const loadWeather = useCallback(async () => {
    try {
      setLoading(true);
      const data = await WeatherService.getCurrentWeather(coordsRef.current || undefined);
      const assessment = WeatherService.assessDriftConditions(data);
      setWeather(data);
      setDriftAssessment(assessment);
    } catch (err) {
      console.error('Weather load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load weather once coords are resolved (locationSource changes from 'loading')
  useEffect(() => {
    if (locationSource === 'loading') return;
    loadWeather();
  }, [locationSource, loadWeather]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (!autoRefresh || locationSource === 'loading') return;
    const interval = setInterval(loadWeather, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadWeather, locationSource]);

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
    locationSource,
  };
}
