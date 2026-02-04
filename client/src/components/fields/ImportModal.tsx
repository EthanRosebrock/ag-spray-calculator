import React, { useState, useRef } from 'react';
import { Field } from '../../types';
import { parseCSV, parseExcel, parseGeoJSON } from '../../utils/importService';

interface ImportModalProps {
  onImport: (fields: Field[]) => void;
  onClose: () => void;
}

type ImportMode = 'csv' | 'geojson';

const ImportModal: React.FC<ImportModalProps> = ({ onImport, onClose }) => {
  const [mode, setMode] = useState<ImportMode>('csv');
  const [parsed, setParsed] = useState<Field[]>([]);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setParsed([]);
    setFileName(file.name);

    try {
      const isExcel = /\.xlsx?$/i.test(file.name);
      let fields: Field[];

      if (mode === 'csv' && isExcel) {
        const buffer = await file.arrayBuffer();
        fields = parseExcel(buffer);
      } else {
        const text = await file.text();
        fields = mode === 'csv' ? parseCSV(text) : parseGeoJSON(text);
      }

      if (fields.length === 0) {
        setError('No valid fields found in file. Check the format and try again.');
        return;
      }

      setParsed(fields);
    } catch (err) {
      setError(`Failed to parse file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleImport = () => {
    if (parsed.length === 0) return;
    onImport(parsed);
  };

  const resetFile = () => {
    setParsed([]);
    setError('');
    setFileName('');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">Import Fields</h2>

        {/* Mode toggle */}
        <div className="flex border-b border-gray-200 mb-4">
          <button
            onClick={() => { setMode('csv'); resetFile(); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              mode === 'csv'
                ? 'border-ag-green-500 text-ag-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            CSV Import
          </button>
          <button
            onClick={() => { setMode('geojson'); resetFile(); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              mode === 'geojson'
                ? 'border-ag-green-500 text-ag-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            GeoJSON / JD Ops Center
          </button>
        </div>

        {/* Instructions */}
        <div className="bg-gray-50 rounded p-3 mb-4 text-sm text-gray-600">
          {mode === 'csv' ? (
            <>
              <p className="font-medium mb-1">CSV / Excel Format</p>
              <p>Expected columns: name, acres, latitude, longitude, crop, notes</p>
              <p className="text-xs mt-1">Supports .csv, .tsv, .txt, and .xlsx files. Column names are matched flexibly.</p>
            </>
          ) : (
            <>
              <p className="font-medium mb-1">GeoJSON / JD Ops Center Export</p>
              <p>Upload a .json or .geojson file containing a FeatureCollection with polygon features.</p>
              <p className="text-xs mt-1">Field boundaries, centroids, and acreage will be calculated automatically.</p>
            </>
          )}
        </div>

        {/* File input */}
        <div className="mb-4">
          <input
            ref={fileRef}
            type="file"
            accept={mode === 'csv' ? '.csv,.tsv,.txt,.xlsx,.xls' : '.json,.geojson'}
            onChange={handleFile}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-ag-green-50 file:text-ag-green-700 hover:file:bg-ag-green-100"
          />
          {fileName && (
            <p className="text-xs text-gray-500 mt-1">Selected: {fileName}</p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700 mb-4">
            {error}
          </div>
        )}

        {/* Preview table */}
        {parsed.length > 0 && (
          <div className="mb-4">
            <h3 className="font-medium mb-2">Preview ({parsed.length} fields)</h3>
            <div className="overflow-x-auto border rounded">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-2 font-medium">#</th>
                    <th className="text-left p-2 font-medium">Name</th>
                    <th className="text-left p-2 font-medium">Acres</th>
                    <th className="text-left p-2 font-medium">Location</th>
                    <th className="text-left p-2 font-medium">Crop</th>
                    {mode === 'geojson' && (
                      <th className="text-left p-2 font-medium">Boundary</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((f, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2 text-sm text-gray-500">{f.fieldNumber || '—'}</td>
                      <td className="p-2">{f.name}</td>
                      <td className="p-2">{f.acres > 0 ? f.acres.toFixed(1) : '—'}</td>
                      <td className="p-2 text-xs">
                        {f.latitude && f.longitude
                          ? `${f.latitude.toFixed(4)}, ${f.longitude.toFixed(4)}`
                          : '—'}
                      </td>
                      <td className="p-2">{f.crop || '—'}</td>
                      {mode === 'geojson' && (
                        <td className="p-2 text-xs">
                          {f.boundary ? `${f.boundary.length} pts` : '—'}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {parsed.length > 0 && (
            <button onClick={handleImport} className="btn-primary flex-1">
              Import {parsed.length} Field{parsed.length !== 1 ? 's' : ''}
            </button>
          )}
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
