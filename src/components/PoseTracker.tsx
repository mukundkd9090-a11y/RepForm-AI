import React, { useRef, useEffect, useState, useCallback } from "react";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { PoseSignals, TechniqueFeedback, ExerciseType } from "../types";
import { createExerciseEngine, ExerciseEngine, EXERCISE_DEFINITIONS } from "../exercises";
import { Camera, RefreshCw, AlertTriangle, VideoOff, Activity, TrendingUp, Flame, Zap } from "lucide-react";

interface PoseTrackerProps {
  currentExercise: ExerciseType;
  onRepComplete: (score: number, minPrimaryAngle: number, flags: Record<string, any>) => void;
  onSignalsUpdate: (signals: PoseSignals) => void;
  onFeedbackUpdate: (feedback: TechniqueFeedback) => void;
  repScores: number[];
  onResetSession: () => void;
}

export const PoseTracker: React.FC<PoseTrackerProps> = ({
  currentExercise,
  onRepComplete,
  onSignalsUpdate,
  onFeedbackUpdate,
  repScores,
  onResetSession,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const videoWrapRef = useRef<HTMLDivElement>(null);

  // Mini graphs canvas refs
  const angleGraphRef = useRef<HTMLCanvasElement>(null);
  const repGraphRef = useRef<HTMLCanvasElement>(null);
  const accGraphRef = useRef<HTMLCanvasElement>(null);

  const [isRunning, setIsRunning] = useState(false);
  const [loadingModel, setLoadingModel] = useState(false);
  const [statusKind, setStatusKind] = useState<"on" | "warn" | "loading">("warn");
  const [statusMsg, setStatusMsg] = useState("Camera is off");
  const [modelLoaded, setModelLoaded] = useState(false);

  // Exercise Engine instance
  const engineRef = useRef<ExerciseEngine>(createExerciseEngine(currentExercise));
  const angleHistoryRef = useRef<{ t: number; value: number }[]>([]);
  const currentPrimaryValueRef = useRef<number | null>(null);

  // Switch engine on exercise change
  useEffect(() => {
    engineRef.current = createExerciseEngine(currentExercise);
    angleHistoryRef.current = [];
    currentPrimaryValueRef.current = null;
  }, [currentExercise]);

  // State refs for animation loop
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);

  // Drawing overlay skeleton and keypoints
  const renderOverlay = (landmarks: any[]) => {
    const canvas = overlayRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!landmarks || landmarks.length === 0) return;

    const lm = landmarks[0];
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    const cw = canvas.width;
    const ch = canvas.height;

    // Cover transform math
    const videoAspect = vw / vh;
    const boxAspect = cw / ch;
    let scale: number, offsetX = 0, offsetY = 0;
    if (videoAspect > boxAspect) {
      scale = ch / vh;
      offsetX = (vw * scale - cw) / 2;
    } else {
      scale = cw / vw;
      offsetY = (vh * scale - ch) / 2;
    }

    const toCanvasXY = (nx: number, ny: number) => ({
      x: nx * vw * scale - offsetX,
      y: ny * vh * scale - offsetY,
    });

    // Draw skeleton connections
    ctx.save();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#35d0e8";
    ctx.shadowColor = "#35d0e8";
    ctx.shadowBlur = 8;

    for (const conn of PoseLandmarker.POSE_CONNECTIONS) {
      const a = lm[conn.start];
      const b = lm[conn.end];
      if (!a || !b) continue;
      if ((a.visibility && a.visibility < 0.3) || (b.visibility && b.visibility < 0.3)) continue;
      const pa = toCanvasXY(a.x, a.y);
      const pb = toCanvasXY(b.x, b.y);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }

    // Draw joint keypoints
    ctx.fillStyle = "#3ddc97";
    ctx.shadowColor = "#3ddc97";
    ctx.shadowBlur = 10;
    for (const p of lm) {
      if (p.visibility && p.visibility < 0.3) continue;
      const pos = toCanvasXY(p.x, p.y);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  // Mini-graph: Live Angle / Metric History
  const drawAngleGraph = () => {
    const canvas = angleGraphRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const pts = angleHistoryRef.current;
    if (pts.length < 2) return;

    const minA = engineRef.current.angleGraphMin;
    const maxA = engineRef.current.angleGraphMax;
    const guideline = engineRef.current.angleGraphGuideline;
    const tMin = pts[0].t;
    const tMax = pts[pts.length - 1].t || tMin + 1;

    // Guideline threshold
    ctx.strokeStyle = "rgba(245, 168, 60, 0.45)";
    ctx.setLineDash([3, 3]);
    const yGuide = h - ((guideline - minA) / (maxA - minA || 1)) * h;
    ctx.beginPath();
    ctx.moveTo(0, yGuide);
    ctx.lineTo(w, yGuide);
    ctx.stroke();
    ctx.setLineDash([]);

    // Curve
    ctx.strokeStyle = "#35d0e8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    pts.forEach((p, i) => {
      const x = ((p.t - tMin) / (tMax - tMin || 1)) * w;
      const y = h - ((p.value - minA) / (maxA - minA || 1)) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };

  // Mini-graph: Rep Scores
  const drawRepScoresGraph = useCallback(() => {
    const canvas = repGraphRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const recent = repScores.slice(-10);
    if (recent.length === 0) return;

    const barW = w / recent.length;
    recent.forEach((s, i) => {
      const bh = Math.max(2, (s / 100) * (h - 4));
      ctx.fillStyle = s >= 80 ? "#3ddc97" : s >= 60 ? "#f5a83c" : "#ef6461";
      ctx.fillRect(i * barW + 2, h - bh, barW - 4, bh);
    });
  }, [repScores]);

  // Mini-graph: Accuracy Trend
  const drawAccTrendGraph = useCallback(() => {
    const canvas = accGraphRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (repScores.length === 0) return;

    const runningAvg: number[] = [];
    let sum = 0;
    repScores.forEach((s, i) => {
      sum += s;
      runningAvg.push(sum / (i + 1));
    });

    ctx.strokeStyle = "#f5a83c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    runningAvg.forEach((v, i) => {
      const x = runningAvg.length === 1 ? 0 : (i / (runningAvg.length - 1)) * w;
      const y = h - (v / 100) * (h - 6) - 3;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, [repScores]);

  // Synchronize mini-graphs on prop changes
  useEffect(() => {
    drawRepScoresGraph();
    drawAccTrendGraph();
  }, [repScores, drawRepScoresGraph, drawAccTrendGraph]);

  // Main frame detection loop
  const detectFrame = useCallback(() => {
    if (!videoRef.current || !landmarkerRef.current) return;
    const video = videoRef.current;

    if (video.readyState >= 2 && video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      try {
        const now = performance.now();
        const result = landmarkerRef.current.detectForVideo(video, now);
        if (result.landmarks && result.landmarks.length > 0) {
          renderOverlay(result.landmarks);

          const frameResult = engineRef.current.processFrame(result.landmarks[0], now);
          setStatusMsg(frameResult.statusMsg);
          setStatusKind(frameResult.inPosition ? "on" : "warn");

          if (frameResult.primaryValue !== null) {
            currentPrimaryValueRef.current = frameResult.primaryValue;
            angleHistoryRef.current.push({ t: now, value: frameResult.primaryValue });

            // Keep last 10 seconds of values
            const cutoff = now - 10000;
            while (angleHistoryRef.current.length && angleHistoryRef.current[0].t < cutoff) {
              angleHistoryRef.current.shift();
            }

            drawAngleGraph();
          }

          onSignalsUpdate(frameResult.signals as any);
          onFeedbackUpdate(frameResult.feedback);

          if (frameResult.repCompleted) {
            onRepComplete(
              frameResult.repCompleted.score,
              frameResult.repCompleted.primaryAngle,
              frameResult.repCompleted.flags
            );
          }
        } else {
          setStatusKind("warn");
          setStatusMsg("No person detected — step back into camera frame");
          const canvas = overlayRef.current;
          if (canvas) {
            const ctx = canvas.getContext("2d");
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
          }
        }
      } catch (err) {
        console.warn("[MediaPipe] Frame processing error:", err);
      }
    }

    rafIdRef.current = requestAnimationFrame(detectFrame);
  }, [onRepComplete, onSignalsUpdate, onFeedbackUpdate]);

  // Synchronize canvas size
  const syncCanvasDimensions = () => {
    if (videoWrapRef.current && overlayRef.current) {
      const rect = videoWrapRef.current.getBoundingClientRect();
      overlayRef.current.width = Math.max(1, Math.round(rect.width));
      overlayRef.current.height = Math.max(1, Math.round(rect.height));
    }
    [angleGraphRef, repGraphRef, accGraphRef].forEach((ref) => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect();
        if (rect.width && rect.height) {
          ref.current.width = Math.round(rect.width);
          ref.current.height = Math.round(rect.height);
        }
      }
    });
  };

  useEffect(() => {
    syncCanvasDimensions();
    window.addEventListener("resize", syncCanvasDimensions);
    return () => window.removeEventListener("resize", syncCanvasDimensions);
  }, []);

  // Initialize MediaPipe PoseLandmarker
  const initModel = async () => {
    if (landmarkerRef.current) return landmarkerRef.current;
    setLoadingModel(true);
    setStatusMsg("Loading MediaPipe vision model...");

    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );

    const modelAssetPath =
      "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

    let landmarker: PoseLandmarker;
    try {
      landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath, delegate: "GPU" },
        runningMode: "VIDEO",
        numPoses: 1,
      });
    } catch {
      landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath, delegate: "CPU" },
        runningMode: "VIDEO",
        numPoses: 1,
      });
    }

    landmarkerRef.current = landmarker;
    setModelLoaded(true);
    setLoadingModel(false);
    return landmarker;
  };

  const handleStartCamera = async () => {
    try {
      await initModel();
      setStatusMsg("Requesting camera access...");
      setStatusKind("loading");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsRunning(true);
      setStatusKind("warn");
      setStatusMsg("Aligning body in frame...");
      syncCanvasDimensions();
      rafIdRef.current = requestAnimationFrame(detectFrame);
    } catch (err: any) {
      console.error("[Camera] Error:", err);
      setIsRunning(false);
      setStatusKind("warn");
      setStatusMsg("Camera access denied or unavailable. Click Start Camera to retry.");
    }
  };

  const handleStopCamera = () => {
    setIsRunning(false);
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    const canvas = overlayRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    setStatusKind("warn");
    setStatusMsg("Camera stopped");
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const meta = EXERCISE_DEFINITIONS[currentExercise] || EXERCISE_DEFINITIONS.squat;
  const latestScore = repScores.length > 0 ? repScores[repScores.length - 1] : null;
  const currentAcc =
    repScores.length > 0 ? Math.round(repScores.reduce((a, b) => a + b, 0) / repScores.length) : null;

  return (
    <section className="flex flex-col gap-3 min-h-0 flex-1">
      {/* Video Panel Container */}
      <div className="flex-1 min-h-0 flex flex-col bg-[#0e1f2e] border border-[#1a3448] rounded-xl overflow-hidden shadow-md">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1a3448] bg-[#0c1a28] shrink-0">
          <div className="flex items-center gap-2 font-display font-semibold text-sm text-[#eaf3fa]">
            <span
              className={`w-2 h-2 rounded-full ${
                isRunning ? "bg-[#ef6461] animate-pulse shadow-[0_0_6px_#ef6461]" : "bg-[#5c7a8e]"
              }`}
            />
            <span>{meta.shortName} — Live Biomechanics Tracker</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={isRunning ? handleStopCamera : handleStartCamera}
              disabled={loadingModel}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all shadow-sm flex items-center gap-1.5 ${
                isRunning
                  ? "bg-[#16283a] text-[#ef6461] border border-[#ef6461]/40 hover:bg-[#ef6461]/10"
                  : "bg-[#35d0e8] text-[#04191f] hover:bg-[#4fdcef] shadow-[#35d0e8]/20"
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              {loadingModel ? "Loading Model..." : isRunning ? "Stop Camera" : "Start Camera"}
            </button>

            <button
              type="button"
              onClick={onResetSession}
              disabled={!isRunning && repScores.length === 0}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide bg-[#0e2434] hover:bg-[#14293a] text-[#9db3c2] hover:text-[#eaf3fa] border border-[#1a3448] transition-colors flex items-center gap-1.5 disabled:opacity-40"
              title="Reset current session counter"
            >
              <RefreshCw className="w-3 h-3" />
              Reset
            </button>
          </div>
        </div>

        {/* Video Stage Wrap */}
        <div ref={videoWrapRef} className="relative flex-1 min-h-0 bg-[#04090e] overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            autoPlay
            muted
            className="absolute inset-0 w-full h-full object-cover -scale-x-100 block"
          />
          <canvas
            ref={overlayRef}
            className="absolute inset-0 w-full h-full object-cover -scale-x-100 pointer-events-none z-10"
          />

          {/* Standby Empty State */}
          {!isRunning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-[#5c7a8e] p-6 text-center z-20 select-none bg-[#04090e]/90">
              <div className="w-14 h-14 rounded-full bg-[#0c1a28] border border-[#1a3448] flex items-center justify-center text-[#35d0e8]/70">
                <VideoOff className="w-6 h-6" />
              </div>
              <p className="text-xs text-[#9db3c2] max-w-sm leading-relaxed">
                Camera is standby. Click <strong className="text-[#35d0e8]">Start Camera</strong> and grant permission to activate real-time pose tracking for <strong className="text-[#eaf3fa]">{meta.name}</strong>.
              </p>
            </div>
          )}

          {/* Live Status Overlay Pill */}
          {isRunning && (
            <div className="absolute top-3 left-3 z-30 flex items-center gap-2 px-3 py-1 rounded-full bg-[#061018]/85 border border-[#1a3448] backdrop-blur-sm text-xs">
              <span
                className={`w-2 h-2 rounded-full ${
                  statusKind === "on"
                    ? "bg-[#3ddc97] shadow-[0_0_6px_#3ddc97]"
                    : statusKind === "loading"
                    ? "bg-[#35d0e8] animate-ping"
                    : "bg-[#f5a83c] shadow-[0_0_6px_#f5a83c]"
                }`}
              />
              <span className="text-[#eaf3fa] font-medium text-[11px]">{statusMsg}</span>
            </div>
          )}

          {/* AI Model Badge */}
          {isRunning && modelLoaded && (
            <div className="absolute top-3 right-3 z-30 px-2.5 py-0.5 rounded bg-[#061018]/80 border border-[#1a3448] text-[10px] font-mono text-[#35d0e8] tracking-wider">
              MEDIAPIPE VISION
            </div>
          )}

          {/* Bottom Alignment Hint */}
          {isRunning && (
            <div className="absolute bottom-0 inset-x-0 z-30 py-2 px-4 text-center text-[11px] text-[#9db3c2] bg-gradient-to-t from-[#061018]/95 to-transparent">
              {engineRef.current.alignmentHint}
            </div>
          )}
        </div>
      </div>

      {/* Mini Graphs Bar */}
      <div className="grid grid-cols-3 gap-3 h-28 shrink-0">
        {/* Dynamic Joint Angle / Elevation Graph */}
        <div className="bg-[#0e1f2e] border border-[#1a3448] rounded-xl p-2.5 flex flex-col min-w-0 shadow-sm">
          <div className="flex items-baseline justify-between mb-1">
            <h3 className="text-[10px] font-semibold text-[#5c7a8e] tracking-wider uppercase truncate">
              {engineRef.current.angleGraphLabel}
            </h3>
            <span className="font-display font-bold text-xs text-[#35d0e8]">
              {engineRef.current.formatPrimaryValue(currentPrimaryValueRef.current)}
            </span>
          </div>
          <div className="flex-1 min-h-0 relative">
            <canvas ref={angleGraphRef} className="w-full h-full block" />
          </div>
        </div>

        {/* Rep Scores */}
        <div className="bg-[#0e1f2e] border border-[#1a3448] rounded-xl p-2.5 flex flex-col min-w-0 shadow-sm">
          <div className="flex items-baseline justify-between mb-1">
            <h3 className="text-[10px] font-semibold text-[#5c7a8e] tracking-wider uppercase">
              Rep Scores
            </h3>
            <span
              className={`font-display font-bold text-xs ${
                latestScore !== null
                  ? latestScore >= 80
                    ? "text-[#3ddc97]"
                    : latestScore >= 60
                    ? "text-[#f5a83c]"
                    : "text-[#ef6461]"
                  : "text-[#5c7a8e]"
              }`}
            >
              {latestScore !== null ? `${latestScore}` : "--"}
            </span>
          </div>
          <div className="flex-1 min-h-0 relative">
            <canvas ref={repGraphRef} className="w-full h-full block" />
          </div>
        </div>

        {/* Accuracy Trend */}
        <div className="bg-[#0e1f2e] border border-[#1a3448] rounded-xl p-2.5 flex flex-col min-w-0 shadow-sm">
          <div className="flex items-baseline justify-between mb-1">
            <h3 className="text-[10px] font-semibold text-[#5c7a8e] tracking-wider uppercase">
              Accuracy Trend
            </h3>
            <span className="font-display font-bold text-xs text-[#f5a83c]">
              {currentAcc !== null ? `${currentAcc}%` : "--%"}
            </span>
          </div>
          <div className="flex-1 min-h-0 relative">
            <canvas ref={accGraphRef} className="w-full h-full block" />
          </div>
        </div>
      </div>
    </section>
  );
};
