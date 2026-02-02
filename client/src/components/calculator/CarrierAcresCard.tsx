import React from 'react';

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
  return (
    <>
      <div className="card">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Carrier Rate (gal/acre)
        </label>
        <input
          type="number"
          className="input-field"
          value={carrierRate || ''}
          onChange={(e) => onCarrierRateChange(parseFloat(e.target.value) || 0)}
          min="1"
          max="60"
          step="1"
        />
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
