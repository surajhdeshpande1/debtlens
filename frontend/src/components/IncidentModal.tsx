import React, { useState } from 'react';
import { X, AlertCircle, Sparkles, HelpCircle } from 'lucide-react';
import { FiveWhysStep, IncidentSeverity } from '../types';
import { useToast } from '../context/ToastContext';

interface IncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  projectId: number;
}

export const IncidentModal: React.FC<IncidentModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  projectId
}) => {
  const { showToast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<IncidentSeverity>('MEDIUM');
  const [module, setModule] = useState('payments');
  const [component, setComponent] = useState('');
  const [effort, setEffort] = useState(4.0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Guided 5-Whys
  const [showFiveWhys, setShowFiveWhys] = useState(false);
  const [fiveWhys, setFiveWhys] = useState<FiveWhysStep[]>([
    { step: 1, question: 'Why did the service fail or degrade?', cause: '', category: 'INCIDENT_SYMPTOM' },
    { step: 2, question: 'Why did that condition occur?', cause: '', category: 'CODE_LOGIC' },
    { step: 3, question: 'Why was that behaviour not handled?', cause: '', category: 'ARCHITECTURE' },
    { step: 4, question: 'Why did the architecture permit this flaw?', cause: '', category: 'SYSTEMIC' },
    { step: 5, question: 'Why does the fundamental root cause persist?', cause: '', category: 'ROOT_CAUSE' }
  ]);

  if (!isOpen) return null;

  const handleWhyChange = (index: number, text: string) => {
    const updated = [...fiveWhys];
    updated[index].cause = text;
    setFiveWhys(updated);
  };

  const handleLoadSample = () => {
    setTitle('Kafka Message Consumer Backpressure Stall in Notification Hub');
    setDescription('Consumer group fell 45,000 messages behind SLA during peak evening notification push. Worker threads blocked indefinitely waiting for downstream webhook replies.');
    setSeverity('HIGH');
    setModule('notification');
    setComponent('Webhook Dispatcher');
    setEffort(8.0);
    setShowFiveWhys(true);
    setFiveWhys([
      { step: 1, question: 'Why did the service fail or degrade?', cause: 'Inbound message consumers exhausted memory pool and stalled.', category: 'PERFORMANCE' },
      { step: 2, question: 'Why did that condition occur?', cause: 'Worker threads were synchronously waiting on slow third-party webhook endpoints.', category: 'NETWORK' },
      { step: 3, question: 'Why was that behaviour not handled?', cause: 'Synchronous blocking HTTP calls executed directly inside async processing loop.', category: 'PERFORMANCE' },
      { step: 4, question: 'Why did the architecture permit this flaw?', cause: 'Missing circuit breaker and asynchronous decoupled queue.', category: 'ARCHITECTURE' },
      { step: 5, question: 'Why does the fundamental root cause persist?', cause: 'Database Connection Pool Exhaustion under Unbounded Waiting', category: 'DATABASE' }
    ]);
    showToast('info', 'Sample Incident Loaded', 'Click Register to submit and update causal network.');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !module) {
      showToast('error', 'Missing Information', 'Please fill in title, description, and module.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: any = {
        project_id: projectId,
        title,
        description,
        severity,
        affected_module: module,
        affected_component: component,
        resolution_effort_hours: effort,
      };

      if (showFiveWhys) {
        payload.five_whys = fiveWhys.filter(w => w.cause.trim() !== '');
      }

      await onSubmit(payload);
      showToast('success', 'Incident Registered', `Recorded and linked to causal analysis engine.`);
      onClose();
    } catch (err) {
      console.error(err);
      showToast('error', 'Submission Failed', 'Could not save incident. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Report Production Incident</h3>
              <p className="text-xs text-slate-500">Capture symptoms, affected module, and guided 5-Whys root cause</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleLoadSample}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors cursor-pointer"
              title="Populate with realistic sample incident and 5-Whys"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Fill Sample</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Incident Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Stripe Webhook Gateway Timeout during Cyber Monday Spike"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Severity Level
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white cursor-pointer"
              >
                <option value="CRITICAL">CRITICAL (3.5x Multiplier)</option>
                <option value="HIGH">HIGH (2.5x Multiplier)</option>
                <option value="MEDIUM">MEDIUM (1.5x Multiplier)</option>
                <option value="LOW">LOW (1.0x Multiplier)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Affected Module <span className="text-rose-500">*</span>
              </label>
              <select
                value={module}
                onChange={(e) => setModule(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white cursor-pointer"
              >
                <option value="payments">payments</option>
                <option value="database">database</option>
                <option value="orders">orders</option>
                <option value="settlement">settlement</option>
                <option value="auth">auth</option>
                <option value="checkout">checkout</option>
                <option value="notification">notification</option>
                <option value="inventory">inventory</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Resolution Effort (Hours)
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={effort}
                onChange={(e) => setEffort(parseFloat(e.target.value) || 1)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Incident Description & Evidence <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detail the failure symptoms, stack trace, error logs, and impact..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
            />
          </div>

          {/* Guided 5-Whys Toggle */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-bold text-slate-900">Guided 5-Whys Root Cause Chain</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-indigo-50 text-indigo-700 font-semibold font-mono">Stage 2 Causality</span>
              </div>
              <button
                type="button"
                onClick={() => setShowFiveWhys(!showFiveWhys)}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium cursor-pointer"
              >
                {showFiveWhys ? 'Collapse 5-Whys' : '+ Expand Guided 5-Whys'}
              </button>
            </div>

            {showFiveWhys && (
              <div className="space-y-2.5 p-3.5 bg-slate-50 rounded-xl border border-slate-200 animate-in fade-in duration-150">
                {fiveWhys.map((w, idx) => (
                  <div key={w.step} className="space-y-1">
                    <label className="block text-[11px] font-medium text-slate-600">
                      <span className="font-bold text-indigo-600">Why #{w.step}:</span> {w.question}
                    </label>
                    <input
                      type="text"
                      value={w.cause}
                      onChange={(e) => handleWhyChange(idx, e.target.value)}
                      placeholder={`State cause for why level ${w.step}...`}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Recording...' : 'Register Incident & Causal Chain'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
