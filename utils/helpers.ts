/**
 * AuthorForge Utilities - Critical Improvements
 * 
 * This file contains utility functions that address:
 * 1. Data compression for localStorage
 * 2. Input validation
 * 3. Retry logic with exponential backoff
 * 4. Debounce helpers
 * 5. Error handling utilities
 */

import pako from 'pako';

// ===== COMPRESSION UTILITIES =====

/**
 * Compress string data using gzip
 * Critical for large chapter content in localStorage
 */
export function compressString(str: string): string {
  try {
    const compressed = pako.deflate(str);
    return btoa(String.fromCharCode(...Array.from(compressed)));
  } catch (error) {
    console.error('Compression failed:', error);
    return str; // Fallback to uncompressed
  }
}

/**
 * Decompress gzip data
 */
export function decompressString(compressed: string): string {
  try {
    const binaryString = atob(compressed);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const decompressed = pako.inflate(bytes, { to: 'string' });
    return decompressed;
  } catch (error) {
    console.error('Decompression failed:', error);
    return compressed; // Fallback to original
  }
}

/**
 * Check if string is compressed
 */
export function isCompressed(str: string): boolean {
  // Simple heuristic: compressed strings are base64
  return /^[A-Za-z0-9+/]+=*$/.test(str);
}

// ===== INPUT VALIDATION =====

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateChapterTitle(title: string): string {
  if (!title || title.trim().length === 0) {
    throw new ValidationError('Chapter title cannot be empty');
  }
  if (title.length > 200) {
    throw new ValidationError('Chapter title too long (max 200 characters)');
  }
  return title.trim();
}

export function validateCharacterName(name: string): string {
  if (!name || name.trim().length === 0) {
    throw new ValidationError('Character name cannot be empty');
  }
  if (name.length > 100) {
    throw new ValidationError('Character name too long (max 100 characters)');
  }
  return name.trim();
}

export function validateApiKey(key: string): string {
  if (!key || key.trim().length === 0) {
    throw new ValidationError('API key cannot be empty');
  }
  if (key.length < 10) {
    throw new ValidationError('API key appears invalid');
  }
  return key.trim();
}

// ===== RETRY LOGIC WITH EXPONENTIAL BACKOFF =====

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  shouldRetry?: (error: any) => boolean;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    shouldRetry = (error) => {
      // Retry on rate limits or network errors
      return (
        error?.message?.includes('429') ||
        error?.message?.toLowerCase().includes('rate limit') ||
        error?.message?.toLowerCase().includes('network')
      );
    },
  } = options;

  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries - 1 && shouldRetry(error)) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        console.log(`Retry attempt ${attempt + 1} after ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }

  throw lastError;
}

// ===== DEBOUNCE UTILITY =====

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}

// ===== ABORT CONTROLLER UTILITIES =====

export function createAbortController(): AbortController {
  return new AbortController();
}

export function checkAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error('Operation cancelled');
  }
}

// ===== ERROR HANDLING =====

export function handleError(error: any, context?: string): string {
  console.error(`Error in ${context || 'unknown'}:`, error);

  if (error instanceof ValidationError) {
    return error.message;
  }

  if (error?.message?.includes('429')) {
    return 'Rate limit exceeded. Please wait a moment and try again.';
  }

  if (error?.message?.toLowerCase().includes('network')) {
    return 'Network error. Please check your connection.';
  }

  if (error?.message?.toLowerCase().includes('api key')) {
    return 'Invalid API key. Please check your settings.';
  }

  return error?.message || 'An unexpected error occurred';
}

// ===== LOCALSTORAGE SIZE CHECK =====

export function getLocalStorageSize(): number {
  let total = 0;
  for (const key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      total += localStorage[key].length + key.length;
    }
  }
  return total;
}

export function getLocalStorageSizeMB(): number {
  return getLocalStorageSize() / (1024 * 1024);
}

export function isLocalStorageNearLimit(thresholdMB: number = 4): boolean {
  return getLocalStorageSizeMB() > thresholdMB;
}

// ===== SAFE JSON PARSING =====

export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch (error) {
    console.error('JSON parse error:', error);
    return fallback;
  }
}

// ===== THROTTLE UTILITY =====

export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
