import type { Transfer } from "./debts";
import type { SplitMode } from "./splits";

/** Public identity of a user as seen by friends and group members. */
export interface SharedProfile {
  user_id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
}

export interface GroupSummary {
  id: string;
  name: string;
  archived_at: string | null;
  created_at: string;
  members: SharedProfile[];
  /** My net position in the group in cents: positive = the group owes me. */
  my_net_cents: number;
}

export interface SharedShare {
  user_id: string;
  amount: number;
  weight: number | null;
}

export interface SharedExpenseItem {
  id: string;
  group_id: string;
  kind: "expense" | "settlement";
  title: string;
  total_amount: number;
  date: string;
  paid_by: string;
  split_mode: SplitMode;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  shares: SharedShare[];
}

export interface SharedEventItem {
  id: string;
  action: "created" | "updated" | "deleted" | "settled" | "member_added" | "member_removed";
  actor_id: string;
  expense_id: string | null;
  summary: Record<string, unknown>;
  created_at: string;
}

export interface GroupDetailData {
  group: Omit<GroupSummary, "my_net_cents" | "members">;
  members: SharedProfile[];
  /** Profiles of people who left but still appear in expenses. */
  extra_profiles: SharedProfile[];
  expenses: SharedExpenseItem[];
  has_more: boolean;
  nets: { user_id: string; net_cents: number }[];
  transfers: Transfer[];
  events: SharedEventItem[];
}

export interface FriendBalance {
  profile: SharedProfile;
  /** Positive: they owe me. Negative: I owe them. */
  cents: number;
  groups: { group_id: string; cents: number }[];
}

export interface BalancesData {
  owed_to_me_cents: number;
  i_owe_cents: number;
  friends: FriendBalance[];
}

export interface SplitInput {
  group_id: string;
  title: string;
  /** Total in euros. */
  total: number;
  date: string;
  paid_by: string;
  split_mode: SplitMode;
  /** value: exact = euros, percent = %, shares = weight; ignored for equal. */
  participants: { user_id: string; value?: number }[];
}
