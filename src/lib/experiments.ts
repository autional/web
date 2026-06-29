interface Experiment {
  id: string;
  variants: { name: string; weight: number }[];
}

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return Math.abs(hash);
}

function getStoredVariant(experimentId: string): string | null {
  try {
    const key = `exp_${experimentId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.variant && parsed.expiresAt > Date.now()) {
        return parsed.variant;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function storeVariant(experimentId: string, variant: string): void {
  try {
    localStorage.setItem(
      `exp_${experimentId}`,
      JSON.stringify({ variant, expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 }),
    );
  } catch {
    // ignore
  }
}

export function getVariant(experiment: Experiment): string {
  const cached = getStoredVariant(experiment.id);
  if (cached && experiment.variants.some((v) => v.name === cached)) {
    return cached;
  }

  const totalWeight = experiment.variants.reduce((sum, v) => sum + v.weight, 0);
  const hash = hashString(experiment.id + (typeof window !== 'undefined' ? navigator.language || '' : ''));
  const point = hash % totalWeight;

  let cumulative = 0;
  for (const variant of experiment.variants) {
    cumulative += variant.weight;
    if (point < cumulative) {
      storeVariant(experiment.id, variant.name);
      trackExperiment(experiment.id, variant.name);
      return variant.name;
    }
  }

  return experiment.variants[0].name;
}

export function trackExperiment(experimentId: string, variant: string): void {
  try {
    const tracked = sessionStorage.getItem(`exp_tracked_${experimentId}`);
    if (tracked === variant) return;
    sessionStorage.setItem(`exp_tracked_${experimentId}`, variant);
  } catch {
    // ignore
  }
}
