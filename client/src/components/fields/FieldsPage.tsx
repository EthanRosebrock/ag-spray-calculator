import React, { useState, useEffect, useMemo } from 'react';
import { Field } from '../../types';
import { getFields, saveField, deleteField } from '../../utils/storageService';
import FieldModal from './FieldModal';
import ImportModal from './ImportModal';
import BulkEditModal from './BulkEditModal';
import MergeBoundariesModal from './MergeBoundariesModal';

const FieldsPage: React.FC = () => {
  const [fields, setFields] = useState<Field[]>([]);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [editingField, setEditingField] = useState<Field | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  // Search & filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [cropFilter, setCropFilter] = useState('');
  const [farmFilter, setFarmFilter] = useState('');
  const [microclimateFilter, setMicroclimateFilter] = useState('');

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const reload = async () => {
    const f = await getFields();
    setFields(f);
  };

  useEffect(() => {
    reload();
  }, []);

  // Clear selection when filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [searchTerm, cropFilter, farmFilter, microclimateFilter]);

  // Unique values for dropdowns
  const uniqueCrops = useMemo(
    () => Array.from(new Set(fields.map((f) => f.crop).filter(Boolean) as string[])).sort(),
    [fields]
  );
  const uniqueFarms = useMemo(
    () => Array.from(new Set(fields.map((f) => f.farmName).filter(Boolean) as string[])).sort(),
    [fields]
  );
  const uniqueMicroclimates = useMemo(
    () => Array.from(new Set(fields.map((f) => f.microclimate).filter(Boolean) as string[])).sort(),
    [fields]
  );

  // Filtered and sorted list
  const filtered = useMemo(() => {
    const result = fields.filter((f) => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const searchable = [
          f.name,
          f.fieldNumber,
          f.farmName,
          f.crop,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!searchable.includes(term)) return false;
      }
      if (cropFilter && f.crop !== cropFilter) return false;
      if (farmFilter && f.farmName !== farmFilter) return false;
      if (microclimateFilter && f.microclimate !== microclimateFilter) return false;
      return true;
    });
    // Sort by field number
    return result.sort((a, b) => {
      const numA = a.fieldNumber || '';
      const numB = b.fieldNumber || '';
      return numA.localeCompare(numB, undefined, { numeric: true });
    });
  }, [fields, searchTerm, cropFilter, farmFilter, microclimateFilter]);

  const hasActiveFilters = searchTerm || cropFilter || farmFilter || microclimateFilter;

  const clearFilters = () => {
    setSearchTerm('');
    setCropFilter('');
    setFarmFilter('');
    setMicroclimateFilter('');
  };

  // Selection helpers
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((f) => selectedIds.has(f.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((f) => f.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Handlers
  const handleSave = async (field: Field) => {
    await saveField(field);
    await reload();
    setShowFieldModal(false);
    setEditingField(null);
  };

  const handleDelete = async (id: string) => {
    await deleteField(id);
    await reload();
    setDeleteConfirm(null);
  };

  const handleImport = async (imported: Field[]) => {
    for (const f of imported) await saveField(f);
    await reload();
    setShowImportModal(false);
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    for (const id of ids) await deleteField(id);
    setSelectedIds(new Set());
    setBulkDeleteConfirm(false);
    await reload();
  };

  const handleBulkEditSave = async () => {
    setShowBulkEditModal(false);
    setSelectedIds(new Set());
    await reload();
  };

  const handleMergeDone = () => {
    reload();
  };

  // Find and remove duplicate fields (same name, keeping the one with more data)
  const removeDuplicates = async () => {
    const seen = new Map<string, Field>();
    const duplicateIds: string[] = [];

    for (const field of fields) {
      const key = field.name.toLowerCase().trim();
      const existing = seen.get(key);

      if (existing) {
        // Keep the one with more data (more non-empty fields, boundary, etc.)
        const scoreField = (f: Field) => {
          let score = 0;
          if (f.boundary && f.boundary.length > 0) score += 10;
          if (f.acres > 0) score += 1;
          if (f.crop) score += 1;
          if (f.farmName) score += 1;
          if (f.latitude && f.longitude) score += 1;
          if (f.subFields && f.subFields.length > 0) score += 5;
          return score;
        };

        if (scoreField(field) > scoreField(existing)) {
          duplicateIds.push(existing.id);
          seen.set(key, field);
        } else {
          duplicateIds.push(field.id);
        }
      } else {
        seen.set(key, field);
      }
    }

    if (duplicateIds.length === 0) {
      window.alert('No duplicate fields found.');
      return;
    }

    if (window.confirm(`Found ${duplicateIds.length} duplicate field(s). Remove them?`)) {
      for (const id of duplicateIds) {
        await deleteField(id);
      }
      await reload();
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Fields</h1>
        <div className="flex gap-2">
          <button
            onClick={removeDuplicates}
            className="btn-secondary text-sm py-2 px-4"
            title="Remove fields with duplicate names"
          >
            Remove Duplicates
          </button>
          <button
            onClick={() => setShowMergeModal(true)}
            className="btn-secondary text-sm py-2 px-4"
          >
            Merge Boundaries
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="btn-secondary text-sm py-2 px-4"
          >
            Import
          </button>
          <button
            onClick={() => {
              setEditingField(null);
              setShowFieldModal(true);
            }}
            className="btn-primary text-sm py-2 px-4"
          >
            + Add Field
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      {fields.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search by name, field #, farm, or crop..."
            className="input-field flex-1 min-w-[200px]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {uniqueCrops.length > 0 && (
            <select
              className="input-field w-auto"
              value={cropFilter}
              onChange={(e) => setCropFilter(e.target.value)}
            >
              <option value="">All Crops</option>
              {uniqueCrops.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
          {uniqueFarms.length > 0 && (
            <select
              className="input-field w-auto"
              value={farmFilter}
              onChange={(e) => setFarmFilter(e.target.value)}
            >
              <option value="">All Farms</option>
              {uniqueFarms.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          )}
          {uniqueMicroclimates.length > 0 && (
            <select
              className="input-field w-auto"
              value={microclimateFilter}
              onChange={(e) => setMicroclimateFilter(e.target.value)}
            >
              <option value="">All Microclimates</option>
              {uniqueMicroclimates.map((m) => (
                <option key={m} value={m} className="capitalize">{m}</option>
              ))}
            </select>
          )}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="btn-secondary text-sm py-2 px-3"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          <span className="text-sm font-medium text-blue-800">
            {selectedIds.size} field{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => setShowBulkEditModal(true)}
              className="btn-primary text-sm py-1.5 px-3"
            >
              Bulk Edit
            </button>
            <button
              onClick={() => setBulkDeleteConfirm(true)}
              className="bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors font-medium text-sm py-1.5 px-3"
            >
              Delete Selected
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="btn-secondary text-sm py-1.5 px-3"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {fields.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 mb-4">No fields configured yet</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => {
                setEditingField(null);
                setShowFieldModal(true);
              }}
              className="btn-primary text-sm py-2 px-4"
            >
              Add Your First Field
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="btn-secondary text-sm py-2 px-4"
            >
              Import from File
            </button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 mb-2">No fields match your search</p>
          <button onClick={clearFilters} className="text-sm text-blue-600 hover:text-blue-800">
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAll}
                    title="Select all"
                  />
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">#</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Name</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Acres</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Crop</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Location</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Microclimate</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((field, index) => (
                <tr
                  key={field.id}
                  className={`border-b border-gray-100 hover:bg-gray-50 ${
                    selectedIds.has(field.id) ? 'bg-blue-50' : ''
                  }`}
                >
                  <td className="py-3 px-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(field.id)}
                      onChange={() => toggleSelect(field.id)}
                    />
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-500">{field.fieldNumber || index + 1}</td>
                  <td className="py-3 px-4">
                    <div className="font-medium">{field.name}</div>
                    {field.farmName && (
                      <div className="text-xs text-gray-500">{field.farmName}</div>
                    )}
                  </td>
                  <td className="py-3 px-4">{field.acres > 0 ? field.acres.toFixed(1) : '—'}</td>
                  <td className="py-3 px-4">{field.crop || '—'}</td>
                  <td className="py-3 px-4 text-sm">
                    {field.latitude && field.longitude
                      ? `${field.latitude.toFixed(4)}, ${field.longitude.toFixed(4)}`
                      : '—'}
                    {field.boundary && (
                      <span className="ml-1 text-xs text-green-600" title={`${field.boundary.length} boundary vertices`}>
                        &#9635;
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {field.microclimate ? (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs capitalize">
                        {field.microclimate}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => {
                          setEditingField(field);
                          setShowFieldModal(true);
                        }}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                      {deleteConfirm === field.id ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleDelete(field.id)}
                            className="text-sm text-red-600 font-medium"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="text-sm text-gray-500"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(field.id)}
                          className="text-sm text-red-500 hover:text-red-700"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {showFieldModal && (
        <FieldModal
          field={editingField}
          onSave={handleSave}
          onClose={() => {
            setShowFieldModal(false);
            setEditingField(null);
          }}
        />
      )}

      {showImportModal && (
        <ImportModal
          onImport={handleImport}
          onClose={() => setShowImportModal(false)}
        />
      )}

      {showBulkEditModal && (
        <BulkEditModal
          selectedIds={selectedIds}
          onSave={handleBulkEditSave}
          onClose={() => setShowBulkEditModal(false)}
        />
      )}

      {showMergeModal && (
        <MergeBoundariesModal
          onMerge={handleMergeDone}
          onClose={() => setShowMergeModal(false)}
        />
      )}

      {/* Bulk Delete Confirmation */}
      {bulkDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold mb-2">Delete {selectedIds.size} Fields?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This cannot be undone. All selected fields and their boundary data will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleBulkDelete}
                className="bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors font-medium flex-1 py-2"
              >
                Delete {selectedIds.size} Field{selectedIds.size !== 1 ? 's' : ''}
              </button>
              <button
                onClick={() => setBulkDeleteConfirm(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FieldsPage;
