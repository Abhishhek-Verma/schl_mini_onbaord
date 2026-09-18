'use client';

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { fetchApi } from '@/lib/api';
import { TokenInspector } from '@/components/TokenInspector';
import { User, KeyRound, CheckCircle, AlertCircle, Edit3, ImagePlus, Trash2, X } from 'lucide-react';
import { ActiveSessions } from '@/components/ActiveSessions';

export default function ProfilePage() {
  const { user, accessToken, setAuth } = useAuthStore();

  // Password change state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Profile edit state
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setAvatar(user.avatar || '');
      setPhoneNumber(user.phoneNumber || '');
    }
  }, [user]);

  // Update Profile Details
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !user) return;

    setLoadingProfile(true);
    setProfileSuccess(null);
    setProfileError(null);

    try {
      const updatedUser = await fetchApi(
        '/auth/profile',
        {
          method: 'PATCH',
          body: JSON.stringify({
            displayName: displayName.trim(),
            avatar: avatar.trim() || null,
            phoneNumber: phoneNumber.trim() || null,
          }),
        },
        accessToken
      );

      setAuth(updatedUser, accessToken);
      setProfileSuccess('Profile details updated successfully!');
      setIsEditingProfile(false);
    } catch (err: any) {
      setProfileError(err.message || 'Failed to update profile');
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !accessToken) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setProfileError('Please choose a JPEG, PNG, WEBP, or GIF image.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setProfileError('Avatar image must be 5 MB or smaller.');
      return;
    }

    setUploadingAvatar(true);
    setProfileError(null);
    setProfileSuccess(null);

    try {
      const { uploadUrl, avatarUrl } = await fetchApi<{ uploadUrl: string; avatarUrl: string }>(
        '/auth/profile/avatar-upload',
        {
          method: 'POST',
          body: JSON.stringify({ contentType: file.type }),
        },
        accessToken
      );

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error('Avatar upload failed. Check the R2 bucket CORS settings.');
      }

      setAvatar(avatarUrl);
      setProfileSuccess('Avatar uploaded. Save your profile to keep it.');
    } catch (err: any) {
      setProfileError(err.message || 'Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const cancelProfileEdit = () => {
    if (!user) return;
    setDisplayName(user.displayName || '');
    setAvatar(user.avatar || '');
    setPhoneNumber(user.phoneNumber || '');
    setProfileError(null);
    setProfileSuccess(null);
    setIsEditingProfile(false);
  };

  // Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;

    setLoadingPassword(true);
    setPasswordSuccess(null);
    setPasswordError(null);

    try {
      const res = await fetchApi(
        '/auth/change-password',
        {
          method: 'POST',
          body: JSON.stringify({ oldPassword, newPassword }),
        },
        accessToken
      );
      setPasswordSuccess(res.message || 'Password changed successfully!');
      setOldPassword('');
      setNewPassword('');
      setIsEditingPassword(false);
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password');
    } finally {
      setLoadingPassword(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-card text-card-foreground border border-border rounded-xl text-center shadow-xl">
        <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="font-heading text-xl font-bold">Authentication Required</h3>
        <p className="text-muted-foreground text-sm mt-2">
          Please log in to view your user profile.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-6">
      {/* Profile Header Banner */}
      <div className="bg-card text-card-foreground border border-border rounded-xl p-6 mb-6 flex items-center justify-between flex-wrap gap-5 shadow-lg">
        <div className="flex items-center gap-5">
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.displayName || user.username}
              referrerPolicy="no-referrer"
              className="w-18 h-18 rounded-full object-cover border-2 border-primary shadow-md"
            />
          ) : (
            <div className="w-18 h-18 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold uppercase shadow-md">
              {user.displayName ? user.displayName[0] : user.username[0]}
            </div>
          )}
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-heading text-2xl font-bold">
                {user.displayName || user.username}
              </h2>
              <span
                className={`px-2.5 py-0.5 text-xs font-bold rounded-full uppercase tracking-wider ${
                  user.role === 'ADMIN'
                    ? 'bg-pink-500/15 text-pink-500 border border-pink-500/30'
                    : 'bg-cyan-500/15 text-cyan-500 border border-cyan-500/30'
                }`}
              >
                {user.role}
              </span>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              @{user.username} • {user.email}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* EDIT PROFILE DETAILS CARD */}
        <div className="bg-card text-card-foreground border border-border rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between gap-3 mb-5">
            <h3 className="font-heading text-lg font-bold flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-primary" /> Profile Details
            </h3>
            {!isEditingProfile && (
              <button
                type="button"
                onClick={() => setIsEditingProfile(true)}
                className="inline-flex items-center gap-2 py-2 px-3 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-semibold text-sm rounded-md border border-border cursor-pointer transition-colors"
              >
                <Edit3 className="w-4 h-4" /> Edit
              </button>
            )}
          </div>

          {!isEditingProfile && (
            <div className="flex flex-col gap-4 text-sm">
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">Display Name</p>
                <p className="px-3.5 py-2.5 bg-muted rounded-md">{user.displayName || 'Not set'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">Phone Number</p>
                <p className="px-3.5 py-2.5 bg-muted rounded-md">{user.phoneNumber || 'Not set'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">Avatar</p>
                <p className="px-3.5 py-2.5 bg-muted rounded-md truncate">{user.avatar || 'Default avatar'}</p>
              </div>
            </div>
          )}

          {profileSuccess && (
            <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-md p-3 text-sm mb-4 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" /> {profileSuccess}
            </div>
          )}

          {profileError && (
            <div className="bg-destructive/15 border border-destructive text-destructive rounded-md p-3 text-sm mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {profileError}
            </div>
          )}

          {isEditingProfile && <form onSubmit={handleUpdateProfile} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Display Name
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Aman Mittal"
                className="w-full px-3.5 py-2.5 bg-input border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Avatar Image
              </label>
              <div className="flex items-center gap-3 mb-3">
                {avatar ? (
                  <img
                    src={avatar}
                    alt="Avatar preview"
                    referrerPolicy="no-referrer"
                    className="w-14 h-14 rounded-full object-cover border-2 border-primary"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold uppercase">
                    {(displayName.trim().split(/\s+/)[0] || user.username).charAt(0)}
                  </div>
                )}
                <span className="text-xs text-muted-foreground">
                  {avatar ? 'Current avatar' : 'Initial avatar'}
                </span>
              </div>
              <div className="flex gap-2">
                <label className="inline-flex items-center justify-center gap-2 flex-1 py-2.5 px-4 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-semibold text-sm rounded-md border border-border cursor-pointer transition-colors">
                  <ImagePlus className="w-4 h-4" />
                  {uploadingAvatar ? 'Uploading...' : 'Choose Image'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleAvatarUpload}
                    disabled={uploadingAvatar}
                    className="sr-only"
                  />
                </label>
                {avatar && (
                  <button
                    type="button"
                    onClick={() => setAvatar('')}
                    disabled={uploadingAvatar}
                    className="inline-flex items-center justify-center gap-2 py-2.5 px-4 text-destructive hover:bg-destructive/10 font-semibold text-sm rounded-md border border-destructive/30 cursor-pointer transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" /> Remove
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Phone Number <span className="font-normal text-muted-foreground/70">(Optional)</span>
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="e.g. +919876543210"
                className="w-full px-3.5 py-2.5 bg-input border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loadingProfile || uploadingAvatar}
              className="w-full py-2.5 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm rounded-md border border-primary cursor-pointer transition-colors shadow-sm mt-2 disabled:opacity-50"
            >
              {loadingProfile ? 'Saving Changes...' : 'Save Profile Changes'}
            </button>
            <button
              type="button"
              onClick={cancelProfileEdit}
              disabled={loadingProfile || uploadingAvatar}
              className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-transparent hover:bg-secondary text-secondary-foreground font-semibold text-sm rounded-md border border-border cursor-pointer transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" /> Cancel
            </button>
          </form>}
        </div>

        {/* SECURITY & PASSWORD CARD */}
        <div className="bg-card text-card-foreground border border-border rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between gap-3 mb-5">
            <h3 className="font-heading text-lg font-bold flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-pink-500" /> Security & Password
            </h3>
            {!isEditingPassword && (
              <button
                type="button"
                onClick={() => setIsEditingPassword(true)}
                className="inline-flex items-center gap-2 py-2 px-3 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-semibold text-sm rounded-md border border-border cursor-pointer transition-colors"
              >
                <KeyRound className="w-4 h-4" /> Update Password
              </button>
            )}
          </div>

          {passwordSuccess && (
            <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-md p-3 text-sm mb-4 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" /> {passwordSuccess}
            </div>
          )}

          {passwordError && (
            <div className="bg-destructive/15 border border-destructive text-destructive rounded-md p-3 text-sm mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {passwordError}
            </div>
          )}

          {!isEditingPassword && !passwordSuccess && (
            <p className="text-sm text-muted-foreground">
              Your password is protected. Click Update Password to change it.
            </p>
          )}

          {isEditingPassword && <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Current Password <span className="font-normal text-muted-foreground/70">(leave blank if logged in via Google)</span>
              </label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2.5 bg-input border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                New Password
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2.5 bg-input border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loadingPassword}
              className="w-full py-2.5 px-4 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-semibold text-sm rounded-md border border-border cursor-pointer transition-colors shadow-sm mt-2 disabled:opacity-50"
            >
              {loadingPassword ? 'Updating Password...' : 'Update Password'}
            </button>
            <button
              type="button"
              onClick={() => {
                setOldPassword('');
                setNewPassword('');
                setPasswordError(null);
                setPasswordSuccess(null);
                setIsEditingPassword(false);
              }}
              disabled={loadingPassword}
              className="inline-flex items-center justify-center w-full py-2.5 px-4 bg-transparent hover:bg-secondary text-secondary-foreground font-semibold text-sm rounded-md border border-border cursor-pointer transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </form>}
        </div>
      </div>

      {/* ACTIVE SESSIONS SECTION */}
      <div className="mt-6">
        <ActiveSessions />
      </div>

      <TokenInspector />
    </div>
  );
}
