import { prisma } from "../lib/prisma.js";

/**
 * Production seed — 30-question grade-neutral Pedagogy Assessment.
 * Question codes Q1..Q30. Safe to re-run: it upserts by `code`.
 *
 * Option shapes:
 *   MCQ / CASE part : { key, text, score }            score in 0..1
 *   MSQ             : { key, text, correct }           boolean
 *   SJT             : { key, text }                    (ranking scored via expertRanking)
 *   CASE part opts  : may also carry { orientation }   (hidden; used for coherence bonus)
 */

const questions = [
  // ============================================================
  // SECTION 1 — CLASSROOM MANAGEMENT (Q1–Q6)
  // ============================================================
  {
    code: "Q1",
    section: "CLASSROOM_MANAGEMENT",
    type: "SJT",
    prompt:
      "A student repeatedly interrupts during your explanation by talking to nearby classmates. This has happened across the last three lessons. Rank these responses from most appropriate to least appropriate.",
    options: [
      { key: "A", text: "Have a brief private conversation with the student to understand why this keeps happening" },
      { key: "B", text: "Quietly change the student's seating to reduce the distraction" },
      { key: "C", text: "Stop the lesson and address the behaviour in front of the whole class" },
      { key: "D", text: "Ignore it and keep teaching, hoping it settles on its own" },
    ],
    expertRanking: ["A", "B", "C", "D"],
    maxDistance: 8,
    caseGroup: null,
    casePart: null,
    coherenceBonus: null,
    isActive: true,
  },
  {
    code: "Q2",
    section: "CLASSROOM_MANAGEMENT",
    type: "MCQ",
    prompt:
      "Just as you begin an important lesson, two students get into an argument that disrupts the class. Neither will back down. What is the most appropriate first action?",
    options: [
      { key: "A", text: "Calmly separate them, settle the class, and tell both you'll speak with them shortly — then continue", score: 1.0 },
      { key: "B", text: "Stop the lesson entirely and resolve the full conflict there and then, in front of everyone", score: 0.25 },
      { key: "C", text: "Send both students out to the principal's office so you can continue teaching", score: 0.0 },
      { key: "D", text: "Ignore the argument and start teaching, expecting them to settle", score: 0.0 },
    ],
    expertRanking: null, maxDistance: null, caseGroup: null, casePart: null, coherenceBonus: null, isActive: true,
  },
  {
    code: "Q3",
    section: "CLASSROOM_MANAGEMENT",
    type: "MCQ",
    prompt:
      "Over the past two weeks your class has become increasingly noisy and off-task during independent work time, despite clear expectations set earlier. What should you do first?",
    options: [
      { key: "A", text: "Reflect on whether the tasks are at the right difficulty and engaging enough, then adjust", score: 1.0 },
      { key: "B", text: "Introduce a reward system for on-task behaviour", score: 0.5 },
      { key: "C", text: "Give the class a firm warning about consequences", score: 0.25 },
      { key: "D", text: "Assign additional work to keep them occupied", score: 0.0 },
    ],
    expertRanking: null, maxDistance: null, caseGroup: null, casePart: null, coherenceBonus: null, isActive: true,
  },
  {
    code: "Q4",
    section: "CLASSROOM_MANAGEMENT",
    type: "MCQ",
    prompt:
      "You notice that moving between activities consistently wastes several minutes as students get distracted. What is the most effective long-term approach?",
    options: [
      { key: "A", text: "Establish and practise clear, consistent transition routines with the class", score: 1.0 },
      { key: "B", text: "Rush students verbally each time to move faster", score: 0.25 },
      { key: "C", text: "Reduce the number of activities so fewer transitions are needed", score: 0.5 },
      { key: "D", text: "Deduct marks from students who are slow to settle", score: 0.0 },
    ],
    expertRanking: null, maxDistance: null, caseGroup: null, casePart: null, coherenceBonus: null, isActive: true,
  },
  {
    code: "Q5",
    section: "CLASSROOM_MANAGEMENT",
    type: "SJT",
    prompt:
      "During class, one student flatly refuses to begin the assigned task and sits with arms crossed. The rest of the class is working. Rank these actions from most to least appropriate.",
    options: [
      { key: "A", text: "Quietly approach and check privately whether something is wrong or the task is unclear" },
      { key: "B", text: "Give the student a moment, then return to offer a smaller first step into the task" },
      { key: "C", text: "Issue a public ultimatum: start now or face a consequence" },
      { key: "D", text: "Demand loudly in front of the class that the student begin immediately" },
    ],
    expertRanking: ["A", "B", "C", "D"],
    maxDistance: 8,
    caseGroup: null, casePart: null, coherenceBonus: null, isActive: true,
  },
  {
    code: "Q6",
    section: "CLASSROOM_MANAGEMENT",
    type: "MSQ",
    prompt:
      "Your class becomes restless and hard to manage in the later part of a long session. Which of the following are appropriate strategies? Select all that apply.",
    options: [
      { key: "A", text: "Break the remaining time into shorter segments with a brief active task between them", correct: true },
      { key: "B", text: "Build in a short movement or attention-reset activity", correct: true },
      { key: "C", text: "Keep pushing through the planned content without variation", correct: false },
      { key: "D", text: "Shift to a more interactive or hands-on format for the final stretch", correct: true },
    ],
    expertRanking: null, maxDistance: null, caseGroup: null, casePart: null, coherenceBonus: null, isActive: true,
  },

  // ============================================================
  // SECTION 2 — TEACHING METHODOLOGY (Q7–Q11)
  // ============================================================
  {
    code: "Q7",
    section: "TEACHING_METHODOLOGY",
    type: "MCQ",
    prompt:
      "You need to introduce a concept your students have never encountered and which is fairly abstract. Which approach is most effective?",
    options: [
      { key: "A", text: "Connect it to something familiar from students' experience, then build toward the abstract idea", score: 1.0 },
      { key: "B", text: "State the formal definition and ask students to memorise it", score: 0.0 },
      { key: "C", text: "Have students copy the definition and complete practice items immediately", score: 0.25 },
      { key: "D", text: "Explain it once in full and move directly to a test", score: 0.0 },
    ],
    expertRanking: null, maxDistance: null, caseGroup: null, casePart: null, coherenceBonus: null, isActive: true,
  },
  {
    code: "Q8",
    section: "TEACHING_METHODOLOGY",
    type: "MCQ",
    prompt:
      "You've explained a concept clearly, but a large portion of the class still looks confused. What is the best next step?",
    options: [
      { key: "A", text: "Re-explain using a different representation or example, then check understanding", score: 1.0 },
      { key: "B", text: "Repeat the exact same explanation, but more slowly and loudly", score: 0.25 },
      { key: "C", text: "Tell students to read the material at home and move on", score: 0.0 },
      { key: "D", text: "Assume the confused students aren't paying attention and continue", score: 0.0 },
    ],
    expertRanking: null, maxDistance: null, caseGroup: null, casePart: null, coherenceBonus: null, isActive: true,
  },
  {
    code: "Q9",
    section: "TEACHING_METHODOLOGY",
    type: "MCQ",
    prompt:
      "You want students to understand why a particular method works, not just how to apply it. Which approach best supports this?",
    options: [
      { key: "A", text: "Pose a question or problem that leads students to reason toward the underlying principle", score: 1.0 },
      { key: "B", text: "Tell students the reason directly and clearly, then move on", score: 0.5 },
      { key: "C", text: "Have students memorise the rule and its justification together", score: 0.25 },
      { key: "D", text: "Skip the reasoning — knowing how to apply it is sufficient", score: 0.0 },
    ],
    expertRanking: null, maxDistance: null, caseGroup: null, casePart: null, coherenceBonus: null, isActive: true,
  },
  {
    code: "Q10",
    section: "TEACHING_METHODOLOGY",
    type: "MSQ",
    prompt:
      "You are planning a group activity and want it to genuinely support learning rather than just fill time. Which design choices support that goal? Select all that apply.",
    options: [
      { key: "A", text: "Give each group member a specific, accountable role", correct: true },
      { key: "B", text: "Design a task that genuinely requires collaboration to complete", correct: true },
      { key: "C", text: "Let groups form freely and complete the task however they like, with no structure", correct: false },
      { key: "D", text: "Build in a way to check individual understanding, not just the group's output", correct: true },
    ],
    expertRanking: null, maxDistance: null, caseGroup: null, casePart: null, coherenceBonus: null, isActive: true,
  },
  {
    code: "Q11",
    section: "TEACHING_METHODOLOGY",
    type: "MCQ",
    prompt:
      "You're partway through a lesson and realise you're slightly behind your planned pace. Most students seem to be following, but not all. What is the best decision?",
    options: [
      { key: "A", text: "Do a quick understanding check, then decide whether to consolidate or move on", score: 1.0 },
      { key: "B", text: "Speed up to cover all planned content by the end of the lesson", score: 0.25 },
      { key: "C", text: "Move on regardless — the plan must be completed", score: 0.0 },
      { key: "D", text: "Slow down dramatically and re-teach everything from the start", score: 0.25 },
    ],
    expertRanking: null, maxDistance: null, caseGroup: null, casePart: null, coherenceBonus: null, isActive: true,
  },

  // ============================================================
  // SECTION 3 — STUDENT PSYCHOLOGY & MOTIVATION (Q12–Q16)
  // ============================================================
  {
    code: "Q12",
    section: "STUDENT_PSYCHOLOGY",
    type: "MCQ",
    prompt:
      "A student works hard when offered a reward but loses all interest when the reward is removed. Which approach best supports developing more durable, intrinsic motivation?",
    options: [
      { key: "A", text: "Help the student experience competence and connect the work to their own goals and interests", score: 1.0 },
      { key: "B", text: "Keep increasing the size of the rewards to maintain effort", score: 0.0 },
      { key: "C", text: "Remove all rewards immediately and expect the student to adjust", score: 0.25 },
      { key: "D", text: "Tell the student that learning is its own reward and move on", score: 0.25 },
    ],
    expertRanking: null, maxDistance: null, caseGroup: null, casePart: null, coherenceBonus: null, isActive: true,
  },
  {
    code: "Q13",
    section: "STUDENT_PSYCHOLOGY",
    type: "MCQ",
    prompt:
      "A student who is struggling begins saying things like \"I'm just not good at this.\" What is the most appropriate response?",
    options: [
      { key: "A", text: "Acknowledge the difficulty, identify a specific next step, and highlight progress the student can achieve", score: 1.0 },
      { key: "B", text: "Reassure the student generally that they are smart and capable", score: 0.5 },
      { key: "C", text: "Compare them to a higher-performing peer to inspire effort", score: 0.0 },
      { key: "D", text: "Agree it's hard and lower what you expect of them going forward", score: 0.0 },
    ],
    expertRanking: null, maxDistance: null, caseGroup: null, casePart: null, coherenceBonus: null, isActive: true,
  },
  {
    code: "Q14",
    section: "STUDENT_PSYCHOLOGY",
    type: "SJT",
    prompt:
      "A student who normally participates actively has become withdrawn over the past week — not answering questions, avoiding group work, and sitting alone. Rank these actions from most to least appropriate.",
    options: [
      { key: "A", text: "Speak with the student privately to understand what may be happening" },
      { key: "B", text: "Quietly observe for a few more days while staying attentive to the student" },
      { key: "C", text: "Contact the student's parents right away" },
      { key: "D", text: "Ask the student's classmates what is wrong with them" },
    ],
    expertRanking: ["A", "B", "C", "D"],
    maxDistance: 8,
    caseGroup: null, casePart: null, coherenceBonus: null, isActive: true,
  },
  {
    code: "Q15",
    section: "STUDENT_PSYCHOLOGY",
    type: "MSQ",
    prompt:
      "A group of students frequently ask \"why do we even need to learn this?\" and show low engagement. Which approaches could genuinely help? Select all that apply.",
    options: [
      { key: "A", text: "Connect the material to real situations or interests relevant to the students", correct: true },
      { key: "B", text: "Give students some meaningful choice in how they engage with the task", correct: true },
      { key: "C", text: "Tell them it will be on the test, so they must learn it", correct: false },
      { key: "D", text: "Show how the skill builds toward something they want to be able to do", correct: true },
    ],
    expertRanking: null, maxDistance: null, caseGroup: null, casePart: null, coherenceBonus: null, isActive: true,
  },
  {
    code: "Q16",
    section: "STUDENT_PSYCHOLOGY",
    type: "MCQ",
    prompt:
      "A capable student clearly knows the material but freezes and avoids answering when called on in front of the class. What is the best approach?",
    options: [
      { key: "A", text: "Create low-pressure ways to contribute and build the student's confidence gradually", score: 1.0 },
      { key: "B", text: "Call on the student more often so they get used to it", score: 0.25 },
      { key: "C", text: "Stop calling on the student entirely to avoid the discomfort", score: 0.25 },
      { key: "D", text: "Point out that there's nothing to be afraid of and insist they answer", score: 0.0 },
    ],
    expertRanking: null, maxDistance: null, caseGroup: null, casePart: null, coherenceBonus: null, isActive: true,
  },

  // ============================================================
  // SECTION 4 — ASSESSMENT & FEEDBACK (Q17–Q20)
  // ============================================================
  {
    code: "Q17",
    section: "ASSESSMENT_FEEDBACK",
    type: "MCQ",
    prompt:
      "Through a quick classroom check, you discover that a large share of the class holds the same misconception about something you just taught. What should you do next?",
    options: [
      { key: "A", text: "Pause, address the misconception with a different approach, and re-check before moving on", score: 1.0 },
      { key: "B", text: "Give the class the correct answer to memorise and continue", score: 0.25 },
      { key: "C", text: "Continue to the next topic since the lesson is technically complete", score: 0.0 },
      { key: "D", text: "Give lower marks to the students who held the misconception", score: 0.0 },
    ],
    expertRanking: null, maxDistance: null, caseGroup: null, casePart: null, coherenceBonus: null, isActive: true,
  },
  {
    code: "Q18",
    section: "ASSESSMENT_FEEDBACK",
    type: "MCQ",
    prompt:
      "A colleague asks you why you do so many small, ungraded checks during lessons. Which explanation best captures their primary purpose?",
    options: [
      { key: "A", text: "To monitor understanding during learning so you can adjust teaching in time", score: 1.0 },
      { key: "B", text: "To assign accurate final grades to students", score: 0.0 },
      { key: "C", text: "To rank students against one another", score: 0.0 },
      { key: "D", text: "To keep students busy and quiet", score: 0.0 },
    ],
    expertRanking: null, maxDistance: null, caseGroup: null, casePart: null, coherenceBonus: null, isActive: true,
  },
  {
    code: "Q19",
    section: "ASSESSMENT_FEEDBACK",
    type: "MSQ",
    prompt:
      "You're returning work to students and want your feedback to actually improve their learning. Which characteristics make feedback more effective? Select all that apply.",
    options: [
      { key: "A", text: "It is specific about what was done well and what to improve", correct: true },
      { key: "B", text: "It gives the student a clear, actionable next step", correct: true },
      { key: "C", text: "It consists mainly of a grade or score with little comment", correct: false },
      { key: "D", text: "It is timely enough that the student can still act on it", correct: true },
    ],
    expertRanking: null, maxDistance: null, caseGroup: null, casePart: null, coherenceBonus: null, isActive: true,
  },
  {
    code: "Q20",
    section: "ASSESSMENT_FEEDBACK",
    type: "MCQ",
    prompt:
      "Before starting a new topic that builds heavily on a previous one, what is the most useful thing to do?",
    options: [
      { key: "A", text: "Run a brief diagnostic check on the prerequisite knowledge and address gaps first", score: 1.0 },
      { key: "B", text: "Assume the previous topic was learned since it was already taught", score: 0.0 },
      { key: "C", text: "Ask \"does everyone understand?\" and proceed if no one objects", score: 0.25 },
      { key: "D", text: "Re-teach the entire previous topic from scratch to be safe", score: 0.25 },
    ],
    expertRanking: null, maxDistance: null, caseGroup: null, casePart: null, coherenceBonus: null, isActive: true,
  },

  // ============================================================
  // SECTION 5 — DIFFERENTIATED & INCLUSIVE TEACHING (Q21–Q24)
  // ============================================================
  {
    code: "Q21",
    section: "DIFFERENTIATED_INCLUSIVE",
    type: "MCQ",
    prompt:
      "Some students in your class grasp today's concept almost immediately while others struggle significantly. You have one lesson. What is the best approach?",
    options: [
      { key: "A", text: "Provide differentiated tasks and targeted support so each group is appropriately challenged", score: 1.0 },
      { key: "B", text: "Teach to the middle and let the fastest and slowest adjust on their own", score: 0.25 },
      { key: "C", text: "Pace the whole class to the strongest students to maximise coverage", score: 0.0 },
      { key: "D", text: "Focus only on the struggling students and set the rest aside", score: 0.25 },
    ],
    expertRanking: null, maxDistance: null, caseGroup: null, casePart: null, coherenceBonus: null, isActive: true,
  },
  {
    code: "Q22",
    section: "DIFFERENTIATED_INCLUSIVE",
    type: "MSQ",
    prompt:
      "A student in your class has a diagnosed learning difficulty. Which approaches support genuine inclusion? Select all that apply.",
    options: [
      { key: "A", text: "Adapt the presentation and task format to remove unnecessary barriers", correct: true },
      { key: "B", text: "Keep the same high learning goals while adjusting the support and pathway", correct: true },
      { key: "C", text: "Give the student easier, separate work permanently so they aren't burdened", correct: false },
      { key: "D", text: "Provide scaffolding that can be gradually reduced as the student grows", correct: true },
    ],
    expertRanking: null, maxDistance: null, caseGroup: null, casePart: null, coherenceBonus: null, isActive: true,
  },
  {
    code: "Q23",
    section: "DIFFERENTIATED_INCLUSIVE",
    type: "MCQ",
    prompt:
      "One student consistently finishes tasks well before everyone else and then becomes bored and disruptive. What is the best approach?",
    options: [
      { key: "A", text: "Provide extension tasks that deepen or apply the learning meaningfully", score: 1.0 },
      { key: "B", text: "Give the student extra quantities of the same routine work", score: 0.25 },
      { key: "C", text: "Let the student do whatever they like once finished", score: 0.25 },
      { key: "D", text: "Ask the student to slow down and work at the class's pace", score: 0.0 },
    ],
    expertRanking: null, maxDistance: null, caseGroup: null, casePart: null, coherenceBonus: null, isActive: true,
  },
  {
    code: "Q24",
    section: "DIFFERENTIATED_INCLUSIVE",
    type: "MCQ",
    prompt:
      "A student is still developing fluency in the language of instruction and struggles to follow purely verbal explanations. What is the most effective approach?",
    options: [
      { key: "A", text: "Support understanding with visuals, demonstrations, and other non-verbal cues alongside speech", score: 1.0 },
      { key: "B", text: "Speak more loudly and repeat the same words", score: 0.0 },
      { key: "C", text: "Reduce what you expect this student to learn", score: 0.25 },
      { key: "D", text: "Ask the student to focus only on copying from peers for now", score: 0.25 },
    ],
    expertRanking: null, maxDistance: null, caseGroup: null, casePart: null, coherenceBonus: null, isActive: true,
  },

  // ============================================================
  // SECTION 6 — COMPLEX EVOLVING SCENARIO (Q25–Q27, linked CASE)
  // coherenceBonus = 0.5 (awarded once if all selected orientations match)
  // ============================================================
  {
    code: "Q25",
    section: "COMPLEX_SCENARIO",
    type: "CASE",
    caseGroup: "CASE1",
    casePart: 1,
    coherenceBonus: 0.5,
    prompt:
      "During a group activity, you notice one group has disengaged — some members are distracted, one is doing unrelated things, and one student is doing the entire task alone. What do you do first?",
    options: [
      { key: "A", text: "Take control firmly: warn the group and separate the distracted members", score: 0.25, orientation: "authoritative" },
      { key: "B", text: "Approach the group, find out what's happening, and redirect them", score: 1.0, orientation: "student-centered" },
      { key: "C", text: "Announce a general warning to the whole class about staying on task", score: 0.25, orientation: "authoritative" },
      { key: "D", text: "Leave them and focus your attention on the groups that are working", score: 0.0, orientation: "passive" },
    ],
    expertRanking: null, maxDistance: null, isActive: true,
  },
  {
    code: "Q26",
    section: "COMPLEX_SCENARIO",
    type: "CASE",
    caseGroup: "CASE1",
    casePart: 2,
    coherenceBonus: 0.5,
    prompt:
      "You approach the group. The student working alone says, \"They never help — I always end up doing everything.\" The others shrug. What do you do?",
    options: [
      { key: "A", text: "Restructure the task so each member has a specific, accountable role", score: 1.0, orientation: "student-centered" },
      { key: "B", text: "Move the hardworking student to a different, better group", score: 0.25, orientation: "avoidant" },
      { key: "C", text: "Warn the other three that they'll lose marks if they don't contribute", score: 0.25, orientation: "authoritative" },
      { key: "D", text: "Abandon group work for this class and switch everyone to individual tasks", score: 0.0, orientation: "avoidant" },
    ],
    expertRanking: null, maxDistance: null, isActive: true,
  },
  {
    code: "Q27",
    section: "COMPLEX_SCENARIO",
    type: "CASE",
    caseGroup: "CASE1",
    casePart: 3,
    coherenceBonus: 0.5,
    prompt:
      "After you restructure the roles, a previously disengaged student begins contributing but produces work noticeably below the expected standard. What do you do?",
    options: [
      { key: "A", text: "Accept it as-is — participation is what matters most right now", score: 0.5, orientation: "student-centered" },
      { key: "B", text: "Give targeted feedback and scaffolding so the student can improve the work", score: 1.0, orientation: "student-centered" },
      { key: "C", text: "Pair them with a stronger peer for support on the next step", score: 0.75, orientation: "student-centered" },
      { key: "D", text: "Permanently lower what you expect from this student", score: 0.0, orientation: "passive" },
    ],
    expertRanking: null, maxDistance: null, isActive: true,
  },

  // ============================================================
  // SECTION 7 — FOUNDATIONAL KNOWLEDGE (Q28–Q30)
  // ============================================================
  {
    code: "Q28",
    section: "FOUNDATIONAL_KNOWLEDGE",
    type: "MCQ",
    prompt: "In teaching, \"scaffolding\" most accurately refers to:",
    options: [
      { key: "A", text: "Providing temporary support that is gradually removed as the learner becomes independent", score: 1.0 },
      { key: "B", text: "Setting up the physical classroom for an activity", score: 0.0 },
      { key: "C", text: "Grouping students by ability for the whole year", score: 0.0 },
      { key: "D", text: "Giving students the full answer to save time", score: 0.0 },
    ],
    expertRanking: null, maxDistance: null, caseGroup: null, casePart: null, coherenceBonus: null, isActive: true,
  },
  {
    code: "Q29",
    section: "FOUNDATIONAL_KNOWLEDGE",
    type: "MCQ",
    prompt: "Which best distinguishes formative from summative assessment?",
    options: [
      { key: "A", text: "Formative supports learning as it happens; summative evaluates learning at the end", score: 1.0 },
      { key: "B", text: "Formative is written; summative is oral", score: 0.0 },
      { key: "C", text: "Formative is for weak students; summative is for strong students", score: 0.0 },
      { key: "D", text: "There is no meaningful difference between them", score: 0.0 },
    ],
    expertRanking: null, maxDistance: null, caseGroup: null, casePart: null, coherenceBonus: null, isActive: true,
  },
  {
    code: "Q30",
    section: "FOUNDATIONAL_KNOWLEDGE",
    type: "MCQ",
    prompt: "A constructivist view of learning holds that students learn best when they:",
    options: [
      { key: "A", text: "Actively build new understanding by connecting it to what they already know", score: 1.0 },
      { key: "B", text: "Passively receive and memorise information delivered by the teacher", score: 0.0 },
      { key: "C", text: "Are ranked and compared to motivate competition", score: 0.0 },
      { key: "D", text: "Repeat facts until they can recall them on demand", score: 0.0 },
    ],
    expertRanking: null, maxDistance: null, caseGroup: null, casePart: null, coherenceBonus: null, isActive: true,
  },
];

async function main() {
  console.log(`🌱 Seeding ${questions.length} pedagogy questions...`);

  // Remove any old placeholder demo rows so they don't pollute a real attempt.
  await prisma.pedagogyQuestion.deleteMany({
    where: { code: { in: ["MCQ_DEMO_1", "MSQ_DEMO_1", "SJT_DEMO_1", "CASE1_P1", "CASE1_P2"] } },
  });

  for (const q of questions) {
    await prisma.pedagogyQuestion.upsert({
      where: { code: q.code },
      update: {
        section: q.section,
        type: q.type,
        prompt: q.prompt,
        options: q.options,
        expertRanking: q.expertRanking ?? null,
        maxDistance: q.maxDistance ?? null,
        caseGroup: q.caseGroup ?? null,
        casePart: q.casePart ?? null,
        coherenceBonus: q.coherenceBonus ?? null,
        isActive: q.isActive ?? true,
      },
      create: {
        code: q.code,
        section: q.section,
        type: q.type,
        prompt: q.prompt,
        options: q.options,
        expertRanking: q.expertRanking ?? null,
        maxDistance: q.maxDistance ?? null,
        caseGroup: q.caseGroup ?? null,
        casePart: q.casePart ?? null,
        coherenceBonus: q.coherenceBonus ?? null,
        isActive: q.isActive ?? true,
      },
    });
  }

  const counts = await prisma.pedagogyQuestion.groupBy({
    by: ["section"],
    where: { isActive: true },
    _count: true,
  });
  console.log("✅ Seed complete. Active questions by section:");
  for (const c of counts) console.log(`   ${c.section}: ${c._count}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
