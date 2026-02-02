import React from 'react';
import { LoadInfo } from '../../hooks/useLoadSplitter';

interface LoadSplitterProps {
  numberOfLoads: number;
  minLoads: number;
  splitMode: 'even' | 'custom';
  loads: LoadInfo[];
  tankSize: number;
  onNumberOfLoadsChange: (n: number) => void;
  onSplitModeChange: (mode: 'even' | 'custom') => void;
  onLoadVolumeChange: (index: number, volume: number) => void;
}

function getBarColor(percentage: number): string {
  if (percentage >= 90) return 'bg-green-500';
  if (percentage >= 50) return 'bg-yellow-500';
  if (percentage >= 25) return 'bg-orange-500';
  return 'bg-red-500';
}

const LoadSplitter: React.FC<LoadSplitterProps> = ({
  numberOfLoads,
  minLoads,
  splitMode,
  loads,
  tankSize,
  onNumberOfLoadsChange,
  onSplitModeChange,
  onLoadVolumeChange,
}) => {
  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">Load Planner</h2>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        {/* Load count stepper */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Loads:</span>
          <button
            onClick={() => onNumberOfLoadsChange(numberOfLoads - 1)}
            disabled={numberOfLoads <= minLoads}
            className="w-8 h-8 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
          >
            -
          </button>
          <span className="text-lg font-bold w-8 text-center">{numberOfLoads}</span>
          <button
            onClick={() => onNumberOfLoadsChange(numberOfLoads + 1)}
            className="w-8 h-8 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 flex items-center justify-center"
          >
            +
          </button>
        </div>

        {/* Split mode toggle */}
        <div className="flex rounded-lg border border-gray-300 overflow-hidden">
          <button
            onClick={() => onSplitModeChange('even')}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              splitMode === 'even'
                ? 'bg-ag-green-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Even Split
          </button>
          <button
            onClick={() => onSplitModeChange('custom')}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              splitMode === 'custom'
                ? 'bg-ag-green-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Custom
          </button>
        </div>
      </div>

      {/* Load bars */}
      <div className="space-y-3">
        {loads.map((load, index) => (
          <div key={index} className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-500 w-8">
              #{load.loadNumber}
            </span>

            <div className="flex-1">
              {splitMode === 'custom' ? (
                <input
                  type="range"
                  min={0}
                  max={tankSize}
                  step={1}
                  value={load.volume}
                  onChange={(e) => onLoadVolumeChange(index, parseFloat(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, ${
                      load.percentage >= 90
                        ? '#22c55e'
                        : load.percentage >= 50
                        ? '#eab308'
                        : load.percentage >= 25
                        ? '#f97316'
                        : '#ef4444'
                    } ${load.percentage}%, #e5e7eb ${load.percentage}%)`,
                  }}
                />
              ) : (
                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${getBarColor(load.percentage)}`}
                    style={{ width: `${Math.min(load.percentage, 100)}%` }}
                  />
                </div>
              )}
            </div>

            <span className="text-sm text-gray-700 w-28 text-right">
              {Math.round(load.volume)} gal ({load.percentage}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LoadSplitter;
