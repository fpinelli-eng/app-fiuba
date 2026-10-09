import type { Profile } from "@/lib/auth";

// Foto de Google si hay; si no, iniciales sobre menta.
export function Avatar({ profile, size }: { profile: Profile; size: number }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.33) };
  if (profile.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profile.avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        style={style}
        className="rounded-full object-cover"
      />
    );
  }
  return (
    <span style={style} className="grid place-items-center rounded-full bg-mint font-bold text-mint-ink">
      {profile.initials}
    </span>
  );
}
