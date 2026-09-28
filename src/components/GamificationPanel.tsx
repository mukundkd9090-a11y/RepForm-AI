import React, { useEffect, useState, useCallback } from "react";
import { api } from "../api";
import { GamificationState, User } from "../types";
import {
  Flame,
  Star,
  Trophy,
  Shield,
  Target,
  Zap,
  CheckCircle2,
  Gift,
  ChevronDown,
  ChevronUp,
  Lock,
  Award,
  Footprints,
  Crown,
  Dumbbell,
  Activity,
  TrendingUp,
} from "lucide-react";

interface GamificationPanelProps {
  user: User | null;
  onOpenAuth: () => void;
  /** Called when a reward is claimed (to trigger toast in parent) */
  onToast: (msg: string) => void;
  /** Trigger re-fetch when a new rep session is saved */
  refreshTrigger?: number;
}

function getAchievementIcon(iconName: string, unlocked: boolean) {
  const cls = `w-4 h-4 ${unlocked ? "text-[#f5a83c]" : "text-[#5c7a8e]"}`;
  switch (iconName) {
    case "Footprints": return <Footprints className={cls} />;
    case "Flame": return <Flame className={cls} />;
    case "Crown": return <Crown className={cls} />;
    case "Dumbbell": return <Dumbbell className={cls} />;
    case "Activity": return <Activity className={cls} />;
    case "TrendingUp": return <TrendingUp className={cls} />;
    case "Zap": return <Zap className={cls} />;
    case "Trophy": return <Trophy className={cls} />;
    case "Target": return <Target className={cls} />;
    case "Shield": return <Shield className={cls} />;
    default: return <Star className={cls} />;
  }
}

function formatExerciseName(ex: string): string {
  switch (ex) {
    case "squat": return "Squats";
    case "pull_up": return "Pull-Ups";
    case "push_up": return "Push-Ups";
    case "jump": return "Jumping Task";
    default: return ex;
  }
}

export const GamificationPanel: React.FC<GamificationPanelProps> = ({
  user,
  onOpenAuth,
  onToast,
  refreshTrigger,
}) => {
  const [data, setData] = useState<GamificationState | null>(null);
  const [loading, setLoading] = useState(false);
  const [claimingDaily, setClaimingDaily] = useState(false);
  const [claimingChallenge, setClaimingChallenge] = useState(false);
  const [usingFreeze, setUsingFreeze] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);

  const fetchGamification = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await api.getGamification();
      setData(res);
    } catch {
      // Silently fail — guest users get no gamification
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchGamification();
  }, [fetchGamification, refreshTrigger]);

  const handleClaimDaily = async () => {
    if (claimingDaily) return;
    setClaimingDaily(true);
    try {
      const res = await api.claimDailyReward();
      onToast(
        res.awardedFreeze
          ? "🧊 Daily Reward: +1 Streak Freeze awarded!"
          : `🎁 Daily Reward claimed! +${res.bonusXp} XP`
      );
      await fetchGamification();
    } catch (err: any) {
      onToast(err.message || "Could not claim reward.");
    } finally {
      setClaimingDaily(false);
    }
  };

  const handleUseFreeze = async () => {
    if (usingFreeze) return;
    setUsingFreeze(true);
    try {
      await api.useStreakFreeze();
      onToast("🧊 Streak Freeze used! Yesterday is protected.");
      await fetchGamification();
    } catch (err: any) {
      onToast(err.message || "Could not use freeze.");
    } finally {
      setUsingFreeze(false);
    }
  };

  const handleClaimChallenge = async () => {
    if (claimingChallenge) return;
    setClaimingChallenge(true);
    try {
      const res = await api.claimChallengeReward();
      onToast(`🏆 Weekly Challenge reward claimed! +${res.awardedXp} XP`);
      await fetchGamification();
    } catch (err: any) {
      onToast(err.message || "Could not claim challenge reward.");
    } finally {
      setClaimingChallenge(false);
    }
  };

  // Not logged in — show teaser card
  if (!user) {
    return (
      <div className="bg-[#0e1f2e] border border-[#1a3448] rounded-xl p-4 shadow-sm">
        <h2 className="font-display text-xs font-semibold text-[#35d0e8] tracking-widest uppercase mb-3 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#35d0e8] shadow-[0_0_6px_#35d0e8]" />
          Gamification
        </h2>
        <div className="space-y-2.5 text-center py-3">
          <div className="flex justify-center gap-3 text-2xl mb-1">
            <Flame className="w-6 h-6 text-[#f5a83c]" />
            <Trophy className="w-6 h-6 text-[#f5a83c]" />
            <Star className="w-6 h-6 text-[#f5a83c]" />
          </div>
          <p className="text-xs text-[#9db3c2] leading-relaxed">
            Sign in to unlock XP levels, daily streaks, missions, achievements & weekly challenges.
          </p>
          <button
            type="button"
            onClick={onOpenAuth}
            className="w-full py-1.5 px-3 rounded-lg bg-gradient-to-r from-[#35d0e8] to-[#1a8fa3] text-[#03181e] text-xs font-bold tracking-wide transition-opacity hover:opacity-90 flex items-center justify-center gap-1.5 mt-1"
          >
            <Zap className="w-3.5 h-3.5" />
            Sign In to Unlock
          </button>
        </div>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="bg-[#0e1f2e] border border-[#1a3448] rounded-xl p-4 shadow-sm">
        <h2 className="font-display text-xs font-semibold text-[#35d0e8] tracking-widest uppercase mb-3 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#35d0e8] shadow-[0_0_6px_#35d0e8]" />
          Gamification
        </h2>
        <div className="flex items-center justify-center py-6">
          <div className="w-6 h-6 border-2 border-[#35d0e8] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { streak, dailyMission, level, weeklyChallenge, achievements } = data;
  const unlockedAchievements = achievements.filter((a) => a.unlocked).length;

  return (
    <div className="space-y-3">
      {/* ── XP Level Card ── */}
      <div className="bg-[#0e1f2e] border border-[#1a3448] rounded-xl p-4 shadow-sm">
        <h2 className="font-display text-xs font-semibold text-[#35d0e8] tracking-widest uppercase mb-3 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#35d0e8] shadow-[0_0_6px_#35d0e8]" />
          Athlete Level
        </h2>

        <div className="flex items-center gap-3 mb-2.5">
          {/* Level badge */}
          <div className="relative shrink-0">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#f5a83c] to-[#c86010] flex items-center justify-center shadow-lg shadow-[#f5a83c]/20">
              <span className="font-display font-black text-xl text-[#03181e]">{level.level}</span>
            </div>
            <Star className="absolute -top-1 -right-1 w-4 h-4 text-[#f5a83c] drop-shadow" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between mb-1">
              <span className="font-display font-bold text-sm text-[#eaf3fa]">
                Level {level.level}
              </span>
              <span className="text-[10px] text-[#9db3c2] font-mono">
                {level.currentXp} / {level.nextLevelXp} XP
              </span>
            </div>
            {/* XP Progress bar */}
            <div className="h-2 rounded-full bg-[#0c1a28] border border-[#1a3448] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#f5a83c] to-[#35d0e8] transition-all duration-700"
                style={{ width: `${level.progressPercent}%` }}
              />
            </div>
            <div className="text-[10px] text-[#5c7a8e] mt-0.5">
              {level.xpToNextLevel} XP to Level {level.level + 1}
            </div>
          </div>
        </div>
      </div>

      {/* ── Streak Card ── */}
      <div className="bg-[#0e1f2e] border border-[#1a3448] rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="font-display text-xs font-semibold text-[#35d0e8] tracking-widest uppercase flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#35d0e8] shadow-[0_0_6px_#35d0e8]" />
            Daily Streak
          </h2>
          <div className="flex items-center gap-1 bg-[#091522] border border-[#1a3448] rounded-lg px-2 py-0.5">
            <Flame className="w-3.5 h-3.5 text-[#f5a83c]" />
            <span className="font-display font-bold text-sm text-[#f5a83c]">{streak.current}</span>
          </div>
        </div>

        {/* Week calendar */}
        <div className="grid grid-cols-7 gap-1 mb-3">
          {streak.weekDays.map((day) => (
            <div key={day.date} className="flex flex-col items-center gap-1">
              <div className="text-[9px] text-[#5c7a8e] font-mono uppercase">{day.dayLabel.slice(0, 1)}</div>
              <div
                className={`w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold transition-all ${
                  day.isToday
                    ? "ring-1 ring-[#35d0e8]"
                    : ""
                } ${
                  day.hasWorkout
                    ? "bg-gradient-to-br from-[#f5a83c] to-[#c86010] text-[#03181e] shadow-sm shadow-[#f5a83c]/20"
                    : day.isFrozen
                    ? "bg-[#1a3448] border border-[#35d0e8]/40 text-[#35d0e8]"
                    : "bg-[#091522] border border-[#1a3448] text-[#5c7a8e]"
                }`}
              >
                {day.hasWorkout ? (
                  <Flame className="w-3 h-3" />
                ) : day.isFrozen ? (
                  <Shield className="w-3 h-3" />
                ) : (
                  <span className="text-[9px]">·</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Freeze status + CTA */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-[#9db3c2]">
            <Shield className="w-3.5 h-3.5 text-[#35d0e8]" />
            <span>{streak.freezesAvailable} freeze{streak.freezesAvailable !== 1 ? "s" : ""} available</span>
          </div>
          {streak.canFreezeYesterday && (
            <button
              type="button"
              onClick={handleUseFreeze}
              disabled={usingFreeze}
              className="text-[10px] px-2 py-0.5 rounded-md bg-[#14293a] hover:bg-[#1a3448] border border-[#35d0e8]/50 text-[#35d0e8] font-semibold transition-colors disabled:opacity-50"
            >
              {usingFreeze ? "Applying…" : "🧊 Freeze Yesterday"}
            </button>
          )}
        </div>
      </div>

      {/* ── Daily Mission Card ── */}
      <div className={`bg-[#0e1f2e] border rounded-xl p-4 shadow-sm transition-colors ${
        dailyMission.completed ? "border-[#3ddc97]/40" : "border-[#1a3448]"
      }`}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display text-xs font-semibold text-[#35d0e8] tracking-widest uppercase flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#35d0e8] shadow-[0_0_6px_#35d0e8]" />
            Daily Mission
          </h2>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#091522] border border-[#1a3448] text-[#5c7a8e]">
            +{dailyMission.rewardXp} XP
          </span>
        </div>

        <div className="mb-2">
          <div className="font-display font-bold text-sm text-[#eaf3fa]">{dailyMission.title}</div>
          <div className="text-[11px] text-[#9db3c2] mt-0.5">{dailyMission.description}</div>
          <div className="text-[10px] text-[#5c7a8e] mt-0.5 font-mono">
            Exercise: {formatExerciseName(dailyMission.exercise)}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-[#9db3c2]">Progress</span>
            <span className="text-[10px] font-mono text-[#eaf3fa]">
              {Math.min(dailyMission.currentReps, dailyMission.targetReps)}/{dailyMission.targetReps} reps
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-[#0c1a28] border border-[#1a3448] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                dailyMission.completed
                  ? "bg-gradient-to-r from-[#3ddc97] to-[#2aa876]"
                  : "bg-gradient-to-r from-[#35d0e8] to-[#1a8fa3]"
              }`}
              style={{
                width: `${Math.min(100, (dailyMission.currentReps / dailyMission.targetReps) * 100)}%`,
              }}
            />
          </div>
        </div>

        {dailyMission.completed && !dailyMission.rewardClaimed && (
          <button
            type="button"
            onClick={handleClaimDaily}
            disabled={claimingDaily}
            className="w-full py-1.5 px-3 rounded-lg bg-gradient-to-r from-[#3ddc97] to-[#2aa876] text-[#03181e] text-xs font-bold tracking-wide flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Gift className="w-3.5 h-3.5" />
            {claimingDaily ? "Claiming…" : "Claim Daily Reward!"}
          </button>
        )}

        {dailyMission.rewardClaimed && (
          <div className="flex items-center gap-1.5 text-[11px] text-[#3ddc97] font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Reward claimed for today!
          </div>
        )}

        {!dailyMission.completed && (
          <div className="text-[11px] text-[#9db3c2]">
            Do {Math.max(0, dailyMission.targetReps - dailyMission.currentReps)} more {formatExerciseName(dailyMission.exercise)} today!
          </div>
        )}
      </div>

      {/* ── Weekly Challenge Card ── */}
      <div className={`bg-[#0e1f2e] border rounded-xl p-4 shadow-sm transition-colors ${
        weeklyChallenge.completed ? "border-[#f5a83c]/40" : "border-[#1a3448]"
      }`}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display text-xs font-semibold text-[#35d0e8] tracking-widest uppercase flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#35d0e8] shadow-[0_0_6px_#35d0e8]" />
            Weekly Challenge
          </h2>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#091522] border border-[#1a3448] text-[#5c7a8e]">
              +{weeklyChallenge.rewardXp} XP
            </span>
            <span className="text-[10px] text-[#9db3c2]">{weeklyChallenge.daysLeft}d left</span>
          </div>
        </div>

        <div className="mb-2">
          <div className="font-display font-bold text-sm text-[#eaf3fa]">{weeklyChallenge.title}</div>
          <div className="text-[11px] text-[#9db3c2] mt-0.5">{weeklyChallenge.description}</div>
        </div>

        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-[#9db3c2]">Total Reps This Week</span>
            <span className="text-[10px] font-mono text-[#eaf3fa]">
              {Math.min(weeklyChallenge.currentReps, weeklyChallenge.targetReps)}/{weeklyChallenge.targetReps}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-[#0c1a28] border border-[#1a3448] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                weeklyChallenge.completed
                  ? "bg-gradient-to-r from-[#f5a83c] to-[#c86010]"
                  : "bg-gradient-to-r from-[#35d0e8] to-[#1a8fa3]"
              }`}
              style={{
                width: `${Math.min(100, (weeklyChallenge.currentReps / weeklyChallenge.targetReps) * 100)}%`,
              }}
            />
          </div>
        </div>

        {weeklyChallenge.completed && !weeklyChallenge.rewardClaimed && (
          <button
            type="button"
            onClick={handleClaimChallenge}
            disabled={claimingChallenge}
            className="w-full py-1.5 px-3 rounded-lg bg-gradient-to-r from-[#f5a83c] to-[#c86010] text-[#03181e] text-xs font-bold tracking-wide flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Trophy className="w-3.5 h-3.5" />
            {claimingChallenge ? "Claiming…" : "Claim Weekly Reward!"}
          </button>
        )}

        {weeklyChallenge.rewardClaimed && (
          <div className="flex items-center gap-1.5 text-[11px] text-[#f5a83c] font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Reward claimed this week!
          </div>
        )}
      </div>

      {/* ── Achievements Card ── */}
      <div className="bg-[#0e1f2e] border border-[#1a3448] rounded-xl p-4 shadow-sm">
        <button
          type="button"
          onClick={() => setShowAchievements((p) => !p)}
          className="w-full flex items-center justify-between"
        >
          <h2 className="font-display text-xs font-semibold text-[#35d0e8] tracking-widest uppercase flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#35d0e8] shadow-[0_0_6px_#35d0e8]" />
            Achievements
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#091522] border border-[#1a3448] text-[#f5a83c]">
              {unlockedAchievements}/{achievements.length}
            </span>
            {showAchievements ? (
              <ChevronUp className="w-3.5 h-3.5 text-[#9db3c2]" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-[#9db3c2]" />
            )}
          </div>
        </button>

        {showAchievements && (
          <div className="mt-3 space-y-2">
            {achievements.map((ach) => (
              <div
                key={ach.id}
                className={`flex items-center gap-2.5 p-2.5 rounded-lg border transition-colors ${
                  ach.unlocked
                    ? "bg-[#091522] border-[#f5a83c]/30 shadow-sm shadow-[#f5a83c]/5"
                    : "bg-[#091522]/50 border-[#1a3448] opacity-70"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    ach.unlocked
                      ? "bg-gradient-to-br from-[#f5a83c]/20 to-[#c86010]/10 border border-[#f5a83c]/30"
                      : "bg-[#0c1a28] border border-[#1a3448]"
                  }`}
                >
                  {ach.unlocked ? (
                    getAchievementIcon(ach.icon, true)
                  ) : (
                    <Lock className="w-3.5 h-3.5 text-[#5c7a8e]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`font-display font-semibold text-xs ${ach.unlocked ? "text-[#eaf3fa]" : "text-[#5c7a8e]"}`}>
                    {ach.title}
                  </div>
                  <div className="text-[10px] text-[#5c7a8e] truncate">{ach.description}</div>
                  {!ach.unlocked && (
                    <div className="mt-1 h-1 rounded-full bg-[#0c1a28] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#2b5468] transition-all"
                        style={{ width: `${Math.min(100, (ach.progress / ach.target) * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
                <div className="text-[10px] text-[#f5a83c] font-mono shrink-0">
                  +{ach.rewardXp}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
