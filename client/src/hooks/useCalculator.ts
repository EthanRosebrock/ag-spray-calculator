import { useState, useMemo, useCallback, useEffect } from 'react';
import { TankMixProduct, Product } from '../types';
import { getCalculatorDefaults, saveCalculatorDefaults } from '../utils/storageService';
import { convertRateToAmount } from '../utils/loadCalculations';

export function useCalculator() {
  const [defaults] = useState(() => getCalculatorDefaults());
  const [tankSize, setTankSizeState] = useState(defaults.tankSize);
  const [carrierRate, setCarrierRateState] = useState(defaults.carrierRate);
  const [acres, setAcresState] = useState(defaults.acres);
  const [selectedProducts, setSelectedProducts] = useState<TankMixProduct[]>([]);

  // Persist defaults when values change
  useEffect(() => {
    saveCalculatorDefaults({ tankSize, carrierRate, acres });
  }, [tankSize, carrierRate, acres]);

  const setTankSize = useCallback((v: number) => {
    setTankSizeState(Math.max(0, v));
  }, []);

  const setCarrierRate = useCallback((v: number) => {
    setCarrierRateState(Math.max(0, v));
  }, []);

  const setAcres = useCallback((v: number) => {
    setAcresState(Math.max(0, v));
  }, []);

  const totalVolume = useMemo(() => carrierRate * acres, [carrierRate, acres]);

  const numberOfLoads = useMemo(() => {
    if (tankSize <= 0 || totalVolume <= 0) return 0;
    return Math.ceil(totalVolume / tankSize);
  }, [totalVolume, tankSize]);

  const tankUtilization = useMemo(() => {
    if (numberOfLoads <= 0 || tankSize <= 0) return 0;
    const lastLoadVolume = totalVolume - (numberOfLoads - 1) * tankSize;
    // Average utilization across all loads
    const fullLoads = numberOfLoads - 1;
    const totalUtil = fullLoads * 100 + (lastLoadVolume / tankSize) * 100;
    return Math.round(totalUtil / numberOfLoads);
  }, [totalVolume, tankSize, numberOfLoads]);

  const addProduct = useCallback(
    (product: Product) => {
      setSelectedProducts((prev) => {
        if (prev.some((p) => p.product.id === product.id)) return prev;
        const rateBasis = product.rateBasis ?? 'per_acre';
        const totalAmount = convertRateToAmount(
          product.defaultRate,
          product.unit,
          acres,
          carrierRate * acres,
          product.rateBasis,
          product.measurementUnit
        );
        return [...prev, { product, rate: product.defaultRate, totalAmount, rateBasis }];
      });
    },
    [acres, carrierRate]
  );

  const updateProductRate = useCallback(
    (index: number, newRate: number) => {
      setSelectedProducts((prev) => {
        const updated = [...prev];
        const item = updated[index];
        const totalAmount = convertRateToAmount(
          newRate,
          item.product.unit,
          acres,
          carrierRate * acres,
          item.product.rateBasis,
          item.product.measurementUnit
        );
        updated[index] = { ...item, rate: newRate, totalAmount };
        return updated;
      });
    },
    [acres, carrierRate]
  );

  const removeProduct = useCallback((index: number) => {
    setSelectedProducts((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Recalculate product totals when acres or carrierRate changes
  useEffect(() => {
    setSelectedProducts((prev) =>
      prev.map((item) => ({
        ...item,
        totalAmount: convertRateToAmount(
          item.rate,
          item.product.unit,
          acres,
          carrierRate * acres,
          item.product.rateBasis,
          item.product.measurementUnit
        ),
      }))
    );
  }, [acres, carrierRate]);

  return {
    tankSize,
    setTankSize,
    carrierRate,
    setCarrierRate,
    acres,
    setAcres,
    selectedProducts,
    setSelectedProducts,
    totalVolume,
    numberOfLoads,
    tankUtilization,
    addProduct,
    updateProductRate,
    removeProduct,
  };
}
