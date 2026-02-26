import { useEffect, useState } from 'react';
import { FileText, Bot, Sparkles } from 'lucide-react';

interface Props {
  skillName: string;
  provider: string;
  onClose: () => void;
}

/** CLI provider → Tailwind dot color (기획서 Phase 4: 이모지 → CSS) */
const PROVIDER_DOT_CLASS: Record<string, string> = {
  claude: 'bg-violet-500',
  codex: 'bg-emerald-500',
  gemini: 'bg-blue-500',
  opencode: 'bg-slate-300',
  copilot: 'bg-amber-500',
  antigravity: 'bg-pink-500',
  api: 'bg-slate-400',
};

export default function ClassroomTrainingAnimation({ skillName, provider, onClose }: Props) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 600);
    const t2 = setTimeout(() => setPhase(2), 1500);
    const t3 = setTimeout(() => setPhase(3), 2800);
    const t4 = setTimeout(onClose, 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-md"
      onClick={onClose}
      style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes chalkWrite { from { width: 0; } to { width: 100%; } }
        @keyframes bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes sparkle { 0%,100% { opacity: 0; transform: scale(0); } 50% { opacity: 1; transform: scale(1); } }
      `}</style>

      <div className="w-[min(600px,90vw)] text-center" style={{ animation: 'slideUp 0.5s ease-out' }}>
        {/* Chalkboard */}
        <div className="relative rounded-xl border-4 border-amber-800 bg-emerald-900 p-8 shadow-2xl">
          {/* Chalk tray */}
          <div className="absolute -bottom-3 left-1/4 right-1/4 h-3 rounded-b bg-amber-700" />

          {/* Teacher (mascot) — Bot icon replaces emoji */}
          <div className="mb-4 flex justify-center" style={{ animation: phase >= 0 ? 'bounce 1s ease-in-out infinite' : '' }}>
            <Bot width={40} height={40} className="text-emerald-300" aria-hidden />
          </div>
          <p className="mb-2 text-xs text-emerald-300/70">HyperClaw Academy</p>

          {/* Chalkboard text */}
          <div className="mb-6 overflow-hidden">
            {phase >= 1 && (
              <p className="flex items-center justify-center gap-2 font-mono text-lg text-white" style={{ animation: 'chalkWrite 0.8s ease-out' }}>
                <FileText width={20} height={20} className="shrink-0" aria-hidden />
                <span>{skillName}</span>
              </p>
            )}
          </div>

          {/* Student (CLI agent) — CSS dot + Bot fallback */}
          <div className="flex items-center justify-center gap-3">
            {phase >= 2 && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-700 bg-emerald-800/50 px-4 py-2" style={{ animation: 'slideUp 0.5s ease-out' }}>
                {PROVIDER_DOT_CLASS[provider] ? (
                  <span className={`h-6 w-6 shrink-0 rounded-full ${PROVIDER_DOT_CLASS[provider]}`} aria-hidden />
                ) : (
                  <Bot width={24} height={24} className="shrink-0 text-slate-400" aria-hidden />
                )}
                <div className="text-left">
                  <p className="text-xs font-medium text-white">{provider} agent</p>
                  <p className="text-[10px] text-emerald-300">Learning...</p>
                </div>
              </div>
            )}
          </div>

          {/* Completion sparkles — Sparkles icon replaces emoji */}
          {phase >= 3 && (
            <div className="mt-4 relative">
              <p className="flex items-center justify-center gap-2 text-sm font-bold text-yellow-300" style={{ animation: 'slideUp 0.3s ease-out' }}>
                <Sparkles width={16} height={16} className="shrink-0" aria-hidden />
                Training Complete!
                <Sparkles width={16} height={16} className="shrink-0" aria-hidden />
              </p>
              {[...Array(5)].map((_, i) => (
                <span key={i} className="absolute pointer-events-none" style={{
                  top: `${20 + (i * 15)}%`,
                  left: `${15 + (i * 18)}%`,
                  animation: `sparkle ${0.5 + (i * 0.1)}s ease-in-out ${i * 0.1}s infinite`,
                }}>
                  <Sparkles width={14} height={14} className="text-yellow-300/90" aria-hidden />
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
