export const DEMO_WEIGHTS = {
  subjectDelivery:      0.30,
  clarity:              0.20,
  structure:            0.20,
  engagementProxy:      0.20, // PROXY — label as such in UI
  professionalismProxy: 0.10, // PROXY
};

// Which demo sub-scores complete each written test (for holistic pairing)
export const COMPLETES = {
  subject:  ["subjectDelivery"],
  pedagogy: ["structure", "engagementProxy", "clarity"],
};

export const DEMO = {
  targetMinMinutes: 6,
  targetMaxMinutes: 8,
  fillerRatePenaltyStart: 0.06,
  deadAirSecondsPenaltyStart: 8,
  minTranscriptChars: 400, // below this, captions considered unusable -> audio fallback
};

export const AI = {
  transcriptionModel: "whisper-1",
  extractionModel: "gpt-5.6-luna",
  maxTranscriptChars: 40000,
};

export function scoreToDemoBand(s) {
  if (s >= 85) return "Excellent";
  if (s >= 70) return "Strong";
  if (s >= 50) return "Adequate";
  return "Weak";
}
