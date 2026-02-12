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
  fieldNumber?: string; // user-assigned field number (e.g. "13E", "24SW")
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
  // Sub-fields for multi-planting per crop year
  subFields?: SubField[];
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
  fieldId?: string;               // links to Field (legacy single-field)
  fieldName: string;              // denormalized for display (comma-joined if multiple)
  fieldIds?: string[];            // links to multiple Fields
  fieldNames?: string[];          // denormalized names for each selected field
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
  // Partial field spraying details
  sprayedFields?: SprayedField[]; // Detailed breakdown of sprayed acres per field
  // Crop year governance
  cropYear?: string;              // "2024", "2025", etc.
}

export interface SprayRecordProduct {
  productName: string;
  rate: number;
  unit: string;
  rateBasis: 'per_acre' | 'per_100_gal';
  totalAmount: number;
}

export interface SavedPin {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  color: string;          // hex color e.g. '#dc2626'
  notes?: string;
  isHome?: boolean;
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

// --- Partial Field Spraying ---
export interface SprayedField {
  fieldId: string;
  fieldName: string;
  totalAcres: number;      // Field's full size (reference)
  sprayedAcres: number;    // Actual acres sprayed
  subFieldId?: string;     // If spraying a sub-field
  subFieldName?: string;   // Sub-field name if applicable
}

// --- Sub-Fields for Multi-Planting ---
export interface SubField {
  id: string;
  name: string;        // "North Section", "Corn Strip"
  acres: number;       // Portion of parent field
  crop: string;        // Crop for this section
  cropYear: string;    // Which year this applies to
}

// --- Applicators ---
export interface Applicator {
  id: string;
  name: string;
  isDefault?: boolean;  // prevent deletion of default entry
}
