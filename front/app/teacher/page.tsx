'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  Crosshair,
  Edit3,
  ExternalLink,
  FileText,
  Globe,
  GraduationCap,
  ImagePlus,
  LoaderCircle,
  Locate,
  MapPin,
  Navigation,
  Play,
  Plus,
  Save,
  School,
  Search,
  ShieldCheck,
  Sliders,
  Sparkles,
  RotateCcw,
  Trash2,
  UploadCloud,
  UserRound,
  Video,
  X,
  Zap,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { AssessmentRunner } from '@/components/skill-assessment/AssessmentRunner';
import { AssessmentResult } from '@/components/skill-assessment/AssessmentResult';
import { useAuthStore } from '@/store/useAuthStore';
import { routeForRole } from '@/lib/auth';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const boardOptions = ['CBSE', 'ICSE', 'STATE_BOARD', 'IB', 'OTHER'];

const weekDays = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

interface TeacherDocument {
  id: string;
  documentType: string;
  documentName?: string;
  slot: number;
  fileName: string;
  sizeBytes: number;
  downloadUrl: string;
}

interface DocumentSlot {
  documentType: string;
  label: string;
  description?: string;
  isRequired: boolean;
  documentName?: string;
}

export type OnboardingStep =
  | 'basic'
  | 'completion'
  | 'documents'
  | 'availability';

const STEPS: { id: OnboardingStep; number: number; label: string }[] = [
  { id: 'basic', number: 1, label: 'Basic Info' },
  { id: 'completion', number: 2, label: 'Personal Details' },
  { id: 'documents', number: 3, label: 'Documents' },
  { id: 'availability', number: 4, label: 'Availability' },
];

export interface EducationEntry {
  courseName: string;
  boardOrUniversity: string;
  passingYear: string;
  gradeSystem: 'Percentage' | 'CGPA';
  gradeValue: string;
}

export interface PreviousSchoolEntry {
  schoolName: string;
  startDate: string;
  endDate: string;
  duration?: string;
  subjectsTaught: string;
}

export interface LocationData {
  locationName: string;
  district: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
  formattedAddress?: string;
  addressDetails?: Record<string, any>;
}

export interface PreferredLocationData extends LocationData {
  radiusKm: number;
}

type TeacherProfile = Record<string, any> & {
  basicInformationCompleted?: boolean;
  profileCompletionCompleted?: boolean;
  documentsCompleted?: boolean;
  skillAssessmentCompleted?: boolean;
  demoClassCompleted?: boolean;
  availabilityCompleted?: boolean;
  onboardingCompleted?: boolean;
};

function listValue(value: unknown): string {
  return Array.isArray(value) ? value.join(', ') : '';
}

function calculateDuration(start: string, end: string): string {
  if (!start) return '';
  const startDate = new Date(start);
  const endDate =
    end && end.toLowerCase() !== 'present' ? new Date(end) : new Date();
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return '';

  let totalMonths =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth());
  if (totalMonths < 0) totalMonths = 0;

  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;

  const parts = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? 'yr' : 'yrs'}`);
  if (months > 0 || years === 0)
    parts.push(`${months} ${months === 1 ? 'mo' : 'mos'}`);
  return parts.join(' ');
}

function getYouTubeEmbedUrl(url: string): string | null {
  if (!url) return null;
  const regExp =
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11
    ? `https://www.youtube.com/embed/${match[2]}`
    : null;
}

function parseArrayOrString(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      return value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
}

export default function TeacherPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
          Loading teacher profile...
        </div>
      }
    >
      <TeacherPageContent />
    </Suspense>
  );
}

function TeacherPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, accessToken, isHydrated, isAuthenticated, setAuth, updateUser } =
    useAuthStore();

  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [step, setStep] = useState<OnboardingStep>('basic');
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
  const [documents, setDocuments] = useState<TeacherDocument[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);

  // Step 1: Basic Information form state
  const [basic, setBasic] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    contactInformation: '',
  });

  // Step 2: Personal details form state
  const [completion, setCompletion] = useState({
    aboutMe: '',
    educationList: [] as EducationEntry[],
    expYears: '0',
    expMonths: '0',
    previousSchoolsList: [] as PreviousSchoolEntry[],
    subjectsList: [] as string[],
    classesTaughtList: [] as string[],
    boardExperience: [] as string[],
    languagesList: [] as string[],
    skillsList: [] as string[],
    achievementsList: [] as string[],
    awardsList: [] as string[],
  });

  // Demo class state (Post-onboarding)
  const [demoVideoUrl, setDemoVideoUrl] = useState('');

  // Pedagogy skill assessment state (Post-onboarding)
  const [pedagogyResult, setPedagogyResult] = useState<any>(null);
  const [loadingPedagogyResult, setLoadingPedagogyResult] = useState(false);
  const [isRetakingPedagogy, setIsRetakingPedagogy] = useState(false);

  useEffect(() => {
    if (
      (section === 'skills' || editing === 'skills') &&
      profile?.skillAssessmentCompleted &&
      !pedagogyResult &&
      !isRetakingPedagogy &&
      accessToken
    ) {
      setLoadingPedagogyResult(true);
      fetchApi<{ result: any }>(
        '/teacher/onboarding/skill-assessment/result',
        {},
        accessToken
      )
        .then((res) => {
          if (res && res.result) {
            setPedagogyResult(res.result);
          }
        })
        .catch(() => {})
        .finally(() => {
          setLoadingPedagogyResult(false);
        });
    }
  }, [
    section,
    editing,
    profile?.skillAssessmentCompleted,
    pedagogyResult,
    isRetakingPedagogy,
    accessToken,
  ]);

  useEffect(() => {
    if (profile?.demoVideoUrl && !demoVideoUrl) {
      setDemoVideoUrl(profile.demoVideoUrl);
    }
  }, [profile?.demoVideoUrl, demoVideoUrl]);

  // Step 5: Availability state
  const [availability, setAvailability] = useState({
    noticePeriod: 'Immediate',
    salaryRange: '',
    availableWorkingDays: [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
    ] as string[],
    availableFrom: 'Immediately',
    currentLocation: null as LocationData | null,
    preferredLocations: [] as PreferredLocationData[],
  });

  const loadDocuments = async () => {
    if (!accessToken) return;
    try {
      const res = await fetchApi<{ documents: TeacherDocument[] }>(
        '/teacher/documents',
        {},
        accessToken
      );
      setDocuments(res.documents || []);
    } catch {
      // Ignore initial load error
    }
  };

  const loadProfile = async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const result = await fetchApi<{ profile: TeacherProfile | null }>(
        '/teacher/onboarding',
        {},
        accessToken
      );
      const nextProfile = result.profile;
      setProfile(nextProfile);

      const nameParts = (user?.displayName || user?.username || '').trim().split(/\s+/);
      const userFirstName = nameParts[0] || '';
      const userLastName = nameParts.slice(1).join(' ') || '';

      if (!nextProfile) {
        setBasic((current) => ({
          ...current,
          firstName: current.firstName || userFirstName,
          lastName: current.lastName || userLastName,
        }));
      }

      if (nextProfile) {
        // Hydrate basic state
        setBasic({
          firstName: userFirstName,
          lastName: userLastName,
          dateOfBirth: nextProfile.dateOfBirth || '',
          gender: nextProfile.gender || '',
          contactInformation: (nextProfile.contactInformation || '')
            .replace(/\D/g, '')
            .slice(-10),
        });

        // Hydrate education list
        let parsedEducation: EducationEntry[] = [];
        if (Array.isArray(nextProfile.education)) {
          parsedEducation = nextProfile.education;
        } else if (typeof nextProfile.education === 'string' && nextProfile.education.trim()) {
          try {
            const val = JSON.parse(nextProfile.education);
            if (Array.isArray(val)) parsedEducation = val;
          } catch {
            parsedEducation = [
              {
                courseName: 'Degree',
                boardOrUniversity: nextProfile.education,
                passingYear: '',
                gradeSystem: 'Percentage',
                gradeValue: '',
              },
            ];
          }
        }

        // Hydrate experience years/months
        let expY = '0';
        let expM = '0';
        if (nextProfile.teachingExperience) {
          const yMatch = nextProfile.teachingExperience.match(/(\d+)\s*Year/i);
          const mMatch = nextProfile.teachingExperience.match(/(\d+)\s*Month/i);
          if (yMatch) expY = yMatch[1];
          if (mMatch) expM = mMatch[1];
        }

        // Hydrate previous schools list
        let parsedSchools: PreviousSchoolEntry[] = [];
        if (Array.isArray(nextProfile.previousSchools)) {
          parsedSchools = nextProfile.previousSchools.map((item: any) => {
            if (typeof item === 'string') {
              return {
                schoolName: item,
                startDate: '',
                endDate: '',
                subjectsTaught: '',
              };
            }
            return item;
          });
        }

        // Hydrate completion state
        setCompletion({
          aboutMe: nextProfile.aboutMe || '',
          educationList: parsedEducation,
          expYears: expY,
          expMonths: expM,
          previousSchoolsList: parsedSchools,
          subjectsList: parseArrayOrString(nextProfile.subjects),
          classesTaughtList: parseArrayOrString(nextProfile.classesTaught),
          boardExperience: parseArrayOrString(nextProfile.boardExperience),
          languagesList: parseArrayOrString(nextProfile.languages),
          skillsList: parseArrayOrString(nextProfile.skills),
          achievementsList: parseArrayOrString(nextProfile.achievements),
          awardsList: parseArrayOrString(nextProfile.awards),
        });

        // Hydrate demo class
        if (nextProfile.demoVideoUrl) {
          setDemoVideoUrl(nextProfile.demoVideoUrl);
        }

        // Hydrate availability
        setAvailability({
          noticePeriod: nextProfile.noticePeriod || 'Immediate',
          salaryRange: nextProfile.salaryRange || nextProfile.preferredSalary?.toString() || '',
          availableWorkingDays: Array.isArray(nextProfile.availableWorkingDays)
            ? nextProfile.availableWorkingDays
            : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          availableFrom: nextProfile.availableFrom || 'Immediately',
          currentLocation: nextProfile.currentLocation || (nextProfile.location ? {
            locationName: nextProfile.location,
            district: '',
            state: '',
            pincode: '',
            latitude: 0,
            longitude: 0,
            formattedAddress: nextProfile.location,
          } : null),
          preferredLocations: Array.isArray(nextProfile.preferredLocations)
            ? nextProfile.preferredLocations
            : (Array.isArray(nextProfile.preferredTeachingLocations)
              ? nextProfile.preferredTeachingLocations.map((loc: string) => ({
                  locationName: loc,
                  district: '',
                  state: '',
                  pincode: '',
                  latitude: 0,
                  longitude: 0,
                  radiusKm: 10,
                  formattedAddress: loc,
                }))
              : []),
        });

        // Automatic step resumption for incomplete onboarding or edit mode
        const editParam = searchParams.get('edit') as OnboardingStep | null;
        if (editParam && STEPS.some((s) => s.id === editParam)) {
          setStep(editParam);
        } else if (!nextProfile.onboardingCompleted) {
          if (!nextProfile.basicInformationCompleted) {
            setStep('basic');
          } else if (!nextProfile.profileCompletionCompleted) {
            setStep('completion');
          } else if (!nextProfile.documentsCompleted) {
            setStep('documents');
          } else {
            setStep('availability');
          }
        }

        // Sync auth store status, demo class, and skill assessment completion status only when changed
        const isDemoDone = Boolean(nextProfile.demoClassCompleted && nextProfile.demoVideoUrl);
        const isSkillDone = Boolean(nextProfile.skillAssessmentCompleted);
        const nextOnboardingCompleted = Boolean(nextProfile.onboardingCompleted);
        if (
          user &&
          (user.onboardingCompleted !== nextOnboardingCompleted ||
            user.demoClassCompleted !== isDemoDone ||
            user.skillAssessmentCompleted !== isSkillDone)
        ) {
          updateUser({
            onboardingCompleted: nextOnboardingCompleted,
            demoClassCompleted: isDemoDone,
            skillAssessmentCompleted: isSkillDone,
          });
        }
      }
      await loadDocuments();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load teacher onboarding'
      );
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
    if (user?.role && user.role !== 'TEACHER') {
      router.replace(routeForRole(user.role));
      return;
    }
    if (!profileLoadedRef.current && user?.role === 'TEACHER') {
      profileLoadedRef.current = true;
      void loadProfile();
    }
  }, [accessToken, isAuthenticated, isHydrated, router, user?.id, user?.role]);

  // Synchronize active onboarding step with URL edit/section parameters
  useEffect(() => {
    const editParam = searchParams.get('edit') as OnboardingStep | null;
    if (editParam && STEPS.some((s) => s.id === editParam)) {
      setStep(editParam);
    }
  }, [searchParams]);

  const updateBasic = (key: string, value: string) =>
    setBasic((current) => ({ ...current, [key]: value }));

  const updateAvailability = (key: string, value: any) =>
    setAvailability((current) => ({ ...current, [key]: value }));

  // Photo upload
  const handlePhotoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !accessToken || !user) return;
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
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
      setSuccess('Profile photo uploaded');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to upload profile photo'
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Document upload handler (dynamic types)
  const handleDocumentUpload = async (docType: string, file: File, documentName?: string) => {
    const isPdf = file.type === 'application/pdf';
    const isImage = file.type.startsWith('image/');
    const maxBytes = isPdf ? 5 * 1024 * 1024 : 2 * 1024 * 1024;
    if (!isPdf && !isImage) {
      setError('Only PDF or image files are allowed.');
      return;
    }
    if (file.size > maxBytes) {
      setError(
        isPdf
          ? 'PDF files must be 5 MB or smaller.'
          : 'Image files must be 2 MB or smaller.'
      );
      return;
    }
    if (!accessToken) return;
    setUploadingDoc(docType);
    setError(null);
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
      const res = await fetch(upload.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!res.ok) throw new Error('The file could not be uploaded to storage.');
      await fetchApi(
        '/teacher/documents/complete',
        {
          method: 'POST',
          body: JSON.stringify({ ...payload, storageKey: upload.storageKey }),
        },
        accessToken
      );
      await loadDocuments();
      setSuccess(`${file.name} uploaded successfully.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to upload document'
      );
    } finally {
      setUploadingDoc(null);
    }
  };

  // Delete a document
  const handleDeleteDocument = async (docId: string) => {
    if (!accessToken) return;
    try {
      await fetchApi(
        `/teacher/documents/${docId}`,
        { method: 'DELETE' },
        accessToken
      );
      await loadDocuments();
      setSuccess('Document removed.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to delete document'
      );
    }
  };

  // Step 1: Save Basic Info
  const saveBasic = async (event?: React.FormEvent, continueNext = true) => {
    if (event) event.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: Record<string, any> = {
        firstName: basic.firstName,
        lastName: basic.lastName,
        name: basic.firstName,
        surname: basic.lastName,
        gender: basic.gender,
        dateOfBirth: basic.dateOfBirth,
      };
      const result = await fetchApi<{ profile: TeacherProfile }>(
        '/teacher/onboarding/basic-information',
        {
          method: 'PUT',
          body: JSON.stringify(payload),
        },
        accessToken
      );
      setProfile(result.profile);

      const fullName = `${basic.firstName} ${basic.lastName}`.trim();
      if (fullName && user && user.displayName !== fullName) {
        updateUser({ displayName: fullName });
      }

      if (isEditingMode && (editing === 'basic' || section === 'basic')) {
        setSuccess('Basic Information updated successfully!');
        router.replace('/teacher?section=basic');
      } else if (continueNext) {
        setStep('completion');
        setSuccess('Basic Information saved. Continuing to Personal Details.');
      } else {
        setSuccess(
          'Progress saved! You can safely leave or log out, and your information will remain saved.'
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to save Basic Information'
      );
    } finally {
      setSaving(false);
    }
  };

  // Step 2: Save Profile Completion (Personal Details)
  const saveCompletion = async (
    event?: React.FormEvent,
    continueNext = true
  ) => {
    if (event) event.preventDefault();
    if (!accessToken) return;

    if (!completion.educationList.length) {
      setError('Please add at least one education entry.');
      return;
    }
    if (!completion.subjectsList.length) {
      setError('Please add at least one subject.');
      return;
    }
    if (!completion.classesTaughtList.length) {
      setError('Please add at least one class taught.');
      return;
    }
    if (!completion.languagesList.length) {
      setError('Please add at least one language.');
      return;
    }
    if (!completion.skillsList.length) {
      setError('Please add at least one skill.');
      return;
    }
    if (!completion.boardExperience.length) {
      setError('Please select at least one board experience option.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const formattedExp =
        completion.expYears === '0' && completion.expMonths === '0'
          ? 'Fresher (0 Years)'
          : `${completion.expYears} Years, ${completion.expMonths} Months`;

      const result = await fetchApi<{ profile: TeacherProfile }>(
        '/teacher/onboarding/profile-completion',
        {
          method: 'PUT',
          body: JSON.stringify({
            aboutMe: completion.aboutMe,
            education: completion.educationList,
            teachingExperience: formattedExp,
            previousSchools: completion.previousSchoolsList,
            subjects: completion.subjectsList,
            classesTaught: completion.classesTaughtList,
            languages: completion.languagesList,
            skills: completion.skillsList,
            achievements: completion.achievementsList,
            awards: completion.awardsList,
            boardExperience: completion.boardExperience,
          }),
        },
        accessToken
      );
      setProfile(result.profile);
      if (isEditingMode && (editing === 'completion' || section === 'completion')) {
        setSuccess('Personal Details & Qualifications updated successfully!');
        router.replace('/teacher?section=completion');
      } else if (continueNext) {
        setStep('documents');
        setSuccess('Personal Details saved. Continuing to Document Upload.');
      } else {
        setSuccess(
          'Progress saved! You can safely leave or log out and continue later.'
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to save Personal Details'
      );
    } finally {
      setSaving(false);
    }
  };

  // Step 3: Save Documents Step
  const saveDocumentsStep = async (continueNext = true) => {
    if (!accessToken) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await fetchApi<{ profile: TeacherProfile }>(
        '/teacher/onboarding/documents-step',
        { method: 'PUT' },
        accessToken
      );
      setProfile(result.profile);
      if (isEditingMode && (editing === 'documents' || section === 'documents')) {
        setSuccess('Documents updated successfully!');
        router.replace('/teacher?section=documents');
      } else if (continueNext) {
        setStep('availability');
        setSuccess('Documents saved. Continuing to Availability.');
      } else {
        setSuccess('Documents progress saved! You can resume at any time.');
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to save Document step'
      );
    } finally {
      setSaving(false);
    }
  };

  // Save Demo Class (Post-onboarding feature)
  const saveDemoStep = async (event?: React.FormEvent, continueNext = true) => {
    if (event) event.preventDefault();
    if (!accessToken) return;

    if (!demoVideoUrl || !demoVideoUrl.trim()) {
      setError('Please provide a valid YouTube video URL for the demo class.');
      return;
    }
    const embed = getYouTubeEmbedUrl(demoVideoUrl);
    if (!embed) {
      setError('Please enter a valid YouTube video URL (e.g., https://www.youtube.com/watch?v=...).');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await fetchApi<{ profile: TeacherProfile }>(
        '/teacher/onboarding/demo-class',
        {
          method: 'PUT',
          body: JSON.stringify({ demoVideoUrl: demoVideoUrl.trim() }),
        },
        accessToken
      );
      setProfile(result.profile);
      updateUser({ demoClassCompleted: true });

      setSuccess('Demo Class saved successfully!');
      router.replace('/teacher?section=demo');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to save Demo Class link'
      );
    } finally {
      setSaving(false);
    }
  };

  // Step 6: Save Availability & Complete Onboarding
  const saveAvailabilityStep = async (
    event?: React.FormEvent,
    finalize = false
  ) => {
    if (event) event.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await fetchApi<{ profile: TeacherProfile }>(
        '/teacher/onboarding/availability',
        {
          method: 'PUT',
          body: JSON.stringify({
            ...availability,
            finalize: profile?.onboardingCompleted ? true : finalize,
          }),
        },
        accessToken
      );
      setProfile(result.profile);

      if (isEditingMode) {
        setSuccess('Availability & location preferences updated successfully!');
        router.replace('/teacher?section=availability');
      } else if (finalize) {
        // Complete onboarding: dynamically reveals sidebar and transitions to dashboard
        if (user && !user.onboardingCompleted) {
          updateUser({ onboardingCompleted: true });
        }
        setSuccess(
          '🎉 Congratulations! Your teacher onboarding is 100% complete. Welcome to Schoolmini!'
        );
        router.replace('/teacher');
      } else {
        setSuccess(
          'Availability saved for later! You can resume and complete onboarding whenever you are ready.'
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to save Availability'
      );
    } finally {
      setSaving(false);
    }
  };

  const firstInitial = useMemo(
    () =>
      (user?.displayName || user?.username || 'T')
        .trim()
        .split(/\s+/)[0]
        .charAt(0)
        .toUpperCase(),
    [user]
  );

  if (!isHydrated || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        Loading teacher profile...
      </div>
    );
  }

  // Check view query param
  const viewParam = searchParams.get('view');

  // Once onboarding is completed, show "Onboarding Details" view
  if (profile?.onboardingCompleted && viewParam === 'onboarding-details' && !editing) {
    return (
      <TeacherOnboardingDetailsView
        user={user}
        profile={profile}
        documents={documents}
        onNavigate={(target) => router.push(target)}
        onBack={() => router.push('/teacher')}
      />
    );
  }

  // Once onboarding is completed, show section details or normal Dashboard
  if (profile?.onboardingCompleted && section && !editing) {
    return (
      <TeacherSectionView
        sectionKey={section}
        profile={profile}
        user={user}
        documents={documents}
        onEdit={(s) => {
          if (STEPS.some((stepItem) => stepItem.id === s)) {
            setStep(s as OnboardingStep);
          }
          router.push(`/teacher?section=${s}&edit=${s}`);
        }}
        onBack={() => router.push('/teacher')}
        success={success}
        error={error}
      />
    );
  }

  // Dedicated View for Skill Assessment (post-onboarding, beside Demo Class)
  if (section === 'skills' || editing === 'skills') {
    const isSkillDone = Boolean(profile?.skillAssessmentCompleted);

    return (
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-4">
          <button
            type="button"
            onClick={() => {
              setIsRetakingPedagogy(false);
              router.push('/teacher');
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
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

        {isSkillDone && !isRetakingPedagogy ? (
          loadingPedagogyResult ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] p-8 space-y-3">
              <LoaderCircle className="size-8 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Loading assessment results...</p>
            </div>
          ) : pedagogyResult ? (
            <AssessmentResult
              result={pedagogyResult}
              onBack={() => router.push('/teacher')}
              onRetake={() => {
                setPedagogyResult(null);
                setIsRetakingPedagogy(true);
              }}
            />
          ) : (
            <div className="bg-card border border-border rounded-xl p-8 text-center space-y-4 max-w-lg mx-auto">
              <div className="size-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                <CheckCircle2 className="size-6" />
              </div>
              <h3 className="font-heading font-bold text-lg">Assessment Completed</h3>
              <p className="text-xs text-muted-foreground">
                Your skill assessment has been recorded on your profile. You may take it again at any time.
              </p>
              <button
                type="button"
                onClick={() => setIsRetakingPedagogy(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
              >
                <RotateCcw className="size-3.5" />
                <span>Retake Assessment</span>
              </button>
            </div>
          )
        ) : (
          <AssessmentRunner
            onComplete={(res) => {
              setPedagogyResult(res);
              setIsRetakingPedagogy(false);
              if (profile) {
                setProfile({ ...profile, skillAssessmentCompleted: true });
              }
            }}
            onCancel={() => {
              setIsRetakingPedagogy(false);
              router.push('/teacher');
            }}
          />
        )}
      </main>
    );
  }

  // Dedicated Edit View for Demo Class (post-onboarding)
  if (editing === 'demo' || (section === 'demo' && editing)) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-4">
          <button
            type="button"
            onClick={() => router.push('/teacher?section=demo')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to Demo Class</span>
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

        <DemoStepForm
          demoVideoUrl={demoVideoUrl}
          setDemoVideoUrl={setDemoVideoUrl}
          saving={saving}
          onSubmit={(e: React.FormEvent) => saveDemoStep(e, true)}
          onBack={() => router.push('/teacher?section=demo')}
        />
      </main>
    );
  }

  // If onboarding is completed and not in edit mode, show the full Dashboard
  if (profile?.onboardingCompleted && !editing) {
    return (
      <TeacherDashboard
        user={user}
        profile={profile}
        onNavigate={(target) => router.push(target)}
        demoVideoUrl={demoVideoUrl}
        setDemoVideoUrl={setDemoVideoUrl}
        onSaveDemo={saveDemoStep}
        savingDemo={saving}
        demoSuccess={success}
        demoError={error}
      />
    );
  }

  // Current step metadata
  const currentStepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Top Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              {isEditingMode
                ? `Editing ${STEPS[currentStepIndex]?.label || 'Section'}`
                : `Step ${currentStepIndex + 1} of ${STEPS.length}`}
            </span>
            <span className="text-xs text-muted-foreground font-medium">
              {isEditingMode ? 'Teacher Profile' : 'Teacher Onboarding'}
            </span>
          </div>
          <h1 className="font-heading text-3xl font-bold mt-2">
            {isEditingMode
              ? `Edit ${STEPS[currentStepIndex]?.label || 'Profile'}`
              : 'Complete your teacher profile'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isEditingMode
              ? 'Update your information and save changes to update your profile.'
              : 'Fill in each section to set up your account. Your progress is saved so you can resume anytime.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isEditingMode && (
            <button
              type="button"
              onClick={() => router.push(`/teacher?section=${section || step}`)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 transition-colors cursor-pointer shrink-0"
            >
              <ArrowLeft className="size-3.5" />
              <span>Cancel & Return</span>
            </button>
          )}
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
              firstInitial
            )}
          </div>
        </div>
      </div>

      {/* 5-Step Navigation Indicator */}
      <div className="mb-7 overflow-x-auto pb-2">
        <div className="flex items-center gap-1.5 min-w-[700px]">
          {STEPS.map((s, idx) => {
            const isCurrent = step === s.id;
            const isCompleted =
              s.id === 'basic'
                ? profile?.basicInformationCompleted
                : s.id === 'completion'
                ? profile?.profileCompletionCompleted
                : s.id === 'documents'
                ? profile?.documentsCompleted
                : profile?.availabilityCompleted;

            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  // Allow clicking completed steps, current step, or any step in edit mode
                  if (isCompleted || idx <= currentStepIndex || isEditingMode) {
                    setStep(s.id);
                    if (isEditingMode) {
                      router.push(`/teacher?section=${s.id}&edit=${s.id}`);
                    }
                  }
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm ring-2 ring-primary/20'
                    : isCompleted
                    ? 'bg-secondary text-secondary-foreground border-border hover:bg-secondary/80'
                    : 'bg-muted/60 text-muted-foreground border-border/60 opacity-60'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
                ) : (
                  <span className="size-4 rounded-full border border-current flex items-center justify-center text-[10px]">
                    {s.number}
                  </span>
                )}
                <span className="truncate">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Global Alerts */}
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

      {/* Step Form Rendering */}
      {step === 'basic' && (
        <BasicForm
          data={basic}
          update={updateBasic}
          photo={user?.avatar || ''}
          email={user?.email || ''}
          uploadingPhoto={uploadingPhoto}
          onPhotoUpload={handlePhotoUpload}
          saving={saving}
          onSubmit={(e: React.FormEvent) => saveBasic(e, true)}
          onSaveProgress={() => saveBasic(undefined, false)}
          onCancel={
            profile?.onboardingCompleted
              ? () => router.push('/teacher?section=basic')
              : undefined
          }
        />
      )}

      {step === 'completion' && (
        <CompletionForm
          data={completion}
          setData={setCompletion}
          saving={saving}
          onSubmit={(e: React.FormEvent) => saveCompletion(e, true)}
          onSaveProgress={() => saveCompletion(undefined, false)}
          onBack={() => setStep('basic')}
        />
      )}

      {step === 'documents' && (
        <DocumentsStepForm
          documents={documents}
          educationList={completion.educationList}
          uploadingDoc={uploadingDoc}
          onUpload={handleDocumentUpload}
          onDelete={handleDeleteDocument}
          saving={saving}
          onSubmit={() => saveDocumentsStep(true)}
          onSaveProgress={() => saveDocumentsStep(false)}
          onBack={() => setStep('completion')}
        />
      )}

      {step === 'availability' && (
        <AvailabilityStepForm
          data={availability}
          update={updateAvailability}
          saving={saving}
          onSubmit={(e: React.FormEvent) => saveAvailabilityStep(e, true)}
          onSaveProgress={() => saveAvailabilityStep(undefined, false)}
          onBack={() => {
            if (editing || profile?.onboardingCompleted) {
              router.push('/teacher?section=availability');
            } else {
              setStep('documents');
            }
          }}
          onCancel={() => router.push(`/teacher?section=${section || 'availability'}`)}
          isEditing={Boolean(editing) || Boolean(profile?.onboardingCompleted)}
          accessToken={accessToken}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------------------
// Step 1: Basic Information Form
// -------------------------------------------------------------------------
function BasicForm({
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

  useEffect(() => {
    setPhotoError(false);
  }, [photo]);

  const inputClass =
    'mt-1.5 w-full rounded-md border border-border bg-input px-3 py-2.5 font-normal';

  return (
    <form
      onSubmit={onSubmit}
      className="bg-card border border-border rounded-xl p-6 shadow-lg"
    >
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-heading text-xl font-bold flex items-center gap-2">
          <UserRound className="size-5 text-primary" />
          Basic Information
        </h2>
        <span className="text-xs text-muted-foreground">
          {onCancel ? 'Edit Section' : 'Step 1 of 4'}
        </span>
      </div>

      <div className="mb-5 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold overflow-hidden shadow-sm">
          {photo && !photoError ? (
            <img
              src={photo}
              alt="Profile"
              referrerPolicy="no-referrer"
              onError={() => setPhotoError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            data.firstName?.[0]?.toUpperCase() || 'T'
          )}
        </div>
        <label className="inline-flex items-center gap-2 py-2 px-3 rounded-md border border-border bg-secondary cursor-pointer text-sm font-semibold hover:bg-secondary/80 transition-colors">
          <ImagePlus className="w-4 h-4" />
          {uploadingPhoto ? 'Uploading...' : 'Upload profile photo'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onPhotoUpload}
            disabled={uploadingPhoto}
            className="sr-only"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          Name
          <input
            required
            type="text"
            placeholder="First name"
            value={data.firstName || ''}
            onChange={(event) => update('firstName', event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="text-sm font-semibold">
          Surname
          <input
            required
            type="text"
            placeholder="Surname / Last name"
            value={data.lastName || ''}
            onChange={(event) => update('lastName', event.target.value)}
            className={inputClass}
          />
        </label>

        <label className="text-sm font-semibold sm:col-span-2">
          <div className="flex items-center justify-between">
            <span>Email address</span>
            <span className="text-xs text-muted-foreground font-normal">
              Auto-fetched from account
            </span>
          </div>
          <input
            value={email}
            readOnly
            className="mt-1.5 w-full rounded-md border border-border bg-muted px-3 py-2.5 font-normal text-muted-foreground cursor-not-allowed"
          />
        </label>

        <div className="sm:col-span-2">
          <label className="text-sm font-semibold block mb-1">Gender</label>
          <Select
            value={data.gender || ''}
            onValueChange={(val) => update('gender', val || '')}
          >
            <SelectTrigger className={`w-full h-10 ${inputClass}`}>
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MALE">Male</SelectItem>
              <SelectItem value="FEMALE">Female</SelectItem>
              <SelectItem value="OTHER">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-7 flex flex-wrap gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-md border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted transition-colors cursor-pointer"
          >
            Cancel
          </button>
        )}
        {onSaveProgress && !onCancel && (
          <button
            type="button"
            onClick={onSaveProgress}
            disabled={saving}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-md border border-border bg-secondary px-4 py-2.5 text-sm font-semibold hover:bg-secondary/80 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Save className="size-4" />
            <span>Save for later</span>
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm cursor-pointer"
        >
          <span>{saving ? 'Saving...' : onCancel ? 'Save Changes' : 'Save & continue'}</span>
          {!onCancel && <ArrowRight className="size-4" />}
        </button>
      </div>
    </form>
  );
}

// -------------------------------------------------------------------------
// Step 2: Personal Details & Qualifications Form
// -------------------------------------------------------------------------
function CompletionForm({
  data,
  setData,
  saving,
  onSubmit,
  onSaveProgress,
  onBack,
}: {
  data: {
    aboutMe: string;
    educationList: EducationEntry[];
    expYears: string;
    expMonths: string;
    previousSchoolsList: PreviousSchoolEntry[];
    subjectsList: string[];
    classesTaughtList: string[];
    boardExperience: string[];
    languagesList: string[];
    skillsList: string[];
    achievementsList: string[];
    awardsList: string[];
  };
  setData: React.Dispatch<React.SetStateAction<any>>;
  saving: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onSaveProgress: () => void;
  onBack: () => void;
}) {
  const inputClass =
    'mt-1.5 w-full rounded-md border border-border bg-input px-3 py-2 font-normal text-sm';

  // Education temporary state
  const [eduCourse, setEduCourse] = useState('');
  const [eduBoard, setEduBoard] = useState('');
  const [eduYear, setEduYear] = useState('');
  const [eduGradeSys, setEduGradeSys] = useState<'Percentage' | 'CGPA'>('Percentage');
  const [eduGradeVal, setEduGradeVal] = useState('');

  // Previous school temporary state
  const [schName, setSchName] = useState('');
  const [schStart, setSchStart] = useState('');
  const [schEnd, setSchEnd] = useState('');
  const [schSubjects, setSchSubjects] = useState('');

  // Tag inputs state
  const [subjectInput, setSubjectInput] = useState('');
  const [classInput, setClassInput] = useState('');
  const [langInput, setLangInput] = useState('');
  const [skillInput, setSkillInput] = useState('');
  const [achieveInput, setAchieveInput] = useState('');
  const [awardInput, setAwardInput] = useState('');

  // Education Handlers
  const addEducation = () => {
    if (!eduCourse.trim() || !eduBoard.trim() || !eduYear.trim()) return;
    setData((prev: any) => ({
      ...prev,
      educationList: [
        ...prev.educationList,
        {
          courseName: eduCourse.trim(),
          boardOrUniversity: eduBoard.trim(),
          passingYear: eduYear.trim(),
          gradeSystem: eduGradeSys,
          gradeValue: eduGradeVal.trim(),
        },
      ],
    }));
    setEduCourse('');
    setEduBoard('');
    setEduYear('');
    setEduGradeVal('');
  };

  const removeEducation = (index: number) => {
    setData((prev: any) => ({
      ...prev,
      educationList: prev.educationList.filter((_: any, i: number) => i !== index),
    }));
  };

  // Previous School Handlers
  const addPreviousSchool = () => {
    if (!schName.trim()) return;
    const dur = calculateDuration(schStart, schEnd);
    setData((prev: any) => ({
      ...prev,
      previousSchoolsList: [
        ...prev.previousSchoolsList,
        {
          schoolName: schName.trim(),
          startDate: schStart,
          endDate: schEnd || 'Present',
          duration: dur,
          subjectsTaught: schSubjects.trim(),
        },
      ],
    }));
    setSchName('');
    setSchStart('');
    setSchEnd('');
    setSchSubjects('');
  };

  const removePreviousSchool = (index: number) => {
    setData((prev: any) => ({
      ...prev,
      previousSchoolsList: prev.previousSchoolsList.filter(
        (_: any, i: number) => i !== index
      ),
    }));
  };

  // Generic tag helpers
  const addTag = (
    key:
      | 'subjectsList'
      | 'classesTaughtList'
      | 'languagesList'
      | 'skillsList'
      | 'achievementsList'
      | 'awardsList',
    val: string,
    clearInput: () => void
  ) => {
    const trimmed = val.trim();
    if (!trimmed || data[key].includes(trimmed)) {
      clearInput();
      return;
    }
    setData((prev: any) => ({ ...prev, [key]: [...prev[key], trimmed] }));
    clearInput();
  };

  const removeTag = (
    key:
      | 'subjectsList'
      | 'classesTaughtList'
      | 'languagesList'
      | 'skillsList'
      | 'achievementsList'
      | 'awardsList',
    item: string
  ) => {
    setData((prev: any) => ({
      ...prev,
      [key]: prev[key].filter((t: string) => t !== item),
    }));
  };

  const toggleBoard = (board: string) => {
    setData((prev: any) => ({
      ...prev,
      boardExperience: prev.boardExperience.includes(board)
        ? prev.boardExperience.filter((b: string) => b !== board)
        : [...prev.boardExperience, board],
    }));
  };

  return (
    <form
      onSubmit={onSubmit}
      className="bg-card border border-border rounded-xl p-6 md:p-8 shadow-lg space-y-8"
    >
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h2 className="font-heading text-xl font-bold flex items-center gap-2">
            <GraduationCap className="size-5 text-primary" />
            Personal Details & Qualifications
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Fill in your educational background, teaching experience, and subjects.
          </p>
        </div>
        <span className="text-xs text-muted-foreground">Step 2 of 4</span>
      </div>

      {/* 1. About Me */}
      <section className="space-y-2">
        <label className="text-sm font-semibold block">
          About Me <span className="text-destructive">*</span>
        </label>
        <textarea
          required
          placeholder="Briefly introduce yourself, your teaching philosophy, and passion for education..."
          value={data.aboutMe}
          onChange={(e) =>
            setData((prev: any) => ({ ...prev, aboutMe: e.target.value }))
          }
          className="min-h-24 w-full rounded-md border border-border bg-input px-3 py-2.5 text-sm font-normal focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </section>

      {/* 2. Education Qualifications (Interactive List) */}
      <section className="space-y-4 rounded-xl border border-border bg-card/50 p-4 md:p-5">
        <div>
          <h3 className="font-heading text-base font-bold flex items-center gap-2">
            <BookOpen className="size-4 text-primary" />
            Education Qualifications <span className="text-destructive">*</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Add 10th, 12th, Bachelor&apos;s, Master&apos;s, B.Ed, D.El.Ed, or any other degrees.
          </p>
        </div>

        {/* Quick Suggestion Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-medium">Quick select:</span>
          {["10th", "12th", "Bachelor's", "Master's", "B.Ed", "D.El.Ed"].map(
            (sug) => (
              <button
                key={sug}
                type="button"
                onClick={() => setEduCourse(sug)}
                className="px-2 py-0.5 rounded border border-border bg-secondary hover:bg-secondary/80 text-[11px] font-medium transition-colors cursor-pointer"
              >
                + {sug}
              </button>
            )
          )}
        </div>

        {/* Add Education Input Row */}
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-5 p-3 rounded-lg bg-background border border-border">
          <div className="md:col-span-1">
            <label className="text-xs font-semibold">Course / Degree</label>
            <input
              placeholder="e.g. 10th, B.Ed, B.Sc"
              value={eduCourse}
              onChange={(e) => setEduCourse(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="md:col-span-1">
            <label className="text-xs font-semibold">Board / University</label>
            <input
              placeholder="e.g. CBSE, Delhi Univ"
              value={eduBoard}
              onChange={(e) => setEduBoard(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="md:col-span-1">
            <label className="text-xs font-semibold">Passing Year</label>
            <input
              type="number"
              placeholder="e.g. 2020"
              value={eduYear}
              onChange={(e) => setEduYear(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="md:col-span-1">
            <label className="text-xs font-semibold block mb-1">Grade System</label>
            <Select
              value={eduGradeSys}
              onValueChange={(val) =>
                val && setEduGradeSys(val as 'Percentage' | 'CGPA')
              }
            >
              <SelectTrigger className={`w-full h-10 ${inputClass}`}>
                <SelectValue placeholder="Grade System" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Percentage">Percentage (%)</SelectItem>
                <SelectItem value="CGPA">CGPA</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-1 flex flex-col justify-between">
            <label className="text-xs font-semibold">
              {eduGradeSys === 'Percentage' ? 'Score (%)' : 'Score (CGPA)'}
            </label>
            <div className="flex gap-2">
              <input
                placeholder={eduGradeSys === 'Percentage' ? '85%' : '8.8'}
                value={eduGradeVal}
                onChange={(e) => setEduGradeVal(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-border bg-input px-3 py-2 font-normal text-sm"
              />
              <button
                type="button"
                onClick={addEducation}
                disabled={!eduCourse.trim() || !eduBoard.trim() || !eduYear.trim()}
                className="mt-1.5 inline-flex items-center justify-center px-3 py-2 rounded-md bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 disabled:opacity-40 transition-colors cursor-pointer shrink-0"
              >
                <Plus className="size-4" />
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Rendered Education List */}
        {data.educationList.length > 0 ? (
          <div className="space-y-2 mt-3">
            {data.educationList.map((edu, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-background shadow-xs text-xs"
              >
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">
                      Degree
                    </span>
                    <span className="font-bold text-sm text-foreground">
                      {edu.courseName}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">
                      Board / University
                    </span>
                    <span className="font-medium text-foreground">
                      {edu.boardOrUniversity}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">
                      Passing Year
                    </span>
                    <span className="font-medium text-foreground">
                      {edu.passingYear}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">
                      Grade
                    </span>
                    <span className="font-medium text-foreground">
                      {edu.gradeValue
                        ? `${edu.gradeValue} (${edu.gradeSystem})`
                        : 'Passed'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeEducation(idx)}
                  className="text-muted-foreground hover:text-destructive p-1 transition-colors cursor-pointer"
                  title="Remove education"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground text-center py-3 border border-dashed border-border rounded-lg">
            No education entries added yet. Use the form above to add your degrees.
          </div>
        )}
      </section>

      {/* 3. Teaching Experience (Years & Months Dropdown) */}
      <section className="space-y-3">
        <div>
          <h3 className="font-heading text-sm font-semibold flex items-center gap-1.5">
            <Clock className="size-4 text-primary" />
            Total Teaching Experience
          </h3>
          <p className="text-xs text-muted-foreground">
            Select your cumulative teaching experience in years and months.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 max-w-md">
          <div>
            <label className="text-xs font-semibold block mb-1">Years</label>
            <Select
              value={String(data.expYears ?? 0)}
              onValueChange={(val) =>
                setData((prev: any) => ({ ...prev, expYears: val !== null ? Number(val) : 0 }))
              }
            >
              <SelectTrigger className={`w-full h-10 ${inputClass}`}>
                <SelectValue placeholder="Years" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 21 }, (_, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {i} {i === 1 ? 'Year' : 'Years'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1">Months</label>
            <Select
              value={String(data.expMonths ?? 0)}
              onValueChange={(val) =>
                setData((prev: any) => ({ ...prev, expMonths: val !== null ? Number(val) : 0 }))
              }
            >
              <SelectTrigger className={`w-full h-10 ${inputClass}`}>
                <SelectValue placeholder="Months" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {i} {i === 1 ? 'Month' : 'Months'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* 4. Previous Schools (Interactive List) */}
      <section className="space-y-4 rounded-xl border border-border bg-card/50 p-4 md:p-5">
        <div>
          <h3 className="font-heading text-base font-bold flex items-center gap-2">
            <Building2 className="size-4 text-primary" />
            Previous School Experience
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Add schools where you previously taught, along with duration and subjects.
          </p>
        </div>

        {/* Add School Input Row */}
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 p-3 rounded-lg bg-background border border-border">
          <div>
            <label className="text-xs font-semibold">School Name</label>
            <input
              placeholder="e.g. DPS International"
              value={schName}
              onChange={(e) => setSchName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-xs font-semibold">Started (Month / Year)</label>
            <input
              type="month"
              value={schStart}
              onChange={(e) => setSchStart(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-xs font-semibold">Ended (Month / Year)</label>
            <input
              type="month"
              value={schEnd}
              onChange={(e) => setSchEnd(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col justify-between">
            <label className="text-xs font-semibold">Subjects Taught</label>
            <div className="flex gap-2">
              <input
                placeholder="e.g. Math, Physics"
                value={schSubjects}
                onChange={(e) => setSchSubjects(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-border bg-input px-3 py-2 font-normal text-sm"
              />
              <button
                type="button"
                onClick={addPreviousSchool}
                disabled={!schName.trim()}
                className="mt-1.5 inline-flex items-center justify-center px-3 py-2 rounded-md bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 disabled:opacity-40 transition-colors cursor-pointer shrink-0"
              >
                <Plus className="size-4" />
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Rendered School List */}
        {data.previousSchoolsList.length > 0 ? (
          <div className="space-y-2 mt-3">
            {data.previousSchoolsList.map((sch, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-background shadow-xs text-xs"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">
                      School
                    </span>
                    <span className="font-bold text-sm text-foreground">
                      {sch.schoolName}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">
                      Duration
                    </span>
                    <span className="font-medium text-foreground">
                      {sch.startDate || 'N/A'} — {sch.endDate || 'Present'}{' '}
                      {sch.duration ? `(${sch.duration})` : ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">
                      Subjects Taught
                    </span>
                    <span className="font-medium text-foreground">
                      {sch.subjectsTaught || 'General'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removePreviousSchool(idx)}
                  className="text-muted-foreground hover:text-destructive p-1 transition-colors cursor-pointer"
                  title="Remove school"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground text-center py-3 border border-dashed border-border rounded-lg">
            No previous schools added yet (freshers can proceed without adding).
          </div>
        )}
      </section>

      {/* 5. Subjects & Classes Taught (Interactive Type & Add Tag Lists) */}
      <div className="grid gap-6 sm:grid-cols-2">
        {/* Subjects */}
        <section className="space-y-2">
          <label className="text-sm font-semibold block">
            Subjects Taught <span className="text-destructive">*</span>
          </label>
          <div className="flex gap-2">
            <input
              placeholder="Type subject (e.g. Mathematics) and press Add"
              value={subjectInput}
              onChange={(e) => setSubjectInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag('subjectsList', subjectInput, () => setSubjectInput(''));
                }
              }}
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() =>
                addTag('subjectsList', subjectInput, () => setSubjectInput(''))
              }
              className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-3 py-2 text-xs font-semibold hover:bg-secondary/80 transition-colors cursor-pointer"
            >
              <Plus className="size-3.5" />
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 min-h-8 pt-1">
            {data.subjectsList.map((sub) => (
              <span
                key={sub}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs text-primary font-medium"
              >
                {sub}
                <button
                  type="button"
                  onClick={() => removeTag('subjectsList', sub)}
                  className="hover:opacity-75 cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        </section>

        {/* Classes Taught */}
        <section className="space-y-2">
          <label className="text-sm font-semibold block">
            Classes Taught <span className="text-destructive">*</span>
          </label>
          <div className="flex gap-2">
            <input
              placeholder="Type class (e.g. 10th, BSc, LKG) and press Add"
              value={classInput}
              onChange={(e) => setClassInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag('classesTaughtList', classInput, () =>
                    setClassInput('')
                  );
                }
              }}
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() =>
                addTag('classesTaughtList', classInput, () => setClassInput(''))
              }
              className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-3 py-2 text-xs font-semibold hover:bg-secondary/80 transition-colors cursor-pointer"
            >
              <Plus className="size-3.5" />
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 min-h-8 pt-1">
            {data.classesTaughtList.map((cls) => (
              <span
                key={cls}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs text-primary font-medium"
              >
                {cls}
                <button
                  type="button"
                  onClick={() => removeTag('classesTaughtList', cls)}
                  className="hover:opacity-75 cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        </section>
      </div>

      {/* 6. Languages & Skills (Interactive Type & Add Tag Lists) */}
      <div className="grid gap-6 sm:grid-cols-2">
        {/* Languages */}
        <section className="space-y-2">
          <label className="text-sm font-semibold block">
            Languages <span className="text-destructive">*</span>
          </label>
          <div className="flex gap-2">
            <input
              placeholder="Type language (e.g. Hindi, English) and press Add"
              value={langInput}
              onChange={(e) => setLangInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag('languagesList', langInput, () => setLangInput(''));
                }
              }}
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() =>
                addTag('languagesList', langInput, () => setLangInput(''))
              }
              className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-3 py-2 text-xs font-semibold hover:bg-secondary/80 transition-colors cursor-pointer"
            >
              <Plus className="size-3.5" />
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 min-h-8 pt-1">
            {data.languagesList.map((lang) => (
              <span
                key={lang}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs text-primary font-medium"
              >
                {lang}
                <button
                  type="button"
                  onClick={() => removeTag('languagesList', lang)}
                  className="hover:opacity-75 cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        </section>

        {/* Skills */}
        <section className="space-y-2">
          <label className="text-sm font-semibold block">
            Skills <span className="text-destructive">*</span>
          </label>
          <div className="flex gap-2">
            <input
              placeholder="Type skill (e.g. Classroom Management) and press Add"
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag('skillsList', skillInput, () => setSkillInput(''));
                }
              }}
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() =>
                addTag('skillsList', skillInput, () => setSkillInput(''))
              }
              className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-3 py-2 text-xs font-semibold hover:bg-secondary/80 transition-colors cursor-pointer"
            >
              <Plus className="size-3.5" />
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 min-h-8 pt-1">
            {data.skillsList.map((sk) => (
              <span
                key={sk}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs text-primary font-medium"
              >
                {sk}
                <button
                  type="button"
                  onClick={() => removeTag('skillsList', sk)}
                  className="hover:opacity-75 cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        </section>
      </div>

      {/* 7. Achievements & Awards (Type and Add) */}
      <div className="grid gap-6 sm:grid-cols-2">
        {/* Achievements */}
        <section className="space-y-2">
          <label className="text-sm font-semibold block">Achievements</label>
          <div className="flex gap-2">
            <input
              placeholder="Type achievement and press Add"
              value={achieveInput}
              onChange={(e) => setAchieveInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag('achievementsList', achieveInput, () =>
                    setAchieveInput('')
                  );
                }
              }}
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() =>
                addTag('achievementsList', achieveInput, () =>
                  setAchieveInput('')
                )
              }
              className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-3 py-2 text-xs font-semibold hover:bg-secondary/80 transition-colors cursor-pointer"
            >
              <Plus className="size-3.5" />
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 min-h-8 pt-1">
            {data.achievementsList.map((ach) => (
              <span
                key={ach}
                className="inline-flex items-center gap-1 rounded-full bg-secondary border border-border px-2.5 py-0.5 text-xs text-foreground font-medium"
              >
                {ach}
                <button
                  type="button"
                  onClick={() => removeTag('achievementsList', ach)}
                  className="hover:opacity-75 cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        </section>

        {/* Awards */}
        <section className="space-y-2">
          <label className="text-sm font-semibold block">Awards & Honors</label>
          <div className="flex gap-2">
            <input
              placeholder="Type award name and press Add"
              value={awardInput}
              onChange={(e) => setAwardInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag('awardsList', awardInput, () => setAwardInput(''));
                }
              }}
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() =>
                addTag('awardsList', awardInput, () => setAwardInput(''))
              }
              className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-3 py-2 text-xs font-semibold hover:bg-secondary/80 transition-colors cursor-pointer"
            >
              <Plus className="size-3.5" />
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 min-h-8 pt-1">
            {data.awardsList.map((aw) => (
              <span
                key={aw}
                className="inline-flex items-center gap-1 rounded-full bg-secondary border border-border px-2.5 py-0.5 text-xs text-foreground font-medium"
              >
                {aw}
                <button
                  type="button"
                  onClick={() => removeTag('awardsList', aw)}
                  className="hover:opacity-75 cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        </section>
      </div>

      {/* 8. Board Experience (Checkboxes) */}
      <section className="space-y-2">
        <label className="text-sm font-semibold block">
          Board Experience <span className="text-destructive">*</span>
        </label>
        <div className="flex flex-wrap gap-3">
          {boardOptions.map((board) => (
            <label
              key={board}
              className="flex items-center gap-2 text-sm font-normal cursor-pointer bg-secondary/50 border border-border px-3 py-2 rounded-lg hover:bg-secondary transition-colors"
            >
              <input
                type="checkbox"
                checked={data.boardExperience.includes(board)}
                onChange={() => toggleBoard(board)}
              />
              {board.replace('_', ' ')}
            </label>
          ))}
        </div>
      </section>

      {/* Action Buttons */}
      <div className="mt-8 flex flex-wrap gap-3 border-t border-border pt-5">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted transition-colors cursor-pointer"
        >
          <ArrowLeft className="size-4" />
          <span>Back</span>
        </button>
        {onSaveProgress && (
          <button
            type="button"
            onClick={onSaveProgress}
            disabled={saving}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-md border border-border bg-secondary px-4 py-2.5 text-sm font-semibold hover:bg-secondary/80 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Save className="size-4" />
            <span>Save for later</span>
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm cursor-pointer"
        >
          <span>{saving ? 'Saving...' : 'Save & continue'}</span>
          <ArrowRight className="size-4" />
        </button>
      </div>
    </form>
  );
}

// -------------------------------------------------------------------------
// Step 3: Document Upload & Verification Form (Dynamic)
// -------------------------------------------------------------------------
function DocumentsStepForm({
  documents,
  educationList,
  uploadingDoc,
  onUpload,
  onDelete,
  saving,
  onSubmit,
  onSaveProgress,
  onBack,
}: {
  documents: TeacherDocument[];
  educationList: EducationEntry[];
  uploadingDoc: string | null;
  onUpload: (docType: string, file: File, documentName?: string) => Promise<void>;
  onDelete: (docId: string) => Promise<void>;
  saving: boolean;
  onSubmit: () => Promise<void>;
  onSaveProgress: () => Promise<void>;
  onBack: () => void;
}) {
  const [customDocTitle, setCustomDocTitle] = useState('');
  const [customSlots, setCustomSlots] = useState<DocumentSlot[]>([]);

  // Build dynamic document slots
  const allSlots = useMemo<DocumentSlot[]>(() => {
    // 1) Base mandatory documents
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

    // 2) Dynamic education-based document slots
    const eduSlots: DocumentSlot[] = (educationList || []).map((edu, idx) => {
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
  }, [educationList, customSlots]);

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

  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-heading text-xl font-bold flex items-center gap-2">
          <FileText className="size-5 text-primary" />
          Document Upload & Verification
        </h2>
        <span className="text-xs text-muted-foreground">Step 3 of 4</span>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Upload your identity and educational documents for verification. Supported
        formats: PDF (up to 5 MB) or JPG/PNG (up to 2 MB).
      </p>

      {/* Mandatory Documents Section */}
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
        Mandatory Documents
      </h3>
      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        {allSlots.filter((s) => s.isRequired).map((slot) => {
          const doc = documents.find((d) => d.documentType === slot.documentType);
          const isUploading = uploadingDoc === slot.documentType;

          return (
            <div
              key={slot.documentType}
              className="rounded-lg border border-border bg-background p-4 flex flex-col justify-between hover:border-primary/40 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-semibold text-sm">{slot.label}</span>
                    {slot.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{slot.description}</p>
                    )}
                  </div>
                  {doc ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-xs font-semibold text-emerald-600 shrink-0">
                      <CheckCircle2 className="size-3" />
                      Uploaded
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground shrink-0">
                      Pending
                    </span>
                  )}
                </div>
                {doc && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    <p className="truncate font-medium text-foreground">
                      {doc.fileName}
                    </p>
                    <p>{(doc.sizeBytes / (1024 * 1024)).toFixed(2)} MB</p>
                    <div className="flex items-center gap-3 mt-1">
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
                        onClick={() => void onDelete(doc.id)}
                        className="inline-flex items-center gap-1 text-xs text-destructive hover:underline cursor-pointer"
                      >
                        <Trash2 className="size-3" />
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4">
                <label className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-md border border-border bg-secondary hover:bg-secondary/80 text-xs font-semibold cursor-pointer transition-colors">
                  {isUploading ? (
                    <>
                      <LoaderCircle className="size-3.5 animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="size-3.5" />
                      <span>{doc ? 'Replace file' : 'Upload file'}</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    disabled={isUploading}
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) void onUpload(slot.documentType, file, slot.documentName);
                    }}
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>

      {/* Optional / Custom Documents Section */}
      {allSlots.some((s) => !s.isRequired) && (
        <>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Additional Documents
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 mb-6">
            {allSlots.filter((s) => !s.isRequired).map((slot) => {
              const doc = documents.find((d) => d.documentType === slot.documentType);
              const isUploading = uploadingDoc === slot.documentType;
              const isCustom = slot.documentType.startsWith('CUSTOM_');

              return (
                <div
                  key={slot.documentType}
                  className="rounded-lg border border-border bg-background p-4 flex flex-col justify-between hover:border-primary/40 transition-colors"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-semibold text-sm">{slot.label}</span>
                        {slot.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{slot.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {doc ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                            <CheckCircle2 className="size-3" />
                            Uploaded
                          </span>
                        ) : (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            Optional
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
                      <div className="mt-2 text-xs text-muted-foreground">
                        <p className="truncate font-medium text-foreground">
                          {doc.fileName}
                        </p>
                        <p>{(doc.sizeBytes / (1024 * 1024)).toFixed(2)} MB</p>
                        <div className="flex items-center gap-3 mt-1">
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
                            onClick={() => void onDelete(doc.id)}
                            className="inline-flex items-center gap-1 text-xs text-destructive hover:underline cursor-pointer"
                          >
                            <Trash2 className="size-3" />
                            Remove
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4">
                    <label className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-md border border-border bg-secondary hover:bg-secondary/80 text-xs font-semibold cursor-pointer transition-colors">
                      {isUploading ? (
                        <>
                          <LoaderCircle className="size-3.5 animate-spin" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <UploadCloud className="size-3.5" />
                          <span>{doc ? 'Replace file' : 'Upload file'}</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="application/pdf,image/jpeg,image/png,image/webp"
                        disabled={isUploading}
                        className="sr-only"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (file) void onUpload(slot.documentType, file, slot.documentName);
                        }}
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Add custom document */}
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 mb-6">
        <p className="text-xs font-semibold text-muted-foreground mb-2">Add Other Document</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={customDocTitle}
            onChange={(e) => setCustomDocTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomSlot(); } }}
            placeholder="e.g. CTET Certificate, Experience Letter..."
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            type="button"
            onClick={addCustomSlot}
            disabled={!customDocTitle.trim()}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Plus className="size-4" />
            Add
          </button>
        </div>
      </div>

      <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 mb-6 text-xs text-muted-foreground flex items-center gap-3">
        <ShieldCheck className="size-5 text-primary shrink-0" />
        <p>
          All uploaded documents are stored in secure cloud storage and encrypted
          end-to-end for confidentiality and partner school verification.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted transition-colors cursor-pointer"
        >
          <ArrowLeft className="size-4" />
          <span>Back</span>
        </button>
        <button
          type="button"
          onClick={onSaveProgress}
          disabled={saving}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-md border border-border bg-secondary px-4 py-2.5 text-sm font-semibold hover:bg-secondary/80 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <Save className="size-4" />
          <span>Save for later</span>
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={saving}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm cursor-pointer"
        >
          <span>{saving ? 'Saving...' : 'Save & continue'}</span>
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}


// -------------------------------------------------------------------------
// Step 5: Demo Class Form (YouTube link input)
// -------------------------------------------------------------------------
function DemoStepForm({
  demoVideoUrl,
  setDemoVideoUrl,
  saving,
  onSubmit,
  onSaveProgress,
  onBack,
}: {
  demoVideoUrl: string;
  setDemoVideoUrl: (v: string) => void;
  saving: boolean;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  onSaveProgress?: () => Promise<void>;
  onBack: () => void;
}) {
  const embedUrl = useMemo(
    () => getYouTubeEmbedUrl(demoVideoUrl),
    [demoVideoUrl]
  );

  return (
    <form
      onSubmit={onSubmit}
      className="bg-card border border-border rounded-xl p-6 shadow-lg"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-heading text-xl font-bold flex items-center gap-2">
          <Video className="size-5 text-primary" />
          Demo Class
        </h2>
        <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-primary/10 text-primary border border-primary/20">
          Post-Onboarding
        </span>
      </div>

      <p className="text-sm text-muted-foreground mb-5">
        Provide a link to a sample teaching demonstration (e.g. on YouTube). This
        enables school principals to observe your classroom presentation style.
      </p>

      <div className="space-y-4 mb-6">
        <label className="block text-sm font-semibold">
          YouTube video link (Compulsory)
          <div className="mt-1.5 flex items-center rounded-md border border-border bg-input">
            <span className="px-3 py-2.5 text-muted-foreground">
              <Play className="size-4 text-red-500" />
            </span>
            <input
              required
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={demoVideoUrl}
              onChange={(e) => setDemoVideoUrl(e.target.value)}
              className="w-full bg-transparent px-3 py-2.5 font-normal focus:outline-none"
            />
          </div>
          <span className="mt-1 block text-xs text-muted-foreground font-normal">
            You can paste an unlisted or public YouTube video URL (5–10 minutes
            recommended).
          </span>
        </label>

        {/* Video Preview */}
        {embedUrl ? (
          <div className="rounded-lg overflow-hidden border border-border aspect-video max-w-lg mx-auto bg-black shadow-md">
            <iframe
              src={embedUrl}
              title="YouTube Demo Class Preview"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="w-full h-full"
            />
          </div>
        ) : demoVideoUrl ? (
          <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            Please enter a valid YouTube video URL to preview your demo lesson.
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted transition-colors cursor-pointer"
        >
          <ArrowLeft className="size-4" />
          <span>Back</span>
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm cursor-pointer"
        >
          <Save className="size-4" />
          <span>{saving ? 'Saving...' : 'Save Demo Class'}</span>
        </button>
      </div>
    </form>
  );
}

const clientSearchCache = new Map<string, LocationData[]>();

// -------------------------------------------------------------------------
// -------------------------------------------------------------------------
// Step 6: Availability Form (Current Location, Preferred Locations & Radius, Notice period, salary, working days)
// -------------------------------------------------------------------------
function AvailabilityStepForm({
  data,
  update,
  saving,
  onSubmit,
  onSaveProgress,
  onBack,
  onCancel,
  isEditing,
  accessToken,
}: {
  data: {
    noticePeriod: string;
    salaryRange: string;
    availableWorkingDays: string[];
    availableFrom: string;
    currentLocation?: LocationData | null;
    preferredLocations?: PreferredLocationData[];
  };
  update: (key: string, value: any) => void;
  saving: boolean;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  onSaveProgress?: () => Promise<void>;
  onBack: () => void;
  onCancel?: () => void;
  isEditing?: boolean;
  accessToken: string | null;
}) {
  const inputClass =
    'mt-1.5 w-full rounded-md border border-border bg-input px-3 py-2.5 font-normal';

  const salaryRangeOptions = [
    'Below ₹15,000',
    '₹15,000 – ₹25,000',
    '₹25,000 – ₹35,000',
    '₹35,000 – ₹50,000',
    '₹50,000 – ₹75,000',
    '₹75,000 – ₹1,00,000',
    'Above ₹1,00,000',
  ];

  const availableFromOptions = [
    'Immediately',
    'Next 15 days',
    'Next 30 days',
    'In the next 2 months',
    'In the next 3 months',
    'After 3 months',
  ];

  const radiusPresets = [5, 10, 15, 25, 50, 75];

  // Current Location state
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isEditingCurrent, setIsEditingCurrent] = useState(false);
  const [currentSearchQuery, setCurrentSearchQuery] = useState('');
  const [currentSearchResults, setCurrentSearchResults] = useState<LocationData[]>([]);
  const [searchingCurrent, setSearchingCurrent] = useState(false);
  const [currentActiveIndex, setCurrentActiveIndex] = useState(-1);

  // Preferred Locations state
  const [prefSearchQuery, setPrefSearchQuery] = useState('');
  const [prefSearchResults, setPrefSearchResults] = useState<LocationData[]>([]);
  const [searchingPref, setSearchingPref] = useState(false);
  const [stagedLocation, setStagedLocation] = useState<LocationData | null>(null);
  const [stagedRadius, setStagedRadius] = useState<number>(10);
  const [prefActiveIndex, setPrefActiveIndex] = useState(-1);

  // Preferred Location Edit state
  const [editingPrefIndex, setEditingPrefIndex] = useState<number | null>(null);
  const [editingPrefData, setEditingPrefData] = useState<PreferredLocationData | null>(null);
  const [isChangingPlace, setIsChangingPlace] = useState(false);
  const [editSearchQuery, setEditSearchQuery] = useState('');
  const [editSearchResults, setEditSearchResults] = useState<LocationData[]>([]);
  const [searchingEdit, setSearchingEdit] = useState(false);
  const [editActiveIndex, setEditActiveIndex] = useState(-1);

  // Sync active index when results change
  useEffect(() => {
    setCurrentActiveIndex(currentSearchResults.length > 0 ? 0 : -1);
  }, [currentSearchResults]);

  useEffect(() => {
    setPrefActiveIndex(prefSearchResults.length > 0 ? 0 : -1);
  }, [prefSearchResults]);

  useEffect(() => {
    setEditActiveIndex(editSearchResults.length > 0 ? 0 : -1);
  }, [editSearchResults]);

  // Scroll active item into view when navigating with arrow keys
  useEffect(() => {
    if (currentActiveIndex >= 0) {
      document.getElementById(`current-loc-opt-${currentActiveIndex}`)?.scrollIntoView({ block: 'nearest' });
    }
  }, [currentActiveIndex]);

  useEffect(() => {
    if (prefActiveIndex >= 0) {
      document.getElementById(`pref-loc-opt-${prefActiveIndex}`)?.scrollIntoView({ block: 'nearest' });
    }
  }, [prefActiveIndex]);

  useEffect(() => {
    if (editActiveIndex >= 0) {
      document.getElementById(`edit-loc-opt-${editActiveIndex}`)?.scrollIntoView({ block: 'nearest' });
    }
  }, [editActiveIndex]);

  // Fallback search / reverse geocode helpers
  const searchLocationsApi = async (rawQuery: string): Promise<LocationData[]> => {
    const q = (rawQuery || '').trim();
    if (!q || q.length < 2) return [];

    const cacheKey = q.toLowerCase();
    const cached = clientSearchCache.get(cacheKey);
    if (cached) return cached;

    // 1. Try via backend endpoint (public and enriched with smart Indian place search)
    try {
      const res = await fetchApi<{ locations: LocationData[] }>(
        `/teacher/location/search?q=${encodeURIComponent(q)}`,
        {},
        accessToken
      );
      if (res && Array.isArray(res.locations) && res.locations.length > 0) {
        clientSearchCache.set(cacheKey, res.locations);
        return res.locations;
      }
    } catch {
      // fallback to multi-variant search
    }

    // 2. Client fallback with multi-word variations & ranking
    const words = q.split(/[\s,]+/).filter((w) => w.length >= 2);
    const variants = [q];
    if (words.length > 1) {
      variants.push(words.join(', '));
    }
    const expanded = q
      .replace(
        /([a-z]+)(nagar|ganj|pur|bad|garh|vihar|colony|enclave|kheda|layout|bazaar|chowk)/gi,
        '$1 $2'
      )
      .trim();
    if (expanded.toLowerCase() !== q.toLowerCase()) {
      variants.push(expanded);
      if (words.length > 1) {
        variants.push(expanded.split(/[\s,]+/).filter(Boolean).join(', '));
      }
    }
    if (words.length > 1) {
      variants.push(words[0]);
    }

    const seen = new Set<string>();
    const rawItems: any[] = [];

    for (const queryVariant of variants) {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
          queryVariant
        )}&countrycodes=in&accept-language=en&addressdetails=1&limit=10`;
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!res.ok) continue;
        const items = await res.json();
        if (Array.isArray(items) && items.length > 0) {
          for (const item of items) {
            const id = String(item.place_id || item.osm_id || item.display_name);
            if (!seen.has(id)) {
              seen.add(id);
              rawItems.push(item);
            }
          }
          const hasFullMatch = rawItems.some((item) => {
            const full = (item.display_name || '').toLowerCase();
            return words.every((w) => full.includes(w.toLowerCase()));
          });
          if (hasFullMatch && rawItems.length >= 3) break;
        }
      } catch {
        // continue
      }
    }

    rawItems.sort((a, b) => {
      const textA = (a.display_name || '').toLowerCase();
      const textB = (b.display_name || '').toLowerCase();
      const scoreA = words.filter((w) => textA.includes(w.toLowerCase())).length;
      const scoreB = words.filter((w) => textB.includes(w.toLowerCase())).length;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return (b.importance || 0) - (a.importance || 0);
    });

    const parsedResults = rawItems.map((item: any) => {
      const addr = item.address || {};
      const locName = (
        item.name ||
        addr.suburb ||
        addr.neighbourhood ||
        addr.city ||
        addr.town ||
        addr.village ||
        (item.display_name ? item.display_name.split(',')[0].trim() : 'Location')
      ).trim();
      const dist = (
        addr.state_district ||
        addr.district ||
        addr.county ||
        addr.city ||
        ''
      ).trim();
      const st = (addr.state || addr.province || addr.region || '').trim();
      const pin = (addr.postcode || addr.postal_code || '').trim();
      return {
        locationName: locName,
        district: dist,
        state: st,
        pincode: pin,
        latitude: parseFloat(item.lat) || 0,
        longitude: parseFloat(item.lon) || 0,
        formattedAddress:
          item.display_name || [locName, dist, st, pin].filter(Boolean).join(', '),
        addressDetails: addr,
      };
    });

    if (parsedResults.length > 0) {
      clientSearchCache.set(cacheKey, parsedResults);
    }
    return parsedResults;
  };

  const reverseGeocodeApi = async (lat: number, lon: number): Promise<LocationData | null> => {
    try {
      const res = await fetchApi<{ location: LocationData }>(
        `/teacher/location/reverse?lat=${lat}&lon=${lon}`,
        {},
        accessToken
      );
      if (res && res.location) return res.location;
    } catch {
      // fallback to direct Nominatim
    }
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=en`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) return null;
      const item = await res.json();
      const addr = item.address || {};
      const locName = (
        item.name ||
        addr.suburb ||
        addr.neighbourhood ||
        addr.city ||
        addr.town ||
        addr.village ||
        (item.display_name ? item.display_name.split(',')[0].trim() : 'Location')
      ).trim();
      const dist = (addr.state_district || addr.district || addr.county || addr.city || '').trim();
      const st = (addr.state || addr.province || addr.region || '').trim();
      const pin = (addr.postcode || addr.postal_code || '').trim();
      return {
        locationName: locName,
        district: dist,
        state: st,
        pincode: pin,
        latitude: parseFloat(item.lat) || lat,
        longitude: parseFloat(item.lon) || lon,
        formattedAddress: item.display_name || [locName, dist, st, pin].filter(Boolean).join(', '),
        addressDetails: addr,
      };
    } catch {
      return {
        locationName: 'My Coordinates',
        district: '',
        state: '',
        pincode: '',
        latitude: lat,
        longitude: lon,
        formattedAddress: `Lat: ${lat.toFixed(5)}, Lon: ${lon.toFixed(5)}`,
      };
    }
  };

  // Detect GPS
  const handleDetectGps = () => {
    if (!('geolocation' in navigator)) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }
    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const resolved = await reverseGeocodeApi(lat, lon);
          if (resolved) {
            update('currentLocation', resolved);
            setIsEditingCurrent(false);
          } else {
            update('currentLocation', {
              locationName: 'Current Position',
              district: '',
              state: '',
              pincode: '',
              latitude: lat,
              longitude: lon,
              formattedAddress: `Lat: ${lat.toFixed(5)}, Lon: ${lon.toFixed(5)}`,
            });
            setIsEditingCurrent(false);
          }
        } catch {
          setGpsError('Failed to resolve address details from coordinates.');
        } finally {
          setGpsLoading(false);
        }
      },
      (err) => {
        setGpsLoading(false);
        const msg =
          {
            1: 'Location access was denied. Please allow location permissions or search manually below.',
            2: 'Device position unavailable. Please search for your location manually.',
            3: 'Acquiring GPS fix timed out. Try again or search manually.',
          }[err.code] || 'Could not acquire device position. Please search manually.';
        setGpsError(msg);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };

  // Search Current Location (debounced)
  useEffect(() => {
    if (!currentSearchQuery || currentSearchQuery.trim().length < 2) {
      setCurrentSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingCurrent(true);
      try {
        const results = await searchLocationsApi(currentSearchQuery);
        setCurrentSearchResults(results);
      } catch {
        setCurrentSearchResults([]);
      } finally {
        setSearchingCurrent(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [currentSearchQuery]);

  // Search Preferred Location (debounced)
  useEffect(() => {
    if (!prefSearchQuery || prefSearchQuery.trim().length < 2) {
      setPrefSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingPref(true);
      try {
        const results = await searchLocationsApi(prefSearchQuery);
        setPrefSearchResults(results);
      } catch {
        setPrefSearchResults([]);
      } finally {
        setSearchingPref(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [prefSearchQuery]);

  // Search for replacement place in Edit Mode (debounced)
  useEffect(() => {
    if (!editSearchQuery || editSearchQuery.trim().length < 2) {
      setEditSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingEdit(true);
      try {
        const results = await searchLocationsApi(editSearchQuery);
        setEditSearchResults(results);
      } catch {
        setEditSearchResults([]);
      } finally {
        setSearchingEdit(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [editSearchQuery]);

  // Add preferred location
  const handleAddPreferred = () => {
    if (!stagedLocation) return;
    const existing = data.preferredLocations || [];
    // Avoid exact duplicate coordinates or exact same locationName
    const isDuplicate = existing.some(
      (item) =>
        item.locationName.toLowerCase() === stagedLocation.locationName.toLowerCase() &&
        Math.abs(item.latitude - stagedLocation.latitude) < 0.001 &&
        Math.abs(item.longitude - stagedLocation.longitude) < 0.001
    );
    if (!isDuplicate) {
      const newItem: PreferredLocationData = {
        ...stagedLocation,
        radiusKm: stagedRadius,
      };
      update('preferredLocations', [...existing, newItem]);
    }
    setStagedLocation(null);
    setPrefSearchQuery('');
    setPrefSearchResults([]);
  };

  // Remove preferred location
  const handleRemovePreferred = (index: number) => {
    if (editingPrefIndex === index) {
      handleCancelEdit();
    }
    const list = data.preferredLocations || [];
    update(
      'preferredLocations',
      list.filter((_, i) => i !== index)
    );
  };

  // Start editing preferred location
  const handleStartEdit = (index: number, item: PreferredLocationData) => {
    setEditingPrefIndex(index);
    setEditingPrefData({ ...item });
    setIsChangingPlace(false);
    setEditSearchQuery('');
    setEditSearchResults([]);
  };

  // Cancel editing preferred location
  const handleCancelEdit = () => {
    setEditingPrefIndex(null);
    setEditingPrefData(null);
    setIsChangingPlace(false);
    setEditSearchQuery('');
    setEditSearchResults([]);
  };

  // Save changes to preferred location
  const handleSaveEdit = () => {
    if (editingPrefIndex === null || !editingPrefData) return;
    const list = [...(data.preferredLocations || [])];
    list[editingPrefIndex] = {
      ...editingPrefData,
      locationName: editingPrefData.locationName.trim() || 'Preferred Location',
      radiusKm: Math.max(1, Number(editingPrefData.radiusKm) || 10),
    };
    update('preferredLocations', list);
    handleCancelEdit();
  };

  const toggleDay = (day: string) => {
    const list = data.availableWorkingDays || [];
    update(
      'availableWorkingDays',
      list.includes(day) ? list.filter((d) => d !== day) : [...list, day]
    );
  };

  return (
    <form
      onSubmit={onSubmit}
      onKeyDown={(e) => {
        // Prevent accidental full-form submission when hitting Enter in search inputs
        if (e.key === 'Enter') {
          const target = e.target as HTMLElement;
          if (target && target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'submit') {
            e.preventDefault();
          }
        }
      }}
      className="bg-card border border-border rounded-xl p-6 shadow-lg space-y-8"
    >
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-heading text-xl font-bold flex items-center gap-2 text-foreground">
            <Clock className="size-5 text-primary" />
            Availability & Location Preferences
          </h2>
          <span className="text-xs text-muted-foreground">
            {isEditing ? 'Edit Section' : 'Step 4 of 4 (Final)'}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Set your current location, commute radius, salary expectations, and working schedule for school vacancy matching.
        </p>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 1. Current Location Section */}
      {/* ------------------------------------------------------------- */}
      <div className="rounded-xl border border-border bg-card/60 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <MapPin className="size-4" />
            </div>
            <div>
              <h3 className="font-heading text-base font-bold text-foreground">Current Location</h3>
              <p className="text-xs text-muted-foreground">
                Your residential location used as your primary base
              </p>
            </div>
          </div>
          {data.currentLocation && !isEditingCurrent && (
            <button
              type="button"
              onClick={() => setIsEditingCurrent(true)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer"
            >
              <Edit3 className="size-3.5" />
              <span>Change Location</span>
            </button>
          )}
        </div>

        {/* Existing Current Location Card */}
        {data.currentLocation && !isEditingCurrent ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 relative">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 mb-1">
                  <Check className="size-3" /> Location Confirmed
                </div>
                <h4 className="font-heading font-bold text-lg text-foreground">
                  {data.currentLocation.locationName}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {data.currentLocation.formattedAddress ||
                    [
                      data.currentLocation.district,
                      data.currentLocation.state,
                      data.currentLocation.pincode,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1.5 text-xs text-muted-foreground">
                  {data.currentLocation.district && (
                    <span>
                      District: <strong className="text-foreground">{data.currentLocation.district}</strong>
                    </span>
                  )}
                  {data.currentLocation.state && (
                    <span>
                      • State: <strong className="text-foreground">{data.currentLocation.state}</strong>
                    </span>
                  )}
                  {data.currentLocation.pincode && (
                    <span>
                      • PIN: <strong className="text-foreground">{data.currentLocation.pincode}</strong>
                    </span>
                  )}
                </div>
              </div>

              {data.currentLocation.latitude !== 0 && data.currentLocation.longitude !== 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-background border border-border text-xs font-mono text-muted-foreground">
                  <Crosshair className="size-3.5 text-emerald-500" />
                  <span>
                    {Number(data.currentLocation.latitude).toFixed(4)}°,{' '}
                    {Number(data.currentLocation.longitude).toFixed(4)}°
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Current Location Input & GPS detector */
          <div className="space-y-4 pt-1">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleDetectGps}
                disabled={gpsLoading}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
              >
                {gpsLoading ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    <span>Acquiring GPS position...</span>
                  </>
                ) : (
                  <>
                    <Locate className="size-4" />
                    <span>Acquire My Device Location</span>
                  </>
                )}
              </button>

              {data.currentLocation && isEditingCurrent && (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingCurrent(false);
                    setCurrentSearchQuery('');
                    setCurrentSearchResults([]);
                  }}
                  className="px-3 py-2 text-xs font-semibold rounded-md border border-border hover:bg-muted text-muted-foreground cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>

            {gpsError && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">{gpsError}</p>
                  <p className="text-[11px] mt-0.5 text-muted-foreground">
                    You can search and select your location manually below instead.
                  </p>
                </div>
              </div>
            )}

            {/* Manual search for Current Location */}
            <div className="relative">
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                Or search and select your current location manually:
              </label>
              <div className="relative">
                <Search className="size-4 text-muted-foreground absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search city, town, village, or locality in India..."
                  value={currentSearchQuery}
                  onChange={(e) => setCurrentSearchQuery(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === 'ArrowDown') {
                      if (currentSearchResults.length > 0) {
                        e.preventDefault();
                        setCurrentActiveIndex((prev) =>
                          prev + 1 < currentSearchResults.length ? prev + 1 : 0
                        );
                      }
                    } else if (e.key === 'ArrowUp') {
                      if (currentSearchResults.length > 0) {
                        e.preventDefault();
                        setCurrentActiveIndex((prev) =>
                          prev > 0 ? prev - 1 : currentSearchResults.length - 1
                        );
                      }
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setCurrentSearchResults([]);
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      if (currentSearchResults.length > 0) {
                        const idx =
                          currentActiveIndex >= 0 && currentActiveIndex < currentSearchResults.length
                            ? currentActiveIndex
                            : 0;
                        update('currentLocation', currentSearchResults[idx]);
                        setIsEditingCurrent(false);
                        setCurrentSearchQuery('');
                        setCurrentSearchResults([]);
                      } else if (currentSearchQuery.trim().length >= 2) {
                        setSearchingCurrent(true);
                        const results = await searchLocationsApi(currentSearchQuery);
                        setCurrentSearchResults(results);
                        setSearchingCurrent(false);
                        if (results.length > 0) {
                          update('currentLocation', results[0]);
                          setIsEditingCurrent(false);
                          setCurrentSearchQuery('');
                          setCurrentSearchResults([]);
                        }
                      }
                    }
                  }}
                  className="w-full rounded-md border border-border bg-input pl-9 pr-9 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {searchingCurrent && (
                  <LoaderCircle className="size-4 animate-spin text-primary absolute right-3 top-3" />
                )}
                {currentSearchQuery && !searchingCurrent && (
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentSearchQuery('');
                      setCurrentSearchResults([]);
                    }}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>

              {/* Autocomplete Dropdown */}
              {currentSearchResults.length > 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card shadow-xl max-h-60 overflow-y-auto divide-y divide-border">
                  {currentSearchResults.map((loc, idx) => {
                    const isSelected = currentActiveIndex === idx;
                    return (
                      <button
                        id={`current-loc-opt-${idx}`}
                        key={idx}
                        type="button"
                        onMouseEnter={() => setCurrentActiveIndex(idx)}
                        onClick={() => {
                          update('currentLocation', loc);
                          setIsEditingCurrent(false);
                          setCurrentSearchQuery('');
                          setCurrentSearchResults([]);
                        }}
                        className={`w-full p-3 text-left transition-colors flex items-start gap-2.5 cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500/15 border-l-4 border-emerald-600 text-foreground ring-1 ring-emerald-500/30'
                            : 'hover:bg-muted/70 text-foreground'
                        }`}
                      >
                        <MapPin
                          className={`size-4 shrink-0 mt-0.5 ${
                            isSelected ? 'text-emerald-600 font-bold' : 'text-primary'
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm flex items-center gap-2">
                            <span>{loc.locationName}</span>
                            {loc.district && (
                              <span className="text-[11px] font-normal text-muted-foreground">
                                ({loc.district})
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {loc.formattedAddress}
                          </div>
                        </div>
                        {isSelected && (
                          <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded bg-emerald-500/20 shrink-0">
                            ↵ Enter to select
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {currentSearchQuery.trim().length >= 2 && !searchingCurrent && currentSearchResults.length === 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card p-3 shadow-lg text-xs text-muted-foreground">
                  No places found for &ldquo;{currentSearchQuery}&rdquo; in India. Try typing city, town, or PIN code (e.g. Lucknow, Gomti Nagar, Ghaziabad).
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. Preferred Locations & Commute Radius Section */}
      {/* ------------------------------------------------------------- */}
      <div className="rounded-xl border border-border bg-card/60 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Navigation className="size-4" />
            </div>
            <div>
              <h3 className="font-heading text-base font-bold text-foreground">
                Preferred Teaching Locations
              </h3>
              <p className="text-xs text-muted-foreground">
                Areas where you are open to teaching and your operational travel radius
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground border border-border">
            {(data.preferredLocations?.length || 0)} Added
          </span>
        </div>

        {/* Search Input for Preferred Locations */}
        <div className="relative">
          <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
            Search city, town, village, or locality:
          </label>
          <div className="relative">
            <Search className="size-4 text-muted-foreground absolute left-3 top-3" />
            <input
              type="text"
              placeholder="e.g., Lucknow, Gomti Nagar, Ghaziabad, Whitefield..."
              value={prefSearchQuery}
              onChange={(e) => setPrefSearchQuery(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'ArrowDown') {
                  if (prefSearchResults.length > 0) {
                    e.preventDefault();
                    setPrefActiveIndex((prev) =>
                      prev + 1 < prefSearchResults.length ? prev + 1 : 0
                    );
                  }
                } else if (e.key === 'ArrowUp') {
                  if (prefSearchResults.length > 0) {
                    e.preventDefault();
                    setPrefActiveIndex((prev) =>
                      prev > 0 ? prev - 1 : prefSearchResults.length - 1
                    );
                  }
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setPrefSearchResults([]);
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  if (prefSearchResults.length > 0) {
                    const idx =
                      prefActiveIndex >= 0 && prefActiveIndex < prefSearchResults.length
                        ? prefActiveIndex
                        : 0;
                    setStagedLocation(prefSearchResults[idx]);
                    setPrefSearchQuery('');
                    setPrefSearchResults([]);
                  } else if (prefSearchQuery.trim().length >= 2) {
                    setSearchingPref(true);
                    const results = await searchLocationsApi(prefSearchQuery);
                    setPrefSearchResults(results);
                    setSearchingPref(false);
                    if (results.length > 0) {
                      setStagedLocation(results[0]);
                      setPrefSearchQuery('');
                      setPrefSearchResults([]);
                    }
                  }
                }
              }}
              className="w-full rounded-md border border-border bg-input pl-9 pr-9 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {searchingPref && (
              <LoaderCircle className="size-4 animate-spin text-primary absolute right-3 top-3" />
            )}
            {prefSearchQuery && !searchingPref && (
              <button
                type="button"
                onClick={() => {
                  setPrefSearchQuery('');
                  setPrefSearchResults([]);
                }}
                className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {prefSearchResults.length > 0 && (
            <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card shadow-xl max-h-60 overflow-y-auto divide-y divide-border">
              {prefSearchResults.map((loc, idx) => {
                const isSelected = prefActiveIndex === idx;
                return (
                  <button
                    id={`pref-loc-opt-${idx}`}
                    key={idx}
                    type="button"
                    onMouseEnter={() => setPrefActiveIndex(idx)}
                    onClick={() => {
                      setStagedLocation(loc);
                      setPrefSearchQuery('');
                      setPrefSearchResults([]);
                    }}
                    className={`w-full p-3 text-left transition-colors flex items-start gap-2.5 cursor-pointer ${
                      isSelected
                        ? 'bg-blue-500/15 border-l-4 border-blue-600 text-foreground ring-1 ring-blue-500/30'
                        : 'hover:bg-muted/70 text-foreground'
                    }`}
                  >
                    <Navigation
                      className={`size-4 shrink-0 mt-0.5 ${
                        isSelected ? 'text-blue-600 font-bold' : 'text-blue-500'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm flex items-center gap-2">
                        <span>{loc.locationName}</span>
                        {loc.district && (
                          <span className="text-[11px] font-normal text-muted-foreground">
                            ({loc.district})
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {loc.formattedAddress}
                      </div>
                    </div>
                    <span
                      className={`text-[11px] font-semibold shrink-0 pt-0.5 ${
                        isSelected
                          ? 'text-blue-700 dark:text-blue-300 font-bold'
                          : 'text-primary'
                      }`}
                    >
                      {isSelected ? '↵ Enter to select' : 'Select & Set Radius →'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {prefSearchQuery.trim().length >= 2 && !searchingPref && prefSearchResults.length === 0 && (
            <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card p-3 shadow-lg text-xs text-muted-foreground">
              No places found for &ldquo;{prefSearchQuery}&rdquo; in India. Try typing city, town, or PIN code (e.g. Gomti Nagar, Lucknow).
            </div>
          )}
        </div>

        {/* Staged Location Radius Config Box */}
        {stagedLocation && (
          <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 space-y-4 animate-in fade-in duration-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                  Configure Commute Radius
                </span>
                <h4 className="font-heading font-bold text-base text-foreground mt-0.5">
                  {stagedLocation.locationName}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {stagedLocation.formattedAddress ||
                    [stagedLocation.district, stagedLocation.state].filter(Boolean).join(', ')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStagedLocation(null)}
                className="text-muted-foreground hover:text-foreground p-1"
                title="Cancel"
              >
                <X className="size-4" />
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold">Commute Radius (Kilometers)</label>
                <span className="text-xs font-bold font-mono px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground">
                  🎯 Within {stagedRadius} km
                </span>
              </div>

              {/* Radius preset chips */}
              <div className="flex flex-wrap gap-2 mb-3">
                {radiusPresets.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setStagedRadius(r)}
                    className={`px-3 py-1 text-xs rounded-full font-semibold border transition-all cursor-pointer ${
                      stagedRadius === r
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-background hover:bg-muted text-foreground border-border'
                    }`}
                  >
                    {r} km
                  </button>
                ))}
              </div>

              {/* Range Slider */}
              <input
                type="range"
                min="1"
                max="100"
                value={stagedRadius}
                onChange={(e) => setStagedRadius(Number(e.target.value))}
                className="w-full accent-primary h-1.5 bg-muted rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1 font-mono">
                <span>1 km (Walking)</span>
                <span>25 km (City commuting)</span>
                <span>100 km (Inter-city)</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setStagedLocation(null)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-md border border-border hover:bg-muted cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddPreferred}
                className="px-4 py-1.5 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Plus className="size-3.5" />
                <span>Add to Preferred Locations</span>
              </button>
            </div>
          </div>
        )}

        {/* Added Preferred Locations List */}
        <div className="space-y-2 pt-1">
          <div className="text-xs font-semibold text-muted-foreground">
            Added Preferred Locations:
          </div>

          {!data.preferredLocations || data.preferredLocations.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              No preferred teaching locations added yet. Search and select locations above to specify where you want to teach.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.preferredLocations.map((item, index) => {
                const isEditing = editingPrefIndex === index && editingPrefData !== null;

                if (isEditing) {
                  return (
                    <div
                      key={index}
                      className="rounded-xl border-2 border-primary bg-primary/5 p-4 space-y-3.5 shadow-md col-span-1 sm:col-span-2 animate-in fade-in duration-200"
                    >
                      <div className="flex items-center justify-between border-b border-primary/20 pb-2">
                        <div className="flex items-center gap-2">
                          <div className="size-6 rounded-md bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
                            <Edit3 className="size-3.5" />
                          </div>
                          <h4 className="font-heading font-bold text-sm text-foreground">
                            Edit Preferred Location #{index + 1}
                          </h4>
                        </div>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted/50 cursor-pointer"
                          title="Close editor"
                        >
                          <X className="size-4" />
                        </button>
                      </div>

                      {/* Location Name & Address / Change Place */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-foreground">
                            Location Name & Address
                          </label>
                          <button
                            type="button"
                            onClick={() => setIsChangingPlace(!isChangingPlace)}
                            className="text-[11px] text-primary hover:underline font-semibold cursor-pointer"
                          >
                            {isChangingPlace ? 'Keep Current Place' : 'Change Place / Search New'}
                          </button>
                        </div>

                        {!isChangingPlace ? (
                          <div className="space-y-1.5">
                            <input
                              type="text"
                              value={editingPrefData.locationName}
                              onChange={(e) =>
                                setEditingPrefData({
                                  ...editingPrefData,
                                  locationName: e.target.value,
                                })
                              }
                              placeholder="Location Name"
                              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            <p className="text-xs text-muted-foreground truncate px-1">
                              {editingPrefData.formattedAddress ||
                                [
                                  editingPrefData.district,
                                  editingPrefData.state,
                                  editingPrefData.pincode,
                                ]
                                  .filter(Boolean)
                                  .join(', ')}
                            </p>
                          </div>
                        ) : (
                          <div className="relative space-y-1">
                            <div className="relative">
                              <Search className="size-4 text-muted-foreground absolute left-3 top-2.5" />
                              <input
                                type="text"
                                placeholder="Search new city, town, or locality in India..."
                                value={editSearchQuery}
                                onChange={(e) => setEditSearchQuery(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'ArrowDown') {
                                    if (editSearchResults.length > 0) {
                                      e.preventDefault();
                                      setEditActiveIndex((prev) =>
                                        prev + 1 < editSearchResults.length ? prev + 1 : 0
                                      );
                                    }
                                  } else if (e.key === 'ArrowUp') {
                                    if (editSearchResults.length > 0) {
                                      e.preventDefault();
                                      setEditActiveIndex((prev) =>
                                        prev > 0 ? prev - 1 : editSearchResults.length - 1
                                      );
                                    }
                                  } else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    setEditSearchResults([]);
                                  } else if (e.key === 'Enter') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (editSearchResults.length > 0) {
                                      const idx =
                                        editActiveIndex >= 0 && editActiveIndex < editSearchResults.length
                                          ? editActiveIndex
                                          : 0;
                                      setEditingPrefData({
                                        ...editingPrefData,
                                        ...editSearchResults[idx],
                                      });
                                      setIsChangingPlace(false);
                                      setEditSearchQuery('');
                                      setEditSearchResults([]);
                                    }
                                  }
                                }}
                                className="w-full rounded-md border border-border bg-background pl-9 pr-9 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                              {searchingEdit && (
                                <LoaderCircle className="size-3.5 animate-spin text-primary absolute right-3 top-2.5" />
                              )}
                            </div>
                            {editSearchResults.length > 0 && (
                              <div className="rounded-lg border border-border bg-card shadow-lg max-h-44 overflow-y-auto divide-y divide-border">
                                {editSearchResults.map((loc, idx) => {
                                  const isSelected = editActiveIndex === idx;
                                  return (
                                    <button
                                      id={`edit-loc-opt-${idx}`}
                                      key={idx}
                                      type="button"
                                      onMouseEnter={() => setEditActiveIndex(idx)}
                                      onClick={() => {
                                        setEditingPrefData({
                                          ...editingPrefData,
                                          ...loc,
                                        });
                                        setIsChangingPlace(false);
                                        setEditSearchQuery('');
                                        setEditSearchResults([]);
                                      }}
                                      className={`w-full p-2 text-left transition-colors flex items-start gap-2 cursor-pointer text-xs ${
                                        isSelected
                                          ? 'bg-primary/15 border-l-4 border-primary text-foreground ring-1 ring-primary/30'
                                          : 'hover:bg-muted/70 text-foreground'
                                      }`}
                                    >
                                      <MapPin
                                        className={`size-3.5 shrink-0 mt-0.5 ${
                                          isSelected ? 'text-primary font-bold' : 'text-muted-foreground'
                                        }`}
                                      />
                                      <div className="min-w-0 flex-1">
                                        <span className="font-semibold text-foreground">
                                          {loc.locationName}
                                        </span>
                                        <span className="text-muted-foreground block truncate text-[11px]">
                                          {loc.formattedAddress}
                                        </span>
                                      </div>
                                      {isSelected && (
                                        <span className="text-[10px] font-semibold text-primary px-1.5 py-0.5 rounded bg-primary/10 shrink-0">
                                          ↵ Enter to select
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Commute Radius Configuration */}
                      <div className="space-y-2 pt-1 border-t border-border/60">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-foreground">
                            Commute Radius
                          </label>
                          <span className="text-xs font-bold font-mono px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground">
                            🎯 Within {editingPrefData.radiusKm || 10} km
                          </span>
                        </div>

                        {/* Radius presets */}
                        <div className="flex flex-wrap gap-1.5">
                          {radiusPresets.map((r) => (
                            <button
                              key={r}
                              type="button"
                              onClick={() =>
                                setEditingPrefData({ ...editingPrefData, radiusKm: r })
                              }
                              className={`px-2.5 py-1 text-xs rounded-full font-semibold border transition-all cursor-pointer ${
                                editingPrefData.radiusKm === r
                                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                  : 'bg-background hover:bg-muted text-foreground border-border'
                              }`}
                            >
                              {r} km
                            </button>
                          ))}
                        </div>

                        {/* Range Slider */}
                        <input
                          type="range"
                          min="1"
                          max="100"
                          value={editingPrefData.radiusKm || 10}
                          onChange={(e) =>
                            setEditingPrefData({
                              ...editingPrefData,
                              radiusKm: Number(e.target.value),
                            })
                          }
                          className="w-full accent-primary h-1.5 bg-muted rounded-lg cursor-pointer mt-1"
                        />
                        <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                          <span>1 km (Walking)</span>
                          <span>25 km (City commuting)</span>
                          <span>100 km (Inter-city)</span>
                        </div>
                      </div>

                      {/* Actions: Cancel & Save */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="px-3.5 py-1.5 text-xs font-semibold rounded-md border border-border bg-background hover:bg-muted text-muted-foreground cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          className="px-4 py-1.5 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                        >
                          <Check className="size-3.5" />
                          <span>Save Changes</span>
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={index}
                    className="rounded-lg border border-border bg-muted/40 p-3.5 space-y-2 relative group hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-heading font-bold text-sm text-foreground truncate">
                          {item.locationName}
                        </h4>
                        <p className="text-xs text-muted-foreground truncate">
                          {item.formattedAddress ||
                            [item.district, item.state, item.pincode]
                              .filter(Boolean)
                              .join(', ')}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(index, item)}
                          className="text-muted-foreground hover:text-primary hover:bg-muted p-1 rounded transition-colors cursor-pointer"
                          title="Edit location and radius"
                        >
                          <Edit3 className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemovePreferred(index)}
                          className="text-muted-foreground hover:text-destructive hover:bg-muted p-1 rounded transition-colors cursor-pointer"
                          title="Remove location"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>

                    {/* Radius & Coordinates Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60 text-xs">
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                        <span>🎯 Within {item.radiusKm || 10} km</span>
                      </div>

                      {item.latitude !== 0 && item.longitude !== 0 && (
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {Number(item.latitude).toFixed(3)}°, {Number(item.longitude).toFixed(3)}°
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. Salary & Availability Schedule Section */}
      {/* ------------------------------------------------------------- */}
      <div className="rounded-xl border border-border bg-card/60 p-5 space-y-5">
        <h3 className="font-heading text-base font-bold text-foreground">
          Salary & Working Schedule
        </h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-semibold block mb-1">
              Expected salary range (₹ per month)
            </label>
            <Select
              value={data.salaryRange || ''}
              onValueChange={(val) => update('salaryRange', val || '')}
            >
              <SelectTrigger className={`w-full h-10 ${inputClass}`}>
                <SelectValue placeholder="Select a range" />
              </SelectTrigger>
              <SelectContent>
                {salaryRangeOptions.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-semibold block mb-1">
              Available to join
            </label>
            <Select
              value={data.availableFrom || ''}
              onValueChange={(val) => update('availableFrom', val || '')}
            >
              <SelectTrigger className={`w-full h-10 ${inputClass}`}>
                <SelectValue placeholder="Select availability" />
              </SelectTrigger>
              <SelectContent>
                {availableFromOptions.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <fieldset className="sm:col-span-2">
            <legend className="text-sm font-semibold">Available working days</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {weekDays.map((day) => {
                const selected = data.availableWorkingDays?.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                      selected
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-background text-foreground border-border hover:bg-muted'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>
      </div>

      {/* Onboarding completion callout (only shown during initial onboarding) */}
      {!isEditing && (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4 text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-3">
          <CheckCircle2 className="size-5 shrink-0" />
          <p>
            Ready to finish? Clicking <strong>&ldquo;Complete onboarding&rdquo;</strong> will finalize
            your registration, reveal your full Schoolmini navigation, and open your interactive
            teacher dashboard.
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        {isEditing ? (
          <>
            <button
              type="button"
              onClick={onCancel || onBack}
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted transition-colors cursor-pointer"
            >
              <ArrowLeft className="size-4" />
              <span>Cancel</span>
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm cursor-pointer"
            >
              <Save className="size-4" />
              <span>{saving ? 'Saving changes...' : 'Save Changes'}</span>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onBack}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted transition-colors cursor-pointer"
            >
              <ArrowLeft className="size-4" />
              <span>Back</span>
            </button>
            <button
              type="button"
              onClick={onSaveProgress}
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-md border border-border bg-secondary px-4 py-2.5 text-sm font-semibold hover:bg-secondary/80 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Save className="size-4" />
              <span>Save for later</span>
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm cursor-pointer"
            >
              <ShieldCheck className="size-4" />
              <span>{saving ? 'Completing...' : 'Complete onboarding'}</span>
            </button>
          </>
        )}
      </div>
    </form>
  );
}

// -------------------------------------------------------------------------
// Dashboard View (Shown after 100% Onboarding Completion)
// -------------------------------------------------------------------------
function TeacherDashboard({
  user,
  profile,
  onNavigate,
  demoVideoUrl,
  setDemoVideoUrl,
  onSaveDemo,
  savingDemo,
  demoSuccess,
  demoError,
}: {
  user: any;
  profile: TeacherProfile | null;
  onNavigate: (section: string) => void;
  demoVideoUrl: string;
  setDemoVideoUrl: (v: string) => void;
  onSaveDemo: (e?: React.FormEvent) => Promise<void>;
  savingDemo: boolean;
  demoSuccess?: string | null;
  demoError?: string | null;
}) {
  const [isDemoExpanded, setIsDemoExpanded] = useState(false);
  const [isSkillsExpanded, setIsSkillsExpanded] = useState(false);
  const isDemoCompleted = Boolean(profile?.demoClassCompleted && profile?.demoVideoUrl);
  const isSkillCompleted = Boolean(profile?.skillAssessmentCompleted);
  const embedUrl = useMemo(
    () => getYouTubeEmbedUrl(demoVideoUrl),
    [demoVideoUrl]
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Welcome Banner */}
      <div className="bg-card border border-border rounded-xl p-6 md:p-8 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <GraduationCap className="h-8 w-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Teacher Dashboard
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-3" />
                  Onboarding Complete
                </span>
              </div>
              <h1 className="font-heading text-2xl md:text-3xl font-bold mt-1">
                Welcome, {user?.displayName || user?.username}
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Your onboarding is complete and verified. Access your profile sections and features below.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Action: Onboarding Details Button */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-primary/40 transition-colors">
        <div className="flex items-center gap-3.5">
          <div className="size-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <FileText className="size-6" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-lg text-foreground">
              Onboarding Details
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
              View and manage all 4 completed onboarding sections (Basic Information, Personal Details, Document Upload, and Availability).
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('/teacher?view=onboarding-details')}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shrink-0 shadow-sm cursor-pointer"
        >
          <span>Onboarding Details</span>
          <ArrowRight className="size-3.5" />
        </button>
      </div>

      {/* Demo Class Section (Collapsed by default, "New" badge until completed) */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-md transition-all">
        <div
          className="flex flex-wrap items-center justify-between gap-4 cursor-pointer select-none"
          onClick={() => setIsDemoExpanded(!isDemoExpanded)}
        >
          <div className="flex items-center gap-3.5">
            <div className="size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Video className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-bold text-base text-foreground">
                  Demo Class
                </h3>
                {!isDemoCompleted ? (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30 animate-pulse">
                    New
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                    <CheckCircle2 className="size-3" />
                    Saved
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isDemoCompleted
                  ? 'Sample teaching video saved. You can update your video link anytime.'
                  : 'Add a sample teaching video demonstration (YouTube link) to improve school vacancy matching.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNavigate('/teacher?section=demo');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-secondary text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 transition-colors shrink-0 cursor-pointer"
            >
              <span>{isDemoCompleted ? 'Edit Video' : 'Add Demo Video'}</span>
              <ArrowRight className="size-3.5" />
            </button>
            <button
              type="button"
              className="p-1.5 rounded-md border border-border bg-muted/60 text-muted-foreground hover:text-foreground transition-colors shrink-0 cursor-pointer"
            >
              {isDemoExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
          </div>
        </div>

        {/* Collapsible Content */}
        {isDemoExpanded && (
          <form
            onSubmit={onSaveDemo}
            className="mt-5 pt-5 border-t border-border space-y-4"
          >
            {demoError && (
              <div className="flex items-center gap-2 rounded-md border border-destructive bg-destructive/15 p-3 text-xs text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                <span>{demoError}</span>
              </div>
            )}
            {demoSuccess && (
              <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/15 p-3 text-xs text-emerald-500">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>{demoSuccess}</span>
              </div>
            )}

            <label className="block text-sm font-semibold">
              YouTube Video Link (Required)
              <div className="mt-1.5 flex items-center rounded-md border border-border bg-input">
                <span className="px-3 py-2 text-muted-foreground">
                  <Play className="size-4 text-red-500" />
                </span>
                <input
                  required
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={demoVideoUrl}
                  onChange={(e) => setDemoVideoUrl(e.target.value)}
                  className="w-full bg-transparent px-3 py-2 text-sm font-normal focus:outline-none text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <span className="mt-1 block text-xs text-muted-foreground font-normal">
                Paste a link to an unlisted or public YouTube teaching demonstration (5–10 minutes recommended).
              </span>
            </label>

            {embedUrl ? (
              <div className="rounded-lg overflow-hidden border border-border aspect-video max-w-lg mx-auto bg-black shadow-md">
                <iframe
                  src={embedUrl}
                  title="YouTube Demo Class Preview"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  className="w-full h-full"
                />
              </div>
            ) : demoVideoUrl ? (
              <div className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                Enter a valid YouTube link to preview your demo lesson.
              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDemoExpanded(false)}
                className="px-4 py-2 rounded-md border border-border text-xs font-semibold hover:bg-muted transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={savingDemo}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm cursor-pointer"
              >
                <Save className="size-3.5" />
                <span>{savingDemo ? 'Saving...' : 'Save Demo Class'}</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Skill Assessment Section (Beside Demo Class, "New" badge until completed) */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-md transition-all">
        <div
          className="flex flex-wrap items-center justify-between gap-4 cursor-pointer select-none"
          onClick={() => setIsSkillsExpanded(!isSkillsExpanded)}
        >
          <div className="flex items-center gap-3.5">
            <div className="size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Zap className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-bold text-base text-foreground">
                  Skill Assessment
                </h3>
                {!isSkillCompleted ? (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30 animate-pulse">
                    New
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                    <CheckCircle2 className="size-3" />
                    Completed & Verified
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isSkillCompleted
                  ? 'Your competency evaluation is verified and recorded on your profile.'
                  : 'Complete your competency and pedagogy verification to earn a certified assessment badge.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNavigate('/teacher?section=skills');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-secondary text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 transition-colors shrink-0 cursor-pointer"
            >
              <span>{isSkillCompleted ? 'View Assessment' : 'Open Assessment'}</span>
              <ArrowRight className="size-3.5" />
            </button>
            <button
              type="button"
              className="p-1.5 rounded-md border border-border bg-muted/60 text-muted-foreground hover:text-foreground transition-colors shrink-0 cursor-pointer"
            >
              {isSkillsExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
          </div>
        </div>

        {/* Collapsible Content */}
        {isSkillsExpanded && (
          <div className="mt-5 pt-5 border-t border-border space-y-4">

            <div className="my-2 text-center max-w-lg mx-auto py-2">
              <div className="mx-auto size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                <Sparkles className="size-7" />
              </div>
              <h4 className="font-heading font-bold text-base">
                Pedagogy Skill Assessment
              </h4>
              <p className="text-xs text-muted-foreground mt-1.5">
                Complete the scenario-based competency assessment to verify your teaching methodology,
                classroom management, and student psychology skills.
              </p>

              <div className={`mt-4 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-xs font-semibold ${
                isSkillCompleted
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-600'
              }`}>
                {isSkillCompleted ? <CheckCircle2 className="size-3.5" /> : <Sparkles className="size-3.5" />}
                <span>
                  {isSkillCompleted
                    ? 'Status: Assessment Completed & Verified'
                    : 'Status: Ready to Take Assessment'}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
              <button
                type="button"
                onClick={() => setIsSkillsExpanded(false)}
                className="px-4 py-2 rounded-md border border-border text-xs font-semibold hover:bg-muted transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/teacher?section=skills')}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm cursor-pointer"
              >
                <span>{isSkillCompleted ? 'View Results & Breakdown' : 'Start Assessment'}</span>
                <ArrowRight className="size-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// Onboarding Details View Component (Accessed via /teacher?view=onboarding-details)
// -------------------------------------------------------------------------
function TeacherOnboardingDetailsView({
  user,
  profile,
  documents,
  onNavigate,
  onBack,
}: {
  user: any;
  profile: TeacherProfile;
  documents: TeacherDocument[];
  onNavigate: (path: string) => void;
  onBack: () => void;
}) {
  const nameParts = (user?.displayName || user?.username || '').trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const surname = nameParts.slice(1).join(' ') || '';

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Top Bar with Back Button */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary px-3.5 py-2 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
        >
          <ArrowLeft className="size-4" />
          <span>Back to Dashboard</span>
        </button>
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">
          Verified Onboarding Records
        </span>
      </div>

      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl md:text-3xl font-bold">
          Onboarding Details
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Review and manage all verified information submitted during your onboarding process.
        </p>
      </div>

      {/* 4 Onboarding Section Cards */}
      <div className="grid gap-5 md:grid-cols-2">
        {/* 1. Basic Information */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col justify-between hover:border-primary/40 transition-colors">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                <UserRound className="size-5" />
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="size-3" />
                Verified
              </span>
            </div>
            <h3 className="font-heading font-bold text-base">Basic Information</h3>
            <div className="mt-3 text-xs space-y-1.5 text-muted-foreground">
              <p><span className="font-semibold text-foreground">Name:</span> {firstName || 'Not set'}</p>
              <p><span className="font-semibold text-foreground">Surname:</span> {surname || 'Not set'}</p>
              <p><span className="font-semibold text-foreground">Email:</span> {user?.email || 'Not set'}</p>
              <p><span className="font-semibold text-foreground">Gender:</span> {profile?.gender || 'Not set'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/teacher?section=basic')}
            className="mt-5 inline-flex items-center justify-between w-full rounded-md border border-border bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
          >
            <span>View & Edit</span>
            <ArrowRight className="size-3.5" />
          </button>
        </div>

        {/* 2. Personal Details */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col justify-between hover:border-primary/40 transition-colors">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                <GraduationCap className="size-5" />
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="size-3" />
                Verified
              </span>
            </div>
            <h3 className="font-heading font-bold text-base">Personal Details & Experience</h3>
            <div className="mt-3 text-xs space-y-1.5 text-muted-foreground">
              <p><span className="font-semibold text-foreground">Experience:</span> {profile?.teachingExperience || 'Not specified'}</p>
              <p><span className="font-semibold text-foreground">Subjects:</span> {listValue(profile?.subjects)?.slice(0, 35) || 'Added'}</p>
              <p><span className="font-semibold text-foreground">Boards:</span> {listValue(profile?.boardExperience) || 'CBSE, ICSE'}</p>
              <p><span className="font-semibold text-foreground">Languages:</span> {listValue(profile?.languages) || 'English, Hindi'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/teacher?section=completion')}
            className="mt-5 inline-flex items-center justify-between w-full rounded-md border border-border bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
          >
            <span>View & Edit</span>
            <ArrowRight className="size-3.5" />
          </button>
        </div>

        {/* 3. Document Upload */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col justify-between hover:border-primary/40 transition-colors">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                <FileText className="size-5" />
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="size-3" />
                Uploaded
              </span>
            </div>
            <h3 className="font-heading font-bold text-base">Document Upload</h3>
            <div className="mt-3 text-xs space-y-1.5 text-muted-foreground">
              <p><span className="font-semibold text-foreground">Uploaded Documents:</span> {documents.length} files</p>
              <p className="text-emerald-600 dark:text-emerald-400 font-medium">Identity & Academic Certificates securely stored</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/teacher/documents')}
            className="mt-5 inline-flex items-center justify-between w-full rounded-md border border-border bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
          >
            <span>Manage Documents</span>
            <ArrowRight className="size-3.5" />
          </button>
        </div>

        {/* 4. Availability & Location */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col justify-between hover:border-primary/40 transition-colors">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Clock className="size-5" />
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="size-3" />
                Verified
              </span>
            </div>
            <h3 className="font-heading font-bold text-base">Availability & Location Preferences</h3>
            <div className="mt-3 grid gap-3 grid-cols-2 text-xs text-muted-foreground">
              <div>
                <p className="font-semibold text-foreground">Expected Salary</p>
                <p className="mt-0.5">{profile?.salaryRange || (profile?.preferredSalary ? `₹${profile.preferredSalary}` : 'Not set')}</p>
              </div>
              <div>
                <p className="font-semibold text-foreground">Joining Notice</p>
                <p className="mt-0.5">{profile?.availableFrom || 'Immediately'}</p>
              </div>
              <div>
                <p className="font-semibold text-foreground">Working Days</p>
                <p className="mt-0.5">{listValue(profile?.availableWorkingDays) || 'Monday to Friday'}</p>
              </div>
              <div>
                <p className="font-semibold text-foreground">Current Location</p>
                <p className="mt-0.5 truncate">{profile?.currentLocation?.locationName || profile?.location || 'Configured'}</p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/teacher?section=availability')}
            className="mt-5 inline-flex items-center justify-between w-full rounded-md border border-border bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
          >
            <span>View & Edit</span>
            <ArrowRight className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// Section View Component (Inspect details of completed sections)
// -------------------------------------------------------------------------
function TeacherSectionView({
  sectionKey,
  profile,
  user,
  documents,
  onEdit,
  onBack,
  success,
  error,
}: {
  sectionKey: string;
  profile: TeacherProfile;
  user: any;
  documents: TeacherDocument[];
  onEdit: (section: string) => void;
  onBack: () => void;
  success?: string | null;
  error?: string | null;
}) {
  let title = 'Teacher Profile Section';

  if (sectionKey === 'basic') {
    title = 'Basic Information';
    const nameParts = (user?.displayName || user?.username || '').trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const surname = nameParts.slice(1).join(' ') || '';

    const rows = [
      ['Name', firstName],
      ['Surname', surname],
      ['Email', user?.email],
      ['Gender', profile.gender],
    ];

    return (
      <SectionWrapper title={title} onEdit={() => onEdit(sectionKey)} onBack={onBack} success={success} error={error}>
        <dl className="grid gap-4 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="rounded-md bg-muted px-3.5 py-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
              </dt>
              <dd className="mt-1.5 whitespace-pre-wrap text-sm font-medium text-card-foreground">
                {value || 'Not provided'}
              </dd>
            </div>
          ))}
        </dl>
      </SectionWrapper>
    );
  }

  if (sectionKey === 'completion') {
    title = 'Personal Details & Qualifications';
    const educationList: EducationEntry[] = Array.isArray(profile.education)
      ? profile.education
      : [];
    const previousSchools: PreviousSchoolEntry[] = Array.isArray(
      profile.previousSchools
    )
      ? profile.previousSchools
      : [];
    const subjects = parseArrayOrString(profile.subjects);
    const classes = parseArrayOrString(profile.classesTaught);
    const boards = parseArrayOrString(profile.boardExperience);
    const languages = parseArrayOrString(profile.languages);
    const skills = parseArrayOrString(profile.skills);
    const achievements = parseArrayOrString(profile.achievements);
    const awards = parseArrayOrString(profile.awards);

    return (
      <SectionWrapper title={title} onEdit={() => onEdit(sectionKey)} onBack={onBack} success={success} error={error}>
        <div className="space-y-6">
          {/* About Me */}
          <div className="rounded-md bg-muted px-4 py-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              About Me
            </h4>
            <p className="mt-1.5 text-sm whitespace-pre-wrap text-card-foreground">
              {profile.aboutMe || 'Not provided'}
            </p>
          </div>

          {/* Education List */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Education Qualifications
            </h4>
            {educationList.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {educationList.map((edu, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-border bg-muted/50 text-xs space-y-1"
                  >
                    <span className="font-bold text-sm text-primary block">
                      {edu.courseName}
                    </span>
                    <p className="text-foreground">
                      {edu.boardOrUniversity} ({edu.passingYear})
                    </p>
                    {edu.gradeValue && (
                      <p className="text-muted-foreground">
                        {edu.gradeSystem}: {edu.gradeValue}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {typeof profile.education === 'string'
                  ? profile.education
                  : 'Not provided'}
              </p>
            )}
          </div>

          {/* Experience */}
          <div className="rounded-md bg-muted px-4 py-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Total Teaching Experience
            </h4>
            <p className="mt-1.5 text-sm font-medium text-card-foreground">
              {profile.teachingExperience || 'Not specified'}
            </p>
          </div>

          {/* Previous Schools */}
          {previousSchools.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Previous Schools
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                {previousSchools.map((sch, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-border bg-muted/50 text-xs space-y-1"
                  >
                    <span className="font-bold text-sm text-foreground block">
                      {sch.schoolName}
                    </span>
                    <p className="text-muted-foreground">
                      {sch.startDate} - {sch.endDate}{' '}
                      {sch.duration ? `(${sch.duration})` : ''}
                    </p>
                    {sch.subjectsTaught && (
                      <p className="text-foreground">
                        Taught: {sch.subjectsTaught}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tags Grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-md bg-muted px-4 py-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Subjects
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {subjects.map((s) => (
                  <span
                    key={s}
                    className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-md bg-muted px-4 py-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Classes Taught
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {classes.map((c) => (
                  <span
                    key={c}
                    className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-md bg-muted px-4 py-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Languages
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {languages.map((l) => (
                  <span
                    key={l}
                    className="px-2 py-0.5 rounded-full bg-secondary text-foreground text-xs font-medium"
                  >
                    {l}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-md bg-muted px-4 py-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Skills
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {skills.map((sk) => (
                  <span
                    key={sk}
                    className="px-2 py-0.5 rounded-full bg-secondary text-foreground text-xs font-medium"
                  >
                    {sk}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-md bg-muted px-4 py-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Board Experience
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {boards.map((b) => (
                  <span
                    key={b}
                    className="px-2 py-0.5 rounded-full bg-secondary text-foreground text-xs font-medium"
                  >
                    {b.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </div>

            {achievements.length > 0 && (
              <div className="rounded-md bg-muted px-4 py-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Achievements
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {achievements.map((a) => (
                    <span
                      key={a}
                      className="px-2 py-0.5 rounded-full bg-secondary text-foreground text-xs font-medium"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {awards.length > 0 && (
              <div className="rounded-md bg-muted px-4 py-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Awards
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {awards.map((aw) => (
                    <span
                      key={aw}
                      className="px-2 py-0.5 rounded-full bg-secondary text-foreground text-xs font-medium"
                    >
                      {aw}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </SectionWrapper>
    );
  }
  if (sectionKey === 'documents') {
    title = 'Uploaded Documents';
    return (
      <SectionWrapper title={title} onEdit={() => onEdit(sectionKey)} onBack={onBack} success={success} error={error}>
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="rounded-md bg-muted px-4 py-3 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {doc.documentName || doc.documentType}
                  </p>
                  <p className="mt-1 text-sm font-medium text-card-foreground truncate">
                    {doc.fileName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(doc.sizeBytes / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
                {doc.downloadUrl && (
                  <a
                    href={doc.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline mt-1"
                  >
                    <ExternalLink className="size-3" />
                    View
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionWrapper>
    );
  }

  if (sectionKey === 'skills') {
    title = 'Skill Assessment';
    const rows = [
      ['Assessment Status', 'Completed & Verified'],
      ['Pedagogy Evaluation', 'Proficient'],
      ['Subject Competence', 'Verified'],
      ['Evaluation Date', new Date().toLocaleDateString()],
    ];
    return (
      <SectionWrapper title={title} onEdit={() => onEdit(sectionKey)} onBack={onBack} success={success} error={error}>
        <dl className="grid gap-4 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="rounded-md bg-muted px-3.5 py-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
              </dt>
              <dd className="mt-1.5 whitespace-pre-wrap text-sm font-medium text-card-foreground">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </SectionWrapper>
    );
  }

  if (sectionKey === 'demo') {
    title = 'Demo Class';
    const embedUrl = profile.demoVideoUrl
      ? getYouTubeEmbedUrl(profile.demoVideoUrl)
      : null;

    return (
      <SectionWrapper title={title} onEdit={() => onEdit(sectionKey)} onBack={onBack} success={success} error={error}>
        <div className="space-y-4">
          <div className="rounded-md bg-muted px-3.5 py-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              YouTube Video URL
            </span>
            <p className="mt-1 text-sm font-medium text-foreground truncate">
              {profile.demoVideoUrl || 'No video provided'}
            </p>
          </div>
          {embedUrl && (
            <div className="aspect-video max-w-2xl mx-auto rounded-lg overflow-hidden border border-border bg-black">
              <iframe
                src={embedUrl}
                title="Demo Video Preview"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="w-full h-full"
              />
            </div>
          )}
        </div>
      </SectionWrapper>
    );
  }

  if (sectionKey === 'availability') {
    title = 'Availability & Preferences';
    const rows = [
      ['Expected Salary Range', profile.salaryRange || (profile.preferredSalary ? `₹${profile.preferredSalary}` : 'Not set')],
      ['Available to Join', profile.availableFrom || 'Immediately'],
      ['Available Working Days', listValue(profile.availableWorkingDays) || 'Monday to Friday'],
    ];

    const currentLoc = profile.currentLocation || (profile.location ? { locationName: profile.location } : null);
    const prefLocs = Array.isArray(profile.preferredLocations)
      ? profile.preferredLocations
      : (Array.isArray(profile.preferredTeachingLocations)
        ? profile.preferredTeachingLocations.map((l: string) => ({ locationName: l, radiusKm: 10 }))
        : []);

    return (
      <SectionWrapper title={title} onEdit={() => onEdit(sectionKey)} onBack={onBack} success={success} error={error}>
        <div className="space-y-6">
          <dl className="grid gap-4 sm:grid-cols-3">
            {rows.map(([label, value]) => (
              <div key={label} className="rounded-lg bg-muted/60 border border-border/50 p-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {label}
                </dt>
                <dd className="mt-1.5 whitespace-pre-wrap text-sm font-semibold text-card-foreground">
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          {/* Current Location Review */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                <MapPin className="size-4" />
              </div>
              <div>
                <h3 className="font-heading text-sm font-bold text-foreground">Current Base Location</h3>
                <p className="text-xs text-muted-foreground">Fixed residential location for commute calculations</p>
              </div>
            </div>
            {currentLoc ? (
              <div className="rounded-lg bg-muted/40 border border-border/60 p-4 flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-heading font-bold text-base text-foreground flex items-center gap-2">
                    {currentLoc.locationName}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {currentLoc.formattedAddress ||
                      [currentLoc.district, currentLoc.state, currentLoc.pincode].filter(Boolean).join(', ')}
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 text-xs text-muted-foreground">
                    {currentLoc.district && (
                      <span>
                        District: <strong className="text-foreground">{currentLoc.district}</strong>
                      </span>
                    )}
                    {currentLoc.state && (
                      <span>
                        • State: <strong className="text-foreground">{currentLoc.state}</strong>
                      </span>
                    )}
                    {currentLoc.pincode && (
                      <span>
                        • PIN: <strong className="text-foreground">{currentLoc.pincode}</strong>
                      </span>
                    )}
                  </div>
                </div>
                {currentLoc.latitude && currentLoc.longitude ? (
                  <span className="font-mono text-xs text-muted-foreground px-2.5 py-1 rounded bg-background border border-border inline-flex items-center gap-1">
                    <Crosshair className="size-3 text-emerald-500" />
                    {Number(currentLoc.latitude).toFixed(4)}°, {Number(currentLoc.longitude).toFixed(4)}°
                  </span>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">No current location specified.</p>
            )}
          </div>

          {/* Preferred Locations Review */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <Navigation className="size-4" />
                </div>
                <div>
                  <h3 className="font-heading text-sm font-bold text-foreground">Preferred Teaching Locations</h3>
                  <p className="text-xs text-muted-foreground">Areas where you are open to teaching and travel radius</p>
                </div>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border">
                {prefLocs.length} {prefLocs.length === 1 ? 'Location' : 'Locations'}
              </span>
            </div>

            {prefLocs.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {prefLocs.map((loc: any, idx: number) => (
                  <div key={idx} className="rounded-lg bg-muted/40 border border-border/60 p-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-heading font-bold text-sm text-foreground">{loc.locationName}</h4>
                      <span className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        🎯 Within {loc.radiusKm || 10} km
                      </span>
                    </div>
                    {loc.formattedAddress && (
                      <p className="text-xs text-muted-foreground line-clamp-1">{loc.formattedAddress}</p>
                    )}
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                      <span>{[loc.district, loc.state].filter(Boolean).join(', ')}</span>
                      {loc.latitude && loc.longitude ? (
                        <span className="font-mono text-[10px]">
                          {Number(loc.latitude).toFixed(3)}°, {Number(loc.longitude).toFixed(3)}°
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">No preferred locations added yet.</p>
            )}
          </div>
        </div>
      </SectionWrapper>
    );
  }

  return null;
}

function SectionWrapper({
  title,
  onEdit,
  onBack,
  success,
  error,
  children,
}: {
  title: string;
  onEdit: () => void;
  onBack: () => void;
  success?: string | null;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="mb-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
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

      <header className="mb-6 flex flex-wrap items-center justify-between gap-5 rounded-xl border border-border bg-card p-6 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <UserRound className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm font-semibold text-primary">Teacher profile</p>
            <h1 className="mt-1 font-heading text-2xl font-bold sm:text-3xl">
              {title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review your saved information.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary px-3.5 py-2.5 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80 cursor-pointer"
        >
          <Edit3 className="h-4 w-4" />
          Edit
        </button>
      </header>

      <section className="rounded-xl border border-border bg-card p-5 shadow-lg sm:p-6">
        {children}
      </section>
    </main>
  );
}
