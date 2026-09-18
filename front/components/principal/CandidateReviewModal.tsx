'use client';

import { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  FileText,
  Flag,
  GraduationCap,
  LoaderCircle,
  Play,
  Sparkles,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { UnifiedScoreView } from '@/components/skill-assessment/UnifiedScoreView';

function getYouTubeEmbedUrl(urlOrId: string | null | undefined): string | null {
  if (!urlOrId) return null;
  if (urlOrId.length === 11 && !urlOrId.includes('/') && !urlOrId.includes('.')) {
    return `https://www.youtube.com/embed/${urlOrId}`;
  }
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = urlOrId.match(regExp);
  return match && match[2].length === 11
    ? `https://www.youtube.com/embed/${match[2]}`
    : null;
}

interface CandidateReviewModalProps {
  candidate: any;
  onClose: () => void;
  onDecisionChange?: () => void;
}

export function CandidateReviewModal({
  candidate,
  onClose,
  onDecisionChange,
}: CandidateReviewModalProps) {
  const [candidateData, setCandidateData] = useState<any>(candidate);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decisionMessage, setDecisionMessage] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [decisionNotes, setDecisionNotes] = useState('');

  // Fetch full evaluation details (including holistic score payload)
  useState(() => {
    if (candidate?.id) {
      fetchApi(`/principal/candidates/${candidate.id}/evaluation`)
        .then((res) => {
          if (res) setCandidateData((prev: any) => ({ ...prev, ...res }));
        })
        .catch((e) => console.warn('Could not fetch candidate evaluation detail:', e));
    }
  });

  const evaluation = candidateData?.demoEvaluation || candidate?.demoEvaluation;
  const profile = candidateData?.profile || candidate?.profile || candidate?.teacherProfile;
  const holistic = candidateData?.holistic;
  const status = evaluation?.status || 'NOT_SUBMITTED';

  const embedUrl =
    getYouTubeEmbedUrl(evaluation?.videoId) ||
    getYouTubeEmbedUrl(evaluation?.videoUrl) ||
    getYouTubeEmbedUrl(profile?.demoVideoUrl);

  const subScores = evaluation?.subScores || {};
  const completions = evaluation?.completions || {};
  const flags = Array.isArray(evaluation?.flags) ? evaluation.flags : [];

  const handleDecision = async (decision: 'ACCEPTED' | 'REJECTED' | 'UNDER_REVIEW') => {
    try {
      setDecisionLoading(true);
      setDecisionMessage(null);
      await fetchApi(`/principal/candidates/${candidate.id}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision, remarks: decisionNotes }),
      });
      setDecisionMessage(`Candidate successfully marked as ${decision}.`);
      if (onDecisionChange) onDecisionChange();
    } catch (err: any) {
      setDecisionMessage(`Error: ${err.message || 'Could not record decision'}`);
    } finally {
      setDecisionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center font-bold text-lg">
              {candidate?.displayName?.[0] || 'T'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-foreground">
                  {candidate?.displayName || candidate?.email}
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                  Candidate Evaluation
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {candidate?.email} {candidate?.phoneNumber ? `• ${candidate.phoneNumber}` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quick Decision Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-border bg-secondary/30">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">Decision Controls:</span>
              {decisionMessage && (
                <span className="text-xs text-primary font-medium">{decisionMessage}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={decisionLoading}
                onClick={() => handleDecision('ACCEPTED')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                <UserCheck className="size-3.5" />
                <span>Accept Candidate</span>
              </button>
              <button
                type="button"
                disabled={decisionLoading}
                onClick={() => handleDecision('REJECTED')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                <UserX className="size-3.5" />
                <span>Reject</span>
              </button>
              <button
                type="button"
                disabled={decisionLoading}
                onClick={() => handleDecision('UNDER_REVIEW')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                <Clock className="size-3.5" />
                <span>Under Review</span>
              </button>
            </div>
          </div>

          {/* Status Banners */}
          {status === 'PENDING' || status === 'PROCESSING' ? (
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-5 flex items-start gap-3 text-blue-500">
              <LoaderCircle className="size-5 shrink-0 animate-spin mt-0.5" />
              <div>
                <h4 className="text-sm font-bold">Demo Evaluation in Progress</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  The automated evaluation pipeline is actively transcribing classroom speech, analyzing instructional clarity, and extracting pedagogical metrics. Please check back shortly.
                </p>
              </div>
            </div>
          ) : status === 'FAILED' ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 flex items-start gap-3 text-destructive">
              <AlertCircle className="size-5 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold">Evaluation Could Not Be Completed</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {evaluation?.errorMessage || 'Video unavailable — check the link is correct and the video is public.'}
                </p>
              </div>
            </div>
          ) : status === 'PROCESSED' ? (
            <>
              {evaluation?.extractionMode === 'SIMULATED' && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2">
                  <AlertTriangle className="size-4 shrink-0 text-amber-600" />
                  <span>Simulated evaluation — not a real AI assessment.</span>
                </div>
              )}

              {/* Score & Band Header */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 flex flex-col justify-center">
                  <div className="text-xs font-bold uppercase tracking-wider text-primary">Demo Score</div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="font-heading text-3xl font-extrabold text-foreground">
                      {evaluation?.demoScore != null ? evaluation.demoScore : '—'}
                    </span>
                    <span className="text-xs text-muted-foreground font-semibold">/ 100</span>
                  </div>
                  <div className="mt-2">
                    <span className="inline-block text-xs font-bold px-2.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                      Band: {evaluation?.band || 'Adequate'}
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-4 flex flex-col justify-center">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Subject Delivery</div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="font-heading text-2xl font-bold text-foreground">
                      {completions?.subjectDeliveryPct != null ? `${completions.subjectDeliveryPct}%` : '—'}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Coverage of syllabus & assigned topics
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-card p-4 flex flex-col justify-center">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pedagogy Execution</div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="font-heading text-2xl font-bold text-foreground">
                      {completions?.pedagogyExecutionPct != null ? `${completions.pedagogyExecutionPct}%` : '—'}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Combined structure, clarity & questioning
                  </p>
                </div>
              </div>

              {/* In-App YouTube Video Player */}
              {embedUrl && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Play className="size-3.5 text-red-500" /> Teaching Demonstration Video
                    </span>
                    {evaluation?.videoUrl && (
                      <a
                        href={evaluation.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
                      >
                        <span>Open on YouTube</span>
                        <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                  <div className="aspect-video w-full rounded-xl overflow-hidden border border-border bg-black shadow-inner">
                    <iframe
                      src={embedUrl}
                      title="Candidate Demo Class"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      referrerPolicy="strict-origin-when-cross-origin"
                      className="w-full h-full"
                    />
                  </div>
                </div>
              )}

              {/* Sub-Scores Breakdown (With Explicit PROXY Labels) */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Sub-Scores Breakdown
                </h4>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-lg border border-border bg-card/60 p-3 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">Subject Delivery (30%)</span>
                      <span className="font-bold">{subScores.subjectDelivery ?? '—'}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${subScores.subjectDelivery || 0}%` }} />
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-card/60 p-3 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">Clarity & Pace (20%)</span>
                      <span className="font-bold">{subScores.clarity ?? '—'}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${subScores.clarity || 0}%` }} />
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-card/60 p-3 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">Structure (20%)</span>
                      <span className="font-bold">{subScores.structure ?? '—'}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${subScores.structure || 0}%` }} />
                    </div>
                  </div>

                  {/* Engagement PROXY */}
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground">Engagement</span>
                        <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-600 border border-amber-500/40">
                          PROXY
                        </span>
                      </div>
                      <span className="font-bold text-amber-600">{subScores.engagementProxy ?? '—'}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500" style={{ width: `${subScores.engagementProxy || 0}%` }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground">Inferred from questions & examples in speech</p>
                  </div>

                  {/* Professionalism PROXY */}
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground">Professionalism</span>
                        <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-600 border border-amber-500/40">
                          PROXY
                        </span>
                      </div>
                      <span className="font-bold text-amber-600">{subScores.professionalismProxy ?? '—'}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500" style={{ width: `${subScores.professionalismProxy || 0}%` }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground">Target duration, tone & media usability</p>
                  </div>
                </div>
              </div>

              {/* Review Flags ("Review These", Not Penalties) */}
              {flags.length > 0 && (
                <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-600">
                    <Flag className="size-4" />
                    <span>Review Observations (Flags for Principal Attention — Not Score Penalties)</span>
                  </div>
                  <div className="space-y-2 mt-2">
                    {flags.map((flag: any, idx: number) => (
                      <div key={idx} className="rounded-lg border border-border/80 bg-background/90 p-2.5 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">{flag.detail}</span>
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-600">
                            {flag.severity}
                          </span>
                        </div>
                        {flag.evidence && (
                          <div className="text-[11px] text-muted-foreground italic bg-muted/40 p-1.5 rounded">
                            "{flag.evidence}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Collapsible Transcript */}
              {evaluation?.transcript && (
                <div className="rounded-xl border border-border overflow-hidden bg-card">
                  <button
                    type="button"
                    onClick={() => setShowTranscript(!showTranscript)}
                    className="w-full flex items-center justify-between p-4 text-xs font-bold text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="size-4 text-primary" />
                      <span>Classroom Speech Transcript</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                        Source: {evaluation.transcriptSource || 'CAPTIONS'}
                      </span>
                    </div>
                    {showTranscript ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  </button>
                  {showTranscript && (
                    <div className="p-4 border-t border-border bg-muted/20 text-xs text-foreground/90 leading-relaxed max-h-64 overflow-y-auto whitespace-pre-wrap font-mono">
                      {evaluation.transcript}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-xs">
              Candidate has not submitted a demo video yet.
            </div>
          )}

          {/* Holistic Score Summary (Part B) */}
          {holistic && (
            <div className="pt-4 border-t border-border space-y-3">
              <UnifiedScoreView
                holisticData={holistic}
                title="Holistic Candidate Profile Score"
                subtitle="Complete pedagogical passport combining cognitive tests, live demo execution, and verified teaching experience."
                isPrincipalView={true}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
