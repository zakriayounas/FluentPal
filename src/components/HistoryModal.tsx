import React from 'react';
import { X, History, Trash2, Calendar, Clock, Award, ChevronRight, MessageSquare } from 'lucide-react';
import { SavedSession, SessionReport } from '../types';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedSessions: SavedSession[];
  onSelectSession: (report: SessionReport) => void;
  onClearHistory: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  savedSessions,
  onSelectSession,
  onClearHistory,
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="history-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="history-modal-dialog"
        className="w-full max-w-xl max-h-[85vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Session History & Progress</h2>
              <p className="text-xs text-slate-400">Review your past conversations and CEFR assessments</p>
            </div>
          </div>
          <button
            id="close-history-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {savedSessions.length === 0 ? (
            <div className="py-14 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                <History className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-white">No Saved Sessions Yet</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Completed language sessions and their CEFR reports will be saved here automatically.
              </p>
            </div>
          ) : (
            savedSessions.map((session) => (
              <div
                key={session.id}
                id={`history-session-${session.id}`}
                onClick={() => {
                  onSelectSession(session.report);
                  onClose();
                }}
                className="p-4 rounded-xl border border-slate-800 bg-slate-800/40 hover:border-indigo-500/50 hover:bg-slate-800/80 transition-all cursor-pointer flex items-center justify-between group"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-white">{session.targetLanguage}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                      {session.level}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      {new Date(session.date).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      {Math.max(1, Math.round(session.durationSeconds / 60))} min
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                      {session.correctionsCount} recasts
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold text-sm flex items-center gap-1">
                    <Award className="w-4 h-4 text-emerald-400" />
                    {session.report?.estimatedCefrLevel || 'B1'}
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {savedSessions.length > 0 && (
          <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-800 bg-slate-900/90">
            <button
              id="clear-history-btn"
              onClick={onClearHistory}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear History
            </button>
            <button
              id="close-history-bottom-btn"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
