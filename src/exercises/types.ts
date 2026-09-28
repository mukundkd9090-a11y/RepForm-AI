import { ExerciseType, ExerciseMeta, TechniqueFeedback } from "../types";

export const POSE_LANDMARKS = {
  NOSE: 0,
  L_EYE_INNER: 1,
  L_EYE: 2,
  L_EYE_OUTER: 3,
  R_EYE_INNER: 4,
  R_EYE: 5,
  R_EYE_OUTER: 6,
  L_EAR: 7,
  R_EAR: 8,
  MOUTH_L: 9,
  MOUTH_R: 10,
  L_SHOULDER: 11,
  R_SHOULDER: 12,
  L_ELBOW: 13,
  R_ELBOW: 14,
  L_WRIST: 15,
  R_WRIST: 16,
  L_PINKY: 17,
  R_PINKY: 18,
  L_INDEX: 19,
  R_INDEX: 20,
  L_THUMB: 21,
  R_THUMB: 22,
  L_HIP: 23,
  R_HIP: 24,
  L_KNEE: 25,
  R_KNEE: 26,
  L_ANKLE: 27,
  R_ANKLE: 28,
  L_HEEL: 29,
  R_HEEL: 30,
  L_FOOT_INDEX: 31,
  R_FOOT_INDEX: 32,
};

export interface Point2D {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export function calcAngleAt(a: Point2D, b: Point2D, c: Point2D): number | null {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const magA = Math.hypot(abx, aby);
  const magC = Math.hypot(cbx, cby);
  if (magA === 0 || magC === 0) return null;
  let cos = dot / (magA * magC);
  cos = Math.min(1, Math.max(-1, cos));
  return Math.acos(cos) * (180 / Math.PI);
}

export function isVisible(lm: Point2D[], idx: number, threshold = 0.35): boolean {
  const p = lm[idx];
  return Boolean(p && (p.visibility === undefined || p.visibility >= threshold));
}

export function calcMidpoint(a: Point2D, b: Point2D): Point2D {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

export function calcDistance(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export interface RepCompletionResult {
  score: number;
  primaryAngle: number;
  flags: Record<string, boolean>;
}

export interface FrameProcessResult {
  signals: Record<string, any>;
  feedback: TechniqueFeedback;
  primaryValue: number | null;
  repCompleted: RepCompletionResult | null;
  inPosition: boolean;
  statusMsg: string;
}

export interface ExerciseEngine {
  meta: ExerciseMeta;
  angleGraphLabel: string;
  angleGraphGuideline: number;
  angleGraphMin: number;
  angleGraphMax: number;
  formatPrimaryValue: (val: number | null) => string;
  alignmentHint: string;
  requiredLandmarksHint: string;
  reset: () => void;
  processFrame: (landmarks: Point2D[], now: number) => FrameProcessResult;
}
