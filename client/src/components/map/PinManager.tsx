import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { SavedPin } from '../../types';
import { getPins, savePin, deletePin, replaceAllPins } from '../../utils/storageService';
import { LocationWeatherService } from '../../utils/weatherService';

interface PinManagerProps {
  active: boolean;
  onPinsChanged: () => void;
}

const PIN_COLORS = [
  { value: '#dc2626', label: 'Red' },
  { value: '#2563eb', label: 'Blue' },
  { value: '#d97706', label: 'Orange' },
  { value: '#7c3aed', label: 'Purple' },
  { value: '#0891b2', label: 'Teal' },
  { value: '#be185d', label: 'Pink' },
];

function makePinIcon(color: string, isHome: boolean) {
  const svg = isHome
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 40" width="32" height="40">
        <path d="M16 0 L30 14 L30 36 Q30 40 26 40 L6 40 Q2 40 2 36 L2 14 Z" fill="${color}" stroke="white" stroke-width="2"/>
        <path d="M12 40 L12 24 L20 24 L20 40" fill="white"/>
        <path d="M16 6 L26 16" stroke="white" stroke-width="2" fill="none"/>
      </svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
        <path d="M12 0 C5.4 0 0 5.4 0 12 C0 21 12 36 12 36 S24 21 24 12 C24 5.4 18.6 0 12 0Z" fill="${color}" stroke="white" stroke-width="1.5"/>
        <circle cx="12" cy="12" r="5" fill="white"/>
      </svg>`;

  return new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(svg),
    iconSize: isHome ? [32, 40] : [24, 36],
    iconAnchor: isHome ? [16, 40] : [12, 36],
    popupAnchor: [0, isHome ? -40 : -36],
  });
}

const MAX_UNDO = 30;

const PinManager: React.FC<PinManagerProps> = ({ active, onPinsChanged }) => {
  const map = useMap();
  const [pins, setPins] = useState<SavedPin[]>([]);
  const [placing, setPlacing] = useState(false);
  const [placingColor, setPlacingColor] = useState('#dc2626');
  const [editingPin, setEditingPin] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', notes: '', color: '' });
  const [markers, setMarkers] = useState<L.Marker[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const pinsRef = useRef(pins);
  pinsRef.current = pins;
  const activeRef = useRef(active);
  activeRef.current = active;

  // Undo stack: stores full pin arrays for snapshot-based undo
  const undoRef = useRef<SavedPin[][]>([]);
  const [undoCount, setUndoCount] = useState(0);

  const snapshotUndo = useCallback(async () => {
    const currentPins = await getPins();
    undoRef.current.push(currentPins);
    if (undoRef.current.length > MAX_UNDO) undoRef.current.splice(0, undoRef.current.length - MAX_UNDO);
    setUndoCount(undoRef.current.length);
  }, []);

  const handleUndo = useCallback(async () => {
    if (undoRef.current.length === 0) return;
    const snapshot = undoRef.current.pop()!;
    setUndoCount(undoRef.current.length);
    await replaceAllPins(snapshot);
    setPins(snapshot);
    onPinsChanged();
  }, [onPinsChanged]);

  // Prevent Leaflet from stealing scroll/touch on the panel.
  const panelRef = useRef<HTMLDivElement>(null);
  const panelCallbackRef = useCallback((el: HTMLDivElement | null) => {
    panelRef.current = el;
    if (el) {
      L.DomEvent.disableScrollPropagation(el);
      L.DomEvent.disableClickPropagation(el);
    }
  }, []);

  // Ctrl+Z
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

  const reloadPins = async () => {
    const loaded = await getPins();
    setPins(loaded);
  };

  useEffect(() => { reloadPins(); }, []);

  // Render markers
  useEffect(() => {
    markers.forEach((m) => map.removeLayer(m));

    const newMarkers = pins.map((pin) => {
      const icon = makePinIcon(pin.color, !!pin.isHome);
      const marker = L.marker([pin.latitude, pin.longitude], {
        icon,
        draggable: active,
      }).addTo(map);

      marker.bindTooltip(pin.name, { direction: 'top', offset: [0, pin.isHome ? -40 : -36] });

      const popupDiv = document.createElement('div');
      popupDiv.className = 'text-sm';
      const infoHtml = `
        <div class="font-semibold">${pin.isHome ? '&#127968; ' : ''}${pin.name}</div>
        ${pin.notes ? `<div class="text-gray-600 text-xs mt-0.5">${pin.notes}</div>` : ''}
        <div class="text-xs text-gray-400 mt-0.5">${pin.latitude.toFixed(5)}, ${pin.longitude.toFixed(5)}</div>
      `;

      if (active) {
        popupDiv.innerHTML = `
          ${infoHtml}
          <div style="display:flex;gap:12px;margin-top:8px">
            <button class="pin-edit-btn" style="font-size:13px;color:#2563eb;font-weight:500;padding:4px 0">Edit</button>
            <button class="pin-delete-btn" style="font-size:13px;color:#dc2626;font-weight:500;padding:4px 0">Delete</button>
            ${pin.isHome ? '' : `<button class="pin-home-btn" style="font-size:13px;color:#d97706;font-weight:500;padding:4px 0">Set Home</button>`}
          </div>
        `;
        popupDiv.querySelector('.pin-edit-btn')?.addEventListener('click', () => {
          marker.closePopup();
          setEditingPin(pin.id);
          setEditForm({ name: pin.name, notes: pin.notes || '', color: pin.color });
        });
        popupDiv.querySelector('.pin-delete-btn')?.addEventListener('click', () => {
          marker.closePopup();
          setConfirmDeleteId(pin.id);
        });
        popupDiv.querySelector('.pin-home-btn')?.addEventListener('click', () => {
          marker.closePopup();
          doSetAsHome(pin);
        });
      } else {
        popupDiv.innerHTML = `${infoHtml}<div class="text-xs text-gray-400 mt-1 italic">Switch to Pins mode to edit</div>`;
      }

      marker.bindPopup(popupDiv);

      if (active) {
        marker.on('dragend', async () => {
          const pos = marker.getLatLng();
          await snapshotUndo();
          const updated = { ...pin, latitude: pos.lat, longitude: pos.lng };
          await savePin(updated);
          if (updated.isHome) await syncHomeToFarmLocation(updated);
          await reloadPins();
          onPinsChanged();
        });
      }

      return marker;
    });

    setMarkers(newMarkers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, map, active]);

  // Map click -> place pin
  useEffect(() => {
    if (!active || !placing) return;
    const handler = async (e: L.LeafletMouseEvent) => {
      await snapshotUndo();
      const pin: SavedPin = {
        id: Date.now().toString(),
        name: `Pin ${pinsRef.current.length + 1}`,
        latitude: e.latlng.lat,
        longitude: e.latlng.lng,
        color: placingColor,
      };
      await savePin(pin);
      await reloadPins();
      onPinsChanged();
    };
    map.on('click', handler);
    return () => { map.off('click', handler); };
  }, [active, placing, map, placingColor, onPinsChanged, snapshotUndo]);

  const syncHomeToFarmLocation = async (pin: SavedPin) => {
    const farm = await LocationWeatherService.getFarmLocation();
    await LocationWeatherService.setFarmLocation({ ...farm, latitude: pin.latitude, longitude: pin.longitude });
  };

  const doDeletePin = async (id: string) => {
    await snapshotUndo();
    await deletePin(id);
    await reloadPins();
    onPinsChanged();
    setConfirmDeleteId(null);
  };

  const doSetAsHome = async (pin: SavedPin) => {
    await snapshotUndo();
    const allPins = await getPins();
    for (const p of allPins) {
      if (p.isHome && p.id !== pin.id) await savePin({ ...p, isHome: false });
    }
    await savePin({ ...pin, isHome: true });
    await syncHomeToFarmLocation(pin);
    await reloadPins();
    onPinsChanged();
  };

  const handleSaveEdit = async () => {
    if (!editingPin) return;
    const existing = pins.find((p) => p.id === editingPin);
    if (!existing) return;
    await snapshotUndo();
    const updated: SavedPin = {
      ...existing,
      name: editForm.name.trim() || existing.name,
      notes: editForm.notes.trim() || undefined,
      color: editForm.color || existing.color,
    };
    await savePin(updated);
    if (updated.isHome) await syncHomeToFarmLocation(updated);
    setEditingPin(null);
    await reloadPins();
    onPinsChanged();
  };

  const handleAddHomeFromFarm = async () => {
    const farm = await LocationWeatherService.getFarmLocation();
    if (!farm.latitude || !farm.longitude) return;
    await snapshotUndo();
    const allPins = await getPins();
    for (const p of allPins) {
      if (p.isHome) await savePin({ ...p, isHome: false });
    }
    const homePin: SavedPin = {
      id: Date.now().toString(),
      name: farm.city ? `${farm.city}, ${farm.state}` : 'Farm Home',
      latitude: farm.latitude,
      longitude: farm.longitude,
      color: '#dc2626',
      isHome: true,
    };
    await savePin(homePin);
    await reloadPins();
    onPinsChanged();
    map.flyTo([homePin.latitude, homePin.longitude], 15, { duration: 1 });
  };

  const flyToPin = (pin: SavedPin) => {
    map.flyTo([pin.latitude, pin.longitude], 15, { duration: 1 });
  };

  const homePin = pins.find((p) => p.isHome);
  const otherPins = pins.filter((p) => !p.isHome);

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
          <h3 className="font-semibold text-sm">Saved Locations</h3>
          {pins.length > 0 && <span className="text-xs text-gray-400">{pins.length}</span>}
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
          {/* Drop pin */}
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setPlacing(!placing)}
              className={`text-sm py-2 px-3 rounded font-medium flex-1 ${
                placing ? 'bg-red-100 text-red-700 border border-red-300' : 'bg-gray-100 text-gray-700 active:bg-gray-200'
              }`}
            >
              {placing ? 'Tap map to place...' : 'Drop Pin'}
            </button>
            {placing && (
              <button onClick={() => setPlacing(false)} className="text-sm py-2 px-3 rounded bg-gray-100 text-gray-600 active:bg-gray-200">
                Done
              </button>
            )}
          </div>

          {/* Color picker */}
          {placing && (
            <div className="flex gap-2 items-center">
              <span className="text-xs text-gray-500">Color:</span>
              {PIN_COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setPlacingColor(c.value)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${placingColor === c.value ? 'border-gray-800 scale-110' : 'border-gray-300'}`}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
          )}

          {/* Delete confirmation */}
          {confirmDeleteId && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded p-2">
              <span className="text-xs text-red-700 flex-1">Delete "{pins.find((p) => p.id === confirmDeleteId)?.name}"?</span>
              <button onClick={() => doDeletePin(confirmDeleteId)} className="text-xs py-1 px-3 rounded bg-red-600 text-white font-medium">Delete</button>
              <button onClick={() => setConfirmDeleteId(null)} className="text-xs py-1 px-3 rounded bg-gray-200 text-gray-700">Cancel</button>
            </div>
          )}

          {/* Edit form */}
          {editingPin && (
            <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-0.5">Name</label>
                <input type="text" className="w-full text-sm border rounded px-2 py-1.5" value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditingPin(null); }}
                  autoFocus />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-0.5">Notes</label>
                <input type="text" className="w-full text-sm border rounded px-2 py-1.5" value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditingPin(null); }}
                  placeholder="Optional" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Color</label>
                <div className="flex gap-2">
                  {PIN_COLORS.map((c) => (
                    <button key={c.value} onClick={() => setEditForm({ ...editForm, color: c.value })}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${editForm.color === c.value ? 'border-gray-800 scale-110' : 'border-gray-300'}`}
                      style={{ backgroundColor: c.value }} />
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={handleSaveEdit} className="text-sm py-1.5 px-4 rounded bg-ag-green-600 text-white font-medium">Save</button>
                <button onClick={() => setEditingPin(null)} className="text-sm py-1.5 px-4 rounded bg-gray-200 text-gray-700">Cancel</button>
              </div>
            </div>
          )}

          {/* Home pin */}
          {homePin ? (
            <div>
              <h4 className="text-xs font-medium text-gray-500 mb-1">Home</h4>
              <div className="flex items-center gap-2 text-sm bg-red-50 border border-red-100 rounded p-2">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: homePin.color }} />
                <button onClick={() => flyToPin(homePin)} className="flex-1 text-left truncate text-red-800 font-medium active:underline min-w-0">{homePin.name}</button>
                <button onClick={() => { setEditingPin(homePin.id); setEditForm({ name: homePin.name, notes: homePin.notes || '', color: homePin.color }); }}
                  className="text-xs text-blue-500 active:text-blue-700 py-1 px-1 flex-shrink-0">Edit</button>
                <button onClick={() => setConfirmDeleteId(homePin.id)}
                  className="text-red-400 active:text-red-600 text-base w-7 h-7 flex items-center justify-center flex-shrink-0">&times;</button>
              </div>
            </div>
          ) : (
            <div>
              <h4 className="text-xs font-medium text-gray-500 mb-1">Home</h4>
              <button onClick={handleAddHomeFromFarm}
                className="w-full text-sm py-2 px-3 rounded bg-red-50 text-red-700 border border-red-200 active:bg-red-100 font-medium">
                + Set Home from Farm Location
              </button>
              <p className="text-xs text-gray-400 mt-1">Or drop a pin and use "Set Home" to pick any spot.</p>
            </div>
          )}

          {/* Other pins */}
          {otherPins.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 mb-1">Locations ({otherPins.length})</h4>
              <div className="space-y-1 max-h-40 overflow-y-auto overscroll-contain">
                {otherPins.map((pin) => (
                  <div key={pin.id} className="flex items-center gap-2 text-sm bg-gray-50 rounded p-1.5">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: pin.color }} />
                    <button onClick={() => flyToPin(pin)} className="flex-1 text-left truncate text-gray-700 active:text-gray-900 min-w-0">{pin.name}</button>
                    <button onClick={() => { setEditingPin(pin.id); setEditForm({ name: pin.name, notes: pin.notes || '', color: pin.color }); }}
                      className="text-xs text-blue-500 active:text-blue-700 py-1 px-1 flex-shrink-0">Edit</button>
                    <button onClick={() => setConfirmDeleteId(pin.id)}
                      className="text-red-400 active:text-red-600 text-base w-7 h-7 flex items-center justify-center flex-shrink-0">&times;</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pins.length === 0 && !placing && (
            <p className="text-xs text-gray-400 text-center py-2">Tap "Drop Pin" then tap the map to save locations.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default PinManager;
