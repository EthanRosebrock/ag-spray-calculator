import { Field } from '../types';

/**
 * Approximate area of a polygon in acres using the Shoelace formula
 * with latitude/longitude scaling.
 */
export function calculatePolygonArea(coords: [number, number][]): number {
  if (coords.length < 3) return 0;

  // Use the centroid latitude for the longitude scaling factor
  const avgLat = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
  const latRad = (avgLat * Math.PI) / 180;
  const lonScale = Math.cos(latRad);

  // Convert to approximate meters using degree lengths
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLon = 111320 * lonScale;

  // Shoelace formula in metric
  let area = 0;
  for (let i = 0; i < coords.length; i++) {
    const j = (i + 1) % coords.length;
    const xi = coords[i][1] * metersPerDegreeLon;
    const yi = coords[i][0] * metersPerDegreeLat;
    const xj = coords[j][1] * metersPerDegreeLon;
    const yj = coords[j][0] * metersPerDegreeLat;
    area += xi * yj - xj * yi;
  }
  area = Math.abs(area) / 2;

  // Convert square meters to acres (1 acre = 4046.86 m²)
  return area / 4046.86;
}

/**
 * Calculate the centroid of a polygon defined by [lat, lng] coordinates.
 */
export function calculateCentroid(coords: [number, number][]): [number, number] {
  if (coords.length === 0) return [0, 0];
  const lat = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
  const lng = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;
  return [lat, lng];
}

/**
 * Parse CSV text into Field objects.
 * Expected columns (flexible header mapping): name, acres, latitude, longitude, crop, notes
 */
export function parseCSV(text: string): Field[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const headers = headerLine.split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));

  // Map known column names
  const colMap: Record<string, number> = {};
  const aliases: Record<string, string[]> = {
    name: ['name', 'field_name', 'fieldname', 'field name', 'field'],
    acres: ['acres', 'area', 'size'],
    latitude: ['latitude', 'lat'],
    longitude: ['longitude', 'lon', 'lng', 'long'],
    crop: ['crop', 'crop_type', 'croptype'],
    notes: ['notes', 'note', 'description', 'comments'],
    carrierrate: ['carrierrate', 'carrier_rate', 'carrier rate', 'gpa'],
    soiltype: ['soiltype', 'soil_type', 'soil type', 'soil'],
    farmname: ['farmname', 'farm_name', 'farm name', 'farm'],
  };

  for (const [key, names] of Object.entries(aliases)) {
    const idx = headers.findIndex((h) => names.includes(h));
    if (idx >= 0) colMap[key] = idx;
  }

  const fields: Field[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple CSV parse (handles quoted commas)
    const values = parseCSVLine(line);

    const get = (key: string): string => {
      const idx = colMap[key];
      return idx !== undefined && idx < values.length ? values[idx].trim() : '';
    };

    const name = get('name');
    if (!name) continue;

    const field: Field = {
      id: Date.now().toString() + '-' + i,
      name,
      acres: parseFloat(get('acres')) || 0,
      carrierRate: parseFloat(get('carrierrate')) || 20,
      latitude: parseFloat(get('latitude')) || undefined,
      longitude: parseFloat(get('longitude')) || undefined,
      crop: get('crop') || undefined,
      notes: get('notes') || undefined,
      soilType: get('soiltype') || undefined,
      farmName: get('farmname') || undefined,
    };

    fields.push(field);
  }

  return fields;
}

/** Parse a single CSV line, respecting quoted fields. */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

/**
 * Parse GeoJSON (FeatureCollection or single Feature) into Field objects.
 * Extracts polygon boundaries and properties.
 */
export function parseGeoJSON(text: string): Field[] {
  const data = JSON.parse(text);
  const features: any[] = [];

  if (data.type === 'FeatureCollection' && Array.isArray(data.features)) {
    features.push(...data.features);
  } else if (data.type === 'Feature') {
    features.push(data);
  } else {
    return [];
  }

  const fields: Field[] = [];

  for (let i = 0; i < features.length; i++) {
    const feature = features[i];
    const props = feature.properties || {};
    const geometry = feature.geometry;

    if (!geometry) continue;

    let boundary: [number, number][] | undefined;
    let centroid: [number, number] | undefined;
    let calculatedAcres = 0;

    if (geometry.type === 'Polygon' && geometry.coordinates?.[0]) {
      // GeoJSON coordinates are [lng, lat], convert to [lat, lng]
      const coords: [number, number][] = geometry.coordinates[0].map((c: number[]) => [c[1], c[0]] as [number, number]);
      boundary = coords;
      centroid = calculateCentroid(coords);
      calculatedAcres = calculatePolygonArea(coords);
    } else if (geometry.type === 'MultiPolygon' && geometry.coordinates?.[0]?.[0]) {
      // Use first polygon of multi-polygon
      const coords: [number, number][] = geometry.coordinates[0][0].map((c: number[]) => [c[1], c[0]] as [number, number]);
      boundary = coords;
      centroid = calculateCentroid(coords);
      calculatedAcres = calculatePolygonArea(coords);
    } else if (geometry.type === 'Point' && geometry.coordinates) {
      centroid = [geometry.coordinates[1], geometry.coordinates[0]];
    }

    // Extract name from common property keys
    const name =
      props.name ||
      props.Name ||
      props.NAME ||
      props.field_name ||
      props.fieldName ||
      props.FIELD_NAME ||
      props.title ||
      `Field ${i + 1}`;

    // Extract acres from properties or calculate
    const propsAcres =
      parseFloat(props.acres || props.Acres || props.ACRES || props.area || props.Area || '') || 0;

    const field: Field = {
      id: Date.now().toString() + '-' + i,
      name,
      acres: propsAcres > 0 ? propsAcres : Math.round(calculatedAcres * 10) / 10,
      carrierRate: 20,
      latitude: centroid ? centroid[0] : undefined,
      longitude: centroid ? centroid[1] : undefined,
      boundary,
      crop: props.crop || props.Crop || props.CROP || undefined,
      notes: props.notes || props.Notes || props.description || undefined,
      farmName: props.farm || props.Farm || props.farm_name || undefined,
    };

    fields.push(field);
  }

  return fields;
}
