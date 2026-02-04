import { Field } from '../types';
import type { GeoJSONFeatureData } from './boundaryMatcher';
import * as XLSX from 'xlsx';

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
 * Detect the delimiter used in a text file (tab, comma, or multi-space).
 * Returns '\t', ',', or '  ' (multi-space sentinel).
 */
function detectDelimiter(lines: string[]): string {
  // Sample up to 5 lines to detect
  const sample = lines.slice(0, 5);
  let tabTotal = 0;
  let commaTotal = 0;
  let multiSpaceTotal = 0;

  for (const line of sample) {
    tabTotal += (line.match(/\t/g) || []).length;
    commaTotal += (line.match(/,/g) || []).length;
    // Count runs of 2+ spaces (potential delimiters between data columns)
    multiSpaceTotal += (line.match(/  {2,}/g) || []).length;
  }

  if (tabTotal >= commaTotal && tabTotal >= multiSpaceTotal && tabTotal > 0) return '\t';
  if (commaTotal >= tabTotal && commaTotal >= multiSpaceTotal && commaTotal > 0) return ',';
  if (multiSpaceTotal > 0) return '  ';
  // Fallback: if nothing detected, try comma
  return ',';
}

/**
 * Split a line using multi-space delimiter (2+ consecutive spaces).
 * Treats any run of 2+ spaces as a column separator.
 */
function splitMultiSpace(line: string): string[] {
  return line.split(/  {2,}/).map((v) => v.trim()).filter((v) => v.length > 0);
}

/**
 * Check whether the first row looks like a header (contains known column names)
 * rather than data.
 */
function looksLikeHeader(values: string[]): boolean {
  const knownHeaders = [
    'name', 'field_name', 'fieldname', 'field name', 'field',
    'acres', 'area', 'size',
    'latitude', 'lat', 'longitude', 'lon', 'lng', 'long',
    'crop', 'notes', 'number', 'field_number', 'fieldnumber', '#',
    'farm', 'farm_name', 'farmname', 'soil', 'soil_type', 'soiltype',
  ];
  const matched = values.filter((v) =>
    knownHeaders.includes(v.trim().toLowerCase().replace(/['"]/g, ''))
  );
  return matched.length >= 2;
}

/**
 * Try to auto-detect column layout for headerless data.
 * Common patterns:
 *   field_number, name, acres
 *   name, acres
 */
function inferColumns(values: string[]): Record<string, number> {
  const colMap: Record<string, number> = {};

  if (values.length >= 3) {
    // Check if first column looks like a field number (short alphanumeric like "1", "13E", "24SW")
    const first = values[0].trim();
    const third = values[values.length - 1].trim();
    if (first.length <= 6 && /^[0-9]/.test(first) && !isNaN(parseFloat(third))) {
      // Pattern: fieldnumber, name, acres (name may span middle columns if tab-separated)
      colMap['fieldnumber'] = 0;
      colMap['name'] = 1;
      colMap['acres'] = values.length - 1;
      return colMap;
    }
  }

  if (values.length >= 2) {
    const last = values[values.length - 1].trim();
    if (!isNaN(parseFloat(last))) {
      colMap['name'] = 0;
      colMap['acres'] = values.length - 1;
    }
  }

  return colMap;
}

/**
 * Parse CSV text into Field objects.
 * Supports comma and tab delimited files, with or without a header row.
 * Expected columns (flexible header mapping): number, name, acres, latitude, longitude, crop, notes
 */
export function parseCSV(text: string): Field[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 1) return [];

  const delimiter = detectDelimiter(lines);

  const splitLine = (line: string): string[] => {
    if (delimiter === '\t') return line.split('\t');
    if (delimiter === '  ') return splitMultiSpace(line);
    return parseCSVLine(line);
  };

  const firstValues = splitLine(lines[0]);

  const hasHeader = looksLikeHeader(firstValues);
  let colMap: Record<string, number> = {};
  let dataStart = 0;

  if (hasHeader) {
    const headers = firstValues.map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));

    const aliases: Record<string, string[]> = {
      fieldnumber: ['number', 'field_number', 'fieldnumber', 'field number', '#', 'field #', 'field#', 'no', 'field_no'],
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
    dataStart = 1;
  } else {
    colMap = inferColumns(firstValues);
    dataStart = 0;
  }

  if (Object.keys(colMap).length === 0) return [];

  const fields: Field[] = [];
  for (let i = dataStart; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = splitLine(line);

    const get = (key: string): string => {
      const idx = colMap[key];
      return idx !== undefined && idx < values.length ? values[idx].trim() : '';
    };

    const name = get('name');
    if (!name) continue;

    const field: Field = {
      id: Date.now().toString() + '-' + i,
      name,
      fieldNumber: get('fieldnumber') || undefined,
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

/**
 * Parse an Excel (.xlsx/.xls) file into Field objects.
 * Reads the first sheet and converts it to CSV text, then delegates to parseCSV.
 */
export function parseExcel(data: ArrayBuffer): Field[] {
  const workbook = XLSX.read(data, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const csv = XLSX.utils.sheet_to_csv(sheet);
  return parseCSV(csv);
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
 * Parse GeoJSON into raw feature data without creating Field objects.
 * Used by the boundary merge flow to match features to existing fields.
 */
export function parseGeoJSONFeatures(text: string): GeoJSONFeatureData[] {
  const data = JSON.parse(text);
  const features: any[] = [];

  if (data.type === 'FeatureCollection' && Array.isArray(data.features)) {
    features.push(...data.features);
  } else if (data.type === 'Feature') {
    features.push(data);
  } else {
    return [];
  }

  const results: GeoJSONFeatureData[] = [];

  for (let i = 0; i < features.length; i++) {
    const feature = features[i];
    const props = feature.properties || {};
    const geometry = feature.geometry;

    if (!geometry) continue;

    let boundary: [number, number][] | undefined;
    let centroid: [number, number] | undefined;
    let calculatedAcres = 0;

    if (geometry.type === 'Polygon' && geometry.coordinates?.[0]) {
      const coords: [number, number][] = geometry.coordinates[0].map(
        (c: number[]) => [c[1], c[0]] as [number, number]
      );
      boundary = coords;
      centroid = calculateCentroid(coords);
      calculatedAcres = calculatePolygonArea(coords);
    } else if (geometry.type === 'MultiPolygon' && geometry.coordinates?.[0]?.[0]) {
      const coords: [number, number][] = geometry.coordinates[0][0].map(
        (c: number[]) => [c[1], c[0]] as [number, number]
      );
      boundary = coords;
      centroid = calculateCentroid(coords);
      calculatedAcres = calculatePolygonArea(coords);
    } else if (geometry.type === 'Point' && geometry.coordinates) {
      centroid = [geometry.coordinates[1], geometry.coordinates[0]];
    }

    const name =
      props.name ||
      props.Name ||
      props.NAME ||
      props.field_name ||
      props.fieldName ||
      props.FIELD_NAME ||
      props.title ||
      `Feature ${i + 1}`;

    const propsAcres =
      parseFloat(props.acres || props.Acres || props.ACRES || props.area || props.Area || '') || 0;

    results.push({
      index: i,
      name,
      boundary,
      centroid,
      acres: propsAcres > 0 ? propsAcres : Math.round(calculatedAcres * 10) / 10,
      properties: props,
    });
  }

  return results;
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
