import React, { useEffect, useState } from "react";
import { api } from "../api";
import { LeaderboardEntry, LeaderboardResponse, ExerciseType, User } from "../types";
import {
  Trophy,
  X,
  Medal,
  Flame,
  Award,
  RefreshCw,
  Users,
  Target,
  Sparkles,
  Calendar,
  Filter,
} from "lucide-react";

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onOpenAuth: () => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onOpenAuth,
}) => {
  const [timeframe, setTimeframe] = useState<"all" | "week" | "today">("all");
  const [selectedExercise, setSelectedExercise] = useState<string>("all");
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getLeaderboard(timeframe, selectedExercise);
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load leaderboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLeaderboard();
    }
  }, [isOpen, timeframe, selectedExercise]);

  if (!isOpen) return null;

  const top3 = (data?.leaderboard || []).slice(0, 3);
  const remaining = (data?.leaderboard || []).slice(3);

  const formatExerciseName = (ex: string) => {
    switch (ex) {
      case "squat":
        return "Squats";
      case "pull_up":
        return "Pull-Ups";
      case "push_up":
        return "Push-Ups";
      case "jump":
        return "Jumping Task";
      default:
        return "All Exercises";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-[#0e1f2e] border border-[#1a3448] w-full max-w-4xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#1a3448] bg-[#0c1a28] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#f5a83c] to-[#d48b26] flex items-center justify-center text-[#03181e] shadow-sm shadow-[#f5a83c]/30">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base sm:text-lg font-bold text-[#eaf3fa] tracking-wide">
                  RepForm Global Leaderboard
                </h2>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-[#14293a] border border-[#1f5a68] text-[10px] font-mono text-[#35d0e8]">
                  LIVE RANKINGS
                </span>
              </div>
              <p className="text-xs text-[#9db3c2]">
                Compare total reps, workout volume, and biomechanical accuracy with fellow athletes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchLeaderboard}
              disabled={loading}
              className="p-2 rounded-lg bg-[#0e2434] hover:bg-[#14293a] text-[#9db3c2] hover:text-[#35d0e8] border border-[#1a3448] transition-colors"
              title="Refresh rankings"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-[#9db3c2] hover:text-[#eaf3fa] hover:bg-[#0e2434] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="px-5 py-3 bg-[#091522] border-b border-[#1a3448] flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Timeframe Tabs */}
          <div className="flex items-center gap-1 bg-[#0c1a28] p-1 rounded-lg border border-[#1a3448]">
            <button
              type="button"
              onClick={() => setTimeframe("all")}
              className={`px-3 py-1 rounded-md text-xs font-semibold tracking-wide transition-colors ${
                timeframe === "all"
                  ? "bg-[#0e2434] text-[#35d0e8] border border-[#1f5a68] shadow-sm"
                  : "text-[#9db3c2] hover:text-[#eaf3fa]"
              }`}
            >
              All Time
            </button>
            <button
              type="button"
              onClick={() => setTimeframe("week")}
              className={`px-3 py-1 rounded-md text-xs font-semibold tracking-wide transition-colors ${
                timeframe === "week"
                  ? "bg-[#0e2434] text-[#35d0e8] border border-[#1f5a68] shadow-sm"
                  : "text-[#9db3c2] hover:text-[#eaf3fa]"
              }`}
            >
              This Week
            </button>
            <button
              type="button"
              onClick={() => setTimeframe("today")}
              className={`px-3 py-1 rounded-md text-xs font-semibold tracking-wide transition-colors ${
                timeframe === "today"
                  ? "bg-[#0e2434] text-[#35d0e8] border border-[#1f5a68] shadow-sm"
                  : "text-[#9db3c2] hover:text-[#eaf3fa]"
              }`}
            >
              Today
            </button>
          </div>

          {/* Exercise Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: "all", label: "All Exercises" },
              { id: "squat", label: "Squats" },
              { id: "pull_up", label: "Pull-Ups" },
              { id: "push_up", label: "Push-Ups" },
              { id: "jump", label: "Jumps" },
            ].map((ex) => (
              <button
                key={ex.id}
                type="button"
                onClick={() => setSelectedExercise(ex.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  selectedExercise === ex.id
                    ? "bg-[#35d0e8] text-[#03181e] font-semibold shadow-sm"
                    : "bg-[#0c1a28] hover:bg-[#14293a] text-[#9db3c2] hover:text-[#eaf3fa] border border-[#1a3448]"
                }`}
              >
                {ex.label}
              </button>
            ))}
          </div>
        </div>

        {/* Modal Scroll Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Current User Standing Highlight */}
          {data?.currentUserRank && (
            <div className="bg-gradient-to-r from-[#14293a] via-[#0e2434] to-[#14293a] border border-[#35d0e8]/40 rounded-xl p-4 shadow-lg shadow-[#35d0e8]/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#35d0e8] to-[#1a8fa3] text-[#03181e] font-display font-bold text-base flex items-center justify-center shrink-0 shadow-md">
                  #{data.currentUserRank.rank}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display font-bold text-sm text-[#eaf3fa]">
                      Your Athlete Standing: {data.currentUserRank.displayName}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-[#35d0e8]/20 border border-[#35d0e8]/40 text-[10px] font-mono text-[#35d0e8]">
                      YOU
                    </span>
                  </div>
                  <p className="text-xs text-[#9db3c2] mt-0.5">
                    Ranked #{data.currentUserRank.rank} of {data.totalAthletes} athletes in {formatExerciseName(selectedExercise)} ({timeframe})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 self-end sm:self-center">
                <div className="text-right">
                  <div className="text-[10px] text-[#5c7a8e] uppercase font-semibold">Total Reps</div>
                  <div className="font-display font-bold text-lg text-[#eaf3fa]">
                    {data.currentUserRank.totalReps}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-[#5c7a8e] uppercase font-semibold">Avg Score</div>
                  <div className="font-display font-bold text-lg text-[#3ddc97]">
                    {data.currentUserRank.avgScore > 0 ? `${data.currentUserRank.avgScore}%` : "—"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {!currentUser && (
            <div className="bg-[#091522] border border-[#1a3448] rounded-xl p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs text-[#9db3c2]">
                <Sparkles className="w-4 h-4 text-[#f5a83c] shrink-0" />
                <span>Sign in or use 1-Click Demo Login to save your rank and appear on the leaderboard!</span>
              </div>
              <button
                type="button"
                onClick={onOpenAuth}
                className="px-3 py-1 rounded-lg bg-[#35d0e8] hover:bg-[#4fdcef] text-[#03181e] font-semibold text-xs tracking-wide transition-colors shrink-0"
              >
                Sign In
              </button>
            </div>
          )}

          {/* Loading State */}
          {loading && !data && (
            <div className="py-16 text-center space-y-3">
              <div className="w-10 h-10 border-2 border-[#35d0e8] border-t-transparent rounded-full animate-spin mx-auto" />
              <div className="text-xs text-[#9db3c2]">Retrieving athlete rankings from database...</div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="py-8 text-center bg-[#ef6461]/10 border border-[#ef6461]/30 rounded-xl p-4 text-xs text-[#ef6461] space-y-2">
              <p>{error}</p>
              <button
                type="button"
                onClick={fetchLeaderboard}
                className="px-3 py-1 rounded-md bg-[#0e2434] text-[#eaf3fa] border border-[#1a3448] hover:border-[#ef6461]"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Empty State */}
          {!loading && data && data.leaderboard.length === 0 && (
            <div className="py-16 text-center bg-[#091522] rounded-xl border border-[#1a3448] p-6 space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#0c1a28] border border-[#1a3448] flex items-center justify-center text-[#5c7a8e] mx-auto">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="font-display font-semibold text-sm text-[#eaf3fa]">
                No Workout Records Found
              </h3>
              <p className="text-xs text-[#9db3c2] max-w-sm mx-auto">
                No athletes have logged reps for {formatExerciseName(selectedExercise)} in this timeframe yet. Be the first to start a session and claim #1 rank!
              </p>
            </div>
          )}

          {/* Top 3 Podium Display */}
          {!loading && top3.length > 0 && (
            <div>
              <h3 className="font-display text-xs font-semibold text-[#5c7a8e] tracking-widest uppercase mb-3 flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-[#f5a83c]" />
                Top Performers
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {top3.map((athlete, idx) => {
                  const rank = idx + 1;
                  const rankBadge =
                    rank === 1
                      ? { bg: "from-[#f5a83c] to-[#ca8018]", text: "text-[#03181e]", border: "border-[#f5a83c]/50", shadow: "shadow-[#f5a83c]/15" }
                      : rank === 2
                      ? { bg: "from-[#9db3c2] to-[#718899]", text: "text-[#03181e]", border: "border-[#9db3c2]/40", shadow: "shadow-[#9db3c2]/10" }
                      : { bg: "from-[#c67d58] to-[#995333]", text: "text-[#03181e]", border: "border-[#c67d58]/40", shadow: "shadow-[#c67d58]/10" };

                  return (
                    <div
                      key={athlete.userId}
                      className={`relative bg-[#091522] border rounded-xl p-4 flex flex-col justify-between shadow-lg ${rankBadge.border} ${rankBadge.shadow} ${
                        athlete.isCurrentUser ? "ring-1 ring-[#35d0e8]" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-lg bg-gradient-to-br ${rankBadge.bg} ${rankBadge.text} font-display font-bold text-sm flex items-center justify-center shrink-0 shadow-sm`}
                          >
                            #{rank}
                          </div>
                          <div>
                            <div className="font-display font-bold text-sm text-[#eaf3fa] truncate max-w-[130px]">
                              {athlete.displayName}
                            </div>
                            <div className="text-[10px] text-[#5c7a8e] uppercase font-mono">
                              {formatExerciseName(athlete.favoriteExercise)}
                            </div>
                          </div>
                        </div>

                        {rank === 1 && <Medal className="w-5 h-5 text-[#f5a83c]" />}
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1a3448] text-xs">
                        <div>
                          <div className="text-[10px] text-[#5c7a8e] uppercase font-semibold">Reps</div>
                          <div className="font-display font-bold text-base text-[#eaf3fa]">
                            {athlete.totalReps}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-[#5c7a8e] uppercase font-semibold">Avg Form</div>
                          <div className="font-display font-bold text-base text-[#3ddc97]">
                            {athlete.avgScore}%
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Full Leaderboard List */}
          {!loading && remaining.length > 0 && (
            <div>
              <h3 className="font-display text-xs font-semibold text-[#5c7a8e] tracking-widest uppercase mb-2">
                All Athletes ({data?.totalAthletes})
              </h3>

              <div className="space-y-2">
                {remaining.map((athlete) => (
                  <div
                    key={athlete.userId}
                    className={`bg-[#091522] border rounded-xl p-3 flex items-center justify-between gap-3 transition-colors ${
                      athlete.isCurrentUser
                        ? "border-[#35d0e8]/50 bg-[#0e2434]"
                        : "border-[#1a3448] hover:border-[#2b5468]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-display font-bold text-sm text-[#5c7a8e] w-6 text-center">
                        #{athlete.rank}
                      </span>
                      <div className="w-8 h-8 rounded-full bg-[#14293a] border border-[#1a3448] flex items-center justify-center font-display font-bold text-xs text-[#35d0e8]">
                        {athlete.avatarInitial}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-display font-semibold text-xs text-[#eaf3fa]">
                            {athlete.displayName}
                          </span>
                          {athlete.isCurrentUser && (
                            <span className="px-1 py-0.2 rounded bg-[#35d0e8]/20 text-[9px] font-mono text-[#35d0e8]">
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-[#5c7a8e]">
                          {athlete.totalSessions} sessions · {formatExerciseName(athlete.favoriteExercise)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      <div className="text-right">
                        <div className="text-[10px] text-[#5c7a8e] uppercase font-semibold">Reps</div>
                        <div className="font-display font-bold text-sm text-[#eaf3fa]">
                          {athlete.totalReps}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-[#5c7a8e] uppercase font-semibold">Avg Form</div>
                        <div className="font-display font-bold text-sm text-[#3ddc97]">
                          {athlete.avgScore}%
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
