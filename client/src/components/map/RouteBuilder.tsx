import React, { useState, useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { TenderRoute, RouteWaypoint } from '../../types';
import { getRoutes, saveRoute, deleteRoute } from '../../utils/storageService';

interface RouteBuilderProps {
  active: boolean;
}

// Haversine distance in miles
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const waypointIcon = (num: number) =>
  new L.DivIcon({
    html: `<div style="background:#2563eb;color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.3)">${num}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    className: '',
  });

const RouteBuilder: React.FC<RouteBuilderProps> = ({ active }) => {
  const map = useMap();
  const [waypoints, setWaypoints] = useState<RouteWaypoint[]>([]);
  const [placing, setPlacing] = useState(false);
  const [routes, setRoutes] = useState<TenderRoute[]>([]);
  const [routeName, setRouteName] = useState('');
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [markers, setMarkers] = useState<L.Marker[]>([]);
  const [polyline, setPolyline] = useState<L.Polyline | null>(null);

  // Load saved routes
  useEffect(() => {
    setRoutes(getRoutes());
  }, []);

  // Render waypoints on map
  useEffect(() => {
    // Clean up previous
    markers.forEach((m) => map.removeLayer(m));
    if (polyline) map.removeLayer(polyline);

    if (waypoints.length === 0) {
      setMarkers([]);
      setPolyline(null);
      return;
    }

    const newMarkers = waypoints.map((wp, i) => {
      const marker = L.marker([wp.latitude, wp.longitude], {
        icon: waypointIcon(i + 1),
        draggable: true,
      }).addTo(map);

      marker.bindTooltip(wp.label || `Waypoint ${i + 1}`, { direction: 'top', offset: [0, -16] });

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        setWaypoints((prev) => {
          const updated = [...prev];
          updated[i] = { ...updated[i], latitude: pos.lat, longitude: pos.lng };
          return updated;
        });
      });

      return marker;
    });

    setMarkers(newMarkers);

    // Draw line
    if (waypoints.length >= 2) {
      const coords = waypoints.map((wp) => [wp.latitude, wp.longitude] as [number, number]);
      const line = L.polyline(coords, {
        color: '#2563eb',
        weight: 3,
        dashArray: '8, 4',
      }).addTo(map);
      setPolyline(line);
    } else {
      setPolyline(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waypoints, map]);

  // Map click handler for placing waypoints
  useEffect(() => {
    if (!active || !placing) return;

    const handler = (e: L.LeafletMouseEvent) => {
      const wp: RouteWaypoint = {
        id: Date.now().toString(),
        label: `Stop ${waypoints.length + 1}`,
        latitude: e.latlng.lat,
        longitude: e.latlng.lng,
      };
      setWaypoints((prev) => [...prev, wp]);
    };

    map.on('click', handler);
    return () => { map.off('click', handler); };
  }, [active, placing, map, waypoints.length]);

  const segments = waypoints.length >= 2
    ? waypoints.slice(0, -1).map((wp, i) => ({
        from: wp,
        to: waypoints[i + 1],
        distance: haversine(wp.latitude, wp.longitude, waypoints[i + 1].latitude, waypoints[i + 1].longitude),
      }))
    : [];

  const totalDistance = segments.reduce((sum, s) => sum + s.distance, 0);

  const removeWaypoint = (index: number) => {
    setWaypoints((prev) => prev.filter((_, i) => i !== index));
  };

  const updateLabel = (id: string, label: string) => {
    setWaypoints((prev) => prev.map((wp) => (wp.id === id ? { ...wp, label } : wp)));
    setEditingLabel(null);
  };

  const clearRoute = () => {
    setWaypoints([]);
    setPlacing(false);
  };

  const handleSaveRoute = () => {
    if (!routeName.trim() || waypoints.length < 2) return;
    const route: TenderRoute = {
      id: Date.now().toString(),
      name: routeName.trim(),
      waypoints,
      createdAt: new Date().toISOString(),
    };
    saveRoute(route);
    setRoutes(getRoutes());
    setRouteName('');
  };

  const loadRoute = (route: TenderRoute) => {
    setWaypoints(route.waypoints);
    setPlacing(false);

    // Fit map to route bounds
    if (route.waypoints.length > 0) {
      const bounds = L.latLngBounds(route.waypoints.map((wp) => [wp.latitude, wp.longitude]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  };

  const handleDeleteRoute = (id: string) => {
    deleteRoute(id);
    setRoutes(getRoutes());
  };

  const moveWaypoint = (fromIdx: number, direction: 'up' | 'down') => {
    const toIdx = direction === 'up' ? fromIdx - 1 : fromIdx + 1;
    if (toIdx < 0 || toIdx >= waypoints.length) return;
    setWaypoints((prev) => {
      const updated = [...prev];
      [updated[fromIdx], updated[toIdx]] = [updated[toIdx], updated[fromIdx]];
      return updated;
    });
  };

  if (!active) return null;

  return (
    <div className="absolute top-4 right-4 z-[1000] bg-white rounded-lg shadow-lg w-72 max-h-[80vh] overflow-y-auto">
      <div className="p-3 border-b">
        <h3 className="font-semibold text-sm">Tender Route Builder</h3>
      </div>

      <div className="p-3 space-y-3">
        {/* Controls */}
        <div className="flex gap-2">
          <button
            onClick={() => setPlacing(!placing)}
            className={`text-sm py-1.5 px-3 rounded font-medium flex-1 ${
              placing
                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {placing ? 'Placing...' : 'Drop Pins'}
          </button>
          <button onClick={clearRoute} className="text-sm py-1.5 px-3 rounded bg-gray-100 text-gray-600 hover:bg-gray-200">
            Clear
          </button>
        </div>

        {/* Waypoint list */}
        {waypoints.length > 0 && (
          <div className="space-y-1">
            {waypoints.map((wp, i) => (
              <div key={wp.id} className="flex items-center gap-1 text-sm bg-gray-50 rounded p-1.5">
                <span className="text-xs font-bold text-blue-600 w-5 text-center">{i + 1}</span>
                {editingLabel === wp.id ? (
                  <input
                    type="text"
                    className="flex-1 text-xs border rounded px-1 py-0.5"
                    defaultValue={wp.label}
                    autoFocus
                    onBlur={(e) => updateLabel(wp.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') updateLabel(wp.id, (e.target as HTMLInputElement).value);
                    }}
                  />
                ) : (
                  <span
                    className="flex-1 text-xs cursor-pointer truncate"
                    onClick={() => setEditingLabel(wp.id)}
                    title="Click to rename"
                  >
                    {wp.label}
                  </span>
                )}
                <div className="flex gap-0.5">
                  {i > 0 && (
                    <button onClick={() => moveWaypoint(i, 'up')} className="text-gray-400 hover:text-gray-600 text-xs px-0.5">
                      &uarr;
                    </button>
                  )}
                  {i < waypoints.length - 1 && (
                    <button onClick={() => moveWaypoint(i, 'down')} className="text-gray-400 hover:text-gray-600 text-xs px-0.5">
                      &darr;
                    </button>
                  )}
                  <button onClick={() => removeWaypoint(i)} className="text-red-400 hover:text-red-600 text-xs px-0.5">
                    &times;
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Segment distances */}
        {segments.length > 0 && (
          <div className="text-xs space-y-1 border-t pt-2">
            {segments.map((s, i) => (
              <div key={i} className="flex justify-between text-gray-500">
                <span>{i + 1} &rarr; {i + 2}</span>
                <span>{s.distance.toFixed(2)} mi</span>
              </div>
            ))}
            <div className="flex justify-between font-medium text-gray-700 pt-1 border-t">
              <span>Total</span>
              <span>{totalDistance.toFixed(2)} mi</span>
            </div>
          </div>
        )}

        {/* Save route */}
        {waypoints.length >= 2 && (
          <div className="border-t pt-2">
            <div className="flex gap-1">
              <input
                type="text"
                className="flex-1 text-sm border rounded px-2 py-1"
                placeholder="Route name"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
              />
              <button
                onClick={handleSaveRoute}
                disabled={!routeName.trim()}
                className="text-sm py-1 px-3 rounded bg-ag-green-600 text-white disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        )}

        {/* Saved routes */}
        {routes.length > 0 && (
          <div className="border-t pt-2">
            <h4 className="text-xs font-medium text-gray-500 mb-1">Saved Routes</h4>
            <div className="space-y-1">
              {routes.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-sm bg-gray-50 rounded p-1.5">
                  <button
                    onClick={() => loadRoute(r)}
                    className="text-xs text-blue-600 hover:text-blue-800 truncate flex-1 text-left"
                  >
                    {r.name} ({r.waypoints.length} stops)
                  </button>
                  <button
                    onClick={() => handleDeleteRoute(r.id)}
                    className="text-xs text-red-400 hover:text-red-600 ml-1"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RouteBuilder;
