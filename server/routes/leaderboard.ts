import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { User, WorkoutSession } from "../db.js";

const JWT_SECRET = process.env.JWT_SECRET || "repform-ai-secure-jwt-secret-key-2026";
const router = Router();

function getOptionalUserId(req: Request): string | null {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
    const token = authHeader.split(" ")[1];
    const payload = jwt.verify(token, JWT_SECRET) as any;
    return payload?.sub || null;
  } catch {
    return null;
  }
}

// GET /api/leaderboard
router.get("/", async (req: Request, res: Response) => {
  try {
    const timeframe = String(req.query.timeframe || "all"); // 'all' | 'week' | 'today'
    const exercise = String(req.query.exercise || "all");
    const currentUserId = getOptionalUserId(req);

    // Calculate start date based on timeframe
    let since: Date | undefined;
    const now = new Date();
    if (timeframe === "today") {
      since = new Date(now);
      since.setHours(0, 0, 0, 0);
    } else if (timeframe === "week") {
      since = new Date(now);
      since.setDate(since.getDate() - 7);
      since.setHours(0, 0, 0, 0);
    }

    const [allSessions, allUsers] = await Promise.all([
      WorkoutSession.findAll({ exercise, since }),
      User.find(),
    ]);

    // Build map of users
    const userMap = new Map<string, { displayName: string; email: string }>();
    for (const u of allUsers) {
      userMap.set(String(u._id), {
        displayName: u.displayName || "Athlete",
        email: u.email || "",
      });
    }

    // Aggregate sessions by userId
    interface UserAgg {
      userId: string;
      totalReps: number;
      totalSessions: number;
      totalCalories: number;
      scores: number[];
      bestScore: number;
      exerciseCount: Record<string, number>;
    }

    const aggMap = new Map<string, UserAgg>();

    for (const s of allSessions) {
      const uId = String(s.userId);
      let entry = aggMap.get(uId);
      if (!entry) {
        entry = {
          userId: uId,
          totalReps: 0,
          totalSessions: 0,
          totalCalories: 0,
          scores: [],
          bestScore: 0,
          exerciseCount: {},
        };
        aggMap.set(uId, entry);
      }

      entry.totalReps += Number(s.reps) || 0;
      entry.totalSessions += 1;
      entry.totalCalories += Number(s.calories) || 0;
      if (s.avgScore) entry.scores.push(Number(s.avgScore));
      if (s.bestScore && s.bestScore > entry.bestScore) entry.bestScore = Number(s.bestScore);

      const ex = s.exercise || "squat";
      entry.exerciseCount[ex] = (entry.exerciseCount[ex] || 0) + 1;
    }

    // Convert to sorted leaderboard list
    const aggregatedList = Array.from(aggMap.values()).map((agg) => {
      const userInfo = userMap.get(agg.userId);
      const name = userInfo?.displayName || (agg.userId === currentUserId ? "You" : `Athlete #${agg.userId.slice(-4)}`);
      const avgScore = agg.scores.length > 0
        ? Math.round(agg.scores.reduce((a, b) => a + b, 0) / agg.scores.length)
        : 0;

      // Find top exercise
      let favEx = "squat";
      let maxExCount = 0;
      for (const [k, v] of Object.entries(agg.exerciseCount)) {
        if (v > maxExCount) {
          maxExCount = v;
          favEx = k;
        }
      }

      return {
        userId: agg.userId,
        displayName: name,
        avatarInitial: name.charAt(0).toUpperCase() || "A",
        totalReps: agg.totalReps,
        totalSessions: agg.totalSessions,
        totalCalories: agg.totalCalories,
        avgScore,
        bestScore: agg.bestScore || avgScore,
        favoriteExercise: favEx,
        isCurrentUser: Boolean(currentUserId && agg.userId === currentUserId),
      };
    });

    // Sort by totalReps desc, then avgScore desc
    aggregatedList.sort((a, b) => {
      if (b.totalReps !== a.totalReps) return b.totalReps - a.totalReps;
      return b.avgScore - a.avgScore;
    });

    // Assign rank
    const rankedList = aggregatedList.map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

    let currentUserRank = null;
    if (currentUserId) {
      const found = rankedList.find((r) => r.userId === currentUserId);
      if (found) {
        currentUserRank = found;
      } else {
        const u = userMap.get(currentUserId);
        const name = u?.displayName || "You";
        currentUserRank = {
          rank: rankedList.length + 1,
          userId: currentUserId,
          displayName: name,
          avatarInitial: name.charAt(0).toUpperCase() || "Y",
          totalReps: 0,
          totalSessions: 0,
          totalCalories: 0,
          avgScore: 0,
          bestScore: 0,
          favoriteExercise: exercise !== "all" ? exercise : "squat",
          isCurrentUser: true,
        };
      }
    }

    res.json({
      leaderboard: rankedList.slice(0, 50),
      currentUserRank,
      totalAthletes: rankedList.length,
      timeframe,
      exercise,
    });
  } catch (err: any) {
    console.error("[Leaderboard] Error:", err);
    res.status(500).json({ error: "Failed to generate leaderboard." });
  }
});

export default router;
