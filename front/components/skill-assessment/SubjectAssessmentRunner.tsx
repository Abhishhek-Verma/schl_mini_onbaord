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
  Loader2,
  Send,
  HelpCircle,
  BookOpen,
  Hourglass,
  Layers,
} from 'lucide-react';

export interface QuestionOption {
  key: string;
  text: string;
}

export interface SanitizedSubjectQuestion {
  id: string;
  code: string;
  subject: string;
  subjectLabel: string;
  classLevel: number;
  topic: string;
  type: 'MCQ' | 'MSQ' | string;
  prompt: string;
  options: QuestionOption[];
}

export interface BlueprintSummaryItem {
  subject: string;
  label: string;
  count: number;
}

interface StartResponse {
  attemptId: string;
  durationMinutes: number;
  softPerQuestionSeconds?: number;
  hardPerQuestion?: boolean;
  blueprintSummary?: BlueprintSummaryItem[];
  questions: SanitizedSubjectQuestion[];
}

interface SubjectAssessmentRunnerProps {
  onComplete: (result: any) => void;
  onCancel?: () => void;
}

export function SubjectAssessmentRunner({ onComplete, onCancel }: SubjectAssessmentRunnerProps) {
  const { accessToken } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<SanitizedSubjectQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [blueprintSummary, setBlueprintSummary] = useState<BlueprintSummaryItem[]>([]);

  // Timing configuration from backend
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [softPerQuestionSeconds, setSoftPerQuestionSeconds] = useState(60);

  // Timers: elapsed seconds and question countdown
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [questionSecondsLeft, setQuestionSecondsLeft] = useState(60);

  // responses: { [questionId]: "A" | ["A", "C"] }
  const [responses, setResponses] = useState<Record<string, any>>({});

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
          '/teacher/onboarding/subject-assessment/start',
          { method: 'POST' },
          accessToken
        );

        if (!isMounted) return;

        if (!data.questions || data.questions.length === 0) {
          throw new Error('No assessment questions received for your subject preferences.');
        }

        setAttemptId(data.attemptId);
        setQuestions(data.questions);
        if (data.blueprintSummary) setBlueprintSummary(data.blueprintSummary);
        if (data.durationMinutes) setDurationMinutes(data.durationMinutes);
        if (data.softPerQuestionSeconds) {
          setSoftPerQuestionSeconds(data.softPerQuestionSeconds);
          setQuestionSecondsLeft(data.softPerQuestionSeconds);
        }

        questionStartTimeRef.current = Date.now();
      } catch (err: any) {
        if (!isMounted) return;
        setError(err.message || 'Unable to start Subject Knowledge assessment.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (accessToken) {
      startAssessment();
    }
  }, [accessToken]);

  // 2. Global Test Timer (counts up to durationMinutes)
  useEffect(() => {
    if (loading || submitting || error || questions.length === 0) return;

    const timer = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        if (next >= durationMinutes * 60) {
          clearInterval(timer);
          handleSubmitTest();
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, submitting, error, questions.length, durationMinutes]);

  // 3. Question Timer (counts down from softPerQuestionSeconds)
  useEffect(() => {
    if (loading || submitting || error || questions.length === 0) return;

    const qTimer = setInterval(() => {
      setQuestionSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(qTimer);
  }, [loading, submitting, error, questions.length, currentIndex]);

  // Helper to record question time on transition
  const recordQuestionTime = useCallback(() => {
    const currentQ = questions[currentIndex];
    if (!currentQ) return;
    const elapsedMs = Date.now() - questionStartTimeRef.current;
    perQuestionMsRef.current[currentQ.id] =
      (perQuestionMsRef.current[currentQ.id] || 0) + elapsedMs;
    questionStartTimeRef.current = Date.now();
  }, [questions, currentIndex]);

  // Navigate between questions
  const goToQuestion = (idx: number) => {
    if (idx < 0 || idx >= questions.length || idx === currentIndex) return;
    recordQuestionTime();
    setCurrentIndex(idx);
    setQuestionSecondsLeft(softPerQuestionSeconds);
  };

  const currentQuestion = questions[currentIndex];

  // Option handlers
  const handleSelectMCQ = (key: string) => {
    if (!currentQuestion) return;
    setResponses((prev) => ({ ...prev, [currentQuestion.id]: key }));
  };

  const handleToggleMSQ = (key: string) => {
    if (!currentQuestion) return;
    const currentList: string[] = Array.isArray(responses[currentQuestion.id])
      ? responses[currentQuestion.id]
      : [];
    const nextList = currentList.includes(key)
      ? currentList.filter((k) => k !== key)
      : [...currentList, key];
    setResponses((prev) => ({ ...prev, [currentQuestion.id]: nextList }));
  };

  // Submit assessment
  const handleSubmitTest = async () => {
    if (submittingRef.current || !attemptId || !accessToken) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    recordQuestionTime();

    try {
      const res = await fetchApi<{ result: any }>(
        '/teacher/onboarding/subject-assessment/submit',
        {
          method: 'POST',
          body: JSON.stringify({
            attemptId,
            responses,
            durationSec: elapsedSeconds,
            perQuestionMs: perQuestionMsRef.current,
          }),
        },
        accessToken
      );

      const result = res.result || res;
      onComplete(result);
    } catch (err: any) {
      setError(err.message || 'Failed to submit subject assessment.');
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  // Completion metrics
  const answeredCount = useMemo(() => {
    let count = 0;
    for (const q of questions) {
      const resp = responses[q.id];
      if (resp !== undefined && resp !== null) {
        if (Array.isArray(resp) && resp.length > 0) count++;
        else if (typeof resp === 'string' && resp.length > 0) count++;
      }
    }
    return count;
  }, [questions, responses]);

  const progressPercent = questions.length > 0
    ? Math.round((answeredCount / questions.length) * 100)
    : 0;

  const totalTimeSec = durationMinutes * 60;
  const timeRemainingSec = Math.max(0, totalTimeSec - elapsedSeconds);
  const remMinutes = Math.floor(timeRemainingSec / 60);
  const remSeconds = timeRemainingSec % 60;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 space-y-4">
        <Loader2 className="size-10 animate-spin text-primary" />
        <p className="text-sm font-medium text-foreground">Generating dynamic subject test...</p>
        <p className="text-xs text-muted-foreground">Tailoring questions to your chosen subjects and classes.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto bg-card border border-border rounded-xl p-6 shadow-md text-center space-y-4">
        <div className="size-12 rounded-full bg-destructive/15 text-destructive flex items-center justify-center mx-auto">
          <AlertCircle className="size-6" />
        </div>
        <h3 className="font-heading font-bold text-lg text-foreground">Unable to Open Assessment</h3>
        <p className="text-xs text-muted-foreground">{error}</p>
        <div className="pt-2 flex justify-center gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-md bg-secondary text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 transition-colors"
            >
              Return to Hub
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!currentQuestion) return null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-200">
      {/* Blueprint Summary Badge Bar */}
      {blueprintSummary.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-card border border-border/80 rounded-xl px-4 py-3 text-xs shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Layers className="size-4 text-primary" />
            <span className="font-semibold text-foreground">Test Blueprint:</span>
            {blueprintSummary.map((b) => (
              <span
                key={b.subject}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium"
              >
                {b.label}: <strong>{b.count} Qs</strong>
              </span>
            ))}
          </div>
          <span className="text-[11px] text-muted-foreground">
            Total {questions.length} Questions
          </span>
        </div>
      )}

      {/* Top Test Header & Timer Bar */}
      <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Subject Assessment
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-semibold">
                Class {currentQuestion.classLevel}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary font-semibold">
                {currentQuestion.subjectLabel}
              </span>
            </div>
            <h2 className="text-sm sm:text-base font-bold text-foreground">
              Question {currentIndex + 1} of {questions.length}
            </h2>
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            {/* Global Hard Countdown */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono text-xs sm:text-sm font-bold ${
              timeRemainingSec < 300
                ? 'border-red-500/40 bg-red-500/15 text-red-600 dark:text-red-400 animate-pulse'
                : 'border-border bg-muted/60 text-foreground'
            }`}>
              <Clock className="size-4 text-primary" />
              <span>
                {String(remMinutes).padStart(2, '0')}:{String(remSeconds).padStart(2, '0')}
              </span>
            </div>

            {/* Advisory Soft Question Pace */}
            <div className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground">
              <Hourglass className="size-3.5" />
              <span>Target pace: {questionSecondsLeft}s</span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Progress: {answeredCount}/{questions.length} answered</span>
            <span>{progressPercent}% Complete</span>
          </div>
          <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Question Card */}
      <div className="bg-card border border-border rounded-xl p-6 sm:p-8 shadow-md space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                Topic: {currentQuestion.topic}
              </span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-secondary text-secondary-foreground">
                {currentQuestion.type === 'MSQ' ? 'Multiple Select (MSQ)' : 'Single Choice (MCQ)'}
              </span>
            </div>
            <p className="text-sm sm:text-base font-semibold text-foreground pt-1 leading-relaxed">
              {currentQuestion.prompt}
            </p>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-3">
          {currentQuestion.options.map((opt) => {
            const isMSQ = currentQuestion.type === 'MSQ';
            const currentResp = responses[currentQuestion.id];
            const isSelected = isMSQ
              ? Array.isArray(currentResp) && currentResp.includes(opt.key)
              : currentResp === opt.key;

            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => (isMSQ ? handleToggleMSQ(opt.key) : handleSelectMCQ(opt.key))}
                className={`w-full text-left p-4 rounded-xl border transition-all flex items-start gap-3 cursor-pointer ${
                  isSelected
                    ? 'border-primary bg-primary/10 text-foreground ring-2 ring-primary/20 shadow-sm'
                    : 'border-border/80 bg-card hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                }`}
              >
                <div
                  className={`size-6 rounded-${isMSQ ? 'md' : 'full'} border flex items-center justify-center shrink-0 font-bold text-xs transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-muted/60 text-muted-foreground'
                  }`}
                >
                  {isSelected ? (isMSQ ? '✓' : opt.key) : opt.key}
                </div>
                <div className="text-sm font-medium leading-relaxed pt-0.5">
                  {opt.text}
                </div>
              </button>
            );
          })}
        </div>

        {currentQuestion.type === 'MSQ' && (
          <p className="text-xs text-muted-foreground italic flex items-center gap-1.5">
            <HelpCircle className="size-3.5 text-primary" />
            This is a multiple-select question. Select all options that apply.
          </p>
        )}
      </div>

      {/* Navigation Footer */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <button
          type="button"
          disabled={currentIndex === 0}
          onClick={() => goToQuestion(currentIndex - 1)}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <ArrowLeft className="size-4" />
          <span>Previous</span>
        </button>

        <div className="flex items-center gap-2">
          {currentIndex < questions.length - 1 ? (
            <button
              type="button"
              onClick={() => goToQuestion(currentIndex + 1)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-primary text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm cursor-pointer"
            >
              <span>Next</span>
              <ArrowRight className="size-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmitTest}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-500 transition-all shadow-md cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  <span>Submit Assessment</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
