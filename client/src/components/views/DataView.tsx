import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  FileCode,
  FileCheck
} from 'lucide-react';
import { api } from '../../api/client';
import { Badge } from '../common/Badge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export const DataView: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any | null>(null);

  // Notion state
  const [notionStatus, setNotionStatus] = useState<any | null>(null);
  const [manualJsonText, setManualJsonText] = useState('');
  const [manualType, setManualType] = useState<'tasks' | 'documents'>('tasks');
  const [manualImporting, setManualImporting] = useState(false);

  const { isAdmin } = useAuth();
  const { success, error } = useToast();

  useEffect(() => {
    loadNotionStatus();
  }, []);

  const loadNotionStatus = async () => {
    try {
      const res = await api.getNotionStatus();
      setNotionStatus(res);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewData(null);
      setImportResult(null);

      // Trigger preview validation automatically
      try {
        setPreviewLoading(true);
        const res = await api.previewExcel(file);
        setPreviewData(res);
        success('Workbook analyzed and validated.');
      } catch (err: any) {
        error(err.message || 'Failed to parse Excel workbook.');
      } finally {
        setPreviewLoading(false);
      }
    }
  };

  const handleCommitImport = async () => {
    if (!selectedFile) return;
    if (!confirm('Proceed with transactional import? A safety backup snapshot will be automatically created before committing changes.')) return;

    try {
      setImporting(true);
      const res = await api.importExcel(selectedFile);
      setImportResult(res);
      success('Excel import completed successfully!');
    } catch (err: any) {
      error(err.message || 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  const handleManualJsonImport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setManualImporting(true);
      const parsed = JSON.parse(manualJsonText);
      if (!Array.isArray(parsed)) {
        throw new Error('Payload must be a JSON array of items.');
      }

      const res = await api.importManualJson(manualType, parsed);
      success(res.message);
      setManualJsonText('');
    } catch (err: any) {
      error(err.message || 'Invalid JSON payload.');
    } finally {
      setManualImporting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Excel Operational Workbook Header */}
      <div className="p-6 rounded-2xl bg-studio-900 border border-studio-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-bold">ExcelJS Engine</span>
              <span className="text-slate-500">•</span>
              <span className="text-xs text-slate-400">Multi-Sheet Operational Snapshot</span>
            </div>
            <h3 className="text-lg font-bold text-slate-100 mt-1">
              Excel Operational Workbook (.xlsx) Export & Import
            </h3>
            <p className="text-xs text-slate-400 max-w-2xl mt-1 leading-relaxed">
              Export real transactional database records with styled headers and frozen rows. The workbook acts as a human-readable exchange snapshot. All imports create an automatic safety database backup prior to writing.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <a
              href={api.getExportTemplateUrl()}
              download="lost_paint_studios_template.xlsx"
              className="px-4 py-2 bg-studio-850 hover:bg-studio-800 border border-studio-750 text-slate-200 rounded-xl text-xs font-medium flex items-center gap-2 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>Download Template</span>
            </a>

            <a
              href={api.getExportWorkbookUrl()}
              download="lost_paint_studios_export.xlsx"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg shadow-emerald-950/40 transition-transform active:scale-95"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Full Workbook (.xlsx)</span>
            </a>
          </div>
        </div>

        {/* Excel Import Box */}
        {isAdmin && (
          <div className="pt-4 border-t border-studio-800">
            <h4 className="text-xs font-bold text-slate-200 uppercase font-mono mb-3">
              Import Operational Workbook (.xlsx)
            </h4>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              {/* File Dropzone */}
              <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-studio-750 hover:border-emerald-500/50 rounded-2xl bg-studio-950/60 cursor-pointer transition-colors text-center">
                <Upload className="w-8 h-8 text-emerald-400 mb-2" />
                <span className="text-xs font-semibold text-slate-200">
                  {selectedFile ? selectedFile.name : 'Choose or drop .xlsx file to validate & import'}
                </span>
                <span className="text-[11px] text-slate-400 mt-1">
                  Supports Tasks, Team, and Bugs sheets with stable ID upserts
                </span>
                <input
                  type="file"
                  accept=".xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              {/* Preview & Action Panel */}
              <div className="p-4 rounded-2xl bg-studio-850/60 border border-studio-750 space-y-3 text-xs">
                {previewLoading ? (
                  <LoadingSpinner label="Parsing and validating workbook..." />
                ) : previewData ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                      <FileCheck className="w-4 h-4" />
                      <span>Validation Complete: {previewData.message}</span>
                    </div>

                    <div className="space-y-1.5 font-mono text-[11px]">
                      {Object.entries(previewData.sheets || {}).map(([sheet, sData]: [string, any]) => (
                        <div key={sheet} className="flex justify-between p-2 rounded bg-studio-900 border border-studio-800">
                          <span className="text-slate-300 font-bold">{sheet} Sheet</span>
                          <span className="text-slate-400">{sData.totalRows} rows ready</span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={handleCommitImport}
                      disabled={importing}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl text-xs shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{importing ? 'Importing with Transaction...' : 'Commit Transactional Import'}</span>
                    </button>
                  </div>
                ) : (
                  <p className="text-slate-400 text-xs italic py-4 text-center">
                    Select a workbook on the left to preview detected sheets and row counts before importing.
                  </p>
                )}

                {importResult && (
                  <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800 text-emerald-200 text-xs space-y-1">
                    <span className="font-bold block">✓ Import Succeeded!</span>
                    <p className="text-[11px]">
                      Imported {importResult.recordsImported?.tasks} tasks, {importResult.recordsImported?.team} team members, and {importResult.recordsImported?.bugs} bugs.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Notion Integration & Manual JSON Gateway */}
      <div className="p-6 rounded-2xl bg-studio-900 border border-studio-800 space-y-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-rose-400 font-bold">Notion Sync Gateway</span>
            <span className="text-slate-500">•</span>
            <span className="text-xs text-slate-400">Official API & Safe JSON Route</span>
          </div>
          <h3 className="text-lg font-bold text-slate-100 mt-1">
            Lost Paint Studios Notion Information Integration
          </h3>
          <p className="text-xs text-slate-400 max-w-2xl mt-1 leading-relaxed">
            Source Notion Page:{' '}
            <a
              href="https://mountainous-mouse-69.a.notion.site/PAINT-SUDIOS-INFOS-3e140812c09680fdbffbf5256cfc82ee"
              target="_blank"
              rel="noopener noreferrer"
              className="text-rose-400 hover:underline inline-flex items-center gap-1 font-mono text-[11px]"
            >
              <span>PAINT-STUDIOS-INFOS</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </div>

        {/* Notion API Status Box */}
        <div className="p-4 rounded-xl bg-studio-850/60 border border-studio-800 flex items-start gap-3">
          <div className="p-2 rounded-lg bg-studio-800 text-slate-300">
            <RefreshCw className="w-4 h-4" />
          </div>
          <div className="flex-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200">Notion API Integration Status</span>
              <Badge variant={notionStatus?.configured ? 'emerald' : 'default'} size="sm">
                {notionStatus?.configured ? 'Configured' : 'Not Configured (Requires Token)'}
              </Badge>
            </div>
            <p className="text-slate-400 mt-1 leading-relaxed">
              {notionStatus?.message || 'Loading status...'}
            </p>
          </div>
        </div>

        {/* Manual Import Gateway (Safe Markdown / JSON Route) */}
        {isAdmin && (
          <div className="space-y-3 pt-4 border-t border-studio-800 text-xs">
            <h4 className="font-bold text-slate-200 uppercase font-mono">
              Manual JSON / Markdown Project Payload Import
            </h4>
            <p className="text-slate-400">
              When Notion API tokens are not provided, you can paste exported JSON structures for tasks or documentation pages directly here without scraping risks:
            </p>

            <form onSubmit={handleManualJsonImport} className="space-y-3">
              <div className="flex items-center gap-3">
                <label className="text-slate-400 font-medium">Record Type:</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setManualType('tasks')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                      manualType === 'tasks' ? 'bg-rose-600 text-white' : 'bg-studio-800 text-slate-300'
                    }`}
                  >
                    Tasks Array
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualType('documents')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                      manualType === 'documents' ? 'bg-rose-600 text-white' : 'bg-studio-800 text-slate-300'
                    }`}
                  >
                    Documents Array
                  </button>
                </div>
              </div>

              <textarea
                rows={5}
                required
                value={manualJsonText}
                onChange={e => setManualJsonText(e.target.value)}
                placeholder={
                  manualType === 'tasks'
                    ? '[{"title": "Implement Flashlight Mechanic", "category": "Coding", "priority": "High"}]'
                    : '[{"title": "Story Canon Notes", "category": "Story & Canon", "content": "# Notes\\nDetails..."}]'
                }
                className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 font-mono text-xs focus:outline-none focus:border-rose-500"
              />

              <button
                type="submit"
                disabled={manualImporting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-semibold rounded-xl"
              >
                {manualImporting ? 'Importing...' : `Import ${manualType === 'tasks' ? 'Tasks' : 'Documents'} Payload`}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
