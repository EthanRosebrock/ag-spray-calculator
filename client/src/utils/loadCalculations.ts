import { TankMixProduct } from '../types';

/**
 * Convert a per-acre rate to a total amount for the given acreage.
 * Moved from ProductStep so it can be shared across the app.
 */
export function convertRateToAmount(rate: number, unit: string, acres: number): number {
  const conversions: Record<string, number> = {
    'oz/acre': 1 / 128,   // oz to gallons
    'pt/acre': 1 / 8,     // pints to gallons
    'qt/acre': 1 / 4,     // quarts to gallons
    'gal/acre': 1,         // gallons to gallons
    'lbs/acre': 1,         // pounds to pounds (dry)
  };
  const factor = conversions[unit] || 1;
  return rate * factor * acres;
}

/**
 * Calculate an even split of totalVolume across numberOfLoads,
 * capping each load at tankSize.
 * Returns an array of load volumes.
 */
export function calculateEvenSplit(
  totalVolume: number,
  numberOfLoads: number,
  tankSize: number
): number[] {
  if (numberOfLoads <= 0 || totalVolume <= 0) return [];
  const evenVolume = totalVolume / numberOfLoads;
  const cappedVolume = Math.min(evenVolume, tankSize);
  return Array.from({ length: numberOfLoads }, () =>
    Math.round(cappedVolume * 100) / 100
  );
}

/**
 * Redistribute load volumes when a user changes one load's volume in custom mode.
 * Adjusts all OTHER loads proportionally so total remains the same.
 *
 * @param loadVolumes   Current array of per-load volumes
 * @param changedIndex  Index of the load the user changed
 * @param newVolume     New volume for that load (clamped to 0..tankSize)
 * @param totalVolume   The total volume that must be distributed
 * @param tankSize      Max per-load volume
 */
export function redistributeLoadVolumes(
  loadVolumes: number[],
  changedIndex: number,
  newVolume: number,
  totalVolume: number,
  tankSize: number
): number[] {
  const clamped = Math.max(0, Math.min(newVolume, tankSize));
  const remaining = totalVolume - clamped;
  const otherIndices = loadVolumes
    .map((_, i) => i)
    .filter((i) => i !== changedIndex);

  const otherSum = otherIndices.reduce((s, i) => s + loadVolumes[i], 0);

  const result = [...loadVolumes];
  result[changedIndex] = clamped;

  if (otherSum === 0) {
    // Distribute remaining evenly among other loads
    const each = remaining / otherIndices.length;
    otherIndices.forEach((i) => {
      result[i] = Math.min(Math.round(each * 100) / 100, tankSize);
    });
  } else {
    // Proportional redistribution
    otherIndices.forEach((i) => {
      const proportion = loadVolumes[i] / otherSum;
      result[i] = Math.min(
        Math.round(remaining * proportion * 100) / 100,
        tankSize
      );
    });
  }

  return result;
}

export interface LoadProductAmount {
  product: TankMixProduct;
  amount: number;       // total product for this load
  displayUnit: string;  // 'gal' or 'lbs'
}

/**
 * Calculate per-load product amounts based on the load's proportion of total volume.
 */
export function calculateLoadProducts(
  loadVolume: number,
  totalVolume: number,
  selectedProducts: TankMixProduct[]
): LoadProductAmount[] {
  if (totalVolume <= 0) return [];
  const proportion = loadVolume / totalVolume;
  return selectedProducts.map((item) => ({
    product: item,
    amount: Math.round(item.totalAmount * proportion * 100) / 100,
    displayUnit: item.product.type === 'liquid' ? 'gal' : 'lbs',
  }));
}
