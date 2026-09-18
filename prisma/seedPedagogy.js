import { prisma } from "../lib/prisma.js";

async function main() {
  console.log("🌱 Seeding placeholder pedagogy questions...");

  // Delete existing placeholder questions to ensure a clean slate
  await prisma.pedagogyQuestion.deleteMany({
    where: {
      code: {
        in: ["MCQ_DEMO_1", "MSQ_DEMO_1", "SJT_DEMO_1", "CASE1_P1", "CASE1_P2"],
      },
    },
  });

  const placeholderQuestions = [
    // 1. MCQ (Quality-weighted single select)
    {
      code: "MCQ_DEMO_1",
      section: "CLASSROOM_MANAGEMENT",
      type: "MCQ",
      prompt:
        "During independent practice, two students in the back row consistently talk and disrupt their peers. What is the most effective immediate instructional response?",
      options: [
        {
          key: "A",
          text: "Move toward their desks while continuing instruction, establishing proximity without interrupting class momentum.",
          score: 1.0,
        },
        {
          key: "B",
          text: "Pause the class and issue a formal verbal reminder to both students regarding the classroom norms.",
          score: 0.6,
        },
        {
          key: "C",
          text: "Send both students to the hallway immediately to preserve the learning environment for others.",
          score: 0.1,
        },
        {
          key: "D",
          text: "Ignore the conversation unless other students raise complaints.",
          score: 0.0,
        },
      ],
      expertRanking: null,
      maxDistance: null,
      caseGroup: null,
      casePart: null,
      coherenceBonus: null,
      isActive: true,
    },

    // 2. MSQ (Multiple-select with penalty & floor)
    {
      code: "MSQ_DEMO_1",
      section: "ASSESSMENT_FEEDBACK",
      type: "MSQ",
      prompt:
        "Which of the following strategies represent effective formative assessment techniques during an active lesson? (Select all that apply)",
      options: [
        {
          key: "A",
          text: "Exit tickets that prompt students to summarize the core concept and note lingering questions.",
          correct: true,
        },
        {
          key: "B",
          text: "Real-time anonymous pulse checks using mini whiteboards or digital poll prompts.",
          correct: true,
        },
        {
          key: "C",
          text: "Surprise end-of-term exams counting for 40% of the final semester grade.",
          correct: false,
        },
        {
          key: "D",
          text: "Think-Pair-Share with targeted teacher sampling across diverse proficiency levels.",
          correct: true,
        },
      ],
      expertRanking: null,
      maxDistance: null,
      caseGroup: null,
      casePart: null,
      coherenceBonus: null,
      isActive: true,
    },

    // 3. SJT (Situational Judgment - Rank order)
    {
      code: "SJT_DEMO_1",
      section: "STUDENT_PSYCHOLOGY",
      type: "SJT",
      prompt:
        "A typically high-performing student has abruptly stopped submitting assignments and appears withdrawn. Rank the following actions from most effective (1) to least effective (4):",
      options: [
        {
          key: "A",
          text: "Schedule a private 1-on-1 check-in to express supportive concern and listen to their situation.",
        },
        {
          key: "B",
          text: "Consult with school counseling or pastoral staff to check for broader patterns or external difficulties.",
        },
        {
          key: "C",
          text: "Publicly ask the student in class why their recent performance has dipped.",
        },
        {
          key: "D",
          text: "Contact parents directly with a supportive tone inquiring if recent changes at home might be affecting the student.",
        },
      ],
      expertRanking: ["A", "D", "B", "C"],
      maxDistance: 8, // 4 items: floor(4*4/2) = 8
      caseGroup: null,
      casePart: null,
      coherenceBonus: null,
      isActive: true,
    },

    // 4. CASE Group (Linked multi-part with coherence bonus)
    {
      code: "CASE1_P1",
      section: "COMPLEX_SCENARIO",
      type: "CASE",
      caseGroup: "CASE1",
      casePart: 1,
      coherenceBonus: 0.5,
      prompt:
        "[Part 1 of 2] Scenario: You introduce a complex project, but several students show signs of cognitive overload and anxiety about getting started. How do you adjust the launch phase?",
      options: [
        {
          key: "A",
          text: "Deconstruct the project into milestone micro-tasks with clear exemplars and scaffolding rubrics.",
          score: 1.0,
          orientation: "STRUCTURED_INQUIRY",
        },
        {
          key: "B",
          text: "Provide step-by-step scripted instructions that dictate every action for the entire class.",
          score: 0.6,
          orientation: "DIRECTIVE",
        },
        {
          key: "C",
          text: "Tell students that struggling is part of the process and leave them to figure it out collaboratively.",
          score: 0.2,
          orientation: "AUTONOMOUS",
        },
      ],
      expertRanking: null,
      maxDistance: null,
      isActive: true,
    },
    {
      code: "CASE1_P2",
      section: "COMPLEX_SCENARIO",
      type: "CASE",
      caseGroup: "CASE1",
      casePart: 2,
      coherenceBonus: 0.5,
      prompt:
        "[Part 2 of 2] Midway through the project, two groups make rapid progress while another group is stuck on the planning milestone. How do you facilitate differentiation?",
      options: [
        {
          key: "A",
          text: "Conduct a targeted small-group workshop with guided questioning while self-directed groups continue with extension tasks.",
          score: 1.0,
          orientation: "STRUCTURED_INQUIRY",
        },
        {
          key: "B",
          text: "Halt all group work and re-teach the planning milestone to the entire class simultaneously.",
          score: 0.5,
          orientation: "DIRECTIVE",
        },
        {
          key: "C",
          text: "Merge the struggling group into the highest-performing group without teacher guidance.",
          score: 0.1,
          orientation: "AUTONOMOUS",
        },
      ],
      expertRanking: null,
      maxDistance: null,
      isActive: true,
    },

    // =========================================================================
    // TODO: real 30-question bank goes here
    // =========================================================================
  ];

  for (const q of placeholderQuestions) {
    await prisma.pedagogyQuestion.upsert({
      where: { code: q.code },
      update: q,
      create: q,
    });
  }

  console.log(`✅ Successfully seeded ${placeholderQuestions.length} placeholder pedagogy questions.`);
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
