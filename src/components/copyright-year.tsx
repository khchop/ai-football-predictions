/**
 * Copyright year component for PPR compatibility.
 * Hardcoded to 2026 to avoid new Date() issues with static prerendering.
 * Update annually or make dynamic after uncached data access in parent.
 */
export function CopyrightYear() {
  return <>2026</>;
}
