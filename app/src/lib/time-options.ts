// 24-hour, 30-minute increment time options: "00:00", "00:30", ..., "23:30"
export const TIME_OPTIONS: string[] = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
});
