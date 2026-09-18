'use client';

import {
  AlertCircle,
  AlertTriangle,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  GraduationCap,
  Info,
  Layers,
  Sparkles,
  TrendingUp,
  Video,
} from 'lucide-react';

interface UnifiedScoreViewProps {
  holisticData: any;
  title?: string;
  subtitle?: string;
  isPrincipalView?: boolean;
}

export function UnifiedScoreView({
  holisticData,
  title = 'Holistic Teacher Profile Score',
  subtitle = 'Pedametrics unified assessment combining written judgment, subject knowledge, live demonstration, and professional experience.',
  isPrincipalView = false,
}: UnifiedScoreViewProps) {
  if (!holisticData) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center text-xs text-muted-foreground">
        No holistic score evaluation available yet.
      </div>
    );
  }

  const breakdown = holisticData?.breakdown || holisticData;
  const {
    holisticScore,
    band,
    isProvisional,
    components = {},
    subjectCompetence,
    pedagogyCompetence,
    floors = [],
    gaps = [],
    pending = [],
  } = breakdown;

  const pedComp = components.pedagogy || {};
  const subComp = components.subject || {};
  const demoComp = components.demo || {};
  const expComp = components.experience || {};

  // Extract class bands and subjects from subject component if available
  const subjectDetails = subComp?.details || {};
  const sectionScores = subjectDetails?.sectionScores || {};
  const classBands = sectionScores?._classBands || null;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="rounded-2xl border border-primary/25 bg-gradient-to-r from-card via-card to-primary/10 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Sparkles className="size-3.5" /> {title}
              </span>
              {isProvisional ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                  <Clock className="size-3" />
                  Provisional (Demo Pending)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-3" />
                  Final Holistic Score
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-3 mt-3">
              <span className="font-heading text-4xl sm:text-5xl font-extrabold text-foreground tracking-tight">
                {holisticScore != null ? holisticScore : '—'}
              </span>
              <span className="text-sm font-semibold text-muted-foreground">/ 100</span>
              <span className="ml-2 text-xs font-bold px-3 py-1 rounded-full bg-primary/15 text-primary border border-primary/30">
                Band: {band || 'Unranked'}
              </span>
            </div>

            <p className="text-xs text-muted-foreground mt-2 max-w-2xl leading-relaxed">
              {subtitle}
            </p>
          </div>

          {isProvisional && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 max-w-xs text-xs space-y-1">
              <div className="font-bold text-amber-600 flex items-center gap-1.5">
                <Info className="size-3.5 shrink-0" />
                <span>Re-Normalized Weights</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Demo class is not yet submitted or processing. Available components are scaled proportionally to 100% until demo evaluation completes.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Eligibility Floor Violations (If Any) */}
      {floors && floors.length > 0 && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-destructive">
            <AlertCircle className="size-4" />
            <span>Eligibility Floor Alert (Must Meet Minimum 40 Floor in Core Components)</span>
          </div>
          <div className="space-y-1.5">
            {floors.map((floor: any, idx: number) => (
              <div key={idx} className="rounded-lg bg-background/80 border border-border/80 p-2.5 text-xs flex items-center justify-between">
                <span className="font-semibold text-foreground">
                  {floor.label || floor.component}: Scored {floor.score}/100 (Floor: {floor.floor})
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-destructive/15 text-destructive uppercase">
                  Below Floor
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4 Component Score Cards */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Layers className="size-3.5" /> Component Contributions
        </h3>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* 1. Pedagogy */}
          <div className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-foreground">Pedagogical Knowledge</span>
                <span className="text-[11px] font-semibold text-muted-foreground">
                  {Math.round((pedComp.weight || 0.25) * 100)}% Wt
                </span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="font-heading text-2xl font-bold text-foreground">
                  {pedComp.score != null ? pedComp.score : '—'}
                </span>
                <span className="text-xs text-muted-foreground">/ 100</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Contribution: +{pedComp.contribution ?? 0} pts
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-border/60 text-[11px] text-muted-foreground">
              Classroom & scenario judgment
            </div>
          </div>

          {/* 2. Subject Knowledge */}
          <div className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-foreground">Subject Knowledge</span>
                <span className="text-[11px] font-semibold text-muted-foreground">
                  {Math.round((subComp.weight || 0.25) * 100)}% Wt
                </span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="font-heading text-2xl font-bold text-foreground">
                  {subComp.score != null ? subComp.score : '—'}
                </span>
                <span className="text-xs text-muted-foreground">/ 100</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Contribution: +{subComp.contribution ?? 0} pts
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-border/60 text-[11px] text-muted-foreground">
              Core curriculum mastery
            </div>
          </div>

          {/* 3. Demo Class */}
          <div className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-foreground">Demo Class Video</span>
                <span className="text-[11px] font-semibold text-muted-foreground">
                  {Math.round((demoComp.weight || 0.35) * 100)}% Wt
                </span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="font-heading text-2xl font-bold text-foreground">
                  {demoComp.score != null && demoComp.status === 'PROCESSED' ? demoComp.score : '—'}
                </span>
                <span className="text-xs text-muted-foreground">/ 100</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {demoComp.status === 'PROCESSED' ? `Contribution: +${demoComp.contribution ?? 0} pts` : 'Evaluation in progress'}
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-border/60 text-[11px] text-muted-foreground">
              {demoComp.extractionMode === 'SIMULATED' ? (
                <span className="text-amber-600 font-semibold">Simulated eval</span>
              ) : (
                'Live speech & delivery analysis'
              )}
            </div>
          </div>

          {/* 4. Experience */}
          <div className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-foreground">Professional Experience</span>
                <span className="text-[11px] font-semibold text-muted-foreground">
                  {Math.round((expComp.weight || 0.15) * 100)}% Wt
                </span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="font-heading text-2xl font-bold text-foreground">
                  {expComp.score != null ? expComp.score : '—'}
                </span>
                <span className="text-xs text-muted-foreground">/ 100</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Contribution: +{expComp.contribution ?? 0} pts
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-border/60 flex flex-wrap gap-1 text-[10px]">
              <span className="bg-muted px-1.5 py-0.5 rounded">
                {expComp.breakdown?.years?.totalYears ?? 0} Yrs
              </span>
              <span className="bg-muted px-1.5 py-0.5 rounded">
                Qual: {expComp.breakdown?.qualification?.score ?? 0}%
              </span>
              <span className="bg-muted px-1.5 py-0.5 rounded">
                Fit: {expComp.breakdown?.relevance?.score ?? 0}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Completion Pairing Section (The Key View) */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="size-4 text-primary" />
            Competence Completion Pairing (Knowing vs. Doing)
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Integrates written cognitive assessments with demonstrated practical classroom execution.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Subject Competence */}
          <div className="rounded-xl border border-border/80 bg-background p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-foreground">Subject Competence (Knowing + Delivering)</span>
              <span className="font-extrabold text-primary text-sm">
                {subjectCompetence != null ? `${subjectCompetence}%` : '—'}
              </span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${subjectCompetence || 0}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Written Mastery: {subComp.score != null ? `${subComp.score}%` : 'Pending'}</span>
              <span>Video Delivery: {demoComp.score != null ? `${demoComp.score}%` : 'Pending'}</span>
            </div>
          </div>

          {/* Pedagogy Competence */}
          <div className="rounded-xl border border-border/80 bg-background p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-foreground">Pedagogical Competence (Judgment + Execution)</span>
              <span className="font-extrabold text-primary text-sm">
                {pedagogyCompetence != null ? `${pedagogyCompetence}%` : '—'}
              </span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${pedagogyCompetence || 0}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Judgment Score: {pedComp.score != null ? `${pedComp.score}%` : 'Pending'}</span>
              <span>Classroom Execution: {demoComp.score != null ? `${demoComp.score}%` : 'Pending'}</span>
            </div>
          </div>
        </div>

        {/* Knowing vs Doing Gap Flags */}
        {gaps && gaps.length > 0 && (
          <div className="space-y-2 mt-2 pt-3 border-t border-border">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600">
              <AlertTriangle className="size-4" />
              <span>Critical Performance Gap Signals</span>
            </div>
            {gaps.map((gap: any, idx: number) => (
              <div
                key={idx}
                className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-700 dark:text-amber-300">
                    {gap.area}: Large Gap ({gap.difference} Points Discrepancy)
                  </span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-amber-500/20 text-amber-700">
                    GAP DETECTED
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Written test score ({gap.writtenScore}%) substantially diverges from practical lesson demonstration ({gap.demoScore}%).
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Grade-Band & Subject Mastery (From SectionScores._classBands) */}
      {classBands && typeof classBands === 'object' && Object.keys(classBands).length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <GraduationCap className="size-3.5" /> Grade-Band Performance
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(classBands).map(([bandKey, bandScore]: [string, any]) => (
              <div key={bandKey} className="rounded-lg border border-border bg-background p-3 space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span>{bandKey}</span>
                  <span className="font-bold text-primary">{Math.round(bandScore)}%</span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${Math.min(100, Math.round(bandScore))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
