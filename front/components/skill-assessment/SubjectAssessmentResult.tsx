'use client';

import React from 'react';
import {
  Award,
  CheckCircle2,
  ArrowLeft,
  Sparkles,
  BarChart3,
  ShieldCheck,
  Calendar,
  Layers,
  BookOpen,
} from 'lucide-react';

export interface SubjectBreakdownItem {
  label: string;
  raw: number;
  max: number;
  normalized: number;
  count: number;
}

export interface SubjectAssessmentResultData {
  overallScore: number;
  band: string;
  sectionScores?: Record<string, any>;
  flags?: Array<{ type: string; [key: string]: any }>;
  submittedAt?: string;
  durationSec?: number;
}

interface SubjectAssessmentResultProps {
  result: SubjectAssessmentResultData;
  onBack: () => void;
}

export function SubjectAssessmentResult({ result, onBack }: SubjectAssessmentResultProps) {
  const { overallScore = 0, band = 'Developing', sectionScores = {} } = result;

  const formattedDate = result.submittedAt
    ? new Date(result.submittedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

  // Visual styling based on band
  const getBandBadgeStyle = (b: string) => {
    switch (b.toLowerCase()) {
      case 'distinguished':
        return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
      case 'proficient':
        return 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30';
      case 'developing':
        return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
      case 'insufficient':
      default:
        return 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30';
    }
  };

  // Separate subject breakdown and class band breakdown
  const subjectList: Array<[string, SubjectBreakdownItem]> = Object.entries(sectionScores).filter(
    ([key]) => key !== '_classBands'
  );
  const classBandsList: Array<[string, SubjectBreakdownItem]> = sectionScores._classBands
    ? Object.entries(sectionScores._classBands)
    : [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-200">
      {/* Top Banner & Overall Score Card */}
      <div className="bg-card border border-border rounded-xl p-6 sm:p-8 shadow-md relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
          <div className="space-y-2 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-3" />
                Subject Assessment Complete and Verified
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 border border-blue-500/30 px-2.5 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                <ShieldCheck className="size-3" />
                Knowledge Verified
              </span>
            </div>
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">
              Subject Knowledge Results
            </h2>
            <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs text-muted-foreground pt-0.5">
              <Calendar className="size-3.5 text-primary" />
              <span>Evaluation Date: {formattedDate}</span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-lg">
              Your subject matter expertise evaluation has been verified and saved. Schools will see your validated proficiency across your open teaching subjects and class levels.
            </p>
          </div>

          {/* Overall Score Circle */}
          <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-muted/50 border border-border/80 min-w-[140px] text-center shrink-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Overall Score
            </span>
            <div className="text-4xl font-extrabold text-foreground mt-1">
              {overallScore}
              <span className="text-lg text-muted-foreground font-normal">/100</span>
            </div>
            <div className={`mt-2 px-3 py-1 rounded-full border text-xs font-bold ${getBandBadgeStyle(band)}`}>
              {band}
            </div>
          </div>
        </div>
      </div>

      {/* Per-Subject Breakdown */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-md space-y-4">
        <div className="flex items-center gap-2 border-b border-border/60 pb-3">
          <BookOpen className="size-5 text-primary" />
          <h3 className="font-heading font-bold text-base text-foreground">
            Per-Subject Proficiency Breakdown
          </h3>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {subjectList.map(([subjectKey, sec]) => (
            <div
              key={subjectKey}
              className="rounded-xl border border-border/70 bg-muted/30 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-foreground">
                  {subjectKey === 'MATH' ? 'Mathematics' : subjectKey === 'SCIENCE' ? 'Science' : sec.label || subjectKey}
                </span>
                <span className="font-mono text-sm font-bold text-primary">
                  {sec.normalized}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, sec.normalized))}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                <span>Total Questions: {sec.count || '—'}</span>
                <span>Score: {sec.raw}/{sec.max}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Per-Class-Band Breakdown */}
      {classBandsList.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6 shadow-md space-y-4">
          <div className="flex items-center gap-2 border-b border-border/60 pb-3">
            <Layers className="size-5 text-primary" />
            <h3 className="font-heading font-bold text-base text-foreground">
              Class-Band Performance
            </h3>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {classBandsList.map(([bandKey, bData]) => (
              <div
                key={bandKey}
                className="rounded-xl border border-border/70 bg-muted/30 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-foreground">{bData.label || bandKey}</span>
                  <span className="font-mono text-sm font-bold text-primary">{bData.normalized}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, bData.normalized))}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                  <span>Questions Evaluated: {bData.count}</span>
                  <span>Score: {bData.raw}/{bData.max}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Return to Dashboard */}
      <div className="pt-2 flex justify-start">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-sm cursor-pointer"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Skill Assessment Hub</span>
        </button>
      </div>
    </div>
  );
}
