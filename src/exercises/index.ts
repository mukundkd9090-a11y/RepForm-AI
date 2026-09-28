import { ExerciseType, ExerciseMeta } from "../types";
import { ExerciseEngine } from "./types";
import { SquatEngine } from "./squat";
import { PullUpEngine } from "./pullUp";
import { JumpEngine } from "./jump";
import { PushUpEngine } from "./pushUp";

export * from "./types";
export * from "./squat";
export * from "./pullUp";
export * from "./jump";
export * from "./pushUp";

export function createExerciseEngine(type: ExerciseType): ExerciseEngine {
  switch (type) {
    case "pull_up":
      return new PullUpEngine();
    case "jump":
      return new JumpEngine();
    case "push_up":
      return new PushUpEngine();
    case "squat":
    default:
      return new SquatEngine();
  }
}

export const EXERCISE_DEFINITIONS: Record<ExerciseType, ExerciseMeta> = {
  squat: new SquatEngine().meta,
  pull_up: new PullUpEngine().meta,
  jump: new JumpEngine().meta,
  push_up: new PushUpEngine().meta,
};

export const EXERCISE_LIST: ExerciseMeta[] = [
  EXERCISE_DEFINITIONS.squat,
  EXERCISE_DEFINITIONS.pull_up,
  EXERCISE_DEFINITIONS.push_up,
  EXERCISE_DEFINITIONS.jump,
];
