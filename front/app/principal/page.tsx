'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Edit3,
  ExternalLink,
  FileCheck2,
  FileText,
  GraduationCap,
  ImagePlus,
  LoaderCircle,
  Plus,
  Save,
  School,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UploadCloud,
  UserCheck,
  UserRound,
  Users,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { fetchApi } from '@/lib/api';
import { routeForRole } from '@/lib/auth';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CandidateReviewModal } from '@/components/principal/CandidateReviewModal';

// -------------------------------------------------------------------------
// Types & Steps Definition
// -------------------------------------------------------------------------
export type PrincipalOnboardingStep = 'basic' | 'completion' | 'documents';

export interface EducationEntry {
  degree: string;
  institution: string;
  year: string;
  field?: string;
}

export interface PreviousInstitutionEntry {
  institutionName: string;
  role: string;
  fromYear: string;
  toYear: string;
}

export interface PrincipalDocument {
  id: string;
  userId: string;
  documentType: string;
  documentName?: string | null;
  slot: number;
  fileName: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  verificationStatus?: string;
  downloadUrl?: string | null;
  createdAt: string;
}

export interface PrincipalProfile {
  id: string;
  userId: string;
  profilePhoto?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  contactInformation?: string | null;
  aboutMe?: string | null;
  currentSchoolName?: string | null;
  boardAffiliation?: string | null;
  schoolAddress?: string | null;
  schoolContactNumber?: string | null;
  adminExperienceYears?: string | null;
  education?: EducationEntry[] | null;
  highestQualification?: string | null;
  previousInstitutions?: PreviousInstitutionEntry[] | null;
  certifications?: string[] | null;
  achievements?: string | null;
  awards?: string | null;
  basicInformationCompleted: boolean;
  profileCompletionCompleted: boolean;
  documentsCompleted: boolean;
  onboardingCompleted: boolean;
  verificationStatus?: string;
  verifiedAt?: string | null;
}

const STEPS: { id: PrincipalOnboardingStep; label: string; stepNum: number }[] = [
  { id: 'basic', label: 'Basic Information', stepNum: 1 },
  { id: 'completion', label: 'Leadership & School Profile', stepNum: 2 },
  { id: 'documents', label: 'Verified Documents', stepNum: 3 },
];

const BOARD_OPTIONS = ['CBSE', 'ICSE', 'State Board', 'IB (International Baccalaureate)', 'Cambridge (IGCSE)', 'Other'];

export default function PrincipalPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-muted-foreground">Loading Principal Suite...</div>}>
      <PrincipalPageContent />
    </Suspense>
  );
}

function PrincipalPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, accessToken, isHydrated, isAuthenticated, setAuth, updateUser } = useAuthStore();

  const [profile, setProfile] = useState<PrincipalProfile | null>(null);
  const [step, setStep] = useState<PrincipalOnboardingStep>('basic');
  const section = searchParams.get('section');
  const editing = searchParams.get('edit');
  const isEditingMode = Boolean(editing) || Boolean(profile?.onboardingCompleted);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);

  // Documents state
  const [documents, setDocuments] = useState<PrincipalDocument[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);

  // Step 1: Basic info
  const [basic, setBasic] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    contactInformation: '',
  });

  // Step 2: Leadership & School Profile
  const [completion, setCompletion] = useState({
    currentSchoolName: '',
    boardAffiliation: 'CBSE',
    schoolAddress: '',
    schoolContactNumber: '',
    adminExperienceYears: '5',
    highestQualification: 'Master of Education (M.Ed)',
    educationList: [] as EducationEntry[],
    previousInstitutionsList: [] as PreviousInstitutionEntry[],
    aboutMe: '',
    achievements: '',
    awards: '',
  });

  // Load documents
  const loadDocuments = async () => {
    if (!accessToken) return;
    try {
      const res = await fetchApi<{ documents: PrincipalDocument[] }>('/principal/documents', {}, accessToken);
      setDocuments(res.documents || []);
    } catch {
      // Ignore background load error
    }
  };

  // Load Profile
  const loadProfile = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchApi<{ profile: PrincipalProfile; documents: PrincipalDocument[] }>(
        '/principal/onboarding',
        {},
        accessToken
      );
      const nextProfile = res.profile;
      setProfile(nextProfile);
      setDocuments(res.documents || []);

      if (nextProfile) {
        // Hydrate basic
        const nameParts = (user?.displayName || user?.username || '').trim().split(/\s+/);
        setBasic({
          firstName: nameParts[0] || '',
          lastName: nameParts.slice(1).join(' ') || '',
          dateOfBirth: nextProfile.dateOfBirth || '',
          gender: nextProfile.gender || '',
          contactInformation: nextProfile.contactInformation || '',
        });

        // Hydrate leadership & school
        setCompletion({
          currentSchoolName: nextProfile.currentSchoolName || '',
          boardAffiliation: nextProfile.boardAffiliation || 'CBSE',
          schoolAddress: nextProfile.schoolAddress || '',
          schoolContactNumber: nextProfile.schoolContactNumber || '',
          adminExperienceYears: nextProfile.adminExperienceYears || '5',
          highestQualification: nextProfile.highestQualification || 'Master of Education (M.Ed)',
          educationList: Array.isArray(nextProfile.education) ? nextProfile.education : [],
          previousInstitutionsList: Array.isArray(nextProfile.previousInstitutions) ? nextProfile.previousInstitutions : [],
          aboutMe: nextProfile.aboutMe || '',
          achievements: nextProfile.achievements || '',
          awards: nextProfile.awards || '',
        });

        // Resume active onboarding step
        const editParam = searchParams.get('edit') as PrincipalOnboardingStep | null;
        if (editParam && STEPS.some((s) => s.id === editParam)) {
          setStep(editParam);
        } else if (!nextProfile.onboardingCompleted) {
          if (!nextProfile.basicInformationCompleted) {
            setStep('basic');
          } else if (!nextProfile.profileCompletionCompleted) {
            setStep('completion');
          } else {
            setStep('documents');
          }
        }

        // Sync auth store
        const nextOnboardingCompleted = Boolean(nextProfile.onboardingCompleted);
        if (user && user.onboardingCompleted !== nextOnboardingCompleted) {
          updateUser({ onboardingCompleted: nextOnboardingCompleted });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load principal onboarding');
    } finally {
      setLoading(false);
    }
  };

  const profileLoadedRef = useRef(false);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated || !accessToken) {
      router.replace('/login');
      return;
    }
    if (user?.role && user.role !== 'PRINCIPAL') {
      router.replace(routeForRole(user.role));
      return;
    }
    if (!profileLoadedRef.current && user?.role === 'PRINCIPAL') {
      profileLoadedRef.current = true;
      void loadProfile();
    }
  }, [accessToken, isAuthenticated, isHydrated, router, user?.id, user?.role]);

  // Synchronize URL edit param
  useEffect(() => {
    const editParam = searchParams.get('edit') as PrincipalOnboardingStep | null;
    if (editParam && STEPS.some((s) => s.id === editParam)) {
      setStep(editParam);
    }
  }, [searchParams]);

  // Save Step 1: Basic Information
  const saveBasic = async (e?: React.FormEvent, continueNext = true) => {
    if (e) e.preventDefault();
    if (!accessToken) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        firstName: basic.firstName,
        lastName: basic.lastName,
        gender: basic.gender,
        dateOfBirth: basic.dateOfBirth,
        contactInformation: basic.contactInformation,
      };

      const result = await fetchApi<{ profile: PrincipalProfile }>(
        '/principal/onboarding/basic-information',
        { method: 'PUT', body: JSON.stringify(payload) },
        accessToken
      );
      setProfile(result.profile);

      const fullName = `${basic.firstName} ${basic.lastName}`.trim();
      if (fullName && user && user.displayName !== fullName) {
        updateUser({ displayName: fullName });
      }

      if (isEditingMode && (editing === 'basic' || section === 'basic')) {
        setSuccess('Basic Information updated successfully!');
        router.replace('/principal?section=basic');
      } else if (continueNext) {
        setStep('completion');
        setSuccess('Basic Information saved. Proceeding to School & Leadership Profile.');
      } else {
        setSuccess('Progress saved! You can resume anytime.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save Basic Information');
    } finally {
      setSaving(false);
    }
  };

  // Save Step 2: Leadership & School Profile
  const saveCompletion = async (e?: React.FormEvent, continueNext = true) => {
    if (e) e.preventDefault();
    if (!accessToken) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        currentSchoolName: completion.currentSchoolName,
        boardAffiliation: completion.boardAffiliation,
        schoolAddress: completion.schoolAddress,
        schoolContactNumber: completion.schoolContactNumber,
        adminExperienceYears: completion.adminExperienceYears,
        highestQualification: completion.highestQualification,
        education: completion.educationList,
        previousInstitutions: completion.previousInstitutionsList,
        aboutMe: completion.aboutMe,
        achievements: completion.achievements,
        awards: completion.awards,
      };

      const result = await fetchApi<{ profile: PrincipalProfile }>(
        '/principal/onboarding/profile-completion',
        { method: 'PUT', body: JSON.stringify(payload) },
        accessToken
      );
      setProfile(result.profile);

      if (isEditingMode && (editing === 'completion' || section === 'completion')) {
        setSuccess('Leadership Profile updated successfully!');
        router.replace('/principal?section=completion');
      } else if (continueNext) {
        setStep('documents');
        setSuccess('Leadership Profile saved. Continuing to Document Verification.');
      } else {
        setSuccess('Progress saved! You can safely resume later.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save Leadership Profile');
    } finally {
      setSaving(false);
    }
  };

  // Save Step 3: Documents & Complete Onboarding
  const saveDocumentsStep = async (finalize = true) => {
    if (!accessToken) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await fetchApi<{ profile: PrincipalProfile }>(
        '/principal/onboarding/documents-step',
        { method: 'PUT', body: JSON.stringify({ finalize }) },
        accessToken
      );
      setProfile(result.profile);

      if (isEditingMode && (editing === 'documents' || section === 'documents')) {
        setSuccess('Documents updated successfully!');
        router.replace('/principal?section=documents');
      } else if (finalize) {
        updateUser({ onboardingCompleted: true });
        setSuccess('🎉 Congratulations! Your Principal profile and credentials have been submitted for verification.');
        router.replace('/principal');
      } else {
        setSuccess('Documents saved! You can resume anytime.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete Documents step');
    } finally {
      setSaving(false);
    }
  };

  // Profile Photo Upload Handler
  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !accessToken || !user) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError('Choose a JPEG, PNG, or WEBP image up to 5 MB.');
      return;
    }
    setUploadingPhoto(true);
    setError(null);
    try {
      const upload = await fetchApi<{ uploadUrl: string; avatarUrl: string }>(
        '/auth/profile/avatar-upload',
        { method: 'POST', body: JSON.stringify({ contentType: file.type }) },
        accessToken
      );
      const uploaded = await fetch(upload.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!uploaded.ok) throw new Error('Profile photo upload failed');
      const updatedUser = await fetchApi(
        '/auth/profile',
        { method: 'PATCH', body: JSON.stringify({ avatar: upload.avatarUrl }) },
        accessToken
      );
      setAuth(updatedUser, accessToken);
      setSuccess('Profile photo uploaded successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to upload profile photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Document Upload Handler
  const handleDocumentUpload = async (docType: string, file: File, documentName?: string) => {
    if (!accessToken) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('File must be smaller than 10 MB.');
      return;
    }
    setUploadingDoc(docType);
    setError(null);
    try {
      const presign = await fetchApi<{ uploadUrl: string; storageKey: string }>(
        '/principal/documents/upload-url',
        {
          method: 'POST',
          body: JSON.stringify({
            documentType: docType,
            documentName: documentName || docType,
            fileName: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
          }),
        },
        accessToken
      );

      // Upload file directly
      await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      // Complete register
      await fetchApi(
        '/principal/documents/complete',
        {
          method: 'POST',
          body: JSON.stringify({
            documentType: docType,
            documentName: documentName || docType,
            fileName: file.name,
            storageKey: presign.storageKey,
            mimeType: file.type,
            sizeBytes: file.size,
          }),
        },
        accessToken
      );

      await loadDocuments();
      setSuccess(`${documentName || docType} uploaded successfully.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Document upload failed');
    } finally {
      setUploadingDoc(null);
    }
  };

  // Delete document
  const handleDeleteDocument = async (id: string) => {
    if (!accessToken) return;
    try {
      await fetchApi(`/principal/documents/${id}`, { method: 'DELETE' }, accessToken);
      await loadDocuments();
      setSuccess('Document removed successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document');
    }
  };

  if (loading && !profile) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <LoaderCircle className="size-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground">Loading Principal workspace...</p>
      </div>
    );
  }

  // Section view for completed profile
  if (profile?.onboardingCompleted && section && !editing) {
    return (
      <PrincipalSectionView
        sectionKey={section}
        profile={profile}
        user={user}
        documents={documents}
        onEdit={(s: string) => router.push(`/principal?section=${s}&edit=${s}`)}
        onBack={() => router.push('/principal')}
        success={success}
        error={error}
      />
    );
  }

  // In-place section edit view for completed profile
  if (profile?.onboardingCompleted && editing) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">Edit Section</span>
            <h1 className="font-heading text-2xl font-bold mt-1">
              {editing === 'basic' ? 'Edit Basic Information' : editing === 'completion' ? 'Edit Leadership & School Profile' : 'Manage Verified Documents'}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => router.push(`/principal?section=${editing}`)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
          >
            <ArrowLeft className="size-3.5" />
            <span>Cancel & Return</span>
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-destructive/15 border border-destructive/30 rounded-lg text-destructive text-sm flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-emerald-500/15 border border-emerald-500/30 rounded-lg text-emerald-600 text-sm flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0" />
            {success}
          </div>
        )}

        {editing === 'basic' && (
          <PrincipalBasicForm
            data={basic}
            update={(k: string, v: string) => setBasic((c) => ({ ...c, [k]: v }))}
            photo={user?.avatar || ''}
            email={user?.email || ''}
            uploadingPhoto={uploadingPhoto}
            onPhotoUpload={handlePhotoUpload}
            saving={saving}
            onSubmit={(e: React.FormEvent) => saveBasic(e, false)}
            onCancel={() => router.push('/principal?section=basic')}
          />
        )}

        {editing === 'completion' && (
          <PrincipalCompletionForm
            data={completion}
            setData={setCompletion}
            saving={saving}
            onSubmit={(e: React.FormEvent) => saveCompletion(e, false)}
            onBack={() => router.push('/principal?section=completion')}
          />
        )}

        {editing === 'documents' && (
          <PrincipalDocumentsForm
            documents={documents}
            uploadingDoc={uploadingDoc}
            onUpload={handleDocumentUpload}
            onDelete={handleDeleteDocument}
            saving={saving}
            onSubmit={() => saveDocumentsStep(false)}
            onBack={() => router.push('/principal?section=documents')}
          />
        )}
      </main>
    );
  }

  // Dynamic Dashboard once onboarding is completed
  if (profile?.onboardingCompleted && !editing) {
    return (
      <PrincipalDashboard
        user={user}
        profile={profile}
        documents={documents}
        onNavigate={(target: string) => router.push(target)}
      />
    );
  }

  // 3-Step Onboarding Wizard
  const currentStepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Top Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              Step {currentStepIndex + 1} of {STEPS.length}
            </span>
            <span className="text-xs text-muted-foreground font-medium">Principal Onboarding</span>
          </div>
          <h1 className="font-heading text-3xl font-bold mt-2">Principal Credential Setup</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Set up your administrative credentials and institution profile to manage your school on Schoolmini.
          </p>
        </div>
        <div className="hidden sm:flex w-12 h-12 rounded-full bg-primary text-primary-foreground items-center justify-center text-xl font-bold overflow-hidden shadow-sm">
          {user?.avatar && !avatarError ? (
            <img
              src={user.avatar}
              alt="Avatar"
              referrerPolicy="no-referrer"
              onError={() => setAvatarError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            (user?.displayName?.[0] || 'P').toUpperCase()
          )}
        </div>
      </div>

      {/* 3-Step Stepper */}
      <div className="mb-7 overflow-x-auto pb-2">
        <div className="flex items-center gap-2 min-w-[500px]">
          {STEPS.map((s, idx) => {
            const isCurrent = step === s.id;
            const isDone =
              s.id === 'basic'
                ? profile?.basicInformationCompleted
                : s.id === 'completion'
                ? profile?.profileCompletionCompleted
                : profile?.documentsCompleted;

            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  if (isDone || idx <= currentStepIndex) setStep(s.id);
                }}
                className={`flex-1 flex items-center gap-2.5 p-3 rounded-lg border text-left transition-all ${
                  isCurrent
                    ? 'border-primary bg-primary/10 text-primary font-semibold shadow-sm'
                    : isDone
                    ? 'border-border bg-card text-foreground hover:bg-muted/50'
                    : 'border-border/60 bg-muted/30 text-muted-foreground opacity-60 cursor-not-allowed'
                }`}
              >
                <div
                  className={`size-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    isDone
                      ? 'bg-emerald-500 text-white'
                      : isCurrent
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isDone ? <Check className="size-3.5" /> : s.stepNum}
                </div>
                <span className="text-xs truncate">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-destructive/15 border border-destructive/30 rounded-lg text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 bg-emerald-500/15 border border-emerald-500/30 rounded-lg text-emerald-600 text-sm flex items-center gap-2">
          <CheckCircle2 className="size-4 shrink-0" />
          {success}
        </div>
      )}

      {/* Forms */}
      {step === 'basic' && (
        <PrincipalBasicForm
          data={basic}
          update={(k: string, v: string) => setBasic((c) => ({ ...c, [k]: v }))}
          photo={user?.avatar || ''}
          email={user?.email || ''}
          uploadingPhoto={uploadingPhoto}
          onPhotoUpload={handlePhotoUpload}
          saving={saving}
          onSubmit={(e: React.FormEvent) => saveBasic(e, true)}
          onSaveProgress={() => saveBasic(undefined, false)}
        />
      )}

      {step === 'completion' && (
        <PrincipalCompletionForm
          data={completion}
          setData={setCompletion}
          saving={saving}
          onSubmit={(e: React.FormEvent) => saveCompletion(e, true)}
          onSaveProgress={() => saveCompletion(undefined, false)}
          onBack={() => setStep('basic')}
        />
      )}

      {step === 'documents' && (
        <PrincipalDocumentsForm
          documents={documents}
          uploadingDoc={uploadingDoc}
          onUpload={handleDocumentUpload}
          onDelete={handleDeleteDocument}
          saving={saving}
          onSubmit={() => saveDocumentsStep(true)}
          onSaveProgress={() => saveDocumentsStep(false)}
          onBack={() => setStep('completion')}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------------------
// Step 1: Principal Basic Information Form
// -------------------------------------------------------------------------
function PrincipalBasicForm({
  data,
  update,
  photo,
  email,
  uploadingPhoto,
  onPhotoUpload,
  saving,
  onSubmit,
  onSaveProgress,
  onCancel,
}: any) {
  const [photoError, setPhotoError] = useState(false);
  useEffect(() => setPhotoError(false), [photo]);

  const inputClass = 'mt-1.5 w-full rounded-md border border-border bg-input px-3 py-2.5 font-normal text-sm';

  return (
    <form onSubmit={onSubmit} className="bg-card border border-border rounded-xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-heading text-xl font-bold flex items-center gap-2">
          <UserRound className="size-5 text-primary" />
          Principal Information
        </h2>
        <span className="text-xs text-muted-foreground">{onCancel ? 'Edit Section' : 'Step 1 of 3'}</span>
      </div>

      <div className="mb-5 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold overflow-hidden shadow-sm">
          {photo && !photoError ? (
            <img src={photo} alt="Profile" referrerPolicy="no-referrer" onError={() => setPhotoError(true)} className="w-full h-full object-cover" />
          ) : (
            data.firstName?.[0]?.toUpperCase() || 'P'
          )}
        </div>
        <label className="inline-flex items-center gap-2 py-2 px-3 rounded-md border border-border bg-secondary cursor-pointer text-sm font-semibold hover:bg-secondary/80 transition-colors">
          <ImagePlus className="w-4 h-4" />
          {uploadingPhoto ? 'Uploading...' : 'Upload photo'}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onPhotoUpload} disabled={uploadingPhoto} className="sr-only" />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 mb-4">
        <label className="text-sm font-semibold">
          First Name
          <input required type="text" placeholder="First name" value={data.firstName || ''} onChange={(e) => update('firstName', e.target.value)} className={inputClass} />
        </label>
        <label className="text-sm font-semibold">
          Surname / Last Name
          <input required type="text" placeholder="Last name" value={data.lastName || ''} onChange={(e) => update('lastName', e.target.value)} className={inputClass} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 mb-4">
        <label className="text-sm font-semibold">
          Email Address
          <input disabled type="email" value={email} className={`${inputClass} bg-muted text-muted-foreground cursor-not-allowed`} />
        </label>
        <div>
          <label className="text-sm font-semibold block mb-1">Gender</label>
          <Select
            value={data.gender || ''}
            onValueChange={(val) => update('gender', val || '')}
          >
            <SelectTrigger className={`w-full h-10 ${inputClass}`}>
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Male">Male</SelectItem>
              <SelectItem value="Female">Female</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
              <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <label className="text-sm font-semibold">
          Date of Birth (Optional)
          <input type="date" value={data.dateOfBirth || ''} onChange={(e) => update('dateOfBirth', e.target.value)} className={inputClass} />
        </label>
        <label className="text-sm font-semibold">
          Official Contact Phone
          <input type="tel" placeholder="+91 98765 43210" value={data.contactInformation || ''} onChange={(e) => update('contactInformation', e.target.value)} className={inputClass} />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border">
        {onCancel ? (
          <button type="button" onClick={onCancel} className="px-4 py-2 text-xs font-semibold rounded-md border border-border hover:bg-muted cursor-pointer">
            Cancel
          </button>
        ) : onSaveProgress ? (
          <button type="button" onClick={onSaveProgress} disabled={saving} className="px-4 py-2 text-xs font-semibold rounded-md border border-border hover:bg-muted cursor-pointer">
            Save for later
          </button>
        ) : <div />}
        <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50">
          <span>{saving ? 'Saving...' : onCancel ? 'Update Information' : 'Save & Continue'}</span>
          <ArrowRight className="size-4" />
        </button>
      </div>
    </form>
  );
}

// -------------------------------------------------------------------------
// Step 2: Leadership & School Profile Form
// -------------------------------------------------------------------------
function PrincipalCompletionForm({ data, setData, saving, onSubmit, onSaveProgress, onBack }: any) {
  const inputClass = 'mt-1.5 w-full rounded-md border border-border bg-input px-3 py-2 text-sm';

  const updateField = (key: string, val: any) => setData((c: any) => ({ ...c, [key]: val }));

  // Dynamic Education Entry
  const addEducation = () => {
    setData((c: any) => ({
      ...c,
      educationList: [...c.educationList, { degree: '', institution: '', year: '', field: '' }],
    }));
  };
  const updateEducation = (index: number, field: string, val: string) => {
    setData((c: any) => {
      const list = [...c.educationList];
      list[index] = { ...list[index], [field]: val };
      return { ...c, educationList: list };
    });
  };
  const removeEducation = (index: number) => {
    setData((c: any) => ({
      ...c,
      educationList: c.educationList.filter((_: any, i: number) => i !== index),
    }));
  };

  // Dynamic Previous Institutions Entry
  const addInstitution = () => {
    setData((c: any) => ({
      ...c,
      previousInstitutionsList: [
        ...c.previousInstitutionsList,
        { institutionName: '', role: 'Principal', fromYear: '', toYear: '' },
      ],
    }));
  };
  const updateInstitution = (index: number, field: string, val: string) => {
    setData((c: any) => {
      const list = [...c.previousInstitutionsList];
      list[index] = { ...list[index], [field]: val };
      return { ...c, previousInstitutionsList: list };
    });
  };
  const removeInstitution = (index: number) => {
    setData((c: any) => ({
      ...c,
      previousInstitutionsList: c.previousInstitutionsList.filter((_: any, i: number) => i !== index),
    }));
  };

  return (
    <form onSubmit={onSubmit} className="bg-card border border-border rounded-xl p-6 shadow-lg space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h2 className="font-heading text-xl font-bold flex items-center gap-2">
            <Building2 className="size-5 text-primary" />
            Leadership & School Profile
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Tell us about your institution and administrative track record.</p>
        </div>
      </div>

      {/* Current School & Board */}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          Current School / Institution Name
          <input required type="text" placeholder="e.g. St. Xavier's Senior Secondary School" value={data.currentSchoolName || ''} onChange={(e) => updateField('currentSchoolName', e.target.value)} className={inputClass} />
        </label>
        <div>
          <label className="text-sm font-semibold block mb-1">Board Affiliation</label>
          <Select
            value={data.boardAffiliation || 'CBSE'}
            onValueChange={(val) => updateField('boardAffiliation', val || 'CBSE')}
          >
            <SelectTrigger className={`w-full h-10 ${inputClass}`}>
              <SelectValue placeholder="Select Board" />
            </SelectTrigger>
            <SelectContent>
              {BOARD_OPTIONS.map((b) => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm font-semibold">
          Administrative Experience (Years)
          <input required type="number" min="0" max="50" placeholder="e.g. 10" value={data.adminExperienceYears || ''} onChange={(e) => updateField('adminExperienceYears', e.target.value)} className={inputClass} />
        </label>
        <label className="text-sm font-semibold sm:col-span-2">
          Highest Degree / Qualification
          <input required type="text" placeholder="e.g. Ph.D in Education, M.Ed, M.Sc." value={data.highestQualification || ''} onChange={(e) => updateField('highestQualification', e.target.value)} className={inputClass} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          School Address / City
          <input type="text" placeholder="e.g. Sector 12, Noida, UP" value={data.schoolAddress || ''} onChange={(e) => updateField('schoolAddress', e.target.value)} className={inputClass} />
        </label>
        <label className="text-sm font-semibold">
          Official School Contact / Landline
          <input type="text" placeholder="e.g. 0120-2345678" value={data.schoolContactNumber || ''} onChange={(e) => updateField('schoolContactNumber', e.target.value)} className={inputClass} />
        </label>
      </div>

      {/* Educational Qualifications List */}
      <div className="pt-2 border-t border-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <GraduationCap className="size-4 text-primary" />
            Educational Credentials
          </h3>
          <button type="button" onClick={addEducation} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer">
            <Plus className="size-3.5" /> Add Degree
          </button>
        </div>
        {data.educationList.length === 0 ? (
          <p className="text-xs text-muted-foreground p-3 border border-dashed rounded-md bg-muted/20">Click "+ Add Degree" to record postgraduate, doctoral, or professional degrees.</p>
        ) : (
          <div className="space-y-3">
            {data.educationList.map((edu: EducationEntry, idx: number) => (
              <div key={idx} className="flex flex-wrap items-center gap-2.5 p-3 rounded-md bg-muted/40 border border-border">
                <input required placeholder="Degree (e.g. M.Ed)" value={edu.degree} onChange={(e) => updateEducation(idx, 'degree', e.target.value)} className="flex-1 min-w-[140px] px-2.5 py-1.5 bg-input border rounded text-xs" />
                <input required placeholder="University / College" value={edu.institution} onChange={(e) => updateEducation(idx, 'institution', e.target.value)} className="flex-1 min-w-[180px] px-2.5 py-1.5 bg-input border rounded text-xs" />
                <input required placeholder="Year" value={edu.year} onChange={(e) => updateEducation(idx, 'year', e.target.value)} className="w-20 px-2.5 py-1.5 bg-input border rounded text-xs" />
                <button type="button" onClick={() => removeEducation(idx)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded cursor-pointer">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Previous Institutions Served */}
      <div className="pt-2 border-t border-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <School className="size-4 text-primary" />
            Previous Institutions Served
          </h3>
          <button type="button" onClick={addInstitution} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer">
            <Plus className="size-3.5" /> Add Institution
          </button>
        </div>
        {data.previousInstitutionsList.length === 0 ? (
          <p className="text-xs text-muted-foreground p-3 border border-dashed rounded-md bg-muted/20">Record previous schools or academic institutes where you served in administrative leadership roles.</p>
        ) : (
          <div className="space-y-3">
            {data.previousInstitutionsList.map((inst: PreviousInstitutionEntry, idx: number) => (
              <div key={idx} className="flex flex-wrap items-center gap-2.5 p-3 rounded-md bg-muted/40 border border-border">
                <input required placeholder="School / Institution Name" value={inst.institutionName} onChange={(e) => updateInstitution(idx, 'institutionName', e.target.value)} className="flex-1 min-w-[180px] px-2.5 py-1.5 bg-input border rounded text-xs" />
                <input required placeholder="Role (e.g. Vice Principal)" value={inst.role} onChange={(e) => updateInstitution(idx, 'role', e.target.value)} className="w-40 px-2.5 py-1.5 bg-input border rounded text-xs" />
                <input placeholder="From Year" value={inst.fromYear} onChange={(e) => updateInstitution(idx, 'fromYear', e.target.value)} className="w-24 px-2.5 py-1.5 bg-input border rounded text-xs" />
                <input placeholder="To Year" value={inst.toYear} onChange={(e) => updateInstitution(idx, 'toYear', e.target.value)} className="w-24 px-2.5 py-1.5 bg-input border rounded text-xs" />
                <button type="button" onClick={() => removeInstitution(idx)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded cursor-pointer">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Philosophy & Achievements */}
      <div className="space-y-4 pt-2 border-t border-border">
        <label className="block text-sm font-semibold">
          Educational Leadership Philosophy / About Me
          <textarea rows={3} placeholder="Share your vision for school administration, pedagogical leadership, and student development..." value={data.aboutMe || ''} onChange={(e) => updateField('aboutMe', e.target.value)} className={inputClass} />
        </label>
        <label className="block text-sm font-semibold">
          Key Institutional Achievements & Recognitions
          <textarea rows={2} placeholder="E.g. Led school to 100% board distinction; implemented digital smart classes..." value={data.achievements || ''} onChange={(e) => updateField('achievements', e.target.value)} className={inputClass} />
        </label>
      </div>

      {/* Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border">
        {onBack ? (
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md border border-border hover:bg-muted cursor-pointer">
            <ArrowLeft className="size-3.5" /> Back
          </button>
        ) : <div />}
        <div className="flex items-center gap-3">
          {onSaveProgress && (
            <button type="button" onClick={onSaveProgress} disabled={saving} className="px-4 py-2 text-xs font-semibold rounded-md border border-border hover:bg-muted cursor-pointer">
              Save for later
            </button>
          )}
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50">
            <span>{saving ? 'Saving...' : 'Save & Continue'}</span>
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    </form>
  );
}

// -------------------------------------------------------------------------
// Step 3: Verified Documents Form
// -------------------------------------------------------------------------
function PrincipalDocumentsForm({ documents, uploadingDoc, onUpload, onDelete, saving, onSubmit, onSaveProgress, onBack }: any) {
  const REQUIRED_DOCS = [
    { type: 'IDENTITY_PROOF', title: 'Government Photo Identity', desc: 'Aadhaar Card, Passport, or Voter ID (PDF or Image)' },
    { type: 'APPOINTMENT_LETTER', title: 'Principal Appointment / Experience Letter', desc: 'Official appointment letter or management tenure verification' },
    { type: 'HIGHEST_DEGREE', title: 'Highest Educational Degree / Certificate', desc: 'Post-graduate degree, Ph.D, or M.Ed certificate' },
    { type: 'SCHOOL_AFFILIATION_PROOF', title: 'School Affiliation / Institutional ID', desc: 'School letterhead credential, ID card, or affiliation document' },
  ];

  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-lg space-y-6">
      <div className="border-b border-border pb-4">
        <h2 className="font-heading text-xl font-bold flex items-center gap-2">
          <FileCheck2 className="size-5 text-primary" />
          Administrative Document Verification
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Upload authentic verification documents. As a school principal, your credentials will be verified by our administrative onboarding committee.
        </p>
      </div>

      {/* Verification Notice Banner */}
      <div className="p-4 rounded-lg bg-primary/10 border border-primary/25 flex items-start gap-3">
        <ShieldCheck className="size-5 text-primary shrink-0 mt-0.5" />
        <div className="text-xs text-foreground/90 space-y-1">
          <p className="font-semibold text-primary">Confidential Non-Teacher Verification Process</p>
          <p className="text-muted-foreground">
            Principals are not subject to classroom demo lessons, teacher assessment exams, or hourly availability scheduling. Once uploaded, documents will be confirmed by platform administrators.
          </p>
        </div>
      </div>

      {/* Document Slots */}
      <div className="space-y-4">
        {REQUIRED_DOCS.map((docDef) => {
          const uploadedDoc = documents.find((d: PrincipalDocument) => d.documentType === docDef.type);
          const isUploading = uploadingDoc === docDef.type;

          return (
            <div key={docDef.type} className="p-4 rounded-lg border border-border bg-card/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm">{docDef.title}</h4>
                  {uploadedDoc && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                      <Check className="size-3" /> Uploaded
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{docDef.desc}</p>
                {uploadedDoc && (
                  <p className="text-xs font-mono text-primary truncate max-w-sm pt-1">
                    {uploadedDoc.fileName} ({(uploadedDoc.sizeBytes / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {uploadedDoc ? (
                  <>
                    {uploadedDoc.downloadUrl && (
                      <a href={uploadedDoc.downloadUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded border border-border hover:bg-muted transition-colors">
                        <ExternalLink className="size-3" /> View
                      </a>
                    )}
                    <button type="button" onClick={() => onDelete(uploadedDoc.id)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded cursor-pointer">
                      <Trash2 className="size-3.5" />
                    </button>
                  </>
                ) : (
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-secondary text-xs font-semibold hover:bg-secondary/80 cursor-pointer transition-colors">
                    <UploadCloud className="size-3.5" />
                    <span>{isUploading ? 'Uploading...' : 'Upload'}</span>
                    <input
                      type="file"
                      accept=".pdf,image/jpeg,image/png,image/webp"
                      disabled={isUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) onUpload(docDef.type, file, docDef.title);
                      }}
                      className="sr-only"
                    />
                  </label>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border">
        {onBack ? (
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md border border-border hover:bg-muted cursor-pointer">
            <ArrowLeft className="size-3.5" /> Back
          </button>
        ) : <div />}
        <div className="flex items-center gap-3">
          {onSaveProgress && (
            <button type="button" onClick={onSaveProgress} disabled={saving} className="px-4 py-2 text-xs font-semibold rounded-md border border-border hover:bg-muted cursor-pointer">
              Save for later
            </button>
          )}
          <button
            type="button"
            onClick={onSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-md cursor-pointer disabled:opacity-50"
          >
            <span>{saving ? 'Processing...' : 'Complete & Submit Profile'}</span>
            <CheckCircle2 className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// Section Details Review Component
// -------------------------------------------------------------------------
function PrincipalSectionView({ sectionKey, profile, user, documents, onEdit, onBack, success, error }: any) {
  let title = 'Principal Section';

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="mb-4">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
          <ArrowLeft className="size-3.5" />
          <span>Back to Dashboard</span>
        </button>
      </div>

      {error && (
        <div className="mb-5 flex gap-2 rounded-md border border-destructive bg-destructive/15 p-3 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="mb-5 flex gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/15 p-3 text-sm text-emerald-500">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {success}
        </div>
      )}

      {/* Header */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-5 rounded-xl border border-border bg-card p-6 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Building2 className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm font-semibold text-primary">Principal Profile</p>
            <h1 className="mt-1 font-heading text-2xl font-bold sm:text-3xl">
              {sectionKey === 'basic' ? 'Basic Information' : sectionKey === 'completion' ? 'Leadership & School Profile' : 'Verified Documents'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Review your saved administrator credentials.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onEdit(sectionKey)}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary px-3.5 py-2.5 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80 cursor-pointer"
        >
          <Edit3 className="h-4 w-4" />
          Edit
        </button>
      </header>

      {/* Section Content */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-lg sm:p-6">
        {sectionKey === 'basic' && (
          <dl className="grid gap-4 sm:grid-cols-2">
            {[
              ['Display Name', user?.displayName || 'Not provided'],
              ['Email Address', user?.email || 'Not provided'],
              ['Gender', profile.gender || 'Not specified'],
              ['Date of Birth', profile.dateOfBirth || 'Not provided'],
              ['Contact Number', profile.contactInformation || 'Not provided'],
            ].map(([k, v]) => (
              <div key={k} className="rounded-md bg-muted px-3.5 py-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{k}</dt>
                <dd className="mt-1 text-sm font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        )}

        {sectionKey === 'completion' && (
          <div className="space-y-6">
            <dl className="grid gap-4 sm:grid-cols-2">
              {[
                ['Current School', profile.currentSchoolName || 'Not specified'],
                ['Board Affiliation', profile.boardAffiliation || 'CBSE'],
                ['Administrative Experience', `${profile.adminExperienceYears || 0} Years`],
                ['Highest Qualification', profile.highestQualification || 'Master of Education'],
                ['School Address', profile.schoolAddress || 'Not specified'],
                ['School Contact', profile.schoolContactNumber || 'Not specified'],
              ].map(([k, v]) => (
                <div key={k} className="rounded-md bg-muted px-3.5 py-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{k}</dt>
                  <dd className="mt-1 text-sm font-medium">{v}</dd>
                </div>
              ))}
            </dl>

            {profile.aboutMe && (
              <div className="rounded-md bg-muted p-4">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Leadership Philosophy</span>
                <p className="mt-1.5 text-sm leading-relaxed">{profile.aboutMe}</p>
              </div>
            )}

            {Array.isArray(profile.education) && profile.education.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-3">Academic Credentials</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  {profile.education.map((edu: any, i: number) => (
                    <div key={i} className="p-3 bg-muted rounded-md text-xs">
                      <p className="font-semibold text-sm">{edu.degree}</p>
                      <p className="text-muted-foreground">{edu.institution} ({edu.year})</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {sectionKey === 'documents' && (
          <div className="space-y-3">
            {documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No verification documents uploaded yet.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {documents.map((doc: PrincipalDocument) => (
                  <div key={doc.id} className="p-3.5 rounded-lg border border-border bg-muted/40 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm truncate">{doc.documentName || doc.documentType}</p>
                      <p className="text-xs text-muted-foreground">{doc.fileName} ({(doc.sizeBytes / 1024).toFixed(1)} KB)</p>
                    </div>
                    {doc.downloadUrl && (
                      <a href={doc.downloadUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 text-primary hover:bg-primary/10 rounded">
                        <ExternalLink className="size-4" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

// -------------------------------------------------------------------------
// Principal Dynamic Dashboard Component
// -------------------------------------------------------------------------
function PrincipalDashboard({ user, profile, documents, onNavigate }: any) {
  const isVerified = profile?.verificationStatus === 'VERIFIED';
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);

  const fetchCandidates = async () => {
    try {
      setLoadingCandidates(true);
      const res = await fetchApi('/principal/candidates');
      setCandidates(res?.candidates || []);
    } catch (e) {
      console.warn('Failed to load candidates:', e);
    } finally {
      setLoadingCandidates(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Welcome Banner */}
      <div className="rounded-2xl border border-border bg-gradient-to-r from-card via-card to-primary/5 p-6 sm:p-8 shadow-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="size-16 rounded-2xl bg-primary/15 text-primary flex items-center justify-center font-bold text-2xl shadow-inner shrink-0">
              {user?.avatar ? (
                <img src={user.avatar} alt="Principal" referrerPolicy="no-referrer" className="w-full h-full rounded-2xl object-cover" />
              ) : (
                <Building2 className="size-8" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-heading text-2xl sm:text-3xl font-bold">
                  {user?.displayName || user?.username}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-semibold">
                  Principal
                </span>
                {isVerified ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 text-xs font-semibold">
                    <CheckCircle2 className="size-3" /> Verified Credential
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 border border-amber-500/30 text-xs font-semibold">
                    <Clock className="size-3" /> Verification In Review
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {profile?.currentSchoolName ? `${profile.currentSchoolName} (${profile.boardAffiliation || 'CBSE'})` : 'School Administrator Workspace'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('/principal?section=basic')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-secondary text-xs font-semibold hover:bg-secondary/80 transition-colors shadow-sm cursor-pointer"
          >
            <Edit3 className="size-3.5" />
            <span>Review Profile</span>
          </button>
        </div>
      </div>

      {/* Onboarding Overview 3-Cards */}
      <div>
        <h2 className="font-heading text-lg font-bold mb-4 flex items-center gap-2">
          <FileText className="size-5 text-primary" />
          Onboarding & Credentials Status
        </h2>

        <div className="grid gap-5 md:grid-cols-3">
          {/* Card 1: Basic Information */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col justify-between hover:border-primary/50 transition-all">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <UserRound className="size-4" />
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  <Check className="size-3" /> Completed
                </span>
              </div>
              <h3 className="font-semibold text-base">Basic Information</h3>
              <p className="text-xs text-muted-foreground mt-1">Personal contact, legal name, official identity and registered email.</p>
              <div className="mt-4 pt-3 border-t border-border/60 text-xs space-y-1 text-muted-foreground">
                <p className="truncate"><span className="font-medium text-foreground">Name:</span> {user?.displayName}</p>
                <p className="truncate"><span className="font-medium text-foreground">Email:</span> {user?.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/principal?section=basic')}
              className="mt-5 inline-flex items-center justify-between w-full rounded-md border border-border bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
            >
              <span>View & Edit</span>
              <ArrowRight className="size-3.5" />
            </button>
          </div>

          {/* Card 2: Leadership Profile */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col justify-between hover:border-primary/50 transition-all">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Building2 className="size-4" />
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  <Check className="size-3" /> Completed
                </span>
              </div>
              <h3 className="font-semibold text-base">Leadership & School Profile</h3>
              <p className="text-xs text-muted-foreground mt-1">Current institution, affiliation board, academic degrees, and administrative tenure.</p>
              <div className="mt-4 pt-3 border-t border-border/60 text-xs space-y-1 text-muted-foreground">
                <p className="truncate"><span className="font-medium text-foreground">School:</span> {profile?.currentSchoolName || 'Configured'}</p>
                <p className="truncate"><span className="font-medium text-foreground">Experience:</span> {profile?.adminExperienceYears || 0} Years</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/principal?section=completion')}
              className="mt-5 inline-flex items-center justify-between w-full rounded-md border border-border bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
            >
              <span>View & Edit</span>
              <ArrowRight className="size-3.5" />
            </button>
          </div>

          {/* Card 3: Documents */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col justify-between hover:border-primary/50 transition-all">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <FileCheck2 className="size-4" />
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  <Check className="size-3" /> Submitted
                </span>
              </div>
              <h3 className="font-semibold text-base">Verified Documents</h3>
              <p className="text-xs text-muted-foreground mt-1">Institutional appointment letter, highest degree, ID proof, and school affiliations.</p>
              <div className="mt-4 pt-3 border-t border-border/60 text-xs space-y-1 text-muted-foreground">
                <p><span className="font-medium text-foreground">Documents Count:</span> {documents.length} Files</p>
                <p><span className="font-medium text-foreground">Audit Status:</span> Non-Teacher Review</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/principal?section=documents')}
              className="mt-5 inline-flex items-center justify-between w-full rounded-md border border-border bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
            >
              <span>View & Edit</span>
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Institutional Management Modules */}
      <div>
        <h2 className="font-heading text-lg font-bold mb-4 flex items-center gap-2">
          <Briefcase className="size-5 text-primary" />
          School Operations & Administrative Modules
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="p-4 rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors">
            <div className="size-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center mb-2.5">
              <Users className="size-4" />
            </div>
            <h4 className="font-semibold text-sm">Faculty & Teacher Hiring</h4>
            <p className="text-xs text-muted-foreground mt-1">Publish subject vacancies and browse certified teacher profiles.</p>
          </div>

          <div className="p-4 rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors">
            <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-2.5">
              <GraduationCap className="size-4" />
            </div>
            <h4 className="font-semibold text-sm">Student Admissions</h4>
            <p className="text-xs text-muted-foreground mt-1">Review student admission inquiries, class rosters and enrollment.</p>
          </div>

          <div className="p-4 rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors">
            <div className="size-8 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center mb-2.5">
              <BookOpen className="size-4" />
            </div>
            <h4 className="font-semibold text-sm">Academic Desk</h4>
            <p className="text-xs text-muted-foreground mt-1">Timetables, substitution scheduling, and curriculum progress.</p>
          </div>

          <div className="p-4 rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors">
            <div className="size-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center mb-2.5">
              <Award className="size-4" />
            </div>
            <h4 className="font-semibold text-sm">School Compliance & Audit</h4>
            <p className="text-xs text-muted-foreground mt-1">Board compliance checklist, staff records, and credentials repository.</p>
          </div>
        </div>
      </div>

      {/* Candidate Review Surface (Part A Spec A8) */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-bold flex items-center gap-2">
              <Users className="size-5 text-primary" />
              Teacher Candidates & Demo Class Evaluation Desk
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Review certified teaching candidates, in-app demo video playback, AI pedagogical facts, sub-scores, and competency metrics.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchCandidates}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
          >
            {loadingCandidates ? <LoaderCircle className="size-3.5 animate-spin" /> : <Clock className="size-3.5" />}
            <span>Refresh Candidates</span>
          </button>
        </div>

        {loadingCandidates && candidates.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground text-xs gap-2">
            <LoaderCircle className="size-4 animate-spin text-primary" />
            <span>Loading candidates...</span>
          </div>
        ) : candidates.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-border rounded-xl text-muted-foreground text-xs">
            No registered teacher candidates found yet.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {candidates.map((cand) => {
              const evalData = cand.demoEvaluation;
              const evalStatus = evalData?.status || 'NOT_SUBMITTED';
              const demoScore = evalData?.demoScore;
              const band = evalData?.band;

              return (
                <div
                  key={cand.id}
                  className="rounded-xl border border-border bg-background p-4 flex flex-col justify-between hover:border-primary/50 transition-all shadow-xs"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                          {cand.displayName?.[0] || 'T'}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-foreground truncate">
                            {cand.displayName || cand.email}
                          </h4>
                          <p className="text-[11px] text-muted-foreground truncate">{cand.email}</p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-muted-foreground font-medium">Demo Status:</span>
                      {evalStatus === 'PROCESSED' ? (
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full text-[11px]">
                          <CheckCircle2 className="size-3" />
                          {demoScore != null ? `${demoScore}/100 (${band})` : 'Evaluated'}
                        </span>
                      ) : evalStatus === 'PROCESSING' || evalStatus === 'PENDING' ? (
                        <span className="inline-flex items-center gap-1 text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full text-[11px] font-semibold">
                          <LoaderCircle className="size-3 animate-spin" /> In Progress
                        </span>
                      ) : evalStatus === 'FAILED' ? (
                        <span className="inline-flex items-center gap-1 text-destructive bg-destructive/10 px-2 py-0.5 rounded-full text-[11px] font-semibold">
                          <AlertCircle className="size-3" /> Evaluation Failed
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          No Demo Submitted
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedCandidate(cand)}
                    className="mt-4 w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-secondary-foreground py-2 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <span>Review Evaluation</span>
                    <ArrowRight className="size-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Candidate Review Modal */}
      {selectedCandidate && (
        <CandidateReviewModal
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
          onDecisionChange={fetchCandidates}
        />
      )}
    </div>
  );
}
