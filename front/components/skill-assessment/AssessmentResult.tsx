'use client';

import React from 'react';
import {
  Award,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  BarChart3,
  Check,
} from 'lucide-react';

export interface SectionScoreItem {
  raw: number;
  max: number;
  normalized: number;
  weight: number;
  weighted: number;
  label: string;
  flags?: Array<{ type: string; section?: string; normalized?: number }>;
}

export interface AssessmentResultData {
  overallScore: number;
  band: string;
  sectionMinMet?: boolean;
  sectionScores?: Record<string, SectionScoreItem>;
  flags?: Array<{ type: string; [key: string]: any }>;
  submittedAt?: string;
  durationSec?: number;
}

interface AssessmentResultProps {
  result: AssessmentResultData;
  onBack: () => void;
  onRetake?: () => void;
}

export function AssessmentResult({ result, onBack, onRetake }: AssessmentResultProps) {
  const { overallScore = 0, band = 'Developing', sectionScores = {}, flags = [] } = result;

  // Visual styling based on band
  const getBandBadgeStyle = (b: string) => {
    switch (b.toLowerCase()) {
      case 'strong':
        return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
      case 'competent':
        return 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30';
      case 'developing':
        return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
      case 'below threshold':
      case 'insufficient':
        return 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30';
      default:
        return 'bg-secondary text-secondary-foreground border-border';
    }
  };

  const sectionsList = Object.entries(sectionScores);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Banner & Overall Score Card */}
      <div className="bg-card border border-border rounded-xl p-6 sm:p-8 shadow-md relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
          <div className="space-y-2 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Pedagogy Competency Assessment
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-3" />
                Verified & Completed
              </span>
            </div>
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">
              Assessment Results
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-lg">
              Your pedagogical evaluation has been processed and saved to your teacher profile.
              Schools will see your certified pedagogy proficiency badge on matching vacancies.
            </p>
          </div>

          {/* Big Score Display */}
          <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-muted/40 border border-border/80 min-w-[160px] text-center shrink-0">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Overall Score
            </span>
            <div className="font-heading text-4xl sm:text-5xl font-extrabold text-foreground mt-1">
              {overallScore}
              <span className="text-xl font-normal text-muted-foreground">/100</span>
            </div>
            <span
              className={`mt-2.5 inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${getBandBadgeStyle(
                band
              )}`}
            >
              <Sparkles className="size-3" />
              {band}
            </span>
          </div>
        </div>
      </div>

      {/* Section Breakdown Card */}
      <div className="bg-card border border-border rounded-xl p-6 sm:p-7 shadow-md space-y-5">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <BarChart3 className="size-4" />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-base text-foreground">
                Domain Competency Breakdown
              </h3>
              <p className="text-xs text-muted-foreground">
                Scores normalized to 100% across core teaching pillars
              </p>
            </div>
          </div>
        </div>

        {/* Breakdown List */}
        <div className="space-y-4 pt-1">
          {sectionsList.length > 0 ? (
            sectionsList.map(([secKey, sec]) => {
              const isBelowMin =
                (sec.flags && sec.flags.some((f) => f.type === 'SECTION_BELOW_MIN')) ||
                sec.normalized < 40;
              const weightPercent = Math.round((sec.weight || 0) * 100);

              return (
                <div
                  key={secKey}
                  className="space-y-1.5 p-3.5 rounded-lg bg-muted/30 border border-border/60 transition-colors"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">
                        {sec.label || secKey}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        ({weightPercent}% Weight)
                      </span>
                      {isBelowMin && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.2 rounded-full">
                          <AlertTriangle className="size-2.5" />
                          Focus Area
                        </span>
                      )}
                    </div>
                    <span className="font-bold text-foreground">
                      {sec.normalized}%
                    </span>
                  </div>

                  {/* Horizontal Bar */}
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isBelowMin
                          ? 'bg-amber-500'
                          : sec.normalized >= 75
                          ? 'bg-emerald-500'
                          : 'bg-primary'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, sec.normalized))}%` }}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-6 text-xs text-muted-foreground">
              No detailed section breakdown recorded.
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs cursor-pointer"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Dashboard</span>
        </button>

        {onRetake && (
          <button
            type="button"
            onClick={onRetake}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-border bg-background text-xs font-semibold hover:bg-muted transition-colors cursor-pointer"
          >
            <RotateCcw className="size-3.5 text-muted-foreground" />
            <span>Retake Assessment</span>
          </button>
        )}
      </div>
    </div>
  );
}
