import type { DeptState } from "./OfficeRoomManagerTheme";
import {
  labels,
  numToHex,
  hexToNum,
  deriveTheme,
  generateTonePresets,
} from "./OfficeRoomManagerTheme";

export interface OfficeRoomManagerDeptCardProps {
  deptId: string;
  deptName: string;
  state: DeptState;
  language: "ko" | "en";
  onActivate: () => void;
  onAccentChange: (accent: number) => void;
  onToneChange: (tone: number) => void;
  onReset: () => void;
}

export default function OfficeRoomManagerDeptCard({
  deptId,
  deptName,
  state,
  language,
  onActivate,
  onAccentChange,
  onToneChange,
  onReset,
}: OfficeRoomManagerDeptCardProps) {
  const theme = deriveTheme(state.accent, state.tone);
  const presets = generateTonePresets(state.accent);

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-100">{deptName}</span>
        <button
          onClick={() => {
            onActivate();
            onReset();
          }}
          className="text-xs text-slate-400 hover:text-slate-200 px-2 py-0.5 rounded border border-slate-600 hover:border-slate-400 transition-colors"
        >
          {labels.reset[language]}
        </button>
      </div>

      <div className="flex gap-1 h-6 rounded overflow-hidden border border-slate-600">
        <div className="flex-1" style={{ backgroundColor: numToHex(theme.floor1) }} />
        <div className="flex-1" style={{ backgroundColor: numToHex(theme.floor2) }} />
        <div className="flex-1" style={{ backgroundColor: numToHex(theme.wall) }} />
        <div className="w-6 flex-none" style={{ backgroundColor: numToHex(theme.accent) }} />
      </div>

      <div className="space-y-1">
        <span className="text-xs text-slate-400">{labels.presets[language]}</span>
        <div className="flex gap-1.5 flex-wrap">
          {presets.map((preset) => (
            <button
              key={preset.tone}
              onClick={() => {
                onActivate();
                onToneChange(preset.tone);
              }}
              title={`Tone ${preset.tone}`}
              className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none"
              style={{
                backgroundColor: numToHex(preset.swatch),
                borderColor: Math.abs(state.tone - preset.tone) <= 2 ? "#fff" : "transparent",
              }}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-xs text-slate-400 w-20 shrink-0">{labels.accent[language]}</label>
        <input
          type="color"
          value={numToHex(state.accent)}
          onChange={(e) => {
            onActivate();
            onAccentChange(hexToNum(e.target.value));
          }}
          onInput={(e) => {
            onActivate();
            onAccentChange(hexToNum((e.target as HTMLInputElement).value));
          }}
          className="w-8 h-8 rounded cursor-pointer border border-slate-600 bg-transparent p-0"
        />
        <span className="text-xs text-slate-500 font-mono">{numToHex(state.accent)}</span>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-xs text-slate-400">{labels.tone[language]}</label>
          <span className="text-xs text-slate-500">{state.tone}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Light</span>
          <input
            type="range"
            min={0}
            max={100}
            value={state.tone}
            onChange={(e) => {
              onActivate();
              onToneChange(Number(e.target.value));
            }}
            onInput={(e) => {
              onActivate();
              onToneChange(Number((e.target as HTMLInputElement).value));
            }}
            className="flex-1 accent-slate-400 h-1.5 cursor-pointer"
          />
          <span className="text-xs text-slate-500">Dark</span>
        </div>
      </div>
    </div>
  );
}
