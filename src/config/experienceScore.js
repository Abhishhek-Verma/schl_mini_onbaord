export const EXPERIENCE_WEIGHTS = {
  years:         0.45, // Diminishing returns curve
  qualification: 0.25,
  relevance:     0.20, // Taught subjects/classes vs open-to (role fit)
  boardMatch:    0.10,
};

export const EXP = {
  yearsSaturationAt: 10, // Years beyond which extra years barely add
  qualificationRanks: {
    PHD:       1.0,
    MASTERS:   0.8,
    BED:       0.8,
    BACHELORS: 0.6,
    DIPLOMA:   0.45,
    DEFAULT:   0.4,
  },
};
