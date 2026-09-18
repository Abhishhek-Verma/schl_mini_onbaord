'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { fetchApi } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import {
  Clock,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  Loader2,
  Send,
  HelpCircle,
  FileQuestion,
  ListOrdered,
  Hourglass,
} from 'lucide-react';

export interface QuestionOption {
  key: string;
  text: string;
}

export interface SanitizedQuestion {
  id: string;
  code: string;
  section: string;
  sectionLabel: string;
  type: 'MCQ' | 'MSQ' | 'SJT' | 'CASE';
  prompt: string;
  options: QuestionOption[];
  caseGroup?: string | null;
  casePart?: number | null;
}

interface StartResponse {
  attemptId: string;
  durationMinutes: number;
  softPerQuestionSeconds?: number;
  hardPerQuestion?: boolean;
  questions: SanitizedQuestion[];
}

interface AssessmentRunnerProps {
  onComplete: (result: any) => void;
  onCancel?: () => void;
}

export function AssessmentRunner({ onComplete, onCancel }: AssessmentRunnerProps) {
  const { accessToken, updateUser } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<SanitizedQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Timing configuration from backend
  const [durationMinutes, setDurationMinutes] = useState(35);
  const [softPerQuestionSeconds, setSoftPerQuestionSeconds] = useState(75);
  const [hardPerQuestion, setHardPerQuestion] = useState(false);

  // Timers: elapsed seconds (counts up), and soft question timer (counts down from softPerQuestionSeconds)
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [questionSecondsLeft, setQuestionSecondsLeft] = useState(75);

  // responses: { [questionId]: "A" | ["A", "B"] | ["A", "D", "B", "C"] }
  const [responses, setResponses] = useState<Record<string, any>>({});
  // SJT tracking: per-question visual ranking and touched flag
  const [sjtRankings, setSjtRankings] = useState<Record<string, string[]>>({});
  const [touchedSJT, setTouchedSJT] = useState<Record<string, boolean>>({});

  // perQuestionMs: { [questionId]: accumulatedMs }
  const perQuestionMsRef = useRef<Record<string, number>>({});
  const questionStartTimeRef = useRef<number>(Date.now());
  const submittingRef = useRef<boolean>(false);

  // 1. Fetch /start on mount
  useEffect(() => {
    let isMounted = true;

    async function startAssessment() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchApi<StartResponse>(
          '/teacher/onboarding/skill-assessment/start',
          { method: 'POST' },
          accessToken
        );

        if (!isMounted) return;

        if (!data.questions || data.questions.length === 0) {
          throw new Error('No assessment questions received.');
        }

        setAttemptId(data.attemptId);
        setQuestions(data.questions);

        if (typeof data.durationMinutes === 'number') {
          setDurationMinutes(data.durationMinutes);
        }
        if (typeof data.softPerQuestionSeconds === 'number') {
          setSoftPerQuestionSeconds(data.softPerQuestionSeconds);
          setQuestionSecondsLeft(data.softPerQuestionSeconds);
        }
        if (typeof data.hardPerQuestion === 'boolean') {
          setHardPerQuestion(data.hardPerQuestion);
        }

        // Initialize visual SJT orders (WITHOUT pre-seeding into responses)
        const initialSjtRankings: Record<string, string[]> = {};
        for (const q of data.questions) {
          if (q.type === 'SJT' && Array.isArray(q.options)) {
            initialSjtRankings[q.id] = q.options.map((o) => o.key);
          }
        }
        setSjtRankings(initialSjtRankings);

        questionStartTimeRef.current = Date.now();
        setLoading(false);
      } catch (err) {
        if (!isMounted) return;
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to start pedagogy assessment.'
        );
        setLoading(false);
      }
    }

    startAssessment();

    return () => {
      isMounted = false;
    };
  }, [accessToken]);

  // Accumulate time spent on current question
  const trackTimeForCurrentQuestion = useCallback(() => {
    const currentQ = questions[currentIndex];
    if (!currentQ) return;
    const now = Date.now();
    const spent = now - questionStartTimeRef.current;
    perQuestionMsRef.current[currentQ.id] =
      (perQuestionMsRef.current[currentQ.id] || 0) + spent;
    questionStartTimeRef.current = now;
  }, [currentIndex, questions]);

  // Submit assessment function (used by button and auto-submit)
  const handleSubmit = useCallback(async () => {
    if (submittingRef.current || !attemptId) return;
    submittingRef.current = true;
    trackTimeForCurrentQuestion();
    setSubmitting(true);
    setError(null);

    try {
      // Build final responses payload: only send SJT if touched; otherwise null
      const finalResponses: Record<string, any> = {};
      for (const q of questions) {
        if (q.type === 'SJT') {
          if (touchedSJT[q.id] && Array.isArray(responses[q.id])) {
            finalResponses[q.id] = responses[q.id];
          } else {
            finalResponses[q.id] = null;
          }
        } else if (responses[q.id] !== undefined) {
          finalResponses[q.id] = responses[q.id];
        }
      }

      const payload = {
        attemptId,
        responses: finalResponses,
        perQuestionMs: perQuestionMsRef.current,
        durationSec: elapsedSeconds,
      };

      const res = await fetchApi<{ result: any; profile: any }>(
        '/teacher/onboarding/skill-assessment/submit',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
        accessToken
      );

      // Sync auth state
      updateUser({ skillAssessmentCompleted: true });

      onComplete(res.result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to submit assessment. Please try again.'
      );
      setSubmitting(false);
      submittingRef.current = false;
    }
  }, [
    attemptId,
    responses,
    touchedSJT,
    questions,
    elapsedSeconds,
    accessToken,
    trackTimeForCurrentQuestion,
    updateUser,
    onComplete,
  ]);

  // 2. Global hard countdown & per-question countdown
  const totalLimitSeconds = durationMinutes * 60;
  const remainingGlobalSeconds = Math.max(0, totalLimitSeconds - elapsedSeconds);

  useEffect(() => {
    if (loading || submitting || questions.length === 0) return;

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        if (next >= totalLimitSeconds) {
          // Hard limit reached: auto-submit!
          handleSubmit();
        }
        return next;
      });

      setQuestionSecondsLeft((prev) => {
        const nextQ = Math.max(0, prev - 1);
        if (nextQ === 0 && hardPerQuestion) {
          // If hard per-question auto-advance is enabled (off by default)
          if (currentIndex < questions.length - 1) {
            trackTimeForCurrentQuestion();
            setCurrentIndex((curr) => curr + 1);
          } else {
            handleSubmit();
          }
        }
        return nextQ;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [
    loading,
    submitting,
    questions.length,
    totalLimitSeconds,
    hardPerQuestion,
    currentIndex,
    handleSubmit,
    trackTimeForCurrentQuestion,
  ]);

  // Reset per-question timer whenever index changes
  useEffect(() => {
    setQuestionSecondsLeft(softPerQuestionSeconds);
  }, [currentIndex, softPerQuestionSeconds]);

  const currentQ = questions[currentIndex];

  // Helper to format MM:SS
  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Determine if current question has an answer
  const isCurrentAnswered = useMemo(() => {
    if (!currentQ) return false;
    const ans = responses[currentQ.id];
    if (currentQ.type === 'MCQ' || currentQ.type === 'CASE') {
      return typeof ans === 'string' && ans.trim().length > 0;
    }
    if (currentQ.type === 'MSQ') {
      return Array.isArray(ans) && ans.length > 0;
    }
    if (currentQ.type === 'SJT') {
      // TASK 1: MUST BE TOUCHED and have full permutation to be counted as answered
      return (
        touchedSJT[currentQ.id] === true &&
        Array.isArray(ans) &&
        ans.length === currentQ.options.length &&
        ans.length > 0
      );
    }
    return false;
  }, [currentQ, responses, touchedSJT]);

  // Handlers for selection
  const handleSelectMCQ = (key: string) => {
    if (!currentQ) return;
    setResponses((prev) => ({
      ...prev,
      [currentQ.id]: key,
    }));
  };

  const handleToggleMSQ = (key: string) => {
    if (!currentQ) return;
    const currentList: string[] = Array.isArray(responses[currentQ.id])
      ? responses[currentQ.id]
      : [];
    const exists = currentList.includes(key);
    const updated = exists
      ? currentList.filter((k) => k !== key)
      : [...currentList, key];

    setResponses((prev) => ({
      ...prev,
      [currentQ.id]: updated,
    }));
  };

  const handleMoveSJT = (index: number, direction: 'up' | 'down') => {
    if (!currentQ) return;

    // Get current visual permutation
    const currentRanking: string[] = Array.isArray(sjtRankings[currentQ.id])
      ? [...sjtRankings[currentQ.id]]
      : currentQ.options.map((o) => o.key);

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentRanking.length) return;

    // Swap items
    const temp = currentRanking[index];
    currentRanking[index] = currentRanking[targetIndex];
    currentRanking[targetIndex] = temp;

    // Update visual ranking
    setSjtRankings((prev) => ({
      ...prev,
      [currentQ.id]: currentRanking,
    }));

    // TASK 1: Mark touched and store in responses
    setTouchedSJT((prev) => ({
      ...prev,
      [currentQ.id]: true,
    }));
    setResponses((prev) => ({
      ...prev,
      [currentQ.id]: currentRanking,
    }));
  };

  // Step Navigation
  const handleNext = () => {
    if (!isCurrentAnswered) return;
    trackTimeForCurrentQuestion();
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    trackTimeForCurrentQuestion();
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] p-8 space-y-4">
        <Loader2 className="size-10 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">
          Preparing your Pedagogy Assessment session...
        </p>
      </div>
    );
  }

  // Error state during start
  if (error && questions.length === 0) {
    return (
      <div className="bg-card border border-destructive/30 rounded-xl p-8 max-w-xl mx-auto text-center space-y-4">
        <div className="size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
          <AlertCircle className="size-6" />
        </div>
        <h3 className="font-heading font-bold text-lg text-foreground">
          Assessment Unavailable
        </h3>
        <p className="text-sm text-muted-foreground">{error}</p>
        <div className="pt-2 flex justify-center gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-semibold rounded-md border border-border hover:bg-muted transition-colors cursor-pointer"
            >
              Back to Dashboard
            </button>
          )}
        </div>
      </div>
    );
  }

  const progressPercent = Math.round(
    ((currentIndex + 1) / questions.length) * 100
  );

  // Styling for timers
  const globalTimerClass =
    remainingGlobalSeconds <= 60
      ? 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/30 animate-pulse'
      : remainingGlobalSeconds <= 300
      ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30'
      : 'text-muted-foreground bg-background border-border/80';

  const softTimerClass =
    questionSecondsLeft === 0
      ? 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/30'
      : questionSecondsLeft <= 20
      ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30'
      : 'text-muted-foreground bg-background border-border/80';

  return (
    <div className="bg-card border border-border rounded-xl shadow-md overflow-hidden transition-all">
      {/* Header bar */}
      <div className="border-b border-border bg-muted/40 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Section badge & question counter */}
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              <FileQuestion className="size-3.5" />
              {currentQ?.sectionLabel || currentQ?.section}
            </span>
            {currentQ?.caseGroup && (
              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-secondary text-secondary-foreground">
                Case Scenario {currentQ.casePart ? `• Part ${currentQ.casePart}` : ''}
              </span>
            )}
          </div>

          {/* Timer controls */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            {/* Per-question soft timer (advisory) */}
            <div
              title="Per-question pacing suggestion (advisory)"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors ${softTimerClass}`}
            >
              <Hourglass className="size-3" />
              <span>Q: {formatTimer(questionSecondsLeft)}</span>
            </div>

            {/* Global hard timer */}
            <div
              title="Total time remaining for assessment"
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md border font-semibold transition-colors ${globalTimerClass}`}
            >
              <Clock className="size-3.5" />
              <span>{formatTimer(remainingGlobalSeconds)}</span>
            </div>

            <span className="font-semibold text-foreground ml-1">
              {currentIndex + 1} / {questions.length}
            </span>
          </div>
        </div>

        {/* Advisory timing copy (Task 3d) */}
        <div className="flex items-center justify-between mt-2 pt-1 text-[11px] text-muted-foreground">
          <span>Total time is limited; the per-question timer is a suggested pace, not a cutoff.</span>
          {questionSecondsLeft === 0 && (
            <span className="text-amber-600 dark:text-amber-400 font-medium">
              Suggested pace reached — take your time and proceed when ready.
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="w-full bg-muted rounded-full h-1.5 mt-2.5 overflow-hidden">
          <div
            className="bg-primary h-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Main question area */}
      <div className="p-5 sm:p-7 space-y-6">
        {error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive bg-destructive/15 p-3 text-xs text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Question prompt */}
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            {currentQ?.type === 'MSQ' && 'Multiple Choice (Select All That Apply)'}
            {currentQ?.type === 'MCQ' && 'Single Choice (Select the best approach)'}
            {currentQ?.type === 'CASE' && 'Scenario Question (Select the most appropriate action)'}
            {currentQ?.type === 'SJT' && 'Situational Judgment (Rank order actions from most to least effective)'}
          </div>
          <h2 className="font-heading font-semibold text-base sm:text-lg text-foreground leading-relaxed">
            {currentQ?.prompt}
          </h2>
        </div>

        {/* Options container */}
        <div className="space-y-3 pt-2">
          {/* 1. MCQ or CASE (Single Select) */}
          {(currentQ?.type === 'MCQ' || currentQ?.type === 'CASE') && (
            <div className="space-y-2.5">
              {currentQ.options.map((opt) => {
                const isSelected = responses[currentQ.id] === opt.key;
                return (
                  <div
                    key={opt.key}
                    onClick={() => handleSelectMCQ(opt.key)}
                    className={`flex items-start gap-3.5 p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border/80 hover:border-border hover:bg-muted/30 bg-background'
                    }`}
                  >
                    <div
                      className={`size-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold border mt-0.5 transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-muted-foreground/30 text-muted-foreground bg-muted/30'
                      }`}
                    >
                      {opt.key}
                    </div>
                    <span className="text-sm font-normal text-foreground leading-snug">
                      {opt.text}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* 2. MSQ (Multiple Select) */}
          {currentQ?.type === 'MSQ' && (
            <div className="space-y-2.5">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5 pb-1 font-medium">
                <HelpCircle className="size-3.5 text-primary" />
                <span>You can choose one or multiple options. Points awarded for correct choices with penalties for wrong ones.</span>
              </div>
              {currentQ.options.map((opt) => {
                const currentSelected: string[] = Array.isArray(responses[currentQ.id])
                  ? responses[currentQ.id]
                  : [];
                const isChecked = currentSelected.includes(opt.key);
                return (
                  <div
                    key={opt.key}
                    onClick={() => handleToggleMSQ(opt.key)}
                    className={`flex items-start gap-3.5 p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer select-none ${
                      isChecked
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border/80 hover:border-border hover:bg-muted/30 bg-background'
                    }`}
                  >
                    <div
                      className={`size-5 rounded flex items-center justify-center shrink-0 border mt-0.5 transition-colors ${
                        isChecked
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-muted-foreground/30 bg-background'
                      }`}
                    >
                      {isChecked && <CheckCircle2 className="size-3.5" />}
                    </div>
                    <span className="text-sm font-normal text-foreground leading-snug">
                      <span className="font-semibold text-muted-foreground mr-2">
                        {opt.key}.
                      </span>
                      {opt.text}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* 3. SJT (Rank Ordering) */}
          {currentQ?.type === 'SJT' && (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground flex items-center justify-between gap-1.5 pb-1 font-medium">
                <span className="flex items-center gap-1.5">
                  <ListOrdered className="size-3.5 text-primary" />
                  Use the Up/Down arrows to rank from Rank #1 (Most Effective) to bottom.
                </span>
                {!touchedSJT[currentQ.id] && (
                  <span className="text-amber-500 font-semibold text-[11px] animate-pulse">
                    * Reorder items to provide your ranking
                  </span>
                )}
              </div>

              {(() => {
                const currentRanking: string[] = Array.isArray(sjtRankings[currentQ.id])
                  ? sjtRankings[currentQ.id]
                  : currentQ.options.map((o) => o.key);

                const optionMap = new Map(currentQ.options.map((o) => [o.key, o]));

                return currentRanking.map((key, idx) => {
                  const opt = optionMap.get(key);
                  if (!opt) return null;
                  const isFirst = idx === 0;
                  const isLast = idx === currentRanking.length - 1;

                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-border bg-background shadow-xs hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-primary/10 text-primary border border-primary/20 shrink-0 mt-0.5">
                          Rank #{idx + 1}
                        </span>
                        <span className="text-sm text-foreground leading-snug">
                          {opt.text}
                        </span>
                      </div>

                      {/* Up / Down Controls */}
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={isFirst}
                          onClick={() => handleMoveSJT(idx, 'up')}
                          aria-label={`Move ${key} up`}
                          className="p-1 rounded bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        >
                          <ChevronUp className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={isLast}
                          onClick={() => handleMoveSJT(idx, 'down')}
                          aria-label={`Move ${key} down`}
                          className="p-1 rounded bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        >
                          <ChevronDown className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Footer navigation */}
      <div className="border-t border-border bg-muted/20 p-4 sm:p-5 flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={currentIndex === 0 || submitting}
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-border bg-background text-xs font-semibold hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <ArrowLeft className="size-3.5" />
          <span>Previous</span>
        </button>

        {currentIndex < questions.length - 1 ? (
          <button
            type="button"
            disabled={!isCurrentAnswered || submitting}
            onClick={handleNext}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-xs cursor-pointer"
          >
            <span>Next Question</span>
            <ArrowRight className="size-3.5" />
          </button>
        ) : (
          <button
            type="button"
            disabled={!isCurrentAnswered || submitting}
            onClick={handleSubmit}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Evaluating...</span>
              </>
            ) : (
              <>
                <Send className="size-3.5" />
                <span>Submit Assessment</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
