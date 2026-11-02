import React, { useState, useEffect } from 'react';
import { X, Coins, Link2, Sparkles } from 'lucide-react';
import { DebtCategory, CauseNode, Incident } from '../types';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { sanitizeInput, safeNumeric } from '../utils/security';

interface DebtModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  projectId: number;
  initialData?: {
    title?: string;
    description?: string;
    category?: DebtCategory;
    module_name?: string;
    effort_principal?: number;
    root_cause_id?: number;
    linked_incident_id?: number;
  } | null;
}

export const DebtModal: React.FC<DebtModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  projectId,
  initialData
}) => {
  const { showToast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<DebtCategory>('ARCHITECTURAL');
  const [module, setModule] = useState('database');
  const [filePath, setFilePath] = useState('');
  const [principal, setPrincipal] = useState(12.0);
  const [assignee, setAssignee] = useState('Sushma Patil');
  const [selectedCauseId, setSelectedCauseId] = useState<number | undefined>(undefined);
  const [selectedIncidentId, setSelectedIncidentId] = useState<number | undefined>(undefined);
  const [causes, setCauses] = useState<CauseNode[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setTitle(initialData.title || '');
        setDescription(initialData.description || '');
        setCategory(initialData.category || 'ARCHITECTURAL');
        setModule(initialData.module_name || 'database');
        setPrincipal(initialData.effort_principal || 12.0);
        setSelectedCauseId(initialData.root_cause_id);
        setSelectedIncidentId(initialData.linked_incident_id);
      } else {
        setTitle('');
        setDescription('');
        setCategory('ARCHITECTURAL');
        setModule('database');
        setPrincipal(12.0);
        setSelectedCauseId(undefined);
        setSelectedIncidentId(undefined);
      }

      // Fetch causes & incidents for dropdown linking
      api.getCauseNodes(projectId).then(setCauses).catch(console.error);
      api.getIncidents(projectId).then(setIncidents).catch(console.error);
    }
  }, [isOpen, initialData, projectId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !module) {
      showToast('error', 'Missing Information', 'Please provide a title, description, and module.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: any = {
        project_id: projectId,
        title: sanitizeInput(title, 200),
        description: sanitizeInput(description, 1000),
        category,
        module_name: sanitizeInput(module, 50).toLowerCase(),
        file_path: sanitizeInput(filePath, 250),
        effort_principal: safeNumeric(principal, 8.0, 0.5, 500),
        assignee: sanitizeInput(assignee, 100) || 'Unassigned',
        root_cause_id: selectedCauseId || null,
        linked_incident_ids: selectedIncidentId ? [selectedIncidentId] : []
      };

      await onSubmit(payload);
      showToast('success', 'Debt Item Registered', 'Added to financial ledger with dynamic interest pricing.');
      onClose();
    } catch (err) {
      console.error(err);
      showToast('error', 'Registration Failed', 'Could not register debt item.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-[#FAF8F5] rounded-md border border-[#EADBCE] shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">

        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E5DFD5] flex items-center justify-between bg-white">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-md bg-[#F0F4FA] text-[#0C1A2E] border border-[#CBD8E8]">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-950">Register Technical Debt Item</h3>
              <p className="text-xs text-stone-500">Record structural compromise, principal effort, and architectural module</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-slate-950 p-1 rounded-md hover:bg-[#F4EFE6] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Debt Item Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Refactor Connection Pool to HikariCP with Dynamic Backpressure"
              className="w-full px-3 py-2 text-xs rounded-md border border-[#E5DFD5] focus:outline-hidden focus:ring-1 focus:ring-[#0C1A2E] bg-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Debt Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as DebtCategory)}
                className="w-full px-3 py-2 text-xs rounded-md border border-[#E5DFD5] focus:outline-hidden focus:ring-1 focus:ring-[#0C1A2E] bg-white cursor-pointer"
              >
                <option value="ARCHITECTURAL">ARCHITECTURAL</option>
                <option value="CODE_SMELL">CODE_SMELL</option>
                <option value="INFRASTRUCTURE">INFRASTRUCTURE</option>
                <option value="TEST_DEBT">TEST_DEBT</option>
                <option value="SECURITY_DEBT">SECURITY_DEBT</option>
                <option value="DOCUMENTATION">DOCUMENTATION</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Affected Module <span className="text-rose-500">*</span>
              </label>
              <select
                value={module}
                onChange={(e) => setModule(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-md border border-[#E5DFD5] focus:outline-hidden focus:ring-1 focus:ring-[#0C1A2E] bg-white cursor-pointer"
              >
                <option value="database">database</option>
                <option value="payments">payments</option>
                <option value="orders">orders</option>
                <option value="settlement">settlement</option>
                <option value="auth">auth</option>
                <option value="checkout">checkout</option>
                <option value="notification">notification</option>
                <option value="inventory">inventory</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Effort Principal P(d) (Hours) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                required
                value={principal}
                onChange={(e) => setPrincipal(parseFloat(e.target.value) || 1)}
                className="w-full px-3 py-2 text-xs rounded-md border border-[#E5DFD5] focus:outline-hidden focus:ring-1 focus:ring-[#0C1A2E] bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Assignee Lead
              </label>
              <input
                type="text"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="Assignee developer..."
                className="w-full px-3 py-2 text-xs rounded-md border border-[#E5DFD5] focus:outline-hidden focus:ring-1 focus:ring-[#0C1A2E] bg-white"
              />
            </div>
          </div>

          {/* Direct Causal & Incident Linkage Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
                <Link2 className="w-3 h-3 text-[#0C1A2E]" />
                <span>Link Systemic Root Cause</span>
              </label>
              <select
                value={selectedCauseId || ''}
                onChange={(e) => setSelectedCauseId(e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-full px-3 py-1.5 text-xs rounded-md border border-[#E5DFD5] bg-white cursor-pointer"
              >
                <option value="">None (Unlinked)</option>
                {causes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.description.length > 40 ? c.description.substring(0, 38) + '...' : c.description}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
                <Link2 className="w-3 h-3 text-[#0C1A2E]" />
                <span>Link Tracing Incident</span>
              </label>
              <select
                value={selectedIncidentId || ''}
                onChange={(e) => setSelectedIncidentId(e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-full px-3 py-1.5 text-xs rounded-md border border-[#E5DFD5] bg-white cursor-pointer"
              >
                <option value="">None (Independent)</option>
                {incidents.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.incident_number}: {i.title.length > 30 ? i.title.substring(0, 28) + '...' : i.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              File Path (Optional)
            </label>
            <input
              type="text"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              placeholder="e.g. database/connection_pool.py"
              className="w-full px-3 py-2 text-xs rounded-md border border-[#E5DFD5] focus:outline-hidden focus:ring-1 focus:ring-[#0C1A2E] bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Remediation Scope & Technical Details <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the structural compromise, corrective architecture refactoring, and acceptance criteria..."
              className="w-full px-3 py-2 text-xs rounded-md border border-[#E5DFD5] focus:outline-hidden focus:ring-1 focus:ring-[#0C1A2E] bg-white"
            />
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-[#E5DFD5] flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md text-xs font-medium text-stone-700 hover:bg-[#F4EFE6] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-md text-xs font-bold bg-[#0C1A2E] hover:bg-[#142B4B] text-white shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Registering...' : 'Register Debt Item'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
