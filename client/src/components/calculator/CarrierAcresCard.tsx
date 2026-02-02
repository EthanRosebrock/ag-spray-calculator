import React, { useState } from 'react';
import { getCarrierPresets, saveCarrierPresets } from '../../utils/storageService';

interface CarrierAcresCardProps {
  carrierRate: number;
  acres: number;
  onCarrierRateChange: (rate: number) => void;
  onAcresChange: (acres: number) => void;
}

const CarrierAcresCard: React.FC<CarrierAcresCardProps> = ({
  carrierRate,
  acres,
  onCarrierRateChange,
  onAcresChange,
}) => {
  const [presets, setPresets] = useState(() => getCarrierPresets());

  const handleAddPreset = () => {
    if (carrierRate <= 0 || presets.includes(carrierRate)) return;
    const updated = [...presets, carrierRate].sort((a, b) => a - b);
    setPresets(updated);
    saveCarrierPresets(updated);
  };

  const handleRemovePreset = (value: number) => {
    const updated = presets.filter((p) => p !== value);
    setPresets(updated);
    saveCarrierPresets(updated);
  };

  return (
    <>
      <div className="card">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Carrier Rate (gal/acre)
        </label>
        <input
          type="number"
          className="input-field mb-3"
          value={carrierRate || ''}
          onChange={(e) => onCarrierRateChange(parseFloat(e.target.value) || 0)}
          min="1"
          max="60"
          step="1"
        />
        <div className="flex flex-wrap gap-2 items-center">
          {presets.map((rate) => (
            <span
              key={rate}
              className={`inline-flex items-center gap-1 rounded text-sm font-medium transition-colors ${
                carrierRate === rate
                  ? 'bg-ag-green-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <button
                onClick={() => onCarrierRateChange(rate)}
                className="px-2 py-1 pl-3"
              >
                {rate}
              </button>
              <button
                onClick={() => handleRemovePreset(rate)}
                className={`pr-2 py-1 text-xs hover:opacity-70 ${
                  carrierRate === rate ? 'text-white/70' : 'text-gray-400'
                }`}
                title="Remove preset"
              >
                x
              </button>
            </span>
          ))}
          <button
            onClick={handleAddPreset}
            disabled={carrierRate <= 0 || presets.includes(carrierRate)}
            className="px-2 py-1 rounded text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Save current value as preset"
          >
            +
          </button>
        </div>
      </div>
      <div className="card">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Acres
        </label>
        <input
          type="number"
          className="input-field"
          value={acres || ''}
          onChange={(e) => onAcresChange(parseFloat(e.target.value) || 0)}
          min="0"
          step="0.1"
        />
      </div>
    </>
  );
};

export default CarrierAcresCard;
