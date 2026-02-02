import React from 'react';

interface ResultsSummaryProps {
  totalVolume: number;
  numberOfLoads: number;
  tankSize: number;
  acres: number;
  carrierRate: number;
}

const ResultsSummary: React.FC<ResultsSummaryProps> = ({
  totalVolume,
  numberOfLoads,
  tankSize,
  acres,
  carrierRate,
}) => {
  if (totalVolume <= 0) return null;

  const fullLoads = numberOfLoads > 0 ? numberOfLoads - 1 : 0;
  const lastLoadVolume = totalVolume - fullLoads * tankSize;
  const hasPartial = numberOfLoads > 1 && lastLoadVolume < tankSize;

  return (
    <div className="card bg-ag-green-50 border-ag-green-200">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-2xl font-bold text-ag-green-700">
            {totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })} gal
          </div>
          <div className="text-sm text-ag-green-600">
            {acres} ac x {carrierRate} gal/ac
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold text-ag-green-700">{numberOfLoads}</div>
          <div className="text-sm text-ag-green-600">
            {numberOfLoads === 1
              ? '1 load'
              : hasPartial
              ? `${fullLoads} full + 1 partial`
              : `${numberOfLoads} full loads`}
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold text-ag-green-700">{tankSize} gal</div>
          <div className="text-sm text-ag-green-600">Tank Size</div>
        </div>
      </div>
    </div>
  );
};

export default ResultsSummary;
