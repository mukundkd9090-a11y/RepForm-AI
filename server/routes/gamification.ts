import { Router, Response } from "express";
import { User, WorkoutSession, IUserGamification } from "../db.js";
import { requireAuth, AuthRequest } from "../auth.js";

const router = Router();
router.use(requireAuth);

function getLocalDateStr(d = new Date()): string {
  return d.toISOString().split("T")[0];
}

function getWeekMonday(d = new Date()): string {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date.toISOString().split("T")[0];
}

function getLevelFromXp(xp: number) {
  let level = 1;
  while (true) {
    const nextReq = 50 * (level + 1) * level;
    if (xp < nextReq) break;
    level++;
  }
  const levelStartXp = 50 * level * (level - 1);
  const nextLevelXp = 50 * (level + 1) * level;
  const xpInLevel = xp - levelStartXp;
  const levelSpan = nextLevelXp - levelStartXp;
  const progressPercent = Math.min(100, Math.max(0, Math.round((xpInLevel / levelSpan) * 100)));

  return {
    level,
    currentXp: xp,
    levelStartXp,
    nextLevelXp,
    xpToNextLevel: Math.max(0, nextLevelXp - xp),
    progressPercent,
  };
}

// Generate deterministic daily mission based on calendar date
function getDailyMissionConfig(dateStr: string) {
  const missions = [
    { exercise: "push_up", targetReps: 20, title: "20 Push-Ups", description: "Complete 20 strict push-ups with full chest depth" },
    { exercise: "squat", targetReps: 25, title: "25 Squats", description: "Hit 25 deep parallel squats with good knee tracking" },
    { exercise: "pull_up", targetReps: 8, title: "8 Pull-Ups", description: "Complete 8 dead-hang pull-ups clearing the bar" },
    { exercise: "jump", targetReps: 30, title: "30 Jumps", description: "Complete 30 explosive plyometric jumps with soft landing" },
    { exercise: "push_up", targetReps: 15, title: "15 Push-Ups", description: "Maintain a rigid plank for 15 locked-out push-ups" },
    { exercise: "squat", targetReps: 30, title: "30 Squats", description: "Perform 30 explosive squats with optimal depth" },
    { exercise: "jump", targetReps: 25, title: "25 Jumps", description: "Achieve 25 rhythmic jumps with overhead arm reach" },
  ];

  // Hash dateStr
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) % missions.length;
  }
  return { date: dateStr, ...missions[hash] };
}

// GET /api/gamification
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const allSessions = await (await WorkoutSession.find({ userId })).exec();

    const gam: IUserGamification = {
      xp: 0,
      streakFreezes: 1,
      streakFrozenDates: [],
      dailyRewardClaimedDates: [],
      claimedChallengeWeeks: [],
      ...(user.gamification || {}),
    };

    const todayStr = getLocalDateStr();
    const currentWeekMondayStr = getWeekMonday();

    // Group sessions by date
    const sessionsByDate = new Map<string, typeof allSessions>();
    for (const s of allSessions) {
      const dStr = getLocalDateStr(new Date(s.createdAt));
      const list = sessionsByDate.get(dStr) || [];
      list.push(s);
      sessionsByDate.set(dStr, list);
    }

    // --- 1. STREAK CALCULATION ---
    let streak = 0;
    const now = new Date();
    const todayHasSession = sessionsByDate.has(todayStr);

    let checkDate = new Date(now);
    if (!todayHasSession) {
      // Check yesterday
      checkDate.setDate(checkDate.getDate() - 1);
    }

    let isMissedYesterday = false;
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getLocalDateStr(yesterday);
    if (!sessionsByDate.has(yesterdayStr) && !gam.streakFrozenDates.includes(yesterdayStr)) {
      isMissedYesterday = true;
    }

    // Step back consecutive days
    while (true) {
      const dStr = getLocalDateStr(checkDate);
      const hasWorkout = sessionsByDate.has(dStr);
      const wasFrozen = gam.streakFrozenDates.includes(dStr);

      if (hasWorkout || wasFrozen) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    // Mon-Sun current week calendar days status
    const weekDays: { date: string; dayLabel: string; hasWorkout: boolean; isFrozen: boolean; isToday: boolean }[] = [];
    const monDate = new Date(currentWeekMondayStr + "T00:00:00");
    for (let i = 0; i < 7; i++) {
      const cur = new Date(monDate);
      cur.setDate(monDate.getDate() + i);
      const dStr = getLocalDateStr(cur);
      weekDays.push({
        date: dStr,
        dayLabel: cur.toLocaleDateString("en-US", { weekday: "short" }),
        hasWorkout: sessionsByDate.has(dStr),
        isFrozen: gam.streakFrozenDates.includes(dStr),
        isToday: dStr === todayStr,
      });
    }

    // --- 2. DAILY MISSION ---
    const missionConfig = getDailyMissionConfig(todayStr);
    const todaySessions = sessionsByDate.get(todayStr) || [];
    const todayExerciseReps = todaySessions
      .filter((s) => s.exercise === missionConfig.exercise)
      .reduce((sum, s) => sum + s.reps, 0);

    const isMissionCompleted = todayExerciseReps >= missionConfig.targetReps;
    const isDailyRewardClaimed = gam.dailyRewardClaimedDates.includes(todayStr);

    // --- 3. XP & LEVEL CALCULATION ---
    // User earns XP from gamification state + 10 XP per session + 1 XP per rep
    let calculatedXp = gam.xp;
    // Base workout XP
    for (const s of allSessions) {
      calculatedXp += 10 + (s.reps || 0);
    }
    // Daily mission bonus XP for days where missions were hit
    if (isMissionCompleted) {
      calculatedXp += 50;
    }

    const levelInfo = getLevelFromXp(calculatedXp);

    // --- 4. WEEKLY CHALLENGE ---
    const thisWeekSessions = allSessions.filter((s) => {
      const sDate = getLocalDateStr(new Date(s.createdAt));
      return sDate >= currentWeekMondayStr;
    });

    const weeklyChallengeTarget = 300; // 300 Total reps this week
    const weeklyChallengeCurrentReps = thisWeekSessions.reduce((sum, s) => sum + s.reps, 0);
    const isWeeklyChallengeCompleted = weeklyChallengeCurrentReps >= weeklyChallengeTarget;
    const isWeeklyChallengeClaimed = gam.claimedChallengeWeeks.includes(currentWeekMondayStr);

    // Calculate days left in week
    const sundayDate = new Date(monDate);
    sundayDate.setDate(monDate.getDate() + 6);
    const daysLeftInWeek = Math.max(1, Math.ceil((sundayDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    // --- 5. ACHIEVEMENTS ---
    const totalSessionsCount = allSessions.length;
    const totalRepsAllTime = allSessions.reduce((sum, s) => sum + s.reps, 0);
    const pushUpReps = allSessions.filter((s) => s.exercise === "push_up").reduce((sum, s) => sum + s.reps, 0);
    const squatReps = allSessions.filter((s) => s.exercise === "squat").reduce((sum, s) => sum + s.reps, 0);
    const pullUpReps = allSessions.filter((s) => s.exercise === "pull_up").reduce((sum, s) => sum + s.reps, 0);
    const jumpReps = allSessions.filter((s) => s.exercise === "jump").reduce((sum, s) => sum + s.reps, 0);
    const bestFormScore = allSessions.reduce((max, s) => Math.max(max, s.avgScore || 0, s.bestScore || 0), 0);

    const achievements = [
      {
        id: "first_step",
        title: "First Step",
        description: "Complete your first workout session",
        icon: "Footprints",
        category: "Milestone",
        progress: Math.min(1, totalSessionsCount),
        target: 1,
        unlocked: totalSessionsCount >= 1,
        rewardXp: 50,
      },
      {
        id: "streak_7",
        title: "Week Warrior",
        description: "Maintain a 7-day fitness streak",
        icon: "Flame",
        category: "Streak",
        progress: Math.min(7, streak),
        target: 7,
        unlocked: streak >= 7,
        rewardXp: 100,
      },
      {
        id: "streak_30",
        title: "Month Master",
        description: "Maintain a 30-day fitness streak",
        icon: "Crown",
        category: "Streak",
        progress: Math.min(30, streak),
        target: 30,
        unlocked: streak >= 30,
        rewardXp: 250,
      },
      {
        id: "pushup_100",
        title: "Push-Up Master",
        description: "Complete 100 valid push-ups",
        icon: "Dumbbell",
        category: "Exercise",
        progress: Math.min(100, pushUpReps),
        target: 100,
        unlocked: pushUpReps >= 100,
        rewardXp: 100,
      },
      {
        id: "squat_200",
        title: "Squat Machine",
        description: "Complete 200 deep squats",
        icon: "Activity",
        category: "Exercise",
        progress: Math.min(200, squatReps),
        target: 200,
        unlocked: squatReps >= 200,
        rewardXp: 100,
      },
      {
        id: "pullup_50",
        title: "Pull-Up Titan",
        description: "Complete 50 strict pull-ups",
        icon: "TrendingUp",
        category: "Exercise",
        progress: Math.min(50, pullUpReps),
        target: 50,
        unlocked: pullUpReps >= 50,
        rewardXp: 150,
      },
      {
        id: "jump_200",
        title: "Sky Bound",
        description: "Complete 200 plyometric jumps",
        icon: "Zap",
        category: "Exercise",
        progress: Math.min(200, jumpReps),
        target: 200,
        unlocked: jumpReps >= 200,
        rewardXp: 100,
      },
      {
        id: "reps_500",
        title: "Rep Machine",
        description: "Complete 500 total valid reps",
        icon: "Trophy",
        category: "Milestone",
        progress: Math.min(500, totalRepsAllTime),
        target: 500,
        unlocked: totalRepsAllTime >= 500,
        rewardXp: 200,
      },
      {
        id: "form_master",
        title: "Form Master",
        description: "Achieve a 95%+ biomechanics correctness score",
        icon: "Target",
        category: "Technique",
        progress: Math.min(95, bestFormScore),
        target: 95,
        unlocked: bestFormScore >= 95,
        rewardXp: 100,
      },
      {
        id: "iron_will",
        title: "Iron Will",
        description: "Use a Streak Freeze to protect your streak",
        icon: "Shield",
        category: "Streak",
        progress: gam.streakFrozenDates.length > 0 ? 1 : 0,
        target: 1,
        unlocked: gam.streakFrozenDates.length > 0,
        rewardXp: 50,
      },
    ];

    res.json({
      streak: {
        current: streak,
        freezesAvailable: gam.streakFreezes,
        isMissedYesterday: isMissedYesterday && streak > 0,
        canFreezeYesterday: isMissedYesterday && gam.streakFreezes > 0,
        weekDays,
      },
      dailyMission: {
        date: todayStr,
        exercise: missionConfig.exercise,
        title: missionConfig.title,
        description: missionConfig.description,
        targetReps: missionConfig.targetReps,
        currentReps: todayExerciseReps,
        completed: isMissionCompleted,
        rewardXp: 50,
        rewardClaimed: isDailyRewardClaimed,
      },
      level: levelInfo,
      weeklyChallenge: {
        id: `week_${currentWeekMondayStr}`,
        weekStart: currentWeekMondayStr,
        title: "500 Total Reps",
        description: "Log 300 total exercise repetitions this week",
        targetReps: weeklyChallengeTarget,
        currentReps: weeklyChallengeCurrentReps,
        completed: isWeeklyChallengeCompleted,
        rewardClaimed: isWeeklyChallengeClaimed,
        rewardXp: 200,
        daysLeft: daysLeftInWeek,
      },
      achievements,
    });
  } catch (err: any) {
    console.error("[Gamification] Error:", err);
    res.status(500).json({ error: "Failed to retrieve gamification data." });
  }
});

// POST /api/gamification/claim-daily-reward
router.post("/claim-daily-reward", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const todayStr = getLocalDateStr();
    const gam: IUserGamification = {
      xp: 0,
      streakFreezes: 1,
      streakFrozenDates: [],
      dailyRewardClaimedDates: [],
      claimedChallengeWeeks: [],
      ...(user.gamification || {}),
    };

    if (gam.dailyRewardClaimedDates.includes(todayStr)) {
      res.status(400).json({ error: "Today's daily reward has already been claimed." });
      return;
    }

    // Award mystery reward: 25-50 bonus XP (or extra freeze if 0 freezes)
    const bonusXp = 35;
    let awardedFreeze = false;
    if (gam.streakFreezes === 0 && Math.random() > 0.5) {
      gam.streakFreezes += 1;
      awardedFreeze = true;
    } else {
      gam.xp += bonusXp;
    }

    gam.dailyRewardClaimedDates.push(todayStr);

    await User.findByIdAndUpdate(userId, { gamification: gam });

    res.json({
      message: "Daily reward claimed successfully!",
      bonusXp: awardedFreeze ? 0 : bonusXp,
      awardedFreeze,
      newStreakFreezes: gam.streakFreezes,
    });
  } catch (err: any) {
    console.error("[ClaimDailyReward] Error:", err);
    res.status(500).json({ error: "Failed to claim daily reward." });
  }
});

// POST /api/gamification/use-streak-freeze
router.post("/use-streak-freeze", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const gam: IUserGamification = {
      xp: 0,
      streakFreezes: 1,
      streakFrozenDates: [],
      dailyRewardClaimedDates: [],
      claimedChallengeWeeks: [],
      ...(user.gamification || {}),
    };

    if (gam.streakFreezes <= 0) {
      res.status(400).json({ error: "No Streak Freezes available." });
      return;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getLocalDateStr(yesterday);

    if (gam.streakFrozenDates.includes(yesterdayStr)) {
      res.status(400).json({ error: "Streak Freeze already applied for yesterday." });
      return;
    }

    gam.streakFreezes -= 1;
    gam.streakFrozenDates.push(yesterdayStr);

    await User.findByIdAndUpdate(userId, { gamification: gam });

    res.json({
      message: "Streak Freeze applied! Your streak is protected.",
      streakFreezesLeft: gam.streakFreezes,
    });
  } catch (err: any) {
    console.error("[UseStreakFreeze] Error:", err);
    res.status(500).json({ error: "Failed to use streak freeze." });
  }
});

// POST /api/gamification/claim-challenge-reward
router.post("/claim-challenge-reward", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const currentWeekMondayStr = getWeekMonday();
    const gam: IUserGamification = {
      xp: 0,
      streakFreezes: 1,
      streakFrozenDates: [],
      dailyRewardClaimedDates: [],
      claimedChallengeWeeks: [],
      ...(user.gamification || {}),
    };

    if (gam.claimedChallengeWeeks.includes(currentWeekMondayStr)) {
      res.status(400).json({ error: "This week's challenge reward has already been claimed." });
      return;
    }

    gam.xp += 200;
    gam.claimedChallengeWeeks.push(currentWeekMondayStr);

    await User.findByIdAndUpdate(userId, { gamification: gam });

    res.json({
      message: "Weekly Challenge reward claimed! +200 XP",
      awardedXp: 200,
    });
  } catch (err: any) {
    console.error("[ClaimChallenge] Error:", err);
    res.status(500).json({ error: "Failed to claim challenge reward." });
  }
});

export default router;
