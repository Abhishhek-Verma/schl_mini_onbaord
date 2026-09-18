'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from 'next-themes';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Kbd } from '@/components/ui/kbd';
import { cn } from '@/lib/utils';

export function ThemeToggleButton({ className = '' }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(resolvedTheme === 'dark');
  }, [resolvedTheme]);

  const toggleTheme = useCallback(() => {
    const nextIsDark = !isDark;
    setIsDark(nextIsDark);

    const styleId = 'theme-transition-styles';
    let styleElement =
      typeof document !== 'undefined'
        ? (document.getElementById(styleId) as HTMLStyleElement)
        : null;
    if (!styleElement && typeof document !== 'undefined') {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }

    if (styleElement) {
      styleElement.textContent = `
        ::view-transition-group(root) {
          animation-duration: 1s;
          animation-timing-function: var(--expo-out, cubic-bezier(0.16, 1, 0.3, 1));
        }
        ::view-transition-new(root) {
          animation-name: reveal-light-top-right;
        }
        ::view-transition-old(root),
        .dark::view-transition-old(root) {
          animation: none;
          z-index: -1;
        }
        .dark::view-transition-new(root) {
          animation-name: reveal-dark-top-right;
        }
        @keyframes reveal-dark-top-right {
          from {
            clip-path: circle(0% at 100% 0%);
          }
          to {
            clip-path: circle(150% at 100% 0%);
          }
        }
        @keyframes reveal-light-top-right {
          from {
            clip-path: circle(0% at 100% 0%);
          }
          to {
            clip-path: circle(150% at 100% 0%);
          }
        }
      `;
    }

    const switchTheme = () => {
      setTheme(theme === 'light' ? 'dark' : 'light');
    };

    if (typeof document !== 'undefined' && document.startViewTransition) {
      document.startViewTransition(switchTheme);
    } else {
      switchTheme();
    }
  }, [isDark, theme, setTheme]);

  return (
    <button
      type="button"
      className={cn(
        'size-8 flex items-center justify-center cursor-pointer rounded-full bg-secondary hover:bg-secondary/80 p-1.5 transition-all duration-300 active:scale-95 text-foreground border border-border',
        className
      )}
      onClick={toggleTheme}
      aria-label="Toggle theme"
    >
      <span className="sr-only">Toggle theme</span>
      <svg viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5">
        <motion.g
          animate={{ rotate: isDark ? -180 : 0 }}
          transition={{ ease: 'easeInOut', duration: 0.5 }}
        >
          <path
            d="M120 67.5C149.25 67.5 172.5 90.75 172.5 120C172.5 149.25 149.25 172.5 120 172.5"
            fill="currentColor"
          />
          <path
            d="M120 67.5C90.75 67.5 67.5 90.75 67.5 120C67.5 149.25 90.75 172.5 120 172.5"
            fill="currentColor"
            opacity={0.5}
          />
        </motion.g>
        <motion.path
          animate={{ rotate: isDark ? 180 : 0 }}
          transition={{ ease: 'easeInOut', duration: 0.5 }}
          d="M120 3.75C55.5 3.75 3.75 55.5 3.75 120C3.75 184.5 55.5 236.25 120 236.25C184.5 236.25 236.25 184.5 236.25 120C236.25 55.5 184.5 3.75 120 3.75ZM120 214.5V172.5C90.75 172.5 67.5 149.25 67.5 120C67.5 90.75 90.75 67.5 120 67.5V25.5C172.5 25.5 214.5 67.5 214.5 120C214.5 172.5 172.5 214.5 120 214.5Z"
          fill="currentColor"
        />
      </svg>
    </button>
  );
}

export function Navbar() {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 sticky top-0 px-4 z-40">
      <div className="flex items-center gap-2 flex-1 max-w-md">
        <div className="relative w-full bg-accentw flex items-center">
          <Search className="absolute left-2.5 size-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            type="search"
            placeholder="Search documentation, users, models..."
            className="pl-8 pr-12 h-9 w-full bg-muted/50 focus:bg-background transition-colors"
          />
          <div className="absolute right-2.5 flex items-center gap-1 pointer-events-none">
            <Kbd>⌘ K</Kbd>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggleButton />
      </div>
    </header>
  );
}
