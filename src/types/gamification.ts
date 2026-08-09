export type GameCurrency = "xp" | "coins";

export type GamificationView = {
  level: number;
  totalXp: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPercent: number;
  coins: number;
};

export type GamificationLedgerView = {
  id: string;
  currency: GameCurrency;
  delta: number;
  balanceAfter: number;
  reason: string;
  createdAt: string;
};

export type GamificationRulesView = {
  enabledAt: string;
  homeworkOnTimeCoins: number;
  homeworkLateCoins: number;
  homeworkMissedCoins: number;
  passportOnTimeCoins: number;
  passportLateCoins: number;
  passportMissedCoins: number;
  routineXp: number;
  levelBaseXp: number;
};
