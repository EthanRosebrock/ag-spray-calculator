// Re-export from utils
export type { ContainerType, ContainerBreakdown } from '../utils/containerCalculations';
export type { WeatherData, DriftAssessment, LocationData, FieldLocation, WeatherStation } from '../utils/weatherService';

export type RateBasis = 'per_acre' | 'per_100_gal';
export type ProductType = 'liquid' | 'dry' | 'bulk';
export type MeasurementUnit = 'fl_oz' | 'pt' | 'qt' | 'gal' | 'oz' | 'lbs';

export interface UnitConfig {
  value: MeasurementUnit;
  label: string;
  category: 'liquid' | 'dry';
  toBaseUnit: number; // conversion factor to base unit (gal for liquid, lbs for dry)
}

export interface Field {
  id: string;
  name: string;
  acres: number;
  carrierRate: number; // gal/acre, default 20
  notes?: string;
  // Location
  latitude?: number;
  longitude?: number;
  elevation?: number;
  microclimate?: 'sheltered' | 'exposed' | 'valley' | 'hilltop';
  // Boundary for map display
  boundary?: [number, number][]; // array of [lat, lng] polygon vertices
  // Metadata
  crop?: string;
  soilType?: string;
  legalDescription?: string;
  farmName?: string;
}

export interface Product {
  id: string;
  name: string;
  type: ProductType;
  unit: string; // display string e.g. 'fl oz / acre' (kept for backward compat)
  defaultRate: number;
  mixingOrder: number;
  pHSensitive?: boolean;
  isCustom?: boolean;
  measurementUnit?: MeasurementUnit;
  rateBasis?: RateBasis;
  packageSize?: number;
  preferredContainers?: string[];
}

export interface TankMixProduct {
  product: Product;
  rate: number;
  totalAmount: number;
  rateBasis: RateBasis;
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

export interface SprayRecord {
  id: string;
  date: string;                   // ISO date string
  fieldId?: string;               // links to Field
  fieldName: string;              // denormalized for display
  operator: string;
  tankSize: number;
  carrierRate: number;
  acres: number;
  products: SprayRecordProduct[];
  totalVolume: number;
  weather?: {                     // snapshot at time of spray
    temperature: number;
    humidity: number;
    windSpeed: number;
    windDirection: string;
    source: string;
  };
  notes?: string;
  createdAt: string;
}

export interface SprayRecordProduct {
  productName: string;
  rate: number;
  unit: string;
  rateBasis: 'per_acre' | 'per_100_gal';
  totalAmount: number;
}

export interface TenderRoute {
  id: string;
  name: string;
  waypoints: RouteWaypoint[];
  createdAt: string;
}

export interface RouteWaypoint {
  id: string;
  label: string;                  // "Fill Station", "Field Entry", etc.
  latitude: number;
  longitude: number;
  notes?: string;
}
