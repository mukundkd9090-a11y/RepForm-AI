import {
  ExerciseEngine,
  FrameProcessResult,
  Point2D,
  POSE_LANDMARKS as L,
  calcAngleAt,
  calcMidpoint,
  isVisible,
} from "./types";

export class JumpEngine implements ExerciseEngine {
  meta = {
    id: "jump" as const,
    name: "Jumping Jacks & Plyometric Jumps",
    shortName: "Jumping Task",
    category: "Full Body & Plyometrics" as const,
    description: "High-intensity plyometric and cardiovascular jumping movement developing power, cadence, and shock absorption.",
    primaryJoint: "Jump Elevation & Arm Reach",
    metValue: 8.5,
    iconName: "Zap",
    guidelines: [
      "Start in a balanced athletic standing position",
      "Explode upwards with full vertical elevation and synchronized arm drive",
      "Land softly on the balls of your feet, bending knees to absorb impact",
      "Maintain rhythmic cadence and dynamic core control",
    ],
  };

  angleGraphLabel = "Jump Elevation — Live";
  angleGraphGuideline = 15; // 15% frame vertical jump height guideline
  angleGraphMin = 0;
  angleGraphMax = 40;
  alignmentHint = "Stand ~7-9 feet back · Full body from head to feet in camera frame";
  requiredLandmarksHint = "Ensure full body (shoulders to feet) is in view";

  private repPhase: "ground" | "airborne" | "landing" = "ground";
  private baseHipY: number | null = null;
  private maxElevationThisRep = 0;
  private flagsThisRep = { stiffLanding: false, shallowJump: false };
  private lastRepTime = 0;

  reset() {
    this.repPhase = "ground";
    this.baseHipY = null;
    this.maxElevationThisRep = 0;
    this.flagsThisRep = { stiffLanding: false, shallowJump: false };
    this.lastRepTime = 0;
  }

  formatPrimaryValue(val: number | null): string {
    return val !== null ? `+${Math.round(val)}%` : "+0%";
  }

  processFrame(lm: Point2D[], now: number): FrameProcessResult {
    const haveHips = isVisible(lm, L.L_HIP) && isVisible(lm, L.R_HIP);
    const haveAnkles = isVisible(lm, L.L_ANKLE) && isVisible(lm, L.R_ANKLE);
    const haveKnees = isVisible(lm, L.L_KNEE) && isVisible(lm, L.R_KNEE);

    if (!haveHips || !haveAnkles) {
      return {
        signals: {},
        feedback: {
          depth: { text: "Step back into view", status: "neutral" },
          knee: { text: "—", status: "neutral" },
          core: { text: "—", status: "neutral" },
          angle: { text: "+0%", status: "neutral" },
        },
        primaryValue: null,
        repCompleted: null,
        inPosition: false,
        statusMsg: this.requiredLandmarksHint,
      };
    }

    const midHip = calcMidpoint(lm[L.L_HIP], lm[L.R_HIP]);

    // Initialize or adapt base hip Y when standing quietly on ground
    if (this.baseHipY === null) {
      this.baseHipY = midHip.y;
    } else if (this.repPhase === "ground" && midHip.y > this.baseHipY) {
      // Allow slight baseline adaptation
      this.baseHipY = this.baseHipY * 0.95 + midHip.y * 0.05;
    }

    // Calculate vertical elevation as percentage of frame (hip going up means midHip.y decreases)
    const rawElevation = Math.max(0, (this.baseHipY - midHip.y) * 100);

    // Calculate knee flexion angle for landing absorption
    let kneeAngle = 180;
    if (haveKnees && haveAnkles) {
      const aL = calcAngleAt(lm[L.L_HIP], lm[L.L_KNEE], lm[L.L_ANKLE]);
      const aR = calcAngleAt(lm[L.R_HIP], lm[L.R_KNEE], lm[L.R_ANKLE]);
      const angles = [aL, aR].filter((a): a is number => a !== null);
      if (angles.length > 0) {
        kneeAngle = angles.reduce((sum, v) => sum + v, 0) / angles.length;
      }
    }

    // Arm and leg spread checks (Jumping Jack / Jack extension)
    const haveWrists = isVisible(lm, L.L_WRIST) && isVisible(lm, L.R_WRIST);
    const haveShoulders = isVisible(lm, L.L_SHOULDER) && isVisible(lm, L.R_SHOULDER);
    const armsOverhead =
      haveWrists &&
      haveShoulders &&
      lm[L.L_WRIST].y < lm[L.L_SHOULDER].y &&
      lm[L.R_WRIST].y < lm[L.R_SHOULDER].y;

    const ankleSpread = Math.abs(lm[L.L_ANKLE].x - lm[L.R_ANKLE].x);

    // State Machine
    let repCompleted = null;
    const jumpDetected = rawElevation >= 4.5 || (armsOverhead && ankleSpread > 0.22);

    if (this.repPhase === "ground") {
      if (jumpDetected && now - this.lastRepTime > 400) {
        this.repPhase = "airborne";
        this.maxElevationThisRep = rawElevation;
        this.flagsThisRep = { stiffLanding: false, shallowJump: false };
      }
    } else if (this.repPhase === "airborne") {
      this.maxElevationThisRep = Math.max(this.maxElevationThisRep, rawElevation);

      // Transition to landing phase when descending back toward ground
      if (rawElevation < 3.0 && !armsOverhead) {
        this.repPhase = "landing";
      }
    } else if (this.repPhase === "landing") {
      // Check landing shock absorption (knee flexion)
      const stiffLanding = kneeAngle > 172;
      if (stiffLanding) {
        this.flagsThisRep.stiffLanding = true;
      }

      // Rep completed
      const peakHeight = Math.max(this.maxElevationThisRep, armsOverhead ? 15 : 8);
      let score = 100;

      if (peakHeight < 7) {
        this.flagsThisRep.shallowJump = true;
        score -= 25;
      } else if (peakHeight < 12) {
        score -= (12 - peakHeight) * 2;
      }

      if (this.flagsThisRep.stiffLanding) {
        score -= 20;
      }

      score = Math.max(0, Math.round(score));
      this.lastRepTime = now;

      repCompleted = {
        score,
        primaryAngle: peakHeight,
        flags: {
          stiffLandingCount: this.flagsThisRep.stiffLanding,
          shallowDepthCount: this.flagsThisRep.shallowJump,
          optimalDepthCount: peakHeight >= 12,
        },
      };

      this.repPhase = "ground";
    }

    // Feedback
    let jumpFb: { text: string; status: "neutral" | "good" | "warn" | "bad" };
    if (this.repPhase === "airborne") {
      jumpFb = { text: "Airborne — maximum extension", status: "good" };
    } else if (this.repPhase === "landing") {
      jumpFb = { text: "Landing — absorb impact softly", status: "neutral" };
    } else {
      jumpFb = { text: "Ready — explode upward", status: "neutral" };
    }

    const landFb: { text: string; status: "neutral" | "good" | "warn" | "bad" } =
      kneeAngle < 165
        ? { text: "Good shock absorption in knees", status: "good" }
        : { text: "Cushion landing with soft knees", status: "warn" };

    const cadenceFb: { text: string; status: "neutral" | "good" | "warn" | "bad" } = armsOverhead
      ? { text: "Full arm overhead reach", status: "good" }
      : { text: "Rhythmic jumping pace", status: "good" };

    const elevationFb: { text: string; status: "neutral" | "good" | "warn" | "bad" } = {
      text: `+${Math.round(rawElevation)}% lift`,
      status: rawElevation >= 10 ? "good" : "neutral",
    };

    return {
      signals: {
        primaryAngle: rawElevation,
        jumpElevation: rawElevation,
        kneeAngle,
        armsOverhead,
      },
      feedback: {
        depth: jumpFb,
        knee: landFb,
        core: cadenceFb,
        angle: elevationFb,
      },
      primaryValue: rawElevation,
      repCompleted,
      inPosition: true,
      statusMsg: "Tracking jumping dynamics & cadence",
    };
  }
}
