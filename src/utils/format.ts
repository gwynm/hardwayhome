/**
 * Format seconds-per-km as "m:ss" pace string.
 * Returns "--:--" if value is null/undefined/non-finite.
 */
export function formatPace(secPerKm: number | null | undefined): string {
  if (secPerKm == null || !isFinite(secPerKm) || secPerKm <= 0) return '--:--';
  const minutes = Math.floor(secPerKm / 60);
  const seconds = Math.floor(secPerKm % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format distance in metres as "X.XX km".
 */
export function formatDistance(metres: number | null | undefined): string {
  if (metres == null) return '0.00 km';
  return `${(metres / 1000).toFixed(2)} km`;
}

/**
 * Format a duration in seconds as "H:MM:SS" or "M:SS".
 */
export function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 0) totalSeconds = 0;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Format BPM as a string, or "--" if null.
 */
export function formatBpm(bpm: number | null | undefined): string {
  if (bpm == null) return '--';
  return Math.round(bpm).toString();
}

/**
 * Format an ISO date string as a short date with time: "13 Feb 14:02".
 * Includes year if not the current year: "13 Feb 2025 14:02".
 */
export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const time = `${hours}:${minutes}`;
  if (date.getFullYear() === now.getFullYear()) {
    return `${day} ${month} ${time}`;
  }
  return `${day} ${month} ${date.getFullYear()} ${time}`;
}
