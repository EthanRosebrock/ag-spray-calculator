import { Field } from '../types';

export type MatchConfidence = 'high' | 'medium' | 'low' | 'none';

export interface GeoJSONFeatureData {
  index: number;
  name: string;
  boundary?: [number, number][];
  centroid?: [number, number];
  acres: number;
  properties: Record<string, any>;
}

export interface MatchResult {
  featureIndex: number;
  featureName: string;
  matchedFieldId: string | null;
  matchedFieldName: string | null;
  confidence: MatchConfidence;
  matchReason: string;
  alternates: { fieldId: string; fieldName: string; reason: string }[];
}

/**
 * Normalize a name for fuzzy comparison: lowercase, strip punctuation, collapse spaces.
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[/,\-()&.'"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract a field number from a GeoJSON feature's properties.
 */
function extractFeatureNumber(props: Record<string, any>): string | undefined {
  const val =
    props.number ||
    props.Number ||
    props.NUMBER ||
    props.field_number ||
    props.fieldNumber ||
    props.FIELD_NUMBER ||
    props.field_no ||
    props.Field_No ||
    props['#'] ||
    props.id ||
    props.ID ||
    props.Id ||
    props.field_id ||
    props.FIELD_ID;
  return val != null ? String(val).trim() : undefined;
}

/**
 * Check if a string looks like a field number (short alphanumeric, starts with digit).
 * Examples: "13", "13E", "24SW", "5", "12-A"
 */
function looksLikeFieldNumber(s: string): boolean {
  const trimmed = s.trim();
  return trimmed.length >= 1 && trimmed.length <= 10 && /^\d/.test(trimmed);
}

/**
 * Normalize a field number for comparison: lowercase, strip common separators.
 */
function normalizeFieldNumber(num: string): string {
  let n = num.trim().toLowerCase();
  // Strip trailing decimal zeros (e.g. "12.0" or "12.00" → "12")
  n = n.replace(/\.0+$/, '');
  // Strip separators
  n = n.replace(/[\s\-_]/g, '');
  // Strip leading zeros but keep at least one digit (e.g. "012" → "12", "0" → "0")
  n = n.replace(/^0+(?=\d)/, '');
  return n;
}

/**
 * Extract the first numeric part (with optional trailing letter suffix) from a string.
 * Returns the normalized form, or null if no digits found.
 */
function extractNumericPart(s: string): string | null {
  const match = s.match(/(\d+[a-zA-Z]*)/);
  if (!match) return null;
  return normalizeFieldNumber(match[1]);
}

/**
 * Match GeoJSON features to existing fields using a priority-based algorithm.
 *
 * Priority order:
 *   1. Exact name match (high)
 *   2. Case-insensitive match (high)
 *   3. Normalized match (medium) -- strips punctuation, collapses spaces
 *   4. Contains match (medium) -- one contains the other, min 4 chars, unambiguous
 *   5. Field number match (medium) -- GeoJSON properties number vs field's fieldNumber
 *   6. Numeric extraction match (medium) -- extract numeric part from feature name, compare against field number or field name
 *   7. Feature name as field number (medium) -- feature named "13E" matches field with fieldNumber "13E"
 *   8. Feature number as field name (medium) -- GeoJSON number property matches field name
 */
export function matchFeaturesToFields(
  features: GeoJSONFeatureData[],
  fields: Field[]
): MatchResult[] {
  // Track which field IDs have already been claimed to prevent duplicates
  const claimedFieldIds = new Set<string>();
  const results: MatchResult[] = [];

  for (const feature of features) {
    const result: MatchResult = {
      featureIndex: feature.index,
      featureName: feature.name,
      matchedFieldId: null,
      matchedFieldName: null,
      confidence: 'none',
      matchReason: '',
      alternates: [],
    };

    const featureNameNorm = normalizeName(feature.name);
    const featureNumber = extractFeatureNumber(feature.properties);

    // 1. Exact name match
    const exactMatch = fields.find(
      (f) => f.name === feature.name && !claimedFieldIds.has(f.id)
    );
    if (exactMatch) {
      result.matchedFieldId = exactMatch.id;
      result.matchedFieldName = exactMatch.name;
      result.confidence = 'high';
      result.matchReason = 'Exact name match';
      claimedFieldIds.add(exactMatch.id);
      results.push(result);
      continue;
    }

    // 2. Case-insensitive match
    const ciMatch = fields.find(
      (f) =>
        f.name.toLowerCase() === feature.name.toLowerCase() &&
        !claimedFieldIds.has(f.id)
    );
    if (ciMatch) {
      result.matchedFieldId = ciMatch.id;
      result.matchedFieldName = ciMatch.name;
      result.confidence = 'high';
      result.matchReason = 'Case-insensitive match';
      claimedFieldIds.add(ciMatch.id);
      results.push(result);
      continue;
    }

    // 3. Normalized match
    const normMatch = fields.find(
      (f) =>
        normalizeName(f.name) === featureNameNorm &&
        featureNameNorm.length > 0 &&
        !claimedFieldIds.has(f.id)
    );
    if (normMatch) {
      result.matchedFieldId = normMatch.id;
      result.matchedFieldName = normMatch.name;
      result.confidence = 'medium';
      result.matchReason = 'Normalized name match';
      claimedFieldIds.add(normMatch.id);
      results.push(result);
      continue;
    }

    // 4. Contains match -- one name contains the other, minimum 4 chars, must be unambiguous
    if (featureNameNorm.length >= 4) {
      const containsMatches = fields.filter(
        (f) =>
          !claimedFieldIds.has(f.id) &&
          (normalizeName(f.name).includes(featureNameNorm) ||
            featureNameNorm.includes(normalizeName(f.name))) &&
          normalizeName(f.name).length >= 4
      );

      if (containsMatches.length === 1) {
        result.matchedFieldId = containsMatches[0].id;
        result.matchedFieldName = containsMatches[0].name;
        result.confidence = 'medium';
        result.matchReason = 'Partial name match';
        claimedFieldIds.add(containsMatches[0].id);
        results.push(result);
        continue;
      } else if (containsMatches.length > 1) {
        // Ambiguous -- add as alternates
        result.alternates = containsMatches.map((f) => ({
          fieldId: f.id,
          fieldName: f.name,
          reason: 'Partial name match (ambiguous)',
        }));
      }
    }

    // 5. Field number match -- GeoJSON properties number vs field's fieldNumber
    if (featureNumber) {
      const normFeatureNum = normalizeFieldNumber(featureNumber);
      const numberMatch = fields.find(
        (f) =>
          f.fieldNumber &&
          normalizeFieldNumber(f.fieldNumber) === normFeatureNum &&
          !claimedFieldIds.has(f.id)
      );
      if (numberMatch) {
        result.matchedFieldId = numberMatch.id;
        result.matchedFieldName = numberMatch.name;
        result.confidence = 'medium';
        result.matchReason = `Field number match (${featureNumber})`;
        claimedFieldIds.add(numberMatch.id);
        results.push(result);
        continue;
      }
    }

    // 6. Numeric extraction match -- extract numeric part from feature name, compare against field number or field name
    {
      const featureNumPart = extractNumericPart(feature.name);
      if (featureNumPart) {
        // Try matching against field's fieldNumber first
        const numExtractMatch = fields.find(
          (f) =>
            !claimedFieldIds.has(f.id) &&
            f.fieldNumber &&
            normalizeFieldNumber(f.fieldNumber) === featureNumPart
        );
        if (numExtractMatch) {
          result.matchedFieldId = numExtractMatch.id;
          result.matchedFieldName = numExtractMatch.name;
          result.confidence = 'medium';
          result.matchReason = `Numeric extraction match (${feature.name} → #${numExtractMatch.fieldNumber})`;
          claimedFieldIds.add(numExtractMatch.id);
          results.push(result);
          continue;
        }
        // Fallback: try matching against the numeric part of field names
        const numExtractNameMatch = fields.find(
          (f) =>
            !claimedFieldIds.has(f.id) &&
            extractNumericPart(f.name) === featureNumPart
        );
        if (numExtractNameMatch) {
          result.matchedFieldId = numExtractNameMatch.id;
          result.matchedFieldName = numExtractNameMatch.name;
          result.confidence = 'medium';
          result.matchReason = `Numeric extraction match (${feature.name} → ${numExtractNameMatch.name})`;
          claimedFieldIds.add(numExtractNameMatch.id);
          results.push(result);
          continue;
        }
      }
    }

    // 7. Feature name looks like a field number -- match against field's fieldNumber or field name
    if (looksLikeFieldNumber(feature.name)) {
      const normName = normalizeFieldNumber(feature.name);
      const nameAsNumMatch = fields.find(
        (f) =>
          f.fieldNumber &&
          normalizeFieldNumber(f.fieldNumber) === normName &&
          !claimedFieldIds.has(f.id)
      );
      if (nameAsNumMatch) {
        result.matchedFieldId = nameAsNumMatch.id;
        result.matchedFieldName = nameAsNumMatch.name;
        result.confidence = 'medium';
        result.matchReason = `Name matches field number (${feature.name} → #${nameAsNumMatch.fieldNumber})`;
        claimedFieldIds.add(nameAsNumMatch.id);
        results.push(result);
        continue;
      }
      // Fallback: match feature name (as number) against numeric part of field name
      const nameAsFieldNameMatch = fields.find(
        (f) =>
          !claimedFieldIds.has(f.id) &&
          extractNumericPart(f.name) === normName
      );
      if (nameAsFieldNameMatch) {
        result.matchedFieldId = nameAsFieldNameMatch.id;
        result.matchedFieldName = nameAsFieldNameMatch.name;
        result.confidence = 'medium';
        result.matchReason = `Name matches field name number (${feature.name} → ${nameAsFieldNameMatch.name})`;
        claimedFieldIds.add(nameAsFieldNameMatch.id);
        results.push(result);
        continue;
      }
    }

    // 8. Feature number matches a field's name (when field has no fieldNumber set)
    if (featureNumber) {
      const numAsNameMatch = fields.find(
        (f) =>
          !claimedFieldIds.has(f.id) &&
          (f.name.toLowerCase() === featureNumber.toLowerCase() ||
            normalizeName(f.name) === normalizeName(featureNumber))
      );
      if (numAsNameMatch) {
        result.matchedFieldId = numAsNameMatch.id;
        result.matchedFieldName = numAsNameMatch.name;
        result.confidence = 'medium';
        result.matchReason = `Feature number matches field name (${featureNumber})`;
        claimedFieldIds.add(numAsNameMatch.id);
        results.push(result);
        continue;
      }
    }

    // No match found
    results.push(result);
  }

  return results;
}
