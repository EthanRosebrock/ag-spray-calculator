import React, { useState, useEffect } from 'react';
import { getTankPresets, saveTankPresets } from '../../utils/storageService';

interface TankSetupCardProps {
  tankSize: number;
  onTankSizeChange: (size: number) => void;
}

const TankSetupCard: React.FC<TankSetupCardProps> = ({ tankSize, onTankSizeChange }) => {
  const [presets, setPresets] = useState<number[]>([]);

  useEffect(() => {
    getTankPresets().then(setPresets);
  }, []);

  const handleAddPreset = async () => {
    if (tankSize <= 0 || presets.includes(tankSize)) return;
    const updated = [...presets, tankSize].sort((a, b) => a - b);
    setPresets(updated);
    await saveTankPresets(updated);
  };

  const handleRemovePreset = async (value: number) => {
    const updated = presets.filter((p) => p !== value);
    setPresets(updated);
    await saveTankPresets(updated);
  };

  return (
    <div className="card">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Tank Size (gal)
      </label>
      <input
        type="number"
        className="input-field mb-3"
        value={tankSize || ''}
        onChange={(e) => onTankSizeChange(parseFloat(e.target.value) || 0)}
        min="0"
        step="10"
      />
      <div className="flex flex-wrap gap-2 items-center">
        {presets.map((size) => (
          <span
            key={size}
            className={`inline-flex items-center gap-1 rounded text-sm font-medium transition-colors ${
              tankSize === size
                ? 'bg-ag-green-600 text-white'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            <button
              onClick={() => onTankSizeChange(size)}
              className="px-2 py-1 pl-3"
            >
              {size}
            </button>
            <button
              onClick={() => handleRemovePreset(size)}
              className={`pr-2 py-1 text-xs hover:opacity-70 ${
                tankSize === size ? 'text-white/70' : 'text-gray-400'
              }`}
              title="Remove preset"
            >
              x
            </button>
          </span>
        ))}
        <button
          onClick={handleAddPreset}
          disabled={tankSize <= 0 || presets.includes(tankSize)}
          className="px-2 py-1 rounded text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Save current value as preset"
        >
          +
        </button>
      </div>
    </div>
  );
};

export default TankSetupCard;
