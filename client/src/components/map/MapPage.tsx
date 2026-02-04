import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Field } from '../../types';
import { getFields, getPins } from '../../utils/storageService';
import { LocationWeatherService } from '../../utils/weatherService';
import FieldLayer from './FieldLayer';
import DrawControls from './DrawControls';
import RouteBuilder from './RouteBuilder';
import PinManager from './PinManager';

type MapMode = 'view' | 'draw' | 'route' | 'pins';

/** Inner component that can access the map instance via useMap() */
function MapControls({ homeTarget }: { homeTarget: [number, number] | null }) {
  const map = useMap();

  const flyHome = useCallback(() => {
    if (homeTarget) {
      map.flyTo(homeTarget, 14, { duration: 1.2 });
    }
  }, [map, homeTarget]);

  useEffect(() => {
    (map as any)._flyHome = flyHome;
  }, [map, flyHome]);

  return null;
}

const MapPage: React.FC = () => {
  const [mode, setMode] = useState<MapMode>('view');
  const [fields, setFields] = useState<Field[]>([]);
  const [center, setCenter] = useState<[number, number]>([40.0, -98.0]);
  const [homeTarget, setHomeTarget] = useState<[number, number] | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const [mapRef, setMapRef] = useState<L.Map | null>(null);

  const loadHomeTarget = () => {
    // Check saved pins for home pin first
    const pins = getPins();
    const homePin = pins.find((p) => p.isHome);
    if (homePin) {
      setHomeTarget([homePin.latitude, homePin.longitude]);
      return;
    }
    // Fall back to farm location
    const farm = LocationWeatherService.getFarmLocation();
    if (farm.latitude && farm.longitude) {
      setHomeTarget([farm.latitude, farm.longitude]);
    }
  };

  useEffect(() => {
    setFields(getFields());

    const farm = LocationWeatherService.getFarmLocation();
    if (farm.latitude && farm.longitude) {
      setCenter([farm.latitude, farm.longitude]);
    }

    loadHomeTarget();
  }, []);

  const reloadFields = () => setFields(getFields());

  const handlePinsChanged = () => {
    loadHomeTarget();
  };

  const handleFlyHome = () => {
    if (mapRef && (mapRef as any)._flyHome) {
      (mapRef as any)._flyHome();
    }
  };

  const modes: { key: MapMode; label: string }[] = [
    { key: 'view', label: 'View' },
    { key: 'draw', label: 'Draw Field' },
    { key: 'route', label: 'Route' },
    { key: 'pins', label: 'Pins' },
  ];

  return (
    <div className="relative h-full">
      {/* Mode toolbar */}
      <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-[1000] bg-white rounded-lg shadow-lg flex overflow-hidden">
        {modes.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`px-2.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium transition-colors ${
              mode === m.key
                ? 'bg-ag-green-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Map controls -- top right (visible when not in route or pins mode, which have their own panels) */}
      {mode !== 'route' && mode !== 'pins' && (
        <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-[1000] flex flex-col gap-2">
          {homeTarget && (
            <button
              onClick={handleFlyHome}
              className="bg-white rounded-lg shadow-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-1.5"
              title="Go to home location"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-red-600">
                <path d="M10 2 L18 9 L16 9 L16 16 Q16 17 15 17 L12 17 L12 12 L8 12 L8 17 L5 17 Q4 17 4 16 L4 9 L2 9 Z"/>
              </svg>
              Home
            </button>
          )}

          <button
            onClick={() => setShowLabels((v) => !v)}
            className={`bg-white rounded-lg shadow-lg px-3 py-2 text-sm font-medium transition-colors flex items-center gap-1.5 ${
              showLabels ? 'text-blue-700' : 'text-gray-500'
            } hover:bg-gray-100`}
            title={showLabels ? 'Hide road names' : 'Show road names'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M3 4h14v2H3V4zm2 4h10v2H5V8zm3 4h4v2H8v-2z"/>
            </svg>
            Roads
          </button>
        </div>
      )}

      <MapContainer
        center={center}
        zoom={14}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        ref={setMapRef}
      >
        {/* Satellite base layer */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri"
          maxZoom={19}
        />

        {/* Road & label overlay */}
        {showLabels && (
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />
        )}

        <MapControls homeTarget={homeTarget} />
        <FieldLayer fields={fields} />
        <DrawControls active={mode === 'draw'} onFieldCreated={reloadFields} />
        <RouteBuilder active={mode === 'route'} />
        <PinManager active={mode === 'pins'} onPinsChanged={handlePinsChanged} />
      </MapContainer>
    </div>
  );
};

export default MapPage;
