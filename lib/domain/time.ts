export function formatRelativeTime(timestamp: number) {
  const diffMs = Date.now() - timestamp;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'Az önce';
  if (min < 60) return `${min} dk önce`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} sa önce`;
  const day = Math.floor(hour / 24);
  return `${day} gün önce`;
}

export function formatDateTime(timestamp: number | null | undefined) {
  if (!timestamp) return '—';
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(timestamp));
}

export function getStartOfTodayTimestamp() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}
