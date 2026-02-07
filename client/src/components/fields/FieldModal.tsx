import React, { useState } from 'react';
import { Field, SubField } from '../../types';
import { getCurrentPosition } from '../../utils/weatherService';
import { useCropYear } from '../../App';

interface FieldModalProps {
  field?: Field | null;
  onSave: (field: Field) => void;
  onClose: () => void;
}

const FieldModal: React.FC<FieldModalProps> = ({ field, onSave, onClose }) => {
  const { cropYear } = useCropYear();
  const [form, setForm] = useState<Partial<Field>>({
    name: field?.name || '',
    fieldNumber: field?.fieldNumber || '',
    acres: field?.acres || 0,
    carrierRate: field?.carrierRate || 20,
    crop: field?.crop || '',
    soilType: field?.soilType || '',
    notes: field?.notes || '',
    legalDescription: field?.legalDescription || '',
    farmName: field?.farmName || '',
    latitude: field?.latitude,
    longitude: field?.longitude,
    elevation: field?.elevation,
    microclimate: field?.microclimate,
  });
  const [subFields, setSubFields] = useState<SubField[]>(field?.subFields || []);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'locating' | 'error'>('idle');

  // Sub-fields for current crop year
  const subFieldsForYear = subFields.filter((sf) => sf.cropYear === cropYear);
  const subFieldsOtherYears = subFields.filter((sf) => sf.cropYear !== cropYear);
  const totalSubFieldAcres = subFieldsForYear.reduce((sum, sf) => sum + sf.acres, 0);

  const addSubField = () => {
    const newSubField: SubField = {
      id: Date.now().toString(),
      name: '',
      acres: 0,
      crop: '',
      cropYear,
    };
    setSubFields([...subFields, newSubField]);
  };

  const updateSubField = (id: string, updates: Partial<SubField>) => {
    setSubFields((prev) =>
      prev.map((sf) => (sf.id === id ? { ...sf, ...updates } : sf))
    );
  };

  const removeSubField = (id: string) => {
    setSubFields((prev) => prev.filter((sf) => sf.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;

    // Filter out sub-fields with empty names
    const validSubFields = subFields.filter((sf) => sf.name.trim() !== '');

    const saved: Field = {
      id: field?.id || Date.now().toString(),
      name: form.name,
      fieldNumber: form.fieldNumber || undefined,
      acres: form.acres || 0,
      carrierRate: form.carrierRate || 20,
      crop: form.crop || undefined,
      soilType: form.soilType || undefined,
      notes: form.notes || undefined,
      legalDescription: form.legalDescription || undefined,
      farmName: form.farmName || undefined,
      latitude: form.latitude,
      longitude: form.longitude,
      elevation: form.elevation,
      microclimate: form.microclimate,
      boundary: field?.boundary,
      subFields: validSubFields.length > 0 ? validSubFields : undefined,
    };

    onSave(saved);
  };

  const useCurrentLocation = async () => {
    setGeoStatus('locating');
    const pos = await getCurrentPosition();
    if (pos) {
      setForm((prev) => ({
        ...prev,
        latitude: +pos.latitude.toFixed(6),
        longitude: +pos.longitude.toFixed(6),
      }));
      setGeoStatus('idle');
    } else {
      setGeoStatus('error');
      setTimeout(() => setGeoStatus('idle'), 3000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">{field ? 'Edit Field' : 'Add Field'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Field Name *</label>
              <input
                type="text"
                className="input-field"
                value={form.name || ''}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Field #</label>
              <input
                type="text"
                className="input-field"
                value={form.fieldNumber || ''}
                onChange={(e) => setForm({ ...form, fieldNumber: e.target.value })}
                placeholder="e.g. 13E"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Acres</label>
              <input
                type="number"
                step="0.1"
                className="input-field"
                value={form.acres || ''}
                onChange={(e) => setForm({ ...form, acres: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Carrier Rate (gal/acre)</label>
              <input
                type="number"
                step="0.5"
                className="input-field"
                value={form.carrierRate || ''}
                onChange={(e) => setForm({ ...form, carrierRate: parseFloat(e.target.value) || 20 })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Crop</label>
              <input
                type="text"
                className="input-field"
                value={form.crop || ''}
                onChange={(e) => setForm({ ...form, crop: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Soil Type</label>
              <input
                type="text"
                className="input-field"
                value={form.soilType || ''}
                onChange={(e) => setForm({ ...form, soilType: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Farm Name</label>
            <input
              type="text"
              className="input-field"
              value={form.farmName || ''}
              onChange={(e) => setForm({ ...form, farmName: e.target.value })}
            />
          </div>

          {/* Location section */}
          <div className="border-t pt-4 mt-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium text-gray-700">Location</h3>
              <button
                type="button"
                onClick={useCurrentLocation}
                disabled={geoStatus === 'locating'}
                className="btn-secondary text-xs py-1 px-3"
              >
                {geoStatus === 'locating' ? 'Locating...' : 'Use Current Location'}
              </button>
            </div>
            {geoStatus === 'error' && (
              <p className="text-xs text-red-600 mb-2">Location access denied or unavailable</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                <input
                  type="number"
                  step="0.000001"
                  className="input-field"
                  value={form.latitude ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, latitude: e.target.value ? parseFloat(e.target.value) : undefined })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                <input
                  type="number"
                  step="0.000001"
                  className="input-field"
                  value={form.longitude ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, longitude: e.target.value ? parseFloat(e.target.value) : undefined })
                  }
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Microclimate</label>
              <select
                className="input-field"
                value={form.microclimate || ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    microclimate: (e.target.value || undefined) as Field['microclimate'],
                  })
                }
              >
                <option value="">Standard</option>
                <option value="sheltered">Sheltered</option>
                <option value="exposed">Exposed</option>
                <option value="valley">Valley</option>
                <option value="hilltop">Hilltop</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Legal Description</label>
            <input
              type="text"
              className="input-field"
              value={form.legalDescription || ''}
              onChange={(e) => setForm({ ...form, legalDescription: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              className="input-field"
              rows={2}
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          {field?.boundary && (
            <div className="text-sm text-gray-500">
              Boundary: {field.boundary.length} vertices (edit on Map tab)
            </div>
          )}

          {/* Sub-fields section - always visible */}
          <div className="border-t pt-4 mt-4">
            <div className="flex justify-between items-center mb-3">
              <div>
                <h3 className="font-medium text-gray-700">Sub-Fields ({cropYear})</h3>
                <p className="text-xs text-gray-500">Divide this field into sections for different crops</p>
              </div>
            </div>

            <div className="space-y-3">
              {subFieldsForYear.map((sf) => (
                <div key={sf.id} className="flex gap-2 items-start bg-gray-50 p-2 rounded">
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Name"
                      className="input-field text-sm py-1.5"
                      value={sf.name}
                      onChange={(e) => updateSubField(sf.id, { name: e.target.value })}
                    />
                    <input
                      type="number"
                      step="0.1"
                      placeholder="Acres"
                      className="input-field text-sm py-1.5"
                      value={sf.acres || ''}
                      onChange={(e) => updateSubField(sf.id, { acres: parseFloat(e.target.value) || 0 })}
                    />
                    <input
                      type="text"
                      placeholder="Crop"
                      className="input-field text-sm py-1.5"
                      value={sf.crop}
                      onChange={(e) => updateSubField(sf.id, { crop: e.target.value })}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSubField(sf.id)}
                    className="text-red-400 hover:text-red-600 mt-1.5"
                  >
                    &times;
                  </button>
                </div>
              ))}

              <div className="flex justify-between items-center">
                <button
                  type="button"
                  onClick={addSubField}
                  className="text-sm text-ag-green-700 hover:text-ag-green-800 font-medium"
                >
                  + Add Sub-Field
                </button>
                {subFieldsForYear.length > 0 && (
                  <span className={`text-xs ${totalSubFieldAcres > (form.acres || 0) ? 'text-red-600' : 'text-gray-500'}`}>
                    {totalSubFieldAcres} / {form.acres || 0} ac
                    {totalSubFieldAcres > (form.acres || 0) && ' (exceeds field size)'}
                  </span>
                )}
              </div>

              {subFieldsOtherYears.length > 0 && (
                <div className="text-xs text-gray-400 mt-2">
                  {subFieldsOtherYears.length} sub-field{subFieldsOtherYears.length !== 1 ? 's' : ''} in other years
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary flex-1">
              {field ? 'Save Changes' : 'Add Field'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FieldModal;
