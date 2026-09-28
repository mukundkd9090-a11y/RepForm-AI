import {
  ExerciseEngine,
  FrameProcessResult,
  Point2D,
  POSE_LANDMARKS as L,
  calcAngleAt,
  calcMidpoint,
  isVisible,
} from "./types";

export class PullUpEngine implements ExerciseEngine {
  meta = {
    id: "pull_up" as const,
    name: "Pull-Up / Chin-Up",
    shortName: "Pull-Ups",
    category: "Upper Body" as const,
    description: "Vertical pulling bodyweight exercise developing the latissimus dorsi, rhomboids, biceps, and core.",
    primaryJoint: "Elbow Angle",
    metValue: 8.0,
    iconName: "TrendingUp",
    guidelines: [
      "Hang with arms fully extended in a dead hang (≥150°)",
      "Pull smoothly until chin clears the bar level (elbow angle ≤75°)",
      "Avoid excessive leg swinging, kipping, or momentum",
      "Lower under control back to full arm extension",
    ],
  };

  angleGraphLabel = "Elbow Angle — Live";
  angleGraphGuideline = 75;
  angleGraphMin = 40;
  angleGraphMax = 180;
  alignmentHint = "Frame upper body and bar · Stand / hang ~6-8 ft away · Ensure arms & torso in view";
  requiredLandmarksHint = "Ensure shoulders, elbows, and wrists are clearly in frame";

  private repPhase: "hang" | "pulling" = "hang";
  private minAngleThisRep = 180;
  private flagsThisRep = { swingKip: false, incompleteLockout: false, shallowPull: false };

  reset() {
    this.repPhase = "hang";
    this.minAngleThisRep = 180;
    this.flagsThisRep = { swingKip: false, incompleteLockout: false, shallowPull: false };
  }

  formatPrimaryValue(val: number | null): string {
    return val !== null ? `${Math.round(val)}°` : "--°";
  }

  processFrame(lm: Point2D[], _now: number): FrameProcessResult {
    const haveLeftArm = isVisible(lm, L.L_SHOULDER) && isVisible(lm, L.L_ELBOW) && isVisible(lm, L.L_WRIST);
    const haveRightArm = isVisible(lm, L.R_SHOULDER) && isVisible(lm, L.R_ELBOW) && isVisible(lm, L.R_WRIST);

    if (!haveLeftArm && !haveRightArm) {
      return {
        signals: {},
        feedback: {
          depth: { text: "Stand / hang in frame", status: "neutral" },
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

    const elbowAngles: number[] = [];
    if (haveLeftArm) {
      const a = calcAngleAt(lm[L.L_SHOULDER], lm[L.L_ELBOW], lm[L.L_WRIST]);
      if (a !== null) elbowAngles.push(a);
    }
    if (haveRightArm) {
      const a = calcAngleAt(lm[L.R_SHOULDER], lm[L.R_ELBOW], lm[L.R_WRIST]);
      if (a !== null) elbowAngles.push(a);
    }

    if (elbowAngles.length === 0) {
      return {
        signals: {},
        feedback: {
          depth: { text: "Adjust camera angle", status: "neutral" },
          knee: { text: "—", status: "neutral" },
          core: { text: "—", status: "neutral" },
          angle: { text: "--°", status: "neutral" },
        },
        primaryValue: null,
        repCompleted: null,
        inPosition: false,
        statusMsg: "Ensure arms and bar are visible",
      };
    }

    const elbowAngle = elbowAngles.reduce((sum, v) => sum + v, 0) / elbowAngles.length;

    // Body swing / kipping check (horizontal displacement between shoulders and hips)
    let swingKip = false;
    const haveShoulders = isVisible(lm, L.L_SHOULDER) && isVisible(lm, L.R_SHOULDER);
    const haveHips = isVisible(lm, L.L_HIP) && isVisible(lm, L.R_HIP);
    if (haveShoulders && haveHips) {
      const midShoulder = calcMidpoint(lm[L.L_SHOULDER], lm[L.R_SHOULDER]);
      const midHip = calcMidpoint(lm[L.L_HIP], lm[L.R_HIP]);
      const swingDx = Math.abs(midHip.x - midShoulder.x);
      swingKip = swingDx > 0.09;
    }

    // State Machine
    let repCompleted = null;
    if (this.repPhase === "hang") {
      if (elbowAngle < 135) {
        this.repPhase = "pulling";
        this.minAngleThisRep = elbowAngle;
        this.flagsThisRep = { swingKip: false, incompleteLockout: false, shallowPull: false };
      }
    } else if (this.repPhase === "pulling") {
      this.minAngleThisRep = Math.min(this.minAngleThisRep, elbowAngle);
      if (swingKip) this.flagsThisRep.swingKip = true;

      // Completed rep upon lowering back to dead hang extension
      if (elbowAngle > 145) {
        const topAngle = this.minAngleThisRep;
        let score = 100;

        if (topAngle > 80) {
          this.flagsThisRep.shallowPull = true;
          score -= Math.min(45, (topAngle - 75) * 1.5);
        }
        if (this.flagsThisRep.swingKip) {
          score -= 20;
        }

        score = Math.max(0, Math.round(score));

        repCompleted = {
          score,
          primaryAngle: topAngle,
          flags: {
            swingKipCount: this.flagsThisRep.swingKip,
            shallowDepthCount: this.flagsThisRep.shallowPull,
            optimalDepthCount: topAngle <= 75,
          },
        };
        this.repPhase = "hang";
      }
    }

    // Feedback
    let chinFb: { text: string; status: "neutral" | "good" | "warn" | "bad" };
    if (this.repPhase === "pulling") {
      if (elbowAngle <= 75) {
        chinFb = { text: "Optimal pull — chin cleared bar (≤75°)", status: "good" };
      } else if (elbowAngle <= 95) {
        chinFb = { text: "Pull higher — get chin over bar", status: "warn" };
      } else {
        chinFb = { text: "Pulling up...", status: "neutral" };
      }
    } else {
      chinFb = { text: "Ready — begin upward pull", status: "neutral" };
    }

    const extensionFb: { text: string; status: "neutral" | "good" | "warn" | "bad" } =
      elbowAngle >= 145
        ? { text: "Full dead hang extension", status: "good" }
        : { text: "Arms partially bent", status: "neutral" };

    const swingFb: { text: string; status: "neutral" | "good" | "warn" | "bad" } = swingKip
      ? { text: "Excessive body swing / kipping detected", status: "bad" }
      : { text: "Strict vertical bar path", status: "good" };

    const angleFb: { text: string; status: "neutral" | "good" | "warn" | "bad" } = {
      text: `${Math.round(elbowAngle)}°`,
      status: elbowAngle <= 75 ? "good" : "neutral",
    };

    return {
      signals: {
        primaryAngle: elbowAngle,
        elbowAngle,
        swingKip,
      },
      feedback: {
        depth: chinFb,
        knee: extensionFb,
        core: swingFb,
        angle: angleFb,
      },
      primaryValue: elbowAngle,
      repCompleted,
      inPosition: true,
      statusMsg: "Tracking pull-up mechanics",
    };
  }
}
