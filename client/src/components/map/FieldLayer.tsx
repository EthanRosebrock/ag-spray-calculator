import React from 'react';
import { Polygon, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Field } from '../../types';

interface FieldLayerProps {
  fields: Field[];
}

// Simple green marker icon
const fieldIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
      <circle cx="12" cy="12" r="10" fill="#16a34a" stroke="white" stroke-width="2"/>
      <circle cx="12" cy="12" r="4" fill="white"/>
    </svg>
  `),
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12],
});

const FieldLayer: React.FC<FieldLayerProps> = ({ fields }) => {
  return (
    <>
      {fields.map((field) => {
        if (field.boundary && field.boundary.length >= 3) {
          return (
            <Polygon
              key={field.id}
              positions={field.boundary}
              pathOptions={{ color: '#16a34a', weight: 2, fillOpacity: 0.2 }}
            >
              <Popup>
                <div className="text-sm">
                  <div className="font-semibold">{field.name}</div>
                  <div>{field.acres.toFixed(1)} acres</div>
                  {field.crop && <div>Crop: {field.crop}</div>}
                </div>
              </Popup>
            </Polygon>
          );
        }

        if (field.latitude && field.longitude) {
          return (
            <Marker
              key={field.id}
              position={[field.latitude, field.longitude]}
              icon={fieldIcon}
            >
              <Popup>
                <div className="text-sm">
                  <div className="font-semibold">{field.name}</div>
                  <div>{field.acres.toFixed(1)} acres</div>
                  {field.crop && <div>Crop: {field.crop}</div>}
                </div>
              </Popup>
            </Marker>
          );
        }

        return null;
      })}
    </>
  );
};

export default FieldLayer;
