import { useState, useMemo, useCallback, useEffect } from 'react';
import { TankMixProduct } from '../types';
import {
  calculateEvenSplit,
  redistributeLoadVolumes,
  calculateLoadProducts,
  LoadProductAmount,
} from '../utils/loadCalculations';

export interface LoadInfo {
  loadNumber: number;
  volume: number;
  percentage: number;         // 0-100 tank fill
  products: LoadProductAmount[];
}

export function useLoadSplitter(
  totalVolume: number,
  tankSize: number,
  minLoads: number,
  selectedProducts: TankMixProduct[]
) {
  const [numberOfLoads, setNumberOfLoadsState] = useState(minLoads);
  const [splitMode, setSplitMode] = useState<'even' | 'custom'>('even');
  const [customVolumes, setCustomVolumes] = useState<number[]>([]);
  const [lockedLoads, setLockedLoads] = useState<Set<number>>(new Set());

  // Sync numberOfLoads to minLoads when inputs change
  useEffect(() => {
    setNumberOfLoadsState(minLoads);
  }, [minLoads]);

  // Recalculate even split when inputs change
  const evenVolumes = useMemo(
    () => calculateEvenSplit(totalVolume, numberOfLoads, tankSize),
    [totalVolume, numberOfLoads, tankSize]
  );

  // Reset custom volumes and locks when switching to even or when load count changes
  useEffect(() => {
    setLockedLoads(new Set());
    if (splitMode === 'even') {
      setCustomVolumes(evenVolumes);
    } else {
      // Re-initialize custom volumes when load count changes
      setCustomVolumes(calculateEvenSplit(totalVolume, numberOfLoads, tankSize));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numberOfLoads, splitMode]);

  // Also update custom volumes if evenVolumes change and we're in even mode
  useEffect(() => {
    if (splitMode === 'even') {
      setCustomVolumes(evenVolumes);
    }
  }, [evenVolumes, splitMode]);

  const loadVolumes = splitMode === 'even' ? evenVolumes : customVolumes;

  const setNumberOfLoads = useCallback(
    (n: number) => {
      setNumberOfLoadsState(Math.max(minLoads, n));
    },
    [minLoads]
  );

  const setLoadVolume = useCallback(
    (index: number, newVolume: number) => {
      if (splitMode !== 'custom') return;
      setLockedLoads((prev) => {
        const next = new Set(prev);
        next.add(index);
        return next;
      });
      setCustomVolumes((prev) =>
        redistributeLoadVolumes(prev, index, newVolume, totalVolume, tankSize, lockedLoads)
      );
    },
    [splitMode, totalVolume, tankSize, lockedLoads]
  );

  const loads: LoadInfo[] = useMemo(() => {
    return loadVolumes.map((volume, i) => ({
      loadNumber: i + 1,
      volume: Math.round(volume * 100) / 100,
      percentage: tankSize > 0 ? Math.round((volume / tankSize) * 100) : 0,
      products: calculateLoadProducts(volume, totalVolume, selectedProducts),
    }));
  }, [loadVolumes, tankSize, totalVolume, selectedProducts]);

  const fullLoads = useMemo(
    () => loads.filter((l) => l.percentage >= 90).length,
    [loads]
  );
  const partialLoads = useMemo(
    () => loads.filter((l) => l.percentage < 90).length,
    [loads]
  );

  const resetLocks = useCallback(() => {
    setLockedLoads(new Set());
  }, []);

  return {
    numberOfLoads,
    setNumberOfLoads,
    splitMode,
    setSplitMode,
    loadVolumes,
    setLoadVolume,
    loads,
    fullLoads,
    partialLoads,
    lockedLoads,
    resetLocks,
  };
}
