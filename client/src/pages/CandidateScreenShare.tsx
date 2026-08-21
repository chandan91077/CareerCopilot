import React from 'react';
import { Monitor, Info, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function CandidateScreenShare() {
  return (
    <div className="max-w-3xl mx-auto space-y-8 py-10">
      <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-500">
          <Monitor className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
            Candidate Screen Sharing
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Screen sharing is managed directly inside the <strong>PrepAI Desktop Overlay</strong> window to ensure smooth background operation and overlay privacy.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-slate-800 text-left text-xs text-slate-600 dark:text-slate-400 space-y-2">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold">
            <Info className="w-4 h-4" />
            Quick Instructions
          </div>
          <ul className="list-disc pl-5 space-y-1">
            <li>Open the <strong>PrepAI Desktop App</strong> and click <strong>[ Screen Share ]</strong> in the top toolbar.</li>
            <li>Click <strong>[ Start Screen Sharing ]</strong> inside the overlay to generate your Session ID and Temporary Password.</li>
            <li>Evaluators can watch your stream by navigating to <strong>Watch Stream</strong>.</li>
          </ul>
        </div>

        <div className="pt-2 flex justify-center">
          <Link
            to="/screen-share/view"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-md transition-all"
          >
            Go to Watch Stream (/screen-share/view)
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
