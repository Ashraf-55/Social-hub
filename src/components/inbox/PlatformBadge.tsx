const COLORS: Record<string, string> = {
  WHATSAPP: "bg-green-100 text-green-700",
  MESSENGER: "bg-blue-100 text-blue-700",
  INSTAGRAM: "bg-pink-100 text-pink-700",
  TIKTOK: "bg-gray-200 text-[var(--text-primary)]"
};

export function PlatformBadge({ platform }: { platform: string }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${COLORS[platform] ?? "bg-[var(--bg-muted)] text-[var(--text-secondary)]"}`}>
      {platform}
    </span>
  );
}
