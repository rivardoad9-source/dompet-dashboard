export type TxType = "in" | "out";

export type ThemeName = "warm" | "midnight";

export interface Transaction {
  id: string;
  type: TxType;
  /** Always a positive number. `type` carries the direction. */
  amount: number;
  categoryId: string;
  note: string;
  /** ISO date, `YYYY-MM-DD`. */
  date: string;
  createdAt: number;
}

/** Monthly spending ceiling ("plafon") for one expense category. */
export interface Budget {
  categoryId: string;
  limit: number;
}

export interface Deposit {
  id: string;
  amount: number;
  date: string;
  note: string;
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  /** ISO date the goal should be reached by. Empty string = no deadline. */
  deadline: string;
  colorVar: string;
  deposits: Deposit[];
}

export interface Settings {
  name: string;
  theme: ThemeName;
  /** Hide every rupiah figure behind a mask — handy for demos and screenshots. */
  privacy: boolean;
}

export interface AppState {
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  settings: Settings;
}

/** Budget health thresholds from the PRD: <70% aman, 70–90% waspada, >90% overbudget. */
export type BudgetStatus = "safe" | "warning" | "over";
