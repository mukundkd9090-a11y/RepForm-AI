import {
  ExerciseEngine,
  FrameProcessResult,
  Point2D,
  POSE_LANDMARKS as L,
  calcAngleAt,
  calcMidpoint,
  isVisible,
} from "./types";

export class PushUpEngine implements ExerciseEngine {
  meta = {
    id: "push_up" as const,
    name: "Push-Up (Plank to Chest)",
    shortName: "Push-Ups",
    category: "Upper Body" as const,
    description: "Horizontal pressing bodyweight exercise strengthening the pectorals, anterior deltoids, triceps, and core.",
    primaryJoint: "Elbow Angle",
    metValue: 6.0,
    iconName: "Flame",
    guidelines: [
      "Maintain a straight, rigid plank from head to heels (160°–180°)",
      "Lower chest until elbows reach a 90° angle or below",
      "Avoid sagging hips or piking your lower back",
      "Press through palms back to complete top arm lockout",
    ],
  };

  angleGraphLabel = "Elbow Angle — Live";
  angleGraphGuideline = 90;
  angleGraphMin = 50;
  angleGraphMax = 185;
  alignmentHint = "Side profile view ~5-7 feet away · Keep arms, torso, and legs in frame";
  requiredLandmarksHint = "Ensure shoulders, elbows, wrists, hips, and ankles are in frame";

  private repPhase: "plank_top" | "descending" = "plank_top";
  private minAngleThisRep = 180;
  private flagsThisRep = { hipSag: false, incompleteLockout: false, shallowDepth: false };

  reset() {
    this.repPhase = "plank_top";
    this.minAngleThisRep = 180;
    this.flagsThisRep = { hipSag: false, incompleteLockout: false, shallowDepth: false };
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
          depth: { text: "Get in push-up plank position", status: "neutral" },
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
        statusMsg: "Ensure arms and torso are visible",
      };
    }

    const elbowAngle = elbowAngles.reduce((sum, v) => sum + v, 0) / elbowAngles.length;

    // Plank straight-line alignment check: SHOULDER -> HIP -> ANKLE
    let hipSag = false;
    let plankAngle: number | null = null;
    const haveShoulders = isVisible(lm, L.L_SHOULDER) || isVisible(lm, L.R_SHOULDER);
    const haveHips = isVisible(lm, L.L_HIP) || isVisible(lm, L.R_HIP);
    const haveAnkles = isVisible(lm, L.L_ANKLE) || isVisible(lm, L.R_ANKLE);

    if (haveShoulders && haveHips && haveAnkles) {
      const sh = isVisible(lm, L.L_SHOULDER) ? lm[L.L_SHOULDER] : lm[L.R_SHOULDER];
      const hp = isVisible(lm, L.L_HIP) ? lm[L.L_HIP] : lm[L.R_HIP];
      const ak = isVisible(lm, L.L_ANKLE) ? lm[L.L_ANKLE] : lm[L.R_ANKLE];
      plankAngle = calcAngleAt(sh, hp, ak);
      if (plankAngle !== null) {
        hipSag = plankAngle < 155;
      }
    }

    // State Machine
    let repCompleted = null;
    if (this.repPhase === "plank_top") {
      if (elbowAngle < 140) {
        this.repPhase = "descending";
        this.minAngleThisRep = elbowAngle;
        this.flagsThisRep = { hipSag: false, incompleteLockout: false, shallowDepth: false };
      }
    } else if (this.repPhase === "descending") {
      this.minAngleThisRep = Math.min(this.minAngleThisRep, elbowAngle);
      if (hipSag) this.flagsThisRep.hipSag = true;

      // Completed rep upon pressing back up to straight arms
      if (elbowAngle > 152) {
        const bottomAngle = this.minAngleThisRep;
        let score = 100;

        if (bottomAngle > 95) {
          this.flagsThisRep.shallowDepth = true;
          score -= Math.min(45, (bottomAngle - 90) * 1.3 + 10);
        }
        if (this.flagsThisRep.hipSag) {
          score -= 20;
        }

        score = Math.max(0, Math.round(score));

        repCompleted = {
          score,
          primaryAngle: bottomAngle,
          flags: {
            hipSagCount: this.flagsThisRep.hipSag,
            shallowDepthCount: this.flagsThisRep.shallowDepth,
            optimalDepthCount: bottomAngle <= 90,
          },
        };
        this.repPhase = "plank_top";
      }
    }

    // Feedback
    let depthFb: { text: string; status: "neutral" | "good" | "warn" | "bad" };
    if (this.repPhase === "descending") {
      if (elbowAngle <= 90) {
        depthFb = { text: "Optimal depth (≤90°)", status: "good" };
      } else if (elbowAngle <= 110) {
        depthFb = { text: "Go slightly deeper — chest to floor", status: "warn" };
      } else {
        depthFb = { text: "Lowering chest...", status: "neutral" };
      }
    } else {
      depthFb = { text: "Ready — begin descent", status: "neutral" };
    }

    const lockoutFb: { text: string; status: "neutral" | "good" | "warn" | "bad" } =
      elbowAngle >= 150
        ? { text: "Full top arm lockout", status: "good" }
        : { text: "Arms partially bent", status: "neutral" };

    const coreFb: { text: string; status: "neutral" | "good" | "warn" | "bad" } = hipSag
      ? { text: "Hips sagging / piking — brace abs & glutes", status: "bad" }
      : { text: "Rigid plank alignment maintained", status: "good" };

    const angleFb: { text: string; status: "neutral" | "good" | "warn" | "bad" } = {
      text: `${Math.round(elbowAngle)}°`,
      status: elbowAngle <= 90 ? "good" : "neutral",
    };

    return {
      signals: {
        primaryAngle: elbowAngle,
        elbowAngle,
        plankAngle,
        hipSag,
      },
      feedback: {
        depth: depthFb,
        knee: lockoutFb,
        core: coreFb,
        angle: angleFb,
      },
      primaryValue: elbowAngle,
      repCompleted,
      inPosition: true,
      statusMsg: "Tracking push-up biomechanics",
    };
  }
}
