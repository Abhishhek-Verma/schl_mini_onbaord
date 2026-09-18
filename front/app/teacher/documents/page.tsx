'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileText,
  LoaderCircle,
  Plus,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import { routeForRole } from '@/lib/auth';

interface TeacherDocument {
  id: string;
  documentType: string;
  documentName?: string;
  slot: number;
  fileName: string;
  sizeBytes: number;
  downloadUrl: string;
}

interface EducationEntry {
  courseName: string;
  boardOrUniversity: string;
  passingYear: string;
  gradeSystem: 'Percentage' | 'CGPA';
  gradeValue: string;
}

interface DocumentSlot {
  documentType: string;
  label: string;
  description?: string;
  isRequired: boolean;
  documentName?: string;
}

const formatSize = (bytes: number) =>
  `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

export default function TeacherDocumentsPage() {
  const router = useRouter();
  const { user, accessToken, isHydrated, isAuthenticated } = useAuthStore();
  const [documents, setDocuments] = useState<TeacherDocument[]>([]);
  const [education, setEducation] = useState<EducationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [customDocTitle, setCustomDocTitle] = useState('');
  const [customSlots, setCustomSlots] = useState<DocumentSlot[]>([]);

  const loadData = async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [docsRes, profileRes] = await Promise.all([
        fetchApi<{ documents: TeacherDocument[] }>(
          '/teacher/documents',
          {},
          accessToken
        ),
        fetchApi<{ profile: Record<string, any> | null }>(
          '/teacher/onboarding',
          {},
          accessToken
        ),
      ]);
      setDocuments(docsRes.documents || []);
      // Parse education from profile
      let eduList: EducationEntry[] = [];
      const edu = profileRes.profile?.education;
      if (Array.isArray(edu)) {
        eduList = edu;
      } else if (typeof edu === 'string' && edu.trim()) {
        try {
          const parsed = JSON.parse(edu);
          if (Array.isArray(parsed)) eduList = parsed;
        } catch {
          /* ignore */
        }
      }
      setEducation(eduList);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error ? error.message : 'Unable to load documents',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated || !user) {
      router.replace('/login');
      return;
    }
    if (user.role !== 'TEACHER') {
      router.replace(routeForRole(user.role));
      return;
    }
    if (user.role === 'TEACHER' && !user.onboardingCompleted) {
      router.replace('/teacher');
      return;
    }
    void loadData();
  }, [accessToken, isAuthenticated, isHydrated, router, user]);

  // Build dynamic document slots
  const allSlots = useMemo<DocumentSlot[]>(() => {
    const base: DocumentSlot[] = [
      {
        documentType: 'AADHAAR',
        label: 'Aadhaar Card',
        description: 'Government ID verification (Front & Back)',
        isRequired: true,
      },
      {
        documentType: 'RESUME',
        label: 'Resume / CV',
        description: 'Updated teacher resume / curriculum vitae',
        isRequired: true,
      },
    ];

    const eduSlots: DocumentSlot[] = (education || []).map((edu, idx) => {
      const safeName = edu.courseName.replace(/[^a-zA-Z0-9]/g, '_');
      return {
        documentType: `EDU_${safeName}_${idx}`,
        label: `${edu.courseName} Certificate / Marksheet`,
        description: edu.boardOrUniversity
          ? `${edu.boardOrUniversity}${edu.passingYear ? ` (${edu.passingYear})` : ''}`
          : undefined,
        isRequired: true,
        documentName: edu.courseName,
      };
    });

    return [...base, ...eduSlots, ...customSlots];
  }, [education, customSlots]);

  const addCustomSlot = () => {
    const title = customDocTitle.trim();
    if (!title) return;
    const safeName = title.replace(/[^a-zA-Z0-9]/g, '_');
    const docType = `CUSTOM_${safeName}_${Date.now()}`;
    setCustomSlots((prev) => [
      ...prev,
      {
        documentType: docType,
        label: title,
        description: 'Custom document',
        isRequired: false,
        documentName: title,
      },
    ]);
    setCustomDocTitle('');
  };

  const removeCustomSlot = (docType: string) => {
    setCustomSlots((prev) => prev.filter((s) => s.documentType !== docType));
  };

  const uploadDocument = async (
    docType: string,
    file: File,
    documentName?: string
  ) => {
    const isPdf = file.type === 'application/pdf';
    const isImage = file.type.startsWith('image/');
    const maxBytes = isPdf ? 5 * 1024 * 1024 : 2 * 1024 * 1024;
    if (!isPdf && !isImage) {
      setMessage({ type: 'error', text: 'Only PDF or image files are allowed.' });
      return;
    }
    if (file.size > maxBytes) {
      setMessage({
        type: 'error',
        text: isPdf
          ? 'PDF files must be 5 MB or smaller.'
          : 'Image files must be 2 MB or smaller.',
      });
      return;
    }
    if (!accessToken) return;
    setUploading(docType);
    setMessage(null);
    try {
      const payload: Record<string, unknown> = {
        documentType: docType,
        slot: 1,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      };
      if (documentName) payload.documentName = documentName;
      const upload = await fetchApi<{ uploadUrl: string; storageKey: string }>(
        '/teacher/documents/upload-url',
        { method: 'POST', body: JSON.stringify(payload) },
        accessToken
      );
      const response = await fetch(upload.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!response.ok)
        throw new Error('The file could not be uploaded to storage.');
      await fetchApi(
        '/teacher/documents/complete',
        {
          method: 'POST',
          body: JSON.stringify({ ...payload, storageKey: upload.storageKey }),
        },
        accessToken
      );
      await loadData();
      setMessage({
        type: 'success',
        text: `${file.name} uploaded successfully.`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error ? error.message : 'Unable to upload document',
      });
    } finally {
      setUploading(null);
    }
  };

  const deleteDocument = async (docId: string) => {
    if (!accessToken) return;
    try {
      await fetchApi(
        `/teacher/documents/${docId}`,
        { method: 'DELETE' },
        accessToken
      );
      await loadData();
      setMessage({ type: 'success', text: 'Document removed.' });
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error ? error.message : 'Unable to delete document',
      });
    }
  };

  if (!isHydrated || loading)
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        Loading documents...
      </div>
    );

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="mb-4">
        <button
          type="button"
          onClick={() => router.push('/teacher')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Dashboard</span>
        </button>
      </div>
      <header className="mb-6 flex items-center gap-4 rounded-xl border border-border bg-card p-6 shadow-lg">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <UploadCloud className="h-7 w-7" />
        </div>
        <div>
          <p className="text-sm font-semibold text-primary">Teacher profile</p>
          <h1 className="mt-1 font-heading text-2xl font-bold sm:text-3xl">
            Document Upload
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Keep your education and identity documents in one secure place.
          </p>
        </div>
      </header>

      {message && (
        <div
          className={`mb-5 flex items-center gap-2 rounded-md border p-3 text-sm ${
            message.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-600'
              : 'border-destructive bg-destructive/15 text-destructive'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          {message.text}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        {allSlots.map((slot) => {
          const doc = documents.find(
            (d) => d.documentType === slot.documentType
          );
          const isUploadingThis = uploading === slot.documentType;
          const isCustom = slot.documentType.startsWith('CUSTOM_');

          return (
            <article
              key={slot.documentType}
              className="rounded-xl border border-border bg-card p-5 shadow-lg hover:border-primary/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-heading font-bold">{slot.label}</p>
                  {slot.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {slot.description}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    PDF up to 5 MB or image up to 2 MB
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {doc ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                      <CheckCircle2 className="size-3" />
                      Uploaded
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {slot.isRequired ? 'Required' : 'Optional'}
                    </span>
                  )}
                  {isCustom && !doc && (
                    <button
                      type="button"
                      onClick={() => removeCustomSlot(slot.documentType)}
                      className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                      title="Remove slot"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {doc && (
                <div className="mt-3 rounded-md bg-muted px-3 py-2">
                  <p className="truncate text-xs font-medium text-foreground">
                    {doc.fileName} · {formatSize(doc.sizeBytes)}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5">
                    {doc.downloadUrl && (
                      <a
                        href={doc.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="size-3" />
                        View
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => void deleteDocument(doc.id)}
                      className="inline-flex items-center gap-1 text-xs text-destructive hover:underline cursor-pointer"
                    >
                      <Trash2 className="size-3" />
                      Remove
                    </button>
                  </div>
                </div>
              )}

              <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-secondary px-3 py-2.5 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80">
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  className="sr-only"
                  disabled={uploading !== null}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) void uploadDocument(slot.documentType, file, slot.documentName);
                  }}
                />
                {isUploadingThis ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-4 w-4" />
                    {doc ? 'Replace document' : 'Choose document'}
                  </>
                )}
              </label>
            </article>
          );
        })}
      </section>

      {/* Add custom document */}
      <div className="mt-6 rounded-xl border border-dashed border-border bg-muted/30 p-5">
        <p className="text-sm font-semibold text-muted-foreground mb-3">
          Add Other Document
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={customDocTitle}
            onChange={(e) => setCustomDocTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustomSlot();
              }
            }}
            placeholder="e.g. CTET Certificate, Experience Letter..."
            className="flex-1 rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            type="button"
            onClick={addCustomSlot}
            disabled={!customDocTitle.trim()}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Plus className="size-4" />
            Add
          </button>
        </div>
      </div>
    </main>
  );
}