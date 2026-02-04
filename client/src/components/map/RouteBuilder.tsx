import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { TenderRoute, RouteWaypoint } from '../../types';
import { getRoutes, saveRoute, deleteRoute } from '../../utils/storageService';

interface RouteBuilderProps {
  active: boolean;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
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

const MAX_UNDO = 30;

const RouteBuilder: React.FC<RouteBuilderProps> = ({ active }) => {
  const map = useMap();
  const [waypoints, setWaypoints] = useState<RouteWaypoint[]>([]);
  const [placing, setPlacing] = useState(false);
  const [routes, setRoutes] = useState<TenderRoute[]>([]);
  const [routeName, setRouteName] = useState('');
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [markers, setMarkers] = useState<L.Marker[]>([]);
  const [polyline, setPolyline] = useState<L.Polyline | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [loadedRouteId, setLoadedRouteId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [showSegments, setShowSegments] = useState(false);

  // Undo stack stored as a ref for cheap push/pop. A companion counter state
  // forces a re-render whenever the stack length changes, so that the canUndo
  // derived variable (and thus the Undo button visibility) stays in sync.
  const undoRef = useRef<RouteWaypoint[][]>([]);
  const [undoCount, setUndoCount] = useState(0);
  const waypointsRef = useRef(waypoints);
  waypointsRef.current = waypoints;

  const pushUndo = useCallback((snapshot: RouteWaypoint[]) => {
    undoRef.current.push(snapshot);
    if (undoRef.current.length > MAX_UNDO) undoRef.current.splice(0, undoRef.current.length - MAX_UNDO);
    setUndoCount(undoRef.current.length);
  }, []);

  const handleUndo = useCallback(() => {
    if (undoRef.current.length === 0) return;
    const prev = undoRef.current.pop()!;
    setUndoCount(undoRef.current.length);
    setWaypoints(prev);
  }, []);

  // Wrapped setter: snapshots current waypoints into undo, then applies update.
  // pushUndo is called BEFORE setWaypoints (not inside an updater) to avoid
  // calling setState from within another setState updater.
  const setWaypointsWithUndo = useCallback(
    (updater: RouteWaypoint[] | ((prev: RouteWaypoint[]) => RouteWaypoint[])) => {
      pushUndo(waypointsRef.current);
      setWaypoints((prev) => {
        return typeof updater === 'function' ? updater(prev) : updater;
      });
    },
    [pushUndo]
  );

  // Prevent Leaflet from stealing scroll/touch on the panel.
  // Use a callback ref so we attach Leaflet event blockers as soon as the
  // DOM element appears (the panel is only rendered when active === true,
  // so a useEffect with [] deps would miss it on first mount).
  const panelRef = useRef<HTMLDivElement>(null);
  const panelCallbackRef = useCallback((el: HTMLDivElement | null) => {
    panelRef.current = el;
    if (el) {
      L.DomEvent.disableScrollPropagation(el);
      L.DomEvent.disableClickPropagation(el);
    }
  }, []);

  // Ctrl+Z
  const activeRef = useRef(active);
  activeRef.current = active;
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!activeRef.current) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo]);

  useEffect(() => { setRoutes(getRoutes()); }, []);

  // Render markers on map
  useEffect(() => {
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
        setWaypointsWithUndo((prev) => {
          const updated = [...prev];
          updated[i] = { ...updated[i], latitude: pos.lat, longitude: pos.lng };
          return updated;
        });
      });

      return marker;
    });

    setMarkers(newMarkers);

    if (waypoints.length >= 2) {
      const coords = waypoints.map((wp) => [wp.latitude, wp.longitude] as [number, number]);
      const line = L.polyline(coords, { color: '#2563eb', weight: 3, dashArray: '8, 4' }).addTo(map);
      setPolyline(line);
    } else {
      setPolyline(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waypoints, map]);

  // Map click → place waypoint
  useEffect(() => {
    if (!active || !placing) return;
    const handler = (e: L.LeafletMouseEvent) => {
      const wp: RouteWaypoint = {
        id: Date.now().toString(),
        label: `Stop ${waypoints.length + 1}`,
        latitude: e.latlng.lat,
        longitude: e.latlng.lng,
      };
      setWaypointsWithUndo((prev) => [...prev, wp]);
    };
    map.on('click', handler);
    return () => { map.off('click', handler); };
  }, [active, placing, map, waypoints.length, setWaypointsWithUndo]);

  const segments = waypoints.length >= 2
    ? waypoints.slice(0, -1).map((wp, i) => ({
        from: wp,
        to: waypoints[i + 1],
        distance: haversine(wp.latitude, wp.longitude, waypoints[i + 1].latitude, waypoints[i + 1].longitude),
      }))
    : [];
  const totalDistance = segments.reduce((sum, s) => sum + s.distance, 0);

  const removeWaypoint = (index: number) => {
    setWaypointsWithUndo((prev) => prev.filter((_, i) => i !== index));
  };

  const updateLabel = (id: string, label: string) => {
    setWaypointsWithUndo((prev) => prev.map((wp) => (wp.id === id ? { ...wp, label } : wp)));
    setEditingLabel(null);
  };

  const clearRoute = () => {
    if (waypoints.length === 0) return;
    setWaypointsWithUndo([]);
    setPlacing(false);
    setConfirmClear(false);
    setLoadedRouteId(null);
  };

  const handleSaveRoute = () => {
    if (!routeName.trim() || waypoints.length < 2) return;
    saveRoute({
      id: loadedRouteId || Date.now().toString(),
      name: routeName.trim(),
      waypoints,
      createdAt: new Date().toISOString(),
    });
    setRoutes(getRoutes());
    setRouteName('');
    setLoadedRouteId(null);
  };

  const loadRoute = (route: TenderRoute) => {
    setWaypointsWithUndo(route.waypoints);
    setPlacing(false);
    setLoadedRouteId(route.id);
    setRouteName(route.name);
    undoRef.current = [];
    setUndoCount(0);
    if (route.waypoints.length > 0) {
      const bounds = L.latLngBounds(route.waypoints.map((wp) => [wp.latitude, wp.longitude]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  };

  const handleDeleteRoute = (id: string) => {
    deleteRoute(id);
    setRoutes(getRoutes());
    setConfirmDeleteId(null);
    if (loadedRouteId === id) { setLoadedRouteId(null); setRouteName(''); }
  };

  const moveWaypoint = (fromIdx: number, direction: 'up' | 'down') => {
    const toIdx = direction === 'up' ? fromIdx - 1 : fromIdx + 1;
    if (toIdx < 0 || toIdx >= waypoints.length) return;
    setWaypointsWithUndo((prev) => {
      const updated = [...prev];
      [updated[fromIdx], updated[toIdx]] = [updated[toIdx], updated[fromIdx]];
      return updated;
    });
  };

  if (!active) return null;

  const canUndo = undoCount > 0;

  return (
    <div
      ref={panelCallbackRef}
      className="absolute bottom-2 left-2 right-2 sm:bottom-auto sm:left-auto sm:top-4 sm:right-4 sm:w-72 z-[1000] bg-white rounded-lg shadow-lg flex flex-col"
      style={{ maxHeight: 'calc(100% - 60px)' }}
    >
      {/* Header */}
      <div
        className="p-3 border-b flex items-center justify-between flex-shrink-0 cursor-pointer select-none"
        onClick={() => setCollapsed((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">Route Builder</h3>
          {waypoints.length > 0 && (
            <span className="text-xs text-gray-400">
              {waypoints.length} pts{segments.length > 0 ? ` · ${totalDistance.toFixed(1)} mi` : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canUndo && (
            <button
              onClick={(e) => { e.stopPropagation(); handleUndo(); }}
              onPointerDown={(e) => e.stopPropagation()}
              className="text-xs text-blue-600 active:text-blue-800 font-medium flex items-center gap-0.5 py-2 px-2 -my-1 rounded active:bg-blue-50 min-w-[44px] min-h-[44px] justify-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M7.793 2.232a.75.75 0 01-.025 1.06L3.622 7.25h10.003a5.375 5.375 0 010 10.75H10.75a.75.75 0 010-1.5h2.875a3.875 3.875 0 000-7.75H3.622l4.146 3.957a.75.75 0 01-1.036 1.085l-5.5-5.25a.75.75 0 010-1.085l5.5-5.25a.75.75 0 011.06.025z" clipRule="evenodd" />
              </svg>
              Undo
            </button>
          )}
          <svg
            xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
            className={`w-4 h-4 text-gray-400 transition-transform ${collapsed ? 'rotate-180' : ''}`}
          >
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </div>
      </div>

      {!collapsed && (
        <div className="overflow-y-auto overscroll-contain p-3 space-y-3">
          {/* Controls */}
          <div className="flex gap-2">
            <button
              onClick={() => setPlacing(!placing)}
              className={`text-sm py-2 px-3 rounded font-medium flex-1 ${
                placing ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-gray-100 text-gray-700 active:bg-gray-200'
              }`}
            >
              {placing ? 'Tap map to place...' : 'Add Waypoints'}
            </button>
            {placing && (
              <button onClick={() => setPlacing(false)} className="text-sm py-2 px-3 rounded bg-gray-100 text-gray-600 active:bg-gray-200">
                Done
              </button>
            )}
          </div>

          {/* Waypoint list */}
          {waypoints.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 mb-1">Waypoints ({waypoints.length})</h4>
              <div className="space-y-1 max-h-40 overflow-y-auto overscroll-contain">
                {waypoints.map((wp, i) => (
                  <div key={wp.id} className="flex items-center gap-1 text-sm bg-gray-50 rounded p-1.5">
                    <span className="text-xs font-bold text-blue-600 w-5 text-center flex-shrink-0">{i + 1}</span>
                    {editingLabel === wp.id ? (
                      <input
                        type="text"
                        className="flex-1 min-w-0 text-xs border rounded px-1 py-0.5"
                        defaultValue={wp.label}
                        autoFocus
                        onBlur={(e) => updateLabel(wp.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') updateLabel(wp.id, (e.target as HTMLInputElement).value);
                          if (e.key === 'Escape') setEditingLabel(null);
                        }}
                      />
                    ) : (
                      <span className="flex-1 min-w-0 text-xs cursor-pointer truncate active:text-blue-600" onClick={() => setEditingLabel(wp.id)}>
                        {wp.label}
                      </span>
                    )}
                    <div className="flex gap-1 flex-shrink-0">
                      {i > 0 && (
                        <button onClick={() => moveWaypoint(i, 'up')} className="text-gray-400 active:text-gray-700 text-base w-6 h-6 flex items-center justify-center">&uarr;</button>
                      )}
                      {i < waypoints.length - 1 && (
                        <button onClick={() => moveWaypoint(i, 'down')} className="text-gray-400 active:text-gray-700 text-base w-6 h-6 flex items-center justify-center">&darr;</button>
                      )}
                      <button onClick={() => removeWaypoint(i)} className="text-red-400 active:text-red-600 text-base w-6 h-6 flex items-center justify-center">&times;</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Distance */}
          {segments.length > 0 && (
            <div className="text-xs border-t pt-2">
              <button onClick={() => setShowSegments((v) => !v)} className="flex justify-between items-center w-full font-medium text-gray-700">
                <span>Total: {totalDistance.toFixed(2)} mi</span>
                <span className="text-gray-400 text-[10px]">{showSegments ? 'hide legs' : 'show legs'}</span>
              </button>
              {showSegments && (
                <div className="mt-1 space-y-0.5">
                  {segments.map((s, i) => (
                    <div key={i} className="flex justify-between text-gray-500">
                      <span>{i + 1} &rarr; {i + 2}</span>
                      <span>{s.distance.toFixed(2)} mi</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Clear */}
          {waypoints.length > 0 && (
            <div>
              {confirmClear ? (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded p-2">
                  <span className="text-xs text-red-700 flex-1">Clear all?</span>
                  <button onClick={clearRoute} className="text-xs py-1 px-3 rounded bg-red-600 text-white font-medium">Clear</button>
                  <button onClick={() => setConfirmClear(false)} className="text-xs py-1 px-3 rounded bg-gray-200 text-gray-700">No</button>
                </div>
              ) : (
                <button onClick={() => setConfirmClear(true)} className="w-full text-sm py-2 px-3 rounded bg-gray-100 text-gray-600 active:bg-gray-200">
                  Clear Route
                </button>
              )}
            </div>
          )}

          {/* Save */}
          {waypoints.length >= 2 && (
            <div className="border-t pt-2">
              <div className="flex gap-1">
                <input
                  type="text" className="flex-1 min-w-0 text-sm border rounded px-2 py-1.5"
                  placeholder="Route name" value={routeName}
                  onChange={(e) => setRouteName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && routeName.trim()) handleSaveRoute(); }}
                />
                <button onClick={handleSaveRoute} disabled={!routeName.trim()} className="text-sm py-1.5 px-3 rounded bg-ag-green-600 text-white disabled:opacity-50 flex-shrink-0">
                  {loadedRouteId ? 'Update' : 'Save'}
                </button>
              </div>
              {loadedRouteId && <p className="text-xs text-gray-400 mt-1">Editing saved route.</p>}
            </div>
          )}

          {/* Saved routes */}
          {routes.length > 0 && (
            <div className="border-t pt-2">
              <h4 className="text-xs font-medium text-gray-500 mb-1">Saved Routes</h4>
              <div className="space-y-1">
                {routes.map((r) => (
                  <div key={r.id} className={`flex items-center justify-between text-sm rounded p-1.5 ${loadedRouteId === r.id ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'}`}>
                    <button onClick={() => loadRoute(r)} className="text-xs text-blue-600 active:text-blue-800 truncate flex-1 text-left py-0.5">
                      {r.name} <span className="text-gray-400">({r.waypoints.length})</span>
                    </button>
                    {confirmDeleteId === r.id ? (
                      <div className="flex gap-1 ml-1 flex-shrink-0">
                        <button onClick={() => handleDeleteRoute(r.id)} className="text-xs py-1 px-2 rounded bg-red-600 text-white">Delete</button>
                        <button onClick={() => setConfirmDeleteId(null)} className="text-xs py-1 px-2 rounded bg-gray-200 text-gray-600">No</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(r.id)} className="text-red-400 active:text-red-600 text-base w-7 h-7 flex items-center justify-center flex-shrink-0">&times;</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {waypoints.length === 0 && !placing && (
            <p className="text-xs text-gray-400 text-center py-2">Tap "Add Waypoints" then tap the map to build a route.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default RouteBuilder;
