import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Plus,
  BookOpen,
  History,
  Tag,
  Edit2,
  Trash2,
  ExternalLink,
  Save,
  CheckCircle2
} from 'lucide-react';
import { Document, Chapter } from '../../types';
import { api } from '../../api/client';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { EmptyState } from '../common/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const CATEGORIES = [
  'All Categories',
  'Game Design & Systems',
  'Story & Canon',
  'Chapter Docs',
  'Technical Notes',
  'Audio & Visual',
  'Meeting Decisions',
  'Studio Procedures',
  'External Links'
];

export const DocumentsView: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [search, setSearch] = useState('');

  // Edit / Create Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [activeDoc, setActiveDoc] = useState<Partial<Document> | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editSummary, setEditSummary] = useState('');

  const { canEdit, isAdmin } = useAuth();
  const { success, error } = useToast();

  useEffect(() => {
    loadDocuments();
  }, [categoryFilter, search]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (categoryFilter && categoryFilter !== 'All Categories') params.category = categoryFilter;
      if (search) params.search = search;

      const [docsRes, chRes] = await Promise.all([
        api.getDocuments(params),
        api.getChapters()
      ]);

      setDocuments(docsRes.documents);
      setChapters(chRes.chapters);

      // Auto-select first doc if none selected
      if (!selectedDoc && docsRes.documents.length > 0) {
        loadDocumentDetail(docsRes.documents[0].id);
      }
    } catch (err) {
      console.error('Failed to load documents', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDocumentDetail = async (id: string) => {
    try {
      const res = await api.getDocument(id);
      setSelectedDoc(res.document);
    } catch (err) {
      error('Failed to load document content.');
    }
  };

  const handleOpenCreate = () => {
    setActiveDoc({
      title: '',
      category: 'Game Design & Systems',
      content: '# Document Title\n\nWrite studio documentation here...',
      tags: '',
      chapter_id: null
    });
    setEditSummary('Initial document creation');
    setIsEditing(false);
    setModalOpen(true);
  };

  const handleOpenEdit = () => {
    if (!selectedDoc) return;
    setActiveDoc({ ...selectedDoc });
    setEditSummary(`Revision v${selectedDoc.version + 1} edits`);
    setIsEditing(true);
    setModalOpen(true);
  };

  const handleSaveDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDoc?.title || !activeDoc?.content) {
      error('Title and content are required.');
      return;
    }

    try {
      if (isEditing && activeDoc.id) {
        await api.updateDocument(activeDoc.id, {
          title: activeDoc.title,
          category: activeDoc.category || 'Game Design & Systems',
          content: activeDoc.content,
          tags: activeDoc.tags || '',
          chapter_id: activeDoc.chapter_id || null,
          summary: editSummary
        });
        success('Document and revision history saved.');
      } else {
        await api.createDocument({
          title: activeDoc.title,
          category: activeDoc.category || 'Game Design & Systems',
          content: activeDoc.content,
          tags: activeDoc.tags || '',
          chapter_id: activeDoc.chapter_id || null
        });
        success('New document created.');
      }

      setModalOpen(false);
      loadDocuments();
    } catch (err: any) {
      error(err.message || 'Failed to save document.');
    }
  };

  const handleDelete = async () => {
    if (!selectedDoc || !confirm(`Delete document "${selectedDoc.title}"?`)) return;
    try {
      await api.deleteDocument(selectedDoc.id);
      success('Document deleted.');
      setSelectedDoc(null);
      loadDocuments();
    } catch (err: any) {
      error(err.message);
    }
  };

  if (loading && documents.length === 0) {
    return <LoadingSpinner label="Loading studio knowledge base..." />;
  }

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search knowledge base..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-studio-900 border border-studio-750 rounded-xl text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-rose-500"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-studio-900 border border-studio-750 rounded-xl text-xs text-slate-300 focus:outline-none"
          >
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {canEdit && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl shadow-md transition-transform active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Create Document</span>
          </button>
        )}
      </div>

      {/* Main 2-Column Split: Document Navigator + Markdown Reader */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Document List Sidebar (4 Cols) */}
        <div className="lg:col-span-4 space-y-2">
          {documents.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs border border-dashed border-studio-800 rounded-xl p-4">
              No documents match your query.
            </div>
          ) : (
            documents.map(doc => {
              const isSelected = selectedDoc?.id === doc.id;
              return (
                <div
                  key={doc.id}
                  onClick={() => loadDocumentDetail(doc.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-rose-950/20 border-rose-600/50 shadow-md'
                      : 'studio-card hover:border-studio-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-1">
                    <span className="text-rose-400/90">{doc.category}</span>
                    <span>v{doc.version}</span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-100 truncate">
                    {doc.title}
                  </h4>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
                    <span>By {doc.author_name}</span>
                    <span className="font-mono text-[10px]">{doc.updated_at ? doc.updated_at.slice(0, 10) : ''}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Document Reader / Details View (8 Cols) */}
        <div className="lg:col-span-8 studio-card p-6 min-h-[500px] flex flex-col justify-between">
          {selectedDoc ? (
            <div>
              {/* Doc Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-studio-800">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="rose" size="sm">{selectedDoc.category}</Badge>
                    <span className="text-xs text-slate-400 font-mono">v{selectedDoc.version}</span>
                    {selectedDoc.chapter_name && (
                      <span className="text-xs text-slate-400 font-mono">📍 {selectedDoc.chapter_name}</span>
                    )}
                  </div>
                  <h2 className="text-xl font-bold text-slate-100 mt-1">
                    {selectedDoc.title}
                  </h2>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Authored by <strong className="text-slate-300">{selectedDoc.author_name}</strong> • Last updated {selectedDoc.updated_at?.slice(0, 10)}
                  </div>
                </div>

                {canEdit && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={handleOpenEdit}
                      className="px-3 py-1.5 bg-studio-850 hover:bg-studio-800 border border-studio-750 text-slate-200 rounded-xl text-xs flex items-center gap-1.5"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>Edit & Revise</span>
                    </button>
                    {isAdmin && (
                      <button
                        onClick={handleDelete}
                        className="p-1.5 bg-rose-950/40 hover:bg-rose-950 text-rose-400 rounded-xl text-xs"
                        title="Delete Document"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Document Content (Rendered Markdown) */}
              <div className="py-6 text-sm text-slate-200 whitespace-pre-wrap leading-relaxed font-sans prose prose-invert max-w-none">
                {selectedDoc.content}
              </div>

              {/* Version History Table */}
              {selectedDoc.history && selectedDoc.history.length > 0 && (
                <div className="pt-6 border-t border-studio-800">
                  <h4 className="text-xs uppercase font-mono font-bold text-slate-400 flex items-center gap-1.5 mb-2">
                    <History className="w-3.5 h-3.5 text-rose-400" />
                    Revision History ({selectedDoc.history.length} versions)
                  </h4>
                  <div className="space-y-1.5">
                    {selectedDoc.history.map(h => (
                      <div
                        key={h.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-studio-850/60 border border-studio-800 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-rose-400 text-[11px]">v{h.version}</span>
                          <span className="text-slate-200">{h.summary || 'Revision'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400 text-[11px] font-mono">
                          <span>{h.changed_by}</span>
                          <span>•</span>
                          <span>{h.created_at ? h.created_at.slice(0, 10) : ''}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-xs">
              <BookOpen className="w-10 h-10 text-slate-600 mb-2" />
              <span>Select a document from the left column to read or edit.</span>
            </div>
          )}
        </div>
      </div>

      {/* CREATE / EDIT DOCUMENT MODAL */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={isEditing ? `Edit & Revise: ${activeDoc?.title}` : 'Create Internal Knowledge Base Document'}
        maxWidth="4xl"
      >
        <form onSubmit={handleSaveDocument} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-slate-400 mb-1 font-medium">Document Title *</label>
              <input
                type="text"
                required
                value={activeDoc?.title || ''}
                onChange={e => setActiveDoc({ ...activeDoc, title: e.target.value })}
                className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500 font-semibold"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Category</label>
              <select
                value={activeDoc?.category || 'Game Design & Systems'}
                onChange={e => setActiveDoc({ ...activeDoc, category: e.target.value })}
                className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-200 focus:outline-none focus:border-rose-500"
              >
                {CATEGORIES.filter(c => c !== 'All Categories').map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Related Chapter</label>
              <select
                value={activeDoc?.chapter_id || ''}
                onChange={e => setActiveDoc({ ...activeDoc, chapter_id: e.target.value || null })}
                className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-200 focus:outline-none focus:border-rose-500"
              >
                <option value="">None (Global Studio Doc)</option>
                {chapters.map(ch => (
                  <option key={ch.id} value={ch.id}>{ch.day_range} — {ch.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Revision Summary</label>
              <input
                type="text"
                value={editSummary}
                onChange={e => setEditSummary(e.target.value)}
                placeholder="e.g. Added URP low-end memory budget limits"
                className="w-full px-3 py-2 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Document Content (Markdown format supported) *</label>
            <textarea
              rows={14}
              required
              value={activeDoc?.content || ''}
              onChange={e => setActiveDoc({ ...activeDoc, content: e.target.value })}
              className="w-full px-3 py-2.5 bg-studio-850 border border-studio-750 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500 font-mono text-xs leading-relaxed"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-studio-800">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 bg-studio-800 text-slate-300 rounded-xl font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl"
            >
              Save Document & Version
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
