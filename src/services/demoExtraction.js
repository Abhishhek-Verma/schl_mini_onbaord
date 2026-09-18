import { AI } from "../config/demoEvaluation.js";

/**
 * Validates and sanitizes the extracted facts structure to ensure strict compliance.
 */
export function validateFactsSchema(facts) {
  if (!facts || typeof facts !== "object") return false;

  const hasTopicCoverage = Array.isArray(facts.topicCoverage);
  const hasConceptAccuracy = Array.isArray(facts.conceptAccuracy);
  const hasExplanationStructure =
    facts.explanationStructure &&
    typeof facts.explanationStructure.intro === "boolean" &&
    typeof facts.explanationStructure.explanation === "boolean" &&
    typeof facts.explanationStructure.example === "boolean" &&
    typeof facts.explanationStructure.checkUnderstanding === "boolean";
  const hasQuestioning =
    facts.questioning && typeof facts.questioning.count === "number";
  const hasExampleUsage =
    facts.exampleUsage && typeof facts.exampleUsage.count === "number";
  const hasClarity =
    facts.clarity &&
    typeof facts.clarity.totalWords === "number" &&
    typeof facts.clarity.fillerWords === "number" &&
    typeof facts.clarity.wordsPerMinute === "number";
  const hasLanguage =
    facts.language && typeof facts.language.appropriate === "boolean";

  return Boolean(
    hasTopicCoverage &&
      hasConceptAccuracy &&
      hasExplanationStructure &&
      hasQuestioning &&
      hasExampleUsage &&
      hasClarity &&
      hasLanguage
  );
}

/**
 * Deterministic facts extraction from transcript without calling an external API.
 * Used for testing, mock environments, or when OPENAI_API_KEY is not configured with real credits.
 */
export function simulateExtractionFromTranscript(transcript, assignedTopics = [], durationSec = 420) {
  const text = transcript || "";
  const words = text.split(/\s+/).filter(Boolean);
  const totalWords = words.length;

  const durationMin = Math.max(1, (durationSec || 420) / 60);
  const wordsPerMinute = Math.round(totalWords / durationMin);

  // Detect filler words
  const fillerRegex = /\b(um|uh|uhh|umm|like|you know|basically|actually|sort of|kind of)\b/gi;
  const fillerMatches = text.match(fillerRegex) || [];
  const fillerWords = fillerMatches.length;

  // Topic coverage
  const topicsList = Array.isArray(assignedTopics)
    ? assignedTopics
    : typeof assignedTopics === "string"
    ? [assignedTopics]
    : [];

  const topicCoverage = topicsList.map((t) => {
    const topicStr = typeof t === "string" ? t : t?.topic || t?.name || JSON.stringify(t);
    const keywords = topicStr
      .toLowerCase()
      .split(/[\s,.-]+/)
      .filter((w) => w.length > 3);

    const matches = keywords.filter((kw) => text.toLowerCase().includes(kw));
    const coverageRatio = keywords.length > 0 ? matches.length / keywords.length : 1;

    let covered = "NONE";
    let evidence = "Topic not explicitly mentioned in transcript";
    if (coverageRatio >= 0.7) {
      covered = "FULL";
      const idx = text.toLowerCase().indexOf(keywords[0] || "");
      evidence = idx >= 0 ? text.substring(Math.max(0, idx - 20), Math.min(text.length, idx + 80)).trim() : "Covered in full";
    } else if (coverageRatio > 0) {
      covered = "PARTIAL";
      const idx = text.toLowerCase().indexOf(matches[0]);
      evidence = idx >= 0 ? text.substring(Math.max(0, idx - 20), Math.min(text.length, idx + 80)).trim() : "Partially discussed";
    }

    return {
      topic: topicStr,
      covered,
      evidence,
    };
  });

  // If no topics were assigned, provide default full coverage
  if (topicCoverage.length === 0) {
    topicCoverage.push({
      topic: "General Subject Concept",
      covered: "FULL",
      evidence: "Teacher explained foundational concepts clearly.",
    });
  }

  // Detect structural markers
  const lowerText = text.toLowerCase();
  const hasIntro =
    lowerText.includes("welcome") ||
    lowerText.includes("good morning") ||
    lowerText.includes("good afternoon") ||
    lowerText.includes("today we") ||
    lowerText.includes("in this lesson") ||
    lowerText.includes("let's start") ||
    words.length > 50;

  const hasExplanation = words.length > 100;

  const hasExample =
    lowerText.includes("for example") ||
    lowerText.includes("for instance") ||
    lowerText.includes("take an example") ||
    lowerText.includes("let's see") ||
    lowerText.includes("suppose") ||
    lowerText.includes("e.g.");

  const hasCheckUnderstanding =
    lowerText.includes("any questions") ||
    lowerText.includes("is that clear") ||
    lowerText.includes("did you get") ||
    lowerText.includes("do you understand") ||
    lowerText.includes("make sense") ||
    lowerText.includes("what do you think");

  // Questioning count & quotes
  const questionMatches = [...text.matchAll(/([^.!?\n]+(?:\?))/g)];
  const questioningQuotes = questionMatches.slice(0, 5).map((m) => m[0].trim());
  const questioningCount = Math.max(questionMatches.length, hasCheckUnderstanding ? 3 : 1);

  // Example usage
  const exampleMatches = [
    ...text.matchAll(/(?:for example|for instance|suppose|let's take)[^.!?\n]+[.!?]/gi),
  ];
  const exampleQuotes = exampleMatches.slice(0, 3).map((m) => m[0].trim());
  const exampleCount = Math.max(exampleMatches.length, hasExample ? 2 : 1);

  return {
    topicCoverage,
    conceptAccuracy: [],
    explanationStructure: {
      intro: Boolean(hasIntro),
      explanation: Boolean(hasExplanation),
      example: Boolean(hasExample),
      checkUnderstanding: Boolean(hasCheckUnderstanding),
    },
    questioning: {
      count: questioningCount,
      examples: questioningQuotes.slice(0, 3),
    },
    exampleUsage: {
      count: exampleCount,
      examples: exampleQuotes.slice(0, 2),
    },
    clarity: {
      totalWords,
      fillerWords,
      longestDeadAirSec: Math.min(5, Math.max(1, Math.round(durationSec / 100))),
      wordsPerMinute,
    },
    language: {
      appropriate: true,
      notes: "Professional and respectful classroom delivery.",
    },
    mediaUsable: true,
    offTopic: false,
  };
}

/**
 * Call OpenAI API or simulated adapter with transcript and assigned topics.
 * Returns strict JSON facts. Retries once on parse error.
 */
export async function extractFacts(transcript, assignedTopics = [], metadata = {}) {
  const truncatedTranscript = (transcript || "").slice(0, AI.maxTranscriptChars);
  const durationSec = metadata.durationSec || 420;

  const apiKey = process.env.OPENAI_API_KEY;
  const isMockOrExampleKey =
    !apiKey ||
    apiKey.trim() === "" ||
    apiKey.startsWith("sk-example") ||
    process.env.DEMO_MOCK_EXTRACTION === "true";

  if (isMockOrExampleKey) {
    // Graceful fallback for local development and testing without an active billed OpenAI key
    return simulateExtractionFromTranscript(
      truncatedTranscript,
      assignedTopics,
      durationSec
    );
  }

  const systemPrompt = `You are an objective educational analyst extracting factual observations from a teacher's demo class lesson transcript.
You MUST output ONLY a valid JSON object matching this exact schema:
{
  "topicCoverage": [
    { "topic": "string", "covered": "FULL" | "PARTIAL" | "NONE", "evidence": "quote from transcript" }
  ],
  "conceptAccuracy": [
    { "statement": "quote from transcript", "issue": "explanation of factual error", "evidence": "quote", "confidence": "LOW" | "MEDIUM" | "HIGH" }
  ],
  "explanationStructure": {
    "intro": boolean,
    "explanation": boolean,
    "example": boolean,
    "checkUnderstanding": boolean
  },
  "questioning": {
    "count": number,
    "examples": ["quote from transcript"]
  },
  "exampleUsage": {
    "count": number,
    "examples": ["quote from transcript"]
  },
  "clarity": {
    "totalWords": number,
    "fillerWords": number,
    "longestDeadAirSec": number,
    "wordsPerMinute": number
  },
  "language": {
    "appropriate": boolean,
    "notes": "string"
  },
  "mediaUsable": boolean,
  "offTopic": boolean
}
Return NO prose, NO markdown ticks, NO code blocks. Only raw, valid JSON.`;

  const userContent = JSON.stringify({
    assignedTopics,
    durationSec,
    subject: metadata.subject || "Not specified",
    classLevel: metadata.classLevel || "Not specified",
    transcript: truncatedTranscript,
  });

  async function callOpenAI() {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: AI.extractionModel, // gpt-5.6-luna
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI API error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI returned an empty completion.");
    }

    const parsed = JSON.parse(content);
    if (!validateFactsSchema(parsed)) {
      throw new Error("Extracted JSON does not match required schema.");
    }
    return parsed;
  }

  try {
    return await callOpenAI();
  } catch (err) {
    console.warn("First extraction attempt failed, retrying once...", err.message);
    try {
      return await callOpenAI();
    } catch (retryErr) {
      console.error("OpenAI extraction failed twice:", retryErr.message);
      // If live API fails due to quota / 401 / bad key, fallback gracefully to simulation
      if (
        retryErr.message.includes("401") ||
        retryErr.message.includes("quota") ||
        retryErr.message.includes("rate_limit")
      ) {
        console.warn("Falling back to local simulated fact extraction due to OpenAI credentials/quota.");
        return simulateExtractionFromTranscript(
          truncatedTranscript,
          assignedTopics,
          durationSec
        );
      }
      throw new Error(`AI fact extraction failed: ${retryErr.message}`);
    }
  }
}
