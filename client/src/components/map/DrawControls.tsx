import React, { useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { Field } from '../../types';
import { calculatePolygonArea, calculateCentroid } from '../../utils/importService';
import { saveField } from '../../utils/storageService';

interface DrawControlsProps {
  active: boolean;
  onFieldCreated: () => void;
}

const DrawControls: React.FC<DrawControlsProps> = ({ active, onFieldCreated }) => {
  const map = useMap();
  const [drawing, setDrawing] = useState(false);
  const [vertices, setVertices] = useState<[number, number][]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [fieldName, setFieldName] = useState('');
  const [tempPolygon, setTempPolygon] = useState<L.Polygon | null>(null);
  const [tempMarkers, setTempMarkers] = useState<L.CircleMarker[]>([]);

  const startDrawing = () => {
    setDrawing(true);
    setVertices([]);
    clearTemp();

    const onClick = (e: L.LeafletMouseEvent) => {
      const point: [number, number] = [e.latlng.lat, e.latlng.lng];
      setVertices((prev) => {
        const newVerts = [...prev, point];
        // Draw vertex marker
        const marker = L.circleMarker(e.latlng, {
          radius: 6,
          color: '#16a34a',
          fillColor: '#22c55e',
          fillOpacity: 1,
          weight: 2,
        }).addTo(map);
        setTempMarkers((m) => [...m, marker]);

        // Update preview polygon
        if (newVerts.length >= 2) {
          if (tempPolygon) {
            tempPolygon.setLatLngs(newVerts);
          } else {
            const poly = L.polygon(newVerts, {
              color: '#16a34a',
              weight: 2,
              fillOpacity: 0.15,
              dashArray: '5, 5',
            }).addTo(map);
            setTempPolygon(poly);
          }
        }
        return newVerts;
      });
    };

    map.on('click', onClick);

    // Store the handler reference for cleanup
    (map as any)._drawClickHandler = onClick;
  };

  const finishDrawing = () => {
    setDrawing(false);
    // Remove click handler
    if ((map as any)._drawClickHandler) {
      map.off('click', (map as any)._drawClickHandler);
      delete (map as any)._drawClickHandler;
    }

    if (vertices.length >= 3) {
      setShowSaveDialog(true);
    } else {
      clearTemp();
    }
  };

  const cancelDrawing = () => {
    setDrawing(false);
    if ((map as any)._drawClickHandler) {
      map.off('click', (map as any)._drawClickHandler);
      delete (map as any)._drawClickHandler;
    }
    clearTemp();
    setVertices([]);
  };

  const clearTemp = () => {
    if (tempPolygon) {
      map.removeLayer(tempPolygon);
      setTempPolygon(null);
    }
    tempMarkers.forEach((m) => map.removeLayer(m));
    setTempMarkers([]);
  };

  const handleSaveField = () => {
    if (!fieldName.trim() || vertices.length < 3) return;

    const boundary = vertices;
    const centroid = calculateCentroid(boundary);
    const acres = calculatePolygonArea(boundary);

    const field: Field = {
      id: Date.now().toString(),
      name: fieldName.trim(),
      acres: Math.round(acres * 10) / 10,
      carrierRate: 20,
      latitude: centroid[0],
      longitude: centroid[1],
      boundary,
    };

    saveField(field);
    clearTemp();
    setVertices([]);
    setFieldName('');
    setShowSaveDialog(false);
    onFieldCreated();
  };

  const cancelSave = () => {
    clearTemp();
    setVertices([]);
    setFieldName('');
    setShowSaveDialog(false);
  };

  if (!active) return null;

  return (
    <>
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-white rounded-lg shadow-lg p-3">
        {!drawing && !showSaveDialog && (
          <button onClick={startDrawing} className="btn-primary text-sm py-2 px-4">
            Draw Field Boundary
          </button>
        )}
        {drawing && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">
              Click map to add vertices ({vertices.length} points)
            </span>
            {vertices.length >= 3 && (
              <button onClick={finishDrawing} className="btn-primary text-sm py-1.5 px-3">
                Finish
              </button>
            )}
            <button onClick={cancelDrawing} className="btn-secondary text-sm py-1.5 px-3">
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Save dialog */}
      {showSaveDialog && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-white rounded-lg shadow-lg p-4 w-80">
          <h3 className="font-semibold mb-3">Save Field</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Field Name</label>
              <input
                type="text"
                className="input-field text-sm"
                value={fieldName}
                onChange={(e) => setFieldName(e.target.value)}
                placeholder="Enter field name"
                autoFocus
              />
            </div>
            <div className="text-sm text-gray-500">
              Area: ~{calculatePolygonArea(vertices).toFixed(1)} acres &middot;{' '}
              {vertices.length} vertices
            </div>
            <div className="flex gap-2">
              <button onClick={handleSaveField} className="btn-primary text-sm py-1.5 px-3 flex-1">
                Save
              </button>
              <button onClick={cancelSave} className="btn-secondary text-sm py-1.5 px-3 flex-1">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DrawControls;
