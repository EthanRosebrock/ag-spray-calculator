import React, { useState } from 'react';
import { useWeather } from '../../hooks/useWeather';

const WeatherWidget: React.FC = () => {
  const { weather, driftAssessment, loading, autoRefresh, setAutoRefresh, loadWeather, isGo, locationSource } =
    useWeather();
  const [open, setOpen] = useState(false);

  const getRecommendationColor = (rec: string): string => {
    switch (rec) {
      case 'optimal':
        return 'bg-green-100 border-green-300 text-green-800';
      case 'acceptable':
        return 'bg-blue-100 border-blue-300 text-blue-800';
      case 'caution':
        return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'avoid':
        return 'bg-red-100 border-red-300 text-red-800';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  const getRiskColor = (risk: string): string => {
    switch (risk) {
      case 'low':
        return 'text-green-600';
      case 'moderate':
        return 'text-yellow-600';
      case 'high':
        return 'text-orange-600';
      case 'extreme':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 4) return 'bg-red-500';
    if (score >= 3) return 'bg-orange-500';
    if (score >= 2) return 'bg-yellow-500';
    if (score >= 1) return 'bg-blue-500';
    return 'bg-green-500';
  };

  // Badge shown in collapsed header
  const badge = weather ? (
    <span
      className={`px-2 py-0.5 rounded text-xs font-bold ${
        isGo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
      }`}
    >
      {isGo ? 'GO' : 'NO-GO'}
    </span>
  ) : null;

  return (
    <div className="card">
      <button
        onClick={() => setOpen(!open)}
        className="flex justify-between items-center w-full text-left"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Weather Check</h2>
          {!open && badge}
          {loading && !weather && (
            <span className="text-xs text-gray-400">Loading...</span>
          )}
        </div>
        <span className="text-gray-400">{open ? '\u25B2' : '\u25BC'}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-6">
          {loading && !weather && (
            <div className="text-center py-8 text-gray-500">Loading weather data...</div>
          )}

          {!loading && !weather && (
            <div className="text-center py-8 text-gray-500">
              <p>Failed to load weather data</p>
              <button onClick={loadWeather} className="btn-primary mt-4 text-sm py-2 px-4">
                Retry
              </button>
            </div>
          )}

          {weather && driftAssessment && (
            <>
              {/* Go / No-Go card */}
              <div
                className={`p-4 rounded-lg border-2 ${getRecommendationColor(
                  weather.sprayRecommendation
                )}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold capitalize">
                      {isGo ? 'GO' : 'NO-GO'} &mdash; {weather.sprayRecommendation} Conditions
                    </h3>
                    <p className="opacity-90 text-sm mt-1">
                      Drift Risk:{' '}
                      <span className={`font-semibold ${getRiskColor(weather.driftRisk)}`}>
                        {weather.driftRisk.toUpperCase()}
                      </span>
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={autoRefresh}
                          onChange={(e) => setAutoRefresh(e.target.checked)}
                        />
                        Auto
                      </label>
                      <button
                        onClick={loadWeather}
                        className="btn-secondary text-xs py-1 px-3"
                      >
                        Refresh
                      </button>
                    </div>
                    <div className="text-xs mt-1 opacity-75">
                      {new Date(weather.timestamp).toLocaleTimeString()}
                    </div>
                    <div className="text-xs mt-0.5 opacity-60">
                      {locationSource === 'gps'
                        ? 'GPS location'
                        : `Farm location (${weather.location?.city || 'Default'})`}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Conditions */}
                <div>
                  <h3 className="font-semibold mb-3">Current Conditions</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <MetricBox
                      label="Temperature"
                      value={`${Math.round(weather.temperature)}\u00B0F`}
                      warning={weather.temperature > 85}
                    />
                    <MetricBox
                      label="Wind Speed"
                      value={`${Math.round(weather.windSpeed)} mph`}
                      sub={weather.windDirection}
                      warning={weather.windSpeed > 10}
                    />
                    <MetricBox
                      label="Humidity"
                      value={`${Math.round(weather.humidity)}%`}
                      warning={weather.humidity < 50}
                    />
                    <MetricBox
                      label="Gusts"
                      value={weather.windGust ? `${Math.round(weather.windGust)} mph` : 'None'}
                      sub={
                        weather.gustFactor > 0
                          ? `+${Math.round(weather.gustFactor)} mph`
                          : undefined
                      }
                      warning={weather.gustFactor > 8}
                    />
                    <MetricBox
                      label="Pressure"
                      value={`${weather.pressure.toFixed(2)}"`}
                      warning={false}
                    />
                    <MetricBox
                      label="Dew Point"
                      value={`${Math.round(weather.dewPoint)}\u00B0F`}
                      sub={weather.temperatureInversion ? 'Inversion!' : undefined}
                      warning={weather.temperatureInversion}
                    />
                  </div>
                </div>

                {/* Drift Factors */}
                <div>
                  <h3 className="font-semibold mb-3">Drift Risk Factors</h3>
                  <div className="space-y-3">
                    {Object.entries(driftAssessment.factors).map(([factor, data]) => (
                      <div key={factor} className="flex items-center gap-3">
                        <div
                          className={`w-3 h-3 rounded-full flex-shrink-0 ${getScoreColor(
                            data.score
                          )}`}
                        />
                        <div className="flex-1">
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-sm capitalize">{factor}</span>
                            <span className="text-xs text-gray-500">Score: {data.score}</span>
                          </div>
                          <div className="text-xs text-gray-600">{data.impact}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <span className="text-sm text-gray-600">Weather Source</span>
                    <div className="text-sm font-medium mt-1">{weather.source}</div>
                    <div className="text-xs text-gray-500">
                      {weather.location?.latitude.toFixed(4)}, {weather.location?.longitude.toFixed(4)}
                      {weather.location?.city && ` — ${weather.location.city}, ${weather.location.state}`}
                    </div>
                  </div>
                </div>

                {/* Recommendations */}
                <div>
                  <h3 className="font-semibold mb-3">Recommendations</h3>
                  {driftAssessment.recommendations.length === 0 ? (
                    <div className="text-center py-6 text-green-600">
                      <p className="font-medium">Excellent spray conditions!</p>
                      <p className="text-sm">No special precautions needed</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {driftAssessment.recommendations.map((rec, i) => (
                        <div
                          key={i}
                          className="p-3 bg-yellow-50 rounded border border-yellow-200 text-sm text-yellow-800"
                        >
                          {rec}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

interface MetricBoxProps {
  label: string;
  value: string;
  sub?: string;
  warning: boolean;
}

const MetricBox: React.FC<MetricBoxProps> = ({ label, value, sub, warning }) => (
  <div
    className={`text-center p-3 rounded border ${
      warning ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'
    }`}
  >
    <div className="font-semibold">{value}</div>
    {sub && <div className="text-xs text-gray-600">{sub}</div>}
    <div className="text-xs text-gray-500 mt-1">{label}</div>
  </div>
);

export default WeatherWidget;
