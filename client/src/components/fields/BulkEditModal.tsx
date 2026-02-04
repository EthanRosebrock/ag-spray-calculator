import React, { useState } from 'react';
import { Field } from '../../types';
import { getFields, saveField } from '../../utils/storageService';

interface BulkEditModalProps {
  selectedIds: Set<string>;
  onSave: () => void;
  onClose: () => void;
}

const BulkEditModal: React.FC<BulkEditModalProps> = ({ selectedIds, onSave, onClose }) => {
  const [applyCrop, setApplyCrop] = useState(false);
  const [applyFarmName, setApplyFarmName] = useState(false);
  const [applyCarrierRate, setApplyCarrierRate] = useState(false);
  const [applyMicroclimate, setApplyMicroclimate] = useState(false);

  const [crop, setCrop] = useState('');
  const [farmName, setFarmName] = useState('');
  const [carrierRate, setCarrierRate] = useState(20);
  const [microclimate, setMicroclimate] = useState<Field['microclimate'] | ''>('');

  const [saving, setSaving] = useState(false);

  const hasChanges = applyCrop || applyFarmName || applyCarrierRate || applyMicroclimate;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasChanges) return;

    setSaving(true);

    const fields = getFields();
    for (const field of fields) {
      if (!selectedIds.has(field.id)) continue;

      const updated = { ...field };
      if (applyCrop) updated.crop = crop || undefined;
      if (applyFarmName) updated.farmName = farmName || undefined;
      if (applyCarrierRate) updated.carrierRate = carrierRate;
      if (applyMicroclimate) {
        updated.microclimate = (microclimate || undefined) as Field['microclimate'];
      }

      saveField(updated);
    }

    setSaving(false);
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-xl font-semibold mb-1">Bulk Edit Fields</h2>
        <p className="text-sm text-gray-500 mb-4">
          Editing {selectedIds.size} field{selectedIds.size !== 1 ? 's' : ''}. Only checked fields will be updated.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Crop */}
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="apply-crop"
              checked={applyCrop}
              onChange={(e) => setApplyCrop(e.target.checked)}
              className="mt-2"
            />
            <div className="flex-1">
              <label htmlFor="apply-crop" className="block text-sm font-medium text-gray-700 mb-1">
                Crop
              </label>
              <input
                type="text"
                className="input-field"
                value={crop}
                onChange={(e) => setCrop(e.target.value)}
                disabled={!applyCrop}
                placeholder="e.g. Corn, Soybeans"
              />
            </div>
          </div>

          {/* Farm Name */}
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="apply-farm"
              checked={applyFarmName}
              onChange={(e) => setApplyFarmName(e.target.checked)}
              className="mt-2"
            />
            <div className="flex-1">
              <label htmlFor="apply-farm" className="block text-sm font-medium text-gray-700 mb-1">
                Farm Name
              </label>
              <input
                type="text"
                className="input-field"
                value={farmName}
                onChange={(e) => setFarmName(e.target.value)}
                disabled={!applyFarmName}
                placeholder="e.g. North Farm"
              />
            </div>
          </div>

          {/* Carrier Rate */}
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="apply-rate"
              checked={applyCarrierRate}
              onChange={(e) => setApplyCarrierRate(e.target.checked)}
              className="mt-2"
            />
            <div className="flex-1">
              <label htmlFor="apply-rate" className="block text-sm font-medium text-gray-700 mb-1">
                Carrier Rate (gal/acre)
              </label>
              <input
                type="number"
                step="0.5"
                className="input-field"
                value={carrierRate}
                onChange={(e) => setCarrierRate(parseFloat(e.target.value) || 20)}
                disabled={!applyCarrierRate}
              />
            </div>
          </div>

          {/* Microclimate */}
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="apply-micro"
              checked={applyMicroclimate}
              onChange={(e) => setApplyMicroclimate(e.target.checked)}
              className="mt-2"
            />
            <div className="flex-1">
              <label htmlFor="apply-micro" className="block text-sm font-medium text-gray-700 mb-1">
                Microclimate
              </label>
              <select
                className="input-field"
                value={microclimate}
                onChange={(e) =>
                  setMicroclimate(e.target.value as Field['microclimate'] | '')
                }
                disabled={!applyMicroclimate}
              >
                <option value="">Standard</option>
                <option value="sheltered">Sheltered</option>
                <option value="exposed">Exposed</option>
                <option value="valley">Valley</option>
                <option value="hilltop">Hilltop</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={!hasChanges || saving}
            >
              {saving ? 'Saving...' : `Update ${selectedIds.size} Field${selectedIds.size !== 1 ? 's' : ''}`}
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

export default BulkEditModal;
