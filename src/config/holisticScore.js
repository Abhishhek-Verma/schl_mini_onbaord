export const HOLISTIC_WEIGHTS = {
  demo:       0.35,
  subject:    0.25,
  pedagogy:   0.25,
  experience: 0.15,
};

// Eligibility floors (below floor flags the candidate, regardless of overall score)
export const FLOORS = {
  pedagogy:   40,
  subject:    40,
  demo:       40,
  experience: 0,
};

export function scoreToProfileBand(s) {
  if (s >= 85) return "Outstanding";
  if (s >= 70) return "Strong";
  if (s >= 55) return "Promising";
  if (s >= 40) return "Marginal";
  return "Not Recommended";
}
