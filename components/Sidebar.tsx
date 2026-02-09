import React from 'react';
import { MessageSquarePlus, Download, GraduationCap, LayoutDashboard } from 'lucide-react';
import { ViewState } from '../types';

interface SidebarProps {
  onNewChat: () => void;
  onExport: () => void;
  currentView: ViewState;
  onViewChange: (view: ViewState) => void;
  isExporting: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  onNewChat, 
  onExport, 
  currentView, 
  onViewChange,
  isExporting,
}) => {
  return (
    <aside className="w-20 md:w-64 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 flex flex-col h-screen transition-all duration-300 border-r border-slate-200 dark:border-slate-800 shrink-0">
      <div className="p-4 flex items-center justify-center md:justify-start gap-2 border-b border-slate-200 dark:border-slate-800 h-16">
        <GraduationCap className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
        <span className="hidden md:block font-bold text-lg text-slate-800 dark:text-indigo-100 tracking-tight">Learning Oracle</span>
      </div>

      <nav className="flex-1 p-4 space-y-4 overflow-y-auto">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center md:justify-start gap-3 p-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-md hover:shadow-lg"
          title="New Chat"
        >
          <MessageSquarePlus className="w-5 h-5" />
          <span className="hidden md:block font-medium">New Session</span>
        </button>

        <div className="border-t border-slate-200 dark:border-slate-800 my-4"></div>

        <button
          onClick={() => onViewChange(ViewState.CHAT)}
          className={`w-full flex items-center justify-center md:justify-start gap-3 p-3 rounded-lg transition-colors ${
            currentView === ViewState.CHAT 
              ? 'bg-indigo-100 dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 font-medium' 
              : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="hidden md:block">Chat Interface</span>
        </button>

        <button
          onClick={() => onViewChange(ViewState.QUIZ)}
          className={`w-full flex items-center justify-center md:justify-start gap-3 p-3 rounded-lg transition-colors ${
            currentView === ViewState.QUIZ 
              ? 'bg-indigo-100 dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 font-medium' 
              : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
          }`}
        >
          <GraduationCap className="w-5 h-5" />
          <span className="hidden md:block">Mastery Check</span>
        </button>

        <button
          onClick={onExport}
          disabled={isExporting}
          className="w-full flex items-center justify-center md:justify-start gap-3 p-3 rounded-lg hover:bg-emerald-50 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-400 transition-colors"
          title="Export Summary"
        >
          {isExporting ? (
            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <Download className="w-5 h-5" />
          )}
          <span className="hidden md:block">Export Summary</span>
        </button>
      </nav>

      <div className="p-4 text-xs text-slate-400 dark:text-slate-500 text-center md:text-left border-t border-slate-200 dark:border-slate-800">
        <span className="hidden md:inline">Powered by Gemini AI</span>
      </div>
    </aside>
  );
};

export default Sidebar;