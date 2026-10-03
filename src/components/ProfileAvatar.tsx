import { initialsAvatarDataUri } from "@/lib/initialsAvatar";
import { cn } from "@/lib/utils";

/** Round avatar: the Google photo when there is one, otherwise a stable initials badge. */
export function ProfileAvatar({ name, url, size = 40, className }: { name: string; url?: string | null; size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote Google photo or data URI
    <img
      src={url || initialsAvatarDataUri(name)}
      alt=""
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      className={cn("rounded-full object-cover shrink-0", className)}
      style={{ width: size, height: size }}
    />
  );
}
