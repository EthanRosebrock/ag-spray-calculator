import React from 'react';

const PRESETS = [200, 300, 500, 750, 1000];

interface TankSetupCardProps {
  tankSize: number;
  onTankSizeChange: (size: number) => void;
}

const TankSetupCard: React.FC<TankSetupCardProps> = ({ tankSize, onTankSizeChange }) => {
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
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((size) => (
          <button
            key={size}
            onClick={() => onTankSizeChange(size)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              tankSize === size
                ? 'bg-ag-green-600 text-white'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            {size}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TankSetupCard;
