import React from 'react';
import { TankMixProduct } from '../../types';
import { LoadInfo } from '../../hooks/useLoadSplitter';
import { getBaseDisplayUnit } from '../../utils/unitConstants';

interface LoadScheduleTableProps {
  loads: LoadInfo[];
  selectedProducts: TankMixProduct[];
  acres?: number;
  totalVolume?: number;
}

const LoadScheduleTable: React.FC<LoadScheduleTableProps> = ({ loads, selectedProducts, acres, totalVolume }) => {
  if (loads.length === 0 || selectedProducts.length === 0) return null;

  const showAcres = acres && acres > 0 && totalVolume && totalVolume > 0;

  return (
    <div className="card overflow-x-auto">
      <h2 className="text-lg font-semibold mb-4">Load Schedule</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 pr-4 font-medium text-gray-600">Load</th>
            <th className="text-right py-2 px-4 font-medium text-gray-600">Volume</th>
            {showAcres && (
              <th className="text-right py-2 px-4 font-medium text-gray-600">Acres</th>
            )}
            {selectedProducts.map((item) => (
              <th key={item.product.id} className="text-right py-2 px-4 font-medium text-gray-600">
                {item.product.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loads.map((load) => {
            const loadAcres = showAcres ? acres * (load.volume / totalVolume) : 0;
            return (
              <tr key={load.loadNumber} className="border-b border-gray-100">
                <td className="py-2 pr-4 font-medium">#{load.loadNumber}</td>
                <td className="text-right py-2 px-4">{Math.round(load.volume)} gal</td>
                {showAcres && (
                  <td className="text-right py-2 px-4">{loadAcres.toFixed(1)} ac</td>
                )}
                {load.products.map((lp) => (
                  <td key={lp.product.product.id} className="text-right py-2 px-4">
                    {lp.amount.toFixed(2)} {lp.displayUnit}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-300 font-semibold">
            <td className="py-2 pr-4">Total</td>
            <td className="text-right py-2 px-4">
              {Math.round(loads.reduce((s, l) => s + l.volume, 0))} gal
            </td>
            {showAcres && (
              <td className="text-right py-2 px-4">{acres.toFixed(1)} ac</td>
            )}
            {selectedProducts.map((item) => (
              <td key={item.product.id} className="text-right py-2 px-4">
                {item.totalAmount.toFixed(2)} {getBaseDisplayUnit(item.product.measurementUnit)}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default LoadScheduleTable;
