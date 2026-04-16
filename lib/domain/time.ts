export function formatRelativeTime(timestamp: number) {
  const diffMs = Date.now() - timestamp;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'az önce';
  if (min < 60) return `${min} dk önce`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} sa önce`;
  const day = Math.floor(hour / 24);
  return `${day} gün önce`;
}
