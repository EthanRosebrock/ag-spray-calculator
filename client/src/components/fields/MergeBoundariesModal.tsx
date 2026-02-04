import React, { useState, useRef, useMemo } from 'react';
import { Field } from '../../types';
import { parseGeoJSONFeatures } from '../../utils/importService';
import { matchFeaturesToFields, type GeoJSONFeatureData, type MatchResult } from '../../utils/boundaryMatcher';
import { getFields, saveField } from '../../utils/storageService';

interface MergeBoundariesModalProps {
  onMerge: () => void;
  onClose: () => void;
}

type Step = 'upload' | 'preview' | 'done';

const confidenceColors: Record<string, string> = {
  high: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-red-100 text-red-800',
  none: 'bg-gray-100 text-gray-600',
};

const MergeBoundariesModal: React.FC<MergeBoundariesModalProps> = ({ onMerge, onClose }) => {
  const [step, setStep] = useState<Step>('upload');
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Parsed data
  const [features, setFeatures] = useState<GeoJSONFeatureData[]>([]);
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);

  // Per-feature options (keyed by feature index)
  const [overrides, setOverrides] = useState<Record<number, string | null>>({});
  const [updateLatLng, setUpdateLatLng] = useState(true);
  const [updateAcres, setUpdateAcres] = useState(false);

  // Apply results
  const [applyCount, setApplyCount] = useState(0);

  const fields = useMemo(() => getFields(), []);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setFileName(file.name);

    try {
      const text = await file.text();
      const parsed = parseGeoJSONFeatures(text);

      if (parsed.length === 0) {
        setError('No polygon features found in this file.');
        return;
      }

      const polygonFeatures = parsed.filter((f) => f.boundary && f.boundary.length >= 3);
      if (polygonFeatures.length === 0) {
        setError('No polygon boundaries found. Only point features were detected.');
        return;
      }

      setFeatures(polygonFeatures);

      // Run the matching algorithm
      const matches = matchFeaturesToFields(polygonFeatures, fields);
      setMatchResults(matches);

      // Initialize overrides from match results
      const initialOverrides: Record<number, string | null> = {};
      for (const match of matches) {
        initialOverrides[match.featureIndex] = match.matchedFieldId;
      }
      setOverrides(initialOverrides);

      setStep('preview');
    } catch (err) {
      setError(`Failed to parse file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const resolveFieldId = (
    featureIndex: number,
    ov: Record<number, string | null>,
    matches: MatchResult[]
  ): string | null => {
    if (featureIndex in ov) return ov[featureIndex];
    const match = matches.find((m) => m.featureIndex === featureIndex);
    return match?.matchedFieldId ?? null;
  };

  const getEffectiveFieldId = (featureIndex: number): string | null => {
    return resolveFieldId(featureIndex, overrides, matchResults);
  };

  const getEffectiveConfidence = (featureIndex: number): string => {
    const fieldId = getEffectiveFieldId(featureIndex);
    if (!fieldId) return 'none';

    const match = matchResults.find((m) => m.featureIndex === featureIndex);
    if (match && match.matchedFieldId === fieldId) return match.confidence;
    return 'medium'; // manual override
  };

  const setFieldOverride = (featureIndex: number, fieldId: string | null) => {
    setOverrides((prev) => ({ ...prev, [featureIndex]: fieldId }));
  };

  // Count how many features will be applied
  const assignedCount = features.filter(
    (f) => getEffectiveFieldId(f.index) !== null
  ).length;

  // Check for duplicate assignments
  const duplicateCheck = useMemo(() => {
    const fieldIdCounts = new Map<string, number>();
    for (const feature of features) {
      const fieldId = resolveFieldId(feature.index, overrides, matchResults);
      if (fieldId) {
        fieldIdCounts.set(fieldId, (fieldIdCounts.get(fieldId) || 0) + 1);
      }
    }
    const dupes = new Set<string>();
    fieldIdCounts.forEach((count, id) => {
      if (count > 1) dupes.add(id);
    });
    return dupes;
  }, [features, overrides, matchResults]);

  const handleApply = () => {
    let count = 0;
    const currentFields = getFields();

    for (const feature of features) {
      const fieldId = getEffectiveFieldId(feature.index);
      if (!fieldId) continue;

      const existing = currentFields.find((f) => f.id === fieldId);
      if (!existing) continue;

      const updated: Field = { ...existing, boundary: feature.boundary };

      if (updateLatLng && feature.centroid) {
        updated.latitude = +feature.centroid[0].toFixed(6);
        updated.longitude = +feature.centroid[1].toFixed(6);
      }

      if (updateAcres && feature.acres > 0) {
        updated.acres = feature.acres;
      }

      saveField(updated);
      count++;
    }

    setApplyCount(count);
    setStep('done');
  };

  const handleDone = () => {
    onMerge();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-1">Merge GeoJSON Boundaries</h2>
        <p className="text-sm text-gray-500 mb-4">
          Add polygon boundaries to existing fields from a GeoJSON file.
        </p>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <>
            <div className="bg-gray-50 rounded p-3 mb-4 text-sm text-gray-600">
              <p className="font-medium mb-1">How it works</p>
              <p>
                Upload a .json or .geojson file. The tool will match polygon features to your
                existing fields by name and add the boundary data without creating duplicates.
              </p>
            </div>

            <div className="mb-4">
              <input
                ref={fileRef}
                type="file"
                accept=".json,.geojson"
                onChange={handleFile}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-ag-green-50 file:text-ag-green-700 hover:file:bg-ag-green-100"
              />
              {fileName && (
                <p className="text-xs text-gray-500 mt-1">Selected: {fileName}</p>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700 mb-4">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={onClose} className="btn-secondary flex-1">
                Cancel
              </button>
            </div>
          </>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && (
          <>
            <div className="mb-4 flex items-center gap-4 text-sm">
              <span className="text-gray-600">
                {features.length} polygon{features.length !== 1 ? 's' : ''} found
              </span>
              <span className="text-gray-400">&middot;</span>
              <span className={assignedCount > 0 ? 'text-green-700 font-medium' : 'text-gray-500'}>
                {assignedCount} matched to fields
              </span>
            </div>

            {duplicateCheck.size > 0 && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800 mb-4">
                Warning: Some fields are assigned to multiple boundaries. Each field should only have one boundary.
              </div>
            )}

            {/* Options */}
            <div className="flex gap-6 mb-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={updateLatLng}
                  onChange={(e) => setUpdateLatLng(e.target.checked)}
                />
                Update lat/lng with centroid
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={updateAcres}
                  onChange={(e) => setUpdateAcres(e.target.checked)}
                />
                Update acres from boundary
              </label>
            </div>

            {/* Match table */}
            <div className="overflow-x-auto border rounded mb-4">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-2 font-medium">GeoJSON Name</th>
                    <th className="text-left p-2 font-medium">Acres</th>
                    <th className="text-left p-2 font-medium">Match</th>
                    <th className="text-left p-2 font-medium">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {features.map((feature) => {
                    const effectiveFieldId = getEffectiveFieldId(feature.index);
                    const confidence = getEffectiveConfidence(feature.index);
                    const isDuplicate = effectiveFieldId
                      ? duplicateCheck.has(effectiveFieldId)
                      : false;

                    return (
                      <tr key={feature.index} className="border-t">
                        <td className="p-2">
                          <div className="font-medium">{feature.name}</div>
                          {feature.boundary && (
                            <div className="text-xs text-gray-400">
                              {feature.boundary.length} vertices
                            </div>
                          )}
                        </td>
                        <td className="p-2">{feature.acres > 0 ? feature.acres.toFixed(1) : '—'}</td>
                        <td className="p-2">
                          <select
                            className={`input-field text-sm py-1 ${isDuplicate ? 'border-yellow-400' : ''}`}
                            value={effectiveFieldId || ''}
                            onChange={(e) =>
                              setFieldOverride(
                                feature.index,
                                e.target.value || null
                              )
                            }
                          >
                            <option value="">-- Skip --</option>
                            {fields.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.name}
                                {f.fieldNumber ? ` (#${f.fieldNumber})` : ''}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${confidenceColors[confidence]}`}
                          >
                            {confidence === 'none' ? 'no match' : confidence}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleApply}
                className="btn-primary flex-1"
                disabled={assignedCount === 0 || duplicateCheck.size > 0}
              >
                Apply {assignedCount} Boundar{assignedCount !== 1 ? 'ies' : 'y'}
              </button>
              <button
                onClick={() => {
                  setStep('upload');
                  setFeatures([]);
                  setMatchResults([]);
                  setOverrides({});
                  setFileName('');
                  if (fileRef.current) fileRef.current.value = '';
                }}
                className="btn-secondary"
              >
                Back
              </button>
              <button onClick={onClose} className="btn-secondary">
                Cancel
              </button>
            </div>
          </>
        )}

        {/* Step 3: Done */}
        {step === 'done' && (
          <>
            <div className="text-center py-8">
              <div className="text-4xl mb-3">&#10003;</div>
              <h3 className="text-lg font-semibold mb-1">Boundaries Merged</h3>
              <p className="text-gray-600">
                Successfully updated {applyCount} field{applyCount !== 1 ? 's' : ''} with
                boundary data. Check the Map tab to see the polygons.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={handleDone} className="btn-primary flex-1">
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MergeBoundariesModal;
