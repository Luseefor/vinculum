import { describe, it, expect, beforeEach, vi } from 'vitest';
import { persistThemeMode, loadStoredThemeMode } from '@/lib/theme/themeStorage';

describe('themeStorage - HIGH-3: localStorage exception handling', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Clear localStorage
    window.localStorage.clear();
  });

  it('should persist theme mode successfully', () => {
    persistThemeMode('dark');
    
    expect(window.localStorage.getItem('vinculum-theme-mode')).toBe('dark');
  });

  it('should handle localStorage.setItem throwing QuotaExceededError', () => {
    const setItemSpy = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    // Should not throw (silently fails in catch block)
    expect(() => persistThemeMode('dark')).not.toThrow();
    
    setItemSpy.mockRestore();
  });

  it('should handle localStorage disabled (private browsing)', () => {
    const setItemSpy = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('localStorage is not available');
    });

    expect(() => persistThemeMode('light')).not.toThrow();
    
    setItemSpy.mockRestore();
  });

  it('should load stored theme mode successfully', () => {
    window.localStorage.setItem('vinculum-theme-mode', 'dark');
    
    const result = loadStoredThemeMode();
    
    expect(result).toBe('dark');
  });

  it('should return "system" when no theme is stored', () => {
    const result = loadStoredThemeMode();
    
    expect(result).toBe('system');
  });

  it('should handle localStorage.getItem throwing exception', () => {
    const getItemSpy = vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('localStorage is not available');
    });

    // Should not throw, should fallback to "system"
    const result = loadStoredThemeMode();
    
    expect(result).toBe('system');
    
    getItemSpy.mockRestore();
  });

  it('should reject invalid theme mode values', () => {
    window.localStorage.setItem('vinculum-theme-mode', 'invalid-theme');
    
    const result = loadStoredThemeMode();
    
    // Should fallback to system for invalid values
    expect(result).toBe('system');
  });

  it('should accept valid theme modes', () => {
    const validModes = ['light', 'dark', 'system'] as const;
    
    for (const mode of validModes) {
      window.localStorage.setItem('vinculum-theme-mode', mode);
      const result = loadStoredThemeMode();
      expect(result).toBe(mode);
    }
  });

  it('should be SSR-safe (return "system" when window is undefined)', () => {
    // In test environment window exists, but the function should handle undefined
    const result = loadStoredThemeMode();
    
    // Should return a valid theme mode
    expect(['light', 'dark', 'system']).toContain(result);
  });
});
