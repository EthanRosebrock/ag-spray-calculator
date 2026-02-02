import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { Field } from '../../types';
import { getFields } from '../../utils/storageService';
import { LocationWeatherService } from '../../utils/weatherService';
import FieldLayer from './FieldLayer';
import DrawControls from './DrawControls';
import RouteBuilder from './RouteBuilder';

type MapMode = 'view' | 'draw' | 'route';

const MapPage: React.FC = () => {
  const [mode, setMode] = useState<MapMode>('view');
  const [fields, setFields] = useState<Field[]>([]);
  const [center, setCenter] = useState<[number, number]>([40.0, -98.0]);

  useEffect(() => {
    setFields(getFields());

    // Use farm location as default center
    const farm = LocationWeatherService.getFarmLocation();
    if (farm.latitude && farm.longitude) {
      setCenter([farm.latitude, farm.longitude]);
    }
  }, []);

  const reloadFields = () => setFields(getFields());

  const modes: { key: MapMode; label: string }[] = [
    { key: 'view', label: 'View' },
    { key: 'draw', label: 'Draw Field' },
    { key: 'route', label: 'Route' },
  ];

  return (
    <div className="relative" style={{ height: 'calc(100vh - 160px)' }}>
      {/* Mode toolbar */}
      <div className="absolute top-4 left-4 z-[1000] bg-white rounded-lg shadow-lg flex overflow-hidden">
        {modes.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              mode === m.key
                ? 'bg-ag-green-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <MapContainer
        center={center}
        zoom={14}
        style={{ height: '100%', width: '100%', borderRadius: '0.5rem' }}
        zoomControl={true}
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri"
          maxZoom={19}
        />

        <FieldLayer fields={fields} />
        <DrawControls active={mode === 'draw'} onFieldCreated={reloadFields} />
        <RouteBuilder active={mode === 'route'} />
      </MapContainer>
    </div>
  );
};

export default MapPage;
