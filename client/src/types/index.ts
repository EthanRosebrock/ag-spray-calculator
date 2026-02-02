// Re-export from utils
export type { ContainerType, ContainerBreakdown } from '../utils/containerCalculations';
export type { WeatherData, DriftAssessment, LocationData, FieldLocation, WeatherStation } from '../utils/weatherService';

export interface Field {
  id: string;
  name: string;
  acres: number;
  carrierRate: number; // gal/acre, default 20
  notes?: string;
}

export interface Product {
  id: string;
  name: string;
  type: 'liquid' | 'dry';
  unit: string; // 'oz/acre' | 'qt/acre' | 'pt/acre' | 'gal/acre' | 'lbs/acre'
  defaultRate: number;
  mixingOrder: number;
  pHSensitive?: boolean;
  isCustom?: boolean;
}

export interface TankMixProduct {
  product: Product;
  rate: number;
  totalAmount: number;
}

export interface CalculatorDefaults {
  tankSize: number;
  carrierRate: number;
  acres: number;
}

export interface LoadConfig {
  loadNumber: number;
  volume: number;       // gallons for this load
  percentage: number;   // 0-100 fill percentage of tank
}

export interface LoadProduct {
  productId: string;
  productName: string;
  amount: number;
  displayUnit: string;  // 'gal' | 'lbs'
}

export interface LoadSplitConfig {
  numberOfLoads: number;
  splitMode: 'even' | 'custom';
  loadVolumes: number[];  // per-load volumes in gallons
}
