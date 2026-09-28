import {
  ExerciseEngine,
  FrameProcessResult,
  Point2D,
  POSE_LANDMARKS as L,
  calcAngleAt,
  calcMidpoint,
  isVisible,
} from "./types";

export class SquatEngine implements ExerciseEngine {
  meta = {
    id: "squat" as const,
    name: "Barbell / Bodyweight Squat",
    shortName: "Squats",
    category: "Lower Body" as const,
    description: "Deep knee and hip flexion compound lift for quadriceps, hamstrings, and glutes.",
    primaryJoint: "Knee Angle",
    metValue: 5.0,
    iconName: "Activity",
    guidelines: [
      "Keep feet shoulder-width apart, toes slightly angled out",
      "Descend until hips are at or below knee level (≤100°)",
      "Drive knees outward tracking over your second toe",
      "Keep chest upright and brace your core throughout",
    ],
  };

  angleGraphLabel = "Knee Angle — Live";
  angleGraphGuideline = 100;
  angleGraphMin = 50;
  angleGraphMax = 190;
  alignmentHint = "Stand ~6-8 feet away · Keep hips, knees & ankles in frame · Maintain good lighting";
  requiredLandmarksHint = "Ensure hips, knees & ankles are clearly visible in frame";

  private repPhase: "up" | "down" = "up";
  private minAngleThisRep = 180;
  private flagsThisRep = { valgus: false, forwardLean: false };

  reset() {
    this.repPhase = "up";
    this.minAngleThisRep = 180;
    this.flagsThisRep = { valgus: false, forwardLean: false };
  }

  formatPrimaryValue(val: number | null): string {
    return val !== null ? `${Math.round(val)}°` : "--°";
  }

  processFrame(lm: Point2D[], _now: number): FrameProcessResult {
    const haveLeft = isVisible(lm, L.L_HIP) && isVisible(lm, L.L_KNEE) && isVisible(lm, L.L_ANKLE);
    const haveRight = isVisible(lm, L.R_HIP) && isVisible(lm, L.R_KNEE) && isVisible(lm, L.R_ANKLE);

    if (!haveLeft && !haveRight) {
      return {
        signals: {},
        feedback: {
          depth: { text: "Stand in frame", status: "neutral" },
          knee: { text: "—", status: "neutral" },
          core: { text: "—", status: "neutral" },
          angle: { text: "--°", status: "neutral" },
        },
        primaryValue: null,
        repCompleted: null,
        inPosition: false,
        statusMsg: this.requiredLandmarksHint,
      };
    }

    const kneeAngles: number[] = [];
    if (haveLeft) {
      const a = calcAngleAt(lm[L.L_HIP], lm[L.L_KNEE], lm[L.L_ANKLE]);
      if (a !== null) kneeAngles.push(a);
    }
    if (haveRight) {
      const a = calcAngleAt(lm[L.R_HIP], lm[L.R_KNEE], lm[L.R_ANKLE]);
      if (a !== null) kneeAngles.push(a);
    }

    if (kneeAngles.length === 0) {
      return {
        signals: {},
        feedback: {
          depth: { text: "Adjust position", status: "neutral" },
          knee: { text: "—", status: "neutral" },
          core: { text: "—", status: "neutral" },
          angle: { text: "--°", status: "neutral" },
        },
        primaryValue: null,
        repCompleted: null,
        inPosition: false,
        statusMsg: "Align camera to clearly capture legs",
      };
    }

    const kneeAngle = kneeAngles.reduce((sum, v) => sum + v, 0) / kneeAngles.length;

    // Knee valgus check
    let valgus = false;
    if (haveLeft && haveRight) {
      const kneeDist = Math.abs(lm[L.L_KNEE].x - lm[L.R_KNEE].x);
      const ankleDist = Math.abs(lm[L.L_ANKLE].x - lm[L.R_ANKLE].x);
      if (ankleDist > 0.02) {
        valgus = kneeDist < ankleDist * 0.72;
      }
    }

    // Torso forward lean check
    let forwardLean = false;
    let torsoAngle: number | null = null;
    const haveShoulders = isVisible(lm, L.L_SHOULDER) && isVisible(lm, L.R_SHOULDER);
    const haveHips = isVisible(lm, L.L_HIP) && isVisible(lm, L.R_HIP);
    if (haveShoulders && haveHips) {
      const midHip = calcMidpoint(lm[L.L_HIP], lm[L.R_HIP]);
      const midShoulder = calcMidpoint(lm[L.L_SHOULDER], lm[L.R_SHOULDER]);
      const dx = midShoulder.x - midHip.x;
      const dy = midShoulder.y - midHip.y;
      torsoAngle = Math.atan2(Math.abs(dx), Math.abs(dy)) * (180 / Math.PI);
      forwardLean = torsoAngle > 38;
    }

    // State Machine
    let repCompleted = null;
    if (this.repPhase === "up") {
      if (kneeAngle < 140) {
        this.repPhase = "down";
        this.minAngleThisRep = kneeAngle;
        this.flagsThisRep = { valgus: false, forwardLean: false };
      }
    } else if (this.repPhase === "down") {
      this.minAngleThisRep = Math.min(this.minAngleThisRep, kneeAngle);
      if (valgus) this.flagsThisRep.valgus = true;
      if (forwardLean) this.flagsThisRep.forwardLean = true;

      // Completed rep return
      if (kneeAngle > 160) {
        const depthAngle = this.minAngleThisRep;
        let score = 100;
        if (depthAngle > 125) {
          score -= Math.min(45, (depthAngle - 125) * 1.1 + 15);
        } else if (depthAngle > 100) {
          score -= (depthAngle - 100) * 0.9;
        }
        if (this.flagsThisRep.valgus) score -= 25;
        if (this.flagsThisRep.forwardLean) score -= 18;
        score = Math.max(0, Math.round(score));

        repCompleted = {
          score,
          primaryAngle: depthAngle,
          flags: { ...this.flagsThisRep },
        };
        this.repPhase = "up";
      }
    }

    // Feedback
    let depthFb: { text: string; status: "neutral" | "good" | "warn" | "bad" };
    if (this.repPhase === "down") {
      if (kneeAngle <= 100) {
        depthFb = { text: "Optimal depth (≤100°)", status: "good" };
      } else if (kneeAngle <= 125) {
        depthFb = { text: "Getting close — descend slightly deeper", status: "warn" };
      } else {
        depthFb = { text: "Too shallow — squat lower", status: "warn" };
      }
    } else {
      depthFb = { text: "Ready — begin your descent", status: "neutral" };
    }

    const kneeFb: { text: string; status: "neutral" | "good" | "warn" | "bad" } = valgus
      ? { text: "Knees caving in — push outward", status: "bad" }
      : { text: "Tracking over toes cleanly", status: "good" };

    const coreFb: { text: string; status: "neutral" | "good" | "warn" | "bad" } = forwardLean
      ? { text: "Excessive forward lean — brace core", status: "warn" }
      : { text: "Maintaining solid torso tension", status: "good" };

    const angleFb: { text: string; status: "neutral" | "good" | "warn" | "bad" } = {
      text: `${Math.round(kneeAngle)}°`,
      status: kneeAngle <= 100 ? "good" : "neutral",
    };

    return {
      signals: {
        primaryAngle: kneeAngle,
        kneeAngle,
        valgus,
        forwardLean,
        torsoAngle,
      },
      feedback: {
        depth: depthFb,
        knee: kneeFb,
        core: coreFb,
        angle: angleFb,
      },
      primaryValue: kneeAngle,
      repCompleted,
      inPosition: true,
      statusMsg: "Tracking squat form",
    };
  }
}
