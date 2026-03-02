// dashboard/lib/contexts/FilterContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { FilterSettings, FilterCondition, defaultFilterSettings } from '../types/filter';

function isDuplicateCondition(existing: FilterCondition, candidate: FilterCondition): boolean {
  return (
    existing.field === candidate.field &&
    existing.operator === candidate.operator &&
    existing.type === candidate.type &&
    (existing.mode || 'exclude') === (candidate.mode || 'exclude') &&
    existing.value.toLowerCase() === candidate.value.toLowerCase()
  );
}

function dedupeConditions(conditions: FilterCondition[]): FilterCondition[] {
  const result: FilterCondition[] = [];
  for (const condition of conditions) {
    if (!result.some((c) => isDuplicateCondition(c, condition))) {
      result.push(condition);
    }
  }
  return result;
}

interface FilterContextType {
  settings: FilterSettings;
  updateSettings: (settings: Partial<FilterSettings>) => void;
  resetSettings: () => void;
  addCustomCondition: (condition: FilterCondition) => void;
  removeCustomCondition: (id: string) => void;
  updateCustomCondition: (id: string, condition: Partial<FilterCondition>) => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

const STORAGE_KEY = 'traefik-filter-settings';

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<FilterSettings>(defaultFilterSettings);

  // Load settings from localStorage on mount
  // BEST PRACTICE FIX: Wrap localStorage operations in try-catch for private browsing mode
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setSettings({ ...defaultFilterSettings, ...parsed });
        } catch (e) {
          console.error('Failed to parse filter settings:', e);
          // Clear corrupted data
          try {
            localStorage.removeItem(STORAGE_KEY);
          } catch {
            // Ignore removal errors
          }
        }
      }
    } catch (error) {
      // localStorage not available (private browsing, quota exceeded, etc.)
      console.warn('localStorage not available, using default filter settings:', error);
      // Continue with default settings
    }
  }, []);

  // Save settings to localStorage whenever they change
  // BEST PRACTICE FIX: Wrap localStorage operations in try-catch
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      // Handle quota exceeded or private browsing mode
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded, cannot save filter settings');
      } else {
        console.warn('Failed to save filter settings to localStorage:', error);
      }
      // Continue without saving - settings will persist in memory for this session
    }
  }, [settings]);

  // PERFORMANCE FIX: Memoize callback functions to prevent unnecessary re-renders
  const updateSettings = useCallback((newSettings: Partial<FilterSettings>) => {
    setSettings((prev) => {
      // If new settings explicitly provide arrays, use them directly (for removals)
      // Otherwise, merge arrays (for additions)
      const mergedExcludedIPs = newSettings.excludedIPs !== undefined
        ? newSettings.excludedIPs
        : prev.excludedIPs;

      const mergedExcludePaths = newSettings.excludePaths !== undefined
        ? newSettings.excludePaths
        : prev.excludePaths;

      const mergedStatusCodes = newSettings.excludeStatusCodes !== undefined
        ? newSettings.excludeStatusCodes
        : prev.excludeStatusCodes;

      const mergedProxySettings = newSettings.proxySettings
        ? {
            ...prev.proxySettings,
            ...newSettings.proxySettings,
            customHeaders: newSettings.proxySettings.customHeaders !== undefined
              ? newSettings.proxySettings.customHeaders
              : prev.proxySettings.customHeaders,
          }
        : prev.proxySettings;

      const mergedCustomConditions = newSettings.customConditions !== undefined
        ? newSettings.customConditions
        : prev.customConditions;

      return {
        ...prev,
        ...newSettings,
        excludedIPs: mergedExcludedIPs,
        excludePaths: mergedExcludePaths,
        excludeStatusCodes: mergedStatusCodes,
        proxySettings: mergedProxySettings,
        customConditions: mergedCustomConditions,
      };
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(defaultFilterSettings);
    // BEST PRACTICE FIX: Wrap localStorage operations in try-catch
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to remove filter settings from localStorage:', error);
      // Continue - settings are reset in state anyway
    }
  }, []);

  const addCustomCondition = useCallback((condition: FilterCondition) => {
    setSettings((prev) => {
      if (prev.customConditions.some((existing) => isDuplicateCondition(existing, condition))) {
        return prev;
      }

      return {
        ...prev,
        customConditions: [...prev.customConditions, condition],
      };
    });
  }, []);

  const removeCustomCondition = useCallback((id: string) => {
    setSettings((prev) => ({
      ...prev,
      customConditions: prev.customConditions.filter((c) => c.id !== id),
    }));
  }, []);

  const updateCustomCondition = useCallback((id: string, updates: Partial<FilterCondition>) => {
    setSettings((prev) => {
      const updated = prev.customConditions.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      );

      return {
        ...prev,
        customConditions: dedupeConditions(updated),
      };
    });
  }, []);

  // PERFORMANCE FIX: Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      settings,
      updateSettings,
      resetSettings,
      addCustomCondition,
      removeCustomCondition,
      updateCustomCondition,
    }),
    [settings, updateSettings, resetSettings, addCustomCondition, removeCustomCondition, updateCustomCondition]
  );

  return (
    <FilterContext.Provider value={contextValue}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
}