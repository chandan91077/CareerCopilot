import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, ShieldCheck, Sparkles, Terminal, FileText, 
  Mic, Play, Layout, Download, Keyboard, Lock, HelpCircle 
} from 'lucide-react';

export default function Landing() {
  const steps = [
    {
      num: '1',
      title: 'Analyze Resume ATS',
      desc: 'Upload your PDF resume and job description to compare ATS keywords and highlight critical skill gaps.',
      icon: <FileText className="w-6 h-6 text-indigo-400" />
    },
    {
      num: '2',
      title: 'Run AI Mock Session',
      desc: 'Simulate live interview environments using real-time Speech-to-Text voice transcription in your browser.',
      icon: <Mic className="w-6 h-6 text-purple-400" />
    },
    {
      num: '3',
      title: 'Solve Monaco Algorithms',
      desc: 'Write JavaScript and technical solutions inside our secure compilation sandbox editor.',
      icon: <Terminal className="w-6 h-6 text-emerald-400" />
    },
    {
      num: '4',
      title: 'Review Performance Reports',
      desc: 'Get granular feedback summaries structured by the STAR methodology detailing growth areas.',
      icon: <Layout className="w-6 h-6 text-amber-400" />
    }
  ];

  const features = [
    {
      title: 'ATS Matching Engine',
      desc: 'Compare target expectations against real job postings to align your profile formatting before submitting.',
      icon: <FileText className="w-5 h-5 text-indigo-400" />
    },
    {
      title: 'Low-latency Transcription',
      desc: 'Speak your answers aloud; our browser-native Web Speech system captures voice tracks with zero lag.',
      icon: <Mic className="w-5 h-5 text-purple-400" />
    },
    {
      title: 'Sandboxed VM Compiler',
      desc: 'Write, debug, and run algorithmic programs securely inside clean, isolated Node execution environments.',
      icon: <Terminal className="w-5 h-5 text-emerald-400" />
    },
    {
      title: 'STAR Coach Analytics',
      desc: 'Understand how complete your answers are with structural indicators across Situation, Task, Action, and Result.',
      icon: <Sparkles className="w-5 h-5 text-amber-400" />
    },
    {
      title: 'Enterprise Encryption',
      desc: 'Your profile, resume documents, and past recordings are safely encrypted and private to you.',
      icon: <Lock className="w-5 h-5 text-pink-400" />
    },
    {
      title: 'Premium Dark Design',
      desc: 'Work late acing interviews inside a custom, harmoneous, and visual dark-mode glassmorphic console.',
      icon: <ShieldCheck className="w-5 h-5 text-sky-400" />
    }
  ];

  const controls = [
    { key: 'Space', desc: 'Activate speech recording' },
    { key: 'Ctrl + Enter', desc: 'Compile Monaco editor code' },
    { key: 'Ctrl + [', desc: 'Move to previous question' },
    { key: 'Ctrl + ]', desc: 'Skip to next question' },
    { key: 'Esc', desc: 'Exit mock interview mode' }
  ];

  const pricingSteps = [
    {
      num: '1',
      title: 'Sign Up Free',
      desc: 'Get started in minutes. Receive 5 free mock sessions, resume ATS checks, and basic algorithmic tasks.'
    },
    {
      num: '2',
      title: 'Test Live Playground',
      desc: 'Experience voice interviews, coding playgrounds, and prompt modifiers with mock parameters.'
    },
    {
      num: '3',
      title: 'Cashfree Checkout',
      desc: 'Unlock unlimited questions, advanced evaluations, and TTS voice output with a secure local upgrade.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#09090b] text-slate-100 selection:bg-indigo-500/30 selection:text-indigo-200 overflow-x-hidden font-sans">
      
      {/* Floating Glass Navbar */}
      <header className="fixed top-5 left-1/2 -translate-x-1/2 w-[90%] max-w-6xl z-50">
        <div className="glass-panel border border-slate-800/80 rounded-full px-6 py-3 flex items-center justify-between backdrop-blur-md bg-zinc-950/70 shadow-lg shadow-black/40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-500/20">
              C
            </div>
            <span className="font-extrabold text-sm tracking-tight bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
              CareerCopilot
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-slate-400">
            <a href="#how-it-works" className="hover:text-indigo-400 transition-colors">How It Works</a>
            <a href="#features" className="hover:text-indigo-400 transition-colors">Features</a>
            <a href="#shortcuts" className="hover:text-indigo-400 transition-colors">Controls</a>
            <a href="#pricing" className="hover:text-indigo-400 transition-colors">Pricing</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/login" className="text-xs font-bold text-slate-300 hover:text-white transition-colors px-3 py-1.5">
              Log in
            </Link>
            <Link 
              to="/register" 
              className="text-xs font-bold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-4 py-2 rounded-full shadow-lg shadow-indigo-500/10 transition-all hover:scale-[1.03]"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-36 pb-20 px-6 max-w-6xl mx-auto text-center flex flex-col items-center justify-center min-h-[85vh]">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute top-1/3 left-1/3 w-[250px] h-[250px] bg-purple-500/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/5 text-indigo-400 text-[10px] font-bold tracking-wider uppercase mb-6 shadow-inner animate-pulse">
          <Sparkles className="w-3.5 h-3.5" /> Next-Gen AI Interview Preparation
        </div>

        <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[1.1] max-w-4xl bg-gradient-to-b from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
          Ace Technical & HR Interviews <br className="hidden md:inline" /> With Real-Time AI Feedback
        </h1>

        <p className="text-slate-400 text-sm md:text-base mt-6 max-w-2xl leading-relaxed">
          Unlock interactive mock interviews, sandboxed coding playgrounds, ATS resume skill checking, and behavioral grading configured for professional success.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 mt-10">
          <Link 
            to="/register" 
            className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold rounded-full shadow-xl shadow-indigo-500/20 transition-all hover:scale-[1.04] flex items-center justify-center gap-2 group text-sm cursor-pointer"
          >
            Start Preparing Now <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <a 
            href="#download" 
            className="w-full sm:w-auto px-8 py-4 bg-zinc-900 hover:bg-zinc-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-sm font-semibold rounded-full transition-all flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" /> Download Desktop App (.exe)
          </a>
        </div>
      </section>

      {/* Process Section (How It Works) */}
      <section id="how-it-works" className="py-24 px-6 max-w-6xl mx-auto border-t border-slate-900 relative">
        <div className="text-center max-w-xl mx-auto mb-16">
          <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-xs font-bold text-indigo-400">01</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Structured Preparation</h2>
          <p className="text-slate-500 text-xs mt-2">Get ready in minutes with our simple four-step analysis loop.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {steps.map((step) => (
            <div 
              key={step.num} 
              className="glass-panel border border-slate-850 hover:border-indigo-500/30 rounded-3xl p-6 bg-zinc-950/40 relative shadow-md transition-all hover:scale-[1.02]"
            >
              <div className="absolute -top-4 left-6 w-8 h-8 rounded-full bg-zinc-900 border border-slate-800 flex items-center justify-center font-bold text-xs text-slate-400">
                {step.num}
              </div>
              <div className="mb-6 mt-2 p-3 rounded-xl bg-zinc-900/60 w-fit border border-slate-800">
                {step.icon}
              </div>
              <h3 className="text-base font-bold text-slate-200 mb-2">{step.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Keyboard Shortcuts Section */}
      <section id="shortcuts" className="py-24 px-6 max-w-6xl mx-auto border-t border-slate-900">
        <div className="text-center max-w-xl mx-auto mb-16">
          <div className="w-8 h-8 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-4">
            <Keyboard className="w-4 h-4 text-purple-400" />
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Master the Controls</h2>
          <p className="text-slate-500 text-xs mt-2">Use built-in keyboard mappings during sessions for swift, seamless operations.</p>
        </div>

        <div className="flex flex-wrap justify-center gap-6 max-w-4xl mx-auto">
          {controls.map((ctrl) => (
            <div 
              key={ctrl.key} 
              className="glass-panel border border-slate-850 rounded-2xl px-6 py-5 bg-zinc-950/30 flex flex-col items-center justify-center min-w-[160px] flex-1 text-center"
            >
              <kbd className="px-3 py-1 rounded bg-zinc-900 border border-slate-800 text-[10px] font-mono text-indigo-400 font-extrabold tracking-wide mb-3 shadow-inner">
                {ctrl.key}
              </kbd>
              <span className="text-xs font-semibold text-slate-400">{ctrl.desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Features Grid Section */}
      <section id="features" className="py-24 px-6 max-w-6xl mx-auto border-t border-slate-900">
        <div className="text-center max-w-xl mx-auto mb-16">
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Premium Architecture</h2>
          <p className="text-slate-500 text-xs mt-2">Designed from the ground up for high fidelity, privacy, and visual appeal.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feat) => (
            <div 
              key={feat.title} 
              className="glass-panel border border-slate-850 hover:border-slate-800 rounded-3xl p-6 bg-zinc-950/20 shadow-md flex items-start gap-4"
            >
              <div className="p-3 rounded-xl bg-zinc-900 border border-slate-800 shrink-0">
                {feat.icon}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-200 mb-1">{feat.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{feat.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing / Trial Onboarding Flow */}
      <section id="pricing" className="py-24 px-6 max-w-6xl mx-auto border-t border-slate-900">
        <div className="text-center max-w-xl mx-auto mb-16">
          <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-xs font-bold text-amber-400">04</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Simple Transition</h2>
          <p className="text-slate-500 text-xs mt-2">Sign up, run tests in our sandbox playground, and upgrade whenever you are ready.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto relative">
          {pricingSteps.map((pStep) => (
            <div 
              key={pStep.num} 
              className="glass-panel border border-slate-850 rounded-3xl p-6 bg-zinc-950/40 relative flex flex-col justify-between"
            >
              <div>
                <div className="w-6 h-6 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center font-extrabold text-[10px] text-indigo-400 mb-4">
                  {pStep.num}
                </div>
                <h3 className="text-sm font-bold text-slate-200 mb-2">{pStep.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-6">{pStep.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link 
            to="/register" 
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-full text-xs transition-all hover:scale-[1.03]"
          >
            Access Free Trial <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Desktop App Download Prompt */}
      <section id="download" className="py-24 px-6 max-w-6xl mx-auto border-t border-slate-900 text-center relative overflow-hidden">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[350px] h-[350px] bg-purple-500/5 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-2xl mx-auto glass-panel border border-slate-800 rounded-3xl p-10 bg-zinc-950/40 relative shadow-2xl">
          <Download className="w-12 h-12 text-indigo-400 mx-auto mb-6" />
          <h2 className="text-xl md:text-2xl font-black tracking-tight">Prefer a Desktop Experience?</h2>
          <p className="text-slate-500 text-xs mt-3 max-w-md mx-auto leading-relaxed">
            Download the desktop client wrapper targeting Windows. Runs directly from your task tray with absolute convenience.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a 
              href="#" 
              onClick={(e) => {
                e.preventDefault();
                alert('The setup installation installer is available in the desktop folder distribution release structure: release/InterviewAISetup.exe');
              }}
              className="w-full sm:w-auto px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" /> Download Installer (.exe)
            </a>
            <span className="text-[10px] text-slate-500 font-mono">Compatible with Windows 10/11 x64</span>
          </div>
        </div>
      </section>

      {/* Simple Footer */}
      <footer className="py-12 border-t border-slate-900 text-center text-[10px] text-slate-500">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center font-bold text-indigo-400 text-xs">
              C
            </div>
            <span className="font-bold text-slate-400 tracking-tight">CareerCopilot</span>
          </div>
          <span>&copy; 2026 CareerCopilot AI Platform. All rights reserved.</span>
          <div className="flex gap-4">
            <a href="#" className="hover:underline">Privacy Policy</a>
            <a href="#" className="hover:underline">Terms of Service</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
