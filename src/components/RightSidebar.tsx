import React, { useEffect, useRef } from "react";
import { TechniqueFeedback, AnalyticsData, ExerciseType } from "../types";
import { EXERCISE_DEFINITIONS } from "../exercises";
import { CheckCircle2, AlertTriangle, XCircle, Info, TrendingUp, Sparkles, HelpCircle } from "lucide-react";

interface RightSidebarProps {
  currentExercise: ExerciseType;
  feedback: TechniqueFeedback;
  todayReps: number;
  analytics: AnalyticsData | null;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  currentExercise,
  feedback,
  todayReps,
  analytics,
}) => {
  const weekCanvasRef = useRef<HTMLCanvasElement>(null);
  const currentMeta = EXERCISE_DEFINITIONS[currentExercise] || EXERCISE_DEFINITIONS.squat;

  // Draw 7-day bar chart
  useEffect(() => {
    const canvas = weekCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    const days = analytics?.last7Days || [];
    const barCount = 7;
    const barWidth = w / barCount;

    // If no backend data yet, show 7 empty days with days of week
    const now = new Date();
    const dayLabels: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dayLabels.push(d.toLocaleDateString("en-US", { weekday: "short" })[0]);
    }

    for (let i = 0; i < barCount; i++) {
      const dayData = days[i];
      const avgScore = dayData?.avgScore || 0;
      const isToday = i === barCount - 1;
      const maxH = h - 22;
      const bh = Math.max(3, (avgScore / 100) * maxH);

      // Bar fill
      if (avgScore > 0) {
        ctx.fillStyle = isToday ? "#35d0e8" : "rgba(157, 179, 194, 0.45)";
      } else {
        ctx.fillStyle = "rgba(26, 52, 72, 0.5)";
      }

      ctx.beginPath();
      const x = i * barWidth + 5;
      const y = h - 18 - bh;
      const bw = barWidth - 10;
      ctx.roundRect ? ctx.roundRect(x, y, bw, bh, 3) : ctx.rect(x, y, bw, bh);
      ctx.fill();

      // Day label
      ctx.fillStyle = isToday ? "#35d0e8" : "#5c7a8e";
      ctx.font = "10px 'Inter', sans-serif";
      ctx.textAlign = "center";
      const lbl = dayData?.dayLabel?.[0] || dayLabels[i] || "";
      ctx.fillText(lbl, i * barWidth + barWidth / 2, h - 4);
    }
  }, [analytics]);

  const renderStatusIcon = (status: "neutral" | "good" | "warn" | "bad") => {
    switch (status) {
      case "good":
        return <CheckCircle2 className="w-3.5 h-3.5 text-[#3ddc97] shrink-0" />;
      case "warn":
        return <AlertTriangle className="w-3.5 h-3.5 text-[#f5a83c] shrink-0" />;
      case "bad":
        return <XCircle className="w-3.5 h-3.5 text-[#ef6461] shrink-0" />;
      default:
        return <Info className="w-3.5 h-3.5 text-[#5c7a8e] shrink-0" />;
    }
  };

  const getStatusColor = (status: "neutral" | "good" | "warn" | "bad") => {
    switch (status) {
      case "good":
        return "text-[#3ddc97]";
      case "warn":
        return "text-[#f5a83c]";
      case "bad":
        return "text-[#ef6461]";
      default:
        return "text-[#9db3c2]";
    }
  };

  const getFeedbackLabels = (ex: ExerciseType) => {
    switch (ex) {
      case "pull_up":
        return {
          slot1: "Chin Clearance",
          slot2: "Dead Hang Extension",
          slot3: "Body Swing / Kipping",
          slot4: "Live Elbow Angle",
        };
      case "push_up":
        return {
          slot1: "Chest Depth (≤90°)",
          slot2: "Top Arm Lockout",
          slot3: "Plank / Spine Alignment",
          slot4: "Live Elbow Angle",
        };
      case "jump":
        return {
          slot1: "Jump State & Height",
          slot2: "Landing Shock Absorption",
          slot3: "Arm Reach & Cadence",
          slot4: "Live Elevation Lift",
        };
      case "squat":
      default:
        return {
          slot1: "Hip / Squat Depth (≤100°)",
          slot2: "Knee Alignment (Valgus)",
          slot3: "Core / Torso Stability",
          slot4: "Live Knee Angle",
        };
    }
  };

  const labels = getFeedbackLabels(currentExercise);

  return (
    <aside className="flex flex-col gap-3.5 min-h-0 overflow-y-auto pl-1">
      {/* Real-time Technique Feedback Panel */}
      <div className="bg-[#0e1f2e] border border-[#1a3448] rounded-xl p-4 shadow-sm">
        <h2 className="font-display text-xs font-semibold text-[#35d0e8] tracking-widest uppercase mb-3 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#35d0e8] shadow-[0_0_6px_#35d0e8]" />
          Technique Feedback
        </h2>

        <div className="space-y-2">
          {/* Primary Biomechanics Slot */}
          <div className="py-1.5 border-b border-[#1a3448]">
            <div className="text-[11px] font-semibold text-[#5c7a8e] tracking-wider uppercase">
              {labels.slot1}
            </div>
            <div className={`text-xs font-semibold mt-1 flex items-center gap-1.5 ${getStatusColor(feedback.depth.status)}`}>
              {renderStatusIcon(feedback.depth.status)}
              <span>{feedback.depth.text}</span>
            </div>
          </div>

          {/* Secondary Joint Alignment Slot */}
          <div className="py-1.5 border-b border-[#1a3448]">
            <div className="text-[11px] font-semibold text-[#5c7a8e] tracking-wider uppercase">
              {labels.slot2}
            </div>
            <div className={`text-xs font-semibold mt-1 flex items-center gap-1.5 ${getStatusColor(feedback.knee.status)}`}>
              {renderStatusIcon(feedback.knee.status)}
              <span>{feedback.knee.text}</span>
            </div>
          </div>

          {/* Core / Torso / Stability Slot */}
          <div className="py-1.5 border-b border-[#1a3448]">
            <div className="text-[11px] font-semibold text-[#5c7a8e] tracking-wider uppercase">
              {labels.slot3}
            </div>
            <div className={`text-xs font-semibold mt-1 flex items-center gap-1.5 ${getStatusColor(feedback.core.status)}`}>
              {renderStatusIcon(feedback.core.status)}
              <span>{feedback.core.text}</span>
            </div>
          </div>

          {/* Live Joint Measurement Slot */}
          <div className="pt-1.5">
            <div className="text-[11px] font-semibold text-[#5c7a8e] tracking-wider uppercase">
              {labels.slot4}
            </div>
            <div className="font-display text-base font-bold text-[#eaf3fa] mt-0.5">
              {feedback.angle.text}
            </div>
          </div>
        </div>
      </div>

      {/* Exercise Biomechanics Form Checklist */}
      <div className="bg-[#0e1f2e] border border-[#1a3448] rounded-xl p-4 shadow-sm">
        <h2 className="font-display text-xs font-semibold text-[#35d0e8] tracking-widest uppercase mb-2 flex items-center gap-2">
          <HelpCircle className="w-3.5 h-3.5 text-[#35d0e8]" />
          Form Execution Guide
        </h2>

        <ul className="space-y-1.5 text-[11px] text-[#9db3c2] leading-relaxed">
          {currentMeta.guidelines.map((guide, idx) => (
            <li key={idx} className="flex items-start gap-1.5">
              <span className="text-[#35d0e8] font-bold">•</span>
              <span>{guide}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Progress & 7-Day History Panel */}
      <div className="bg-[#0e1f2e] border border-[#1a3448] rounded-xl p-4 shadow-sm">
        <h2 className="font-display text-xs font-semibold text-[#35d0e8] tracking-widest uppercase mb-3 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#35d0e8] shadow-[0_0_6px_#35d0e8]" />
          Progress & Trends
        </h2>

        <div className="flex items-baseline justify-between mb-3 pb-2 border-b border-[#1a3448]">
          <span className="font-display text-3xl font-bold text-[#eaf3fa] tracking-tight">
            {todayReps}
          </span>
          <span className="text-xs text-[#9db3c2] flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-[#35d0e8]" />
            reps today
          </span>
        </div>

        <div className="text-[10px] font-semibold text-[#5c7a8e] uppercase tracking-wider mb-1 flex items-center justify-between">
          <span>Last 7 Days · Avg Score</span>
          <span className="font-mono text-[#35d0e8]">MongoDB</span>
        </div>

        <div className="w-full h-20 mt-1 bg-[#091522] rounded-lg p-2 border border-[#1a3448]">
          <canvas ref={weekCanvasRef} className="w-full h-full block" />
        </div>
      </div>
    </aside>
  );
};
