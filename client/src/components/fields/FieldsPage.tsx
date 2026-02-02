import React, { useState, useEffect } from 'react';
import { Field } from '../../types';
import { getFields, saveField, deleteField } from '../../utils/storageService';
import FieldModal from './FieldModal';
import ImportModal from './ImportModal';

const FieldsPage: React.FC = () => {
  const [fields, setFields] = useState<Field[]>([]);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingField, setEditingField] = useState<Field | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const reload = () => setFields(getFields());

  useEffect(() => {
    reload();
  }, []);

  const handleSave = (field: Field) => {
    saveField(field);
    reload();
    setShowFieldModal(false);
    setEditingField(null);
  };

  const handleDelete = (id: string) => {
    deleteField(id);
    reload();
    setDeleteConfirm(null);
  };

  const handleImport = (imported: Field[]) => {
    imported.forEach((f) => saveField(f));
    reload();
    setShowImportModal(false);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Fields</h1>
        <div className="flex gap-2">
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
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Name</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Acres</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Crop</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Location</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Microclimate</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => (
                <tr key={field.id} className="border-b border-gray-100 hover:bg-gray-50">
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
    </div>
  );
};

export default FieldsPage;
