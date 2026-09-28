export interface User {
  _id: string;
  email: string;
  displayName: string;
  bodyWeightKg: number;
  targetReps: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

export type ExerciseType = "squat" | "pull_up" | "jump" | "push_up";

export interface ExerciseMeta {
  id: ExerciseType;
  name: string;
  shortName: string;
  category: "Lower Body" | "Upper Body" | "Full Body & Plyometrics";
  description: string;
  primaryJoint: string;
  metValue: number;
  iconName: string;
  guidelines: string[];
}

export interface WorkoutSession {
  _id: string;
  userId: string;
  exercise: string;
  reps: number;
  targetReps: number;
  durationSeconds: number;
  calories: number;
  avgScore: number;
  bestScore: number;
  repScores: number[];
  flagsSummary: {
    valgusDetectedCount?: number;
    forwardLeanCount?: number;
    shallowDepthCount?: number;
    optimalDepthCount?: number;
    incompleteLockoutCount?: number;
    hipSagCount?: number;
    swingKipCount?: number;
    stiffLandingCount?: number;
    [key: string]: number | undefined;
  };
  notes?: string;
  createdAt: string;
}

export interface AnalyticsData {
  last7Days: {
    date: string;
    dayLabel: string;
    reps: number;
    avgScore: number;
    count: number;
  }[];
  totalSessions: number;
  totalReps: number;
  totalCalories: number;
  overallAvgScore: number;
  bestScoreEver: number;
}

export interface TodayStats {
  repsToday: number;
  caloriesToday: number;
  avgScoreToday: number | null;
  sessionsCountToday: number;
}

export interface DbStatus {
  mode: "mongodb_atlas" | "embedded_store";
  connected: boolean;
  uriConfigured: boolean;
  message: string;
  databaseName?: string;
}

export interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;
  database: DbStatus;
}

export interface PoseSignals {
  primaryAngle: number | null;
  kneeAngle?: number | null;
  elbowAngle?: number | null;
  torsoAngle?: number | null;
  plankAngle?: number | null;
  jumpHeightNormalized?: number | null;
  valgus?: boolean;
  forwardLean?: boolean;
  hipSag?: boolean;
  kipping?: boolean;
  stiffLanding?: boolean;
  [key: string]: any;
}

export interface FeedbackSlot {
  text: string;
  status: "neutral" | "good" | "warn" | "bad";
}

export interface TechniqueFeedback {
  depth: FeedbackSlot;
  knee: FeedbackSlot;
  core: FeedbackSlot;
  angle: FeedbackSlot;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatarInitial: string;
  totalReps: number;
  totalSessions: number;
  totalCalories: number;
  avgScore: number;
  bestScore: number;
  favoriteExercise: string;
  isCurrentUser?: boolean;
}

export interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  currentUserRank: LeaderboardEntry | null;
  totalAthletes: number;
  timeframe: "all" | "week" | "today";
  exercise: string;
}

export interface StreakDay {
  date: string;
  dayLabel: string;
  hasWorkout: boolean;
  isFrozen: boolean;
  isToday: boolean;
}

export interface StreakInfo {
  current: number;
  freezesAvailable: number;
  isMissedYesterday: boolean;
  canFreezeYesterday: boolean;
  weekDays: StreakDay[];
}

export interface DailyMission {
  date: string;
  exercise: string;
  title: string;
  description: string;
  targetReps: number;
  currentReps: number;
  completed: boolean;
  rewardXp: number;
  rewardClaimed: boolean;
}

export interface LevelInfo {
  level: number;
  currentXp: number;
  levelStartXp: number;
  nextLevelXp: number;
  xpToNextLevel: number;
  progressPercent: number;
}

export interface WeeklyChallenge {
  id: string;
  weekStart: string;
  title: string;
  description: string;
  targetReps: number;
  currentReps: number;
  completed: boolean;
  rewardClaimed: boolean;
  rewardXp: number;
  daysLeft: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  progress: number;
  target: number;
  unlocked: boolean;
  rewardXp: number;
}

export interface GamificationState {
  streak: StreakInfo;
  dailyMission: DailyMission;
  level: LevelInfo;
  weeklyChallenge: WeeklyChallenge;
  achievements: Achievement[];
}

export interface ClaimDailyRewardResponse {
  message: string;
  bonusXp: number;
  awardedFreeze: boolean;
  newStreakFreezes: number;
}

