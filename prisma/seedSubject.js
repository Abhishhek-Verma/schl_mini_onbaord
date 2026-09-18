import { prisma } from "../lib/prisma.js";
import { SUBJECTS, CLASS_MIN, CLASS_MAX } from "../src/config/subjectAssessment.js";

const TOPICS = {
  MATH: {
    6: ["Fractions & Decimals", "Integers", "Basic Geometrical Ideas"],
    7: ["Algebraic Expressions", "Lines and Angles", "Rational Numbers"],
    8: ["Linear Equations in One Variable", "Quadrilaterals", "Exponents and Powers"],
    9: ["Polynomials", "Coordinate Geometry", "Triangles"],
    10: ["Quadratic Equations", "Arithmetic Progressions", "Trigonometry"],
  },
  SCIENCE: {
    6: ["Components of Food", "Light & Reflections", "Body Movements"],
    7: ["Nutrition in Plants", "Acids, Bases & Salts", "Motion & Time"],
    8: ["Crop Production", "Force & Pressure", "Combustion & Flame"],
    9: ["Matter in Our Surroundings", "Laws of Motion", "Work & Energy"],
    10: ["Chemical Reactions", "Life Processes", "Light - Optics"],
  },
};

const DIFFICULTIES = ["EASY", "EASY", "EASY", "MEDIUM", "MEDIUM", "MEDIUM", "MEDIUM", "MEDIUM", "HARD", "HARD"];

async function main() {
  console.log("🌱 Seeding Dummy Subject Knowledge Questions...");

  let totalSeeded = 0;
  const countsPerSubjectClass = {};

  for (const subject of SUBJECTS) {
    for (let c = CLASS_MIN; c <= CLASS_MAX; c++) {
      const topicList = TOPICS[subject]?.[c] || [`General ${subject} Topics`];
      const key = `${subject}_Class_${c}`;
      countsPerSubjectClass[key] = 0;

      // Seed 10 questions per (subject, class): 8 MCQ, 2 MSQ
      for (let i = 1; i <= 10; i++) {
        const isMsq = i > 8;
        const codeNum = String(i).padStart(3, "0");
        const code = `${subject}-${c}-${codeNum}`;
        const topic = topicList[(i - 1) % topicList.length];
        const difficulty = DIFFICULTIES[i - 1] || "MEDIUM";
        const subjectLabel = subject === "MATH" ? "Mathematics" : "Science";

        const prompt = isMsq
          ? `[SAMPLE] Class ${c} ${subjectLabel} - Topic: ${topic} (Question ${i} - Select all that apply)`
          : `[SAMPLE] Class ${c} ${subjectLabel} - Topic: ${topic} (Question ${i})`;

        let options;
        if (isMsq) {
          options = [
            { key: "A", text: `[Sample correct statement 1 for ${topic}]`, correct: true },
            { key: "B", text: `[Sample incorrect statement 2 for ${topic}]`, correct: false },
            { key: "C", text: `[Sample correct statement 3 for ${topic}]`, correct: true },
            { key: "D", text: `[Sample incorrect statement 4 for ${topic}]`, correct: false },
          ];
        } else {
          options = [
            { key: "A", text: `[Sample correct option for ${topic}]`, score: 1 },
            { key: "B", text: `[Sample distractor B for ${topic}]`, score: 0 },
            { key: "C", text: `[Sample distractor C for ${topic}]`, score: 0 },
            { key: "D", text: `[Sample distractor D for ${topic}]`, score: 0 },
          ];
        }

        await prisma.subjectQuestion.upsert({
          where: { code },
          update: {
            subject,
            classLevel: c,
            board: "NEUTRAL",
            topic,
            difficulty,
            type: isMsq ? "MSQ" : "MCQ",
            prompt,
            options,
            isActive: true,
          },
          create: {
            code,
            subject,
            classLevel: c,
            board: "NEUTRAL",
            topic,
            difficulty,
            type: isMsq ? "MSQ" : "MCQ",
            prompt,
            options,
            isActive: true,
          },
        });

        countsPerSubjectClass[key]++;
        totalSeeded++;
      }
    }
  }

  console.log("\n📊 Per (Subject, Class) Seed Summary:");
  for (const [k, count] of Object.entries(countsPerSubjectClass)) {
    console.log(`  • ${k}: ${count} questions`);
  }
  console.log(`\n✅ Total dummy questions seeded: ${totalSeeded}\n`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
