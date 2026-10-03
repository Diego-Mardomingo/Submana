import type { SharedProfile } from "./types";

/** Display name of a group: direct (1:1) groups are named after the other person. */
export function groupTitle(group: { name: string; kind: "group" | "direct" }, members: SharedProfile[], meId: string) {
  if (group.kind === "group") return group.name;
  return members.find((m) => m.user_id !== meId)?.display_name ?? group.name;
}
