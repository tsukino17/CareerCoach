import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function sanitizeResponseContent<T>(data: T): T {
  if (typeof data === 'string') {
    // 1. Replace pairs of single quotes with Chinese double quotes
    let text = data.replace(/'([^']*)'/g, '“$1”');
    
    // 2. Add spaces around Chinese double quotes to prevent crowding
    // Add space before opening quote “ if it's not preceded by a space
    text = text.replace(/([^\s])“/g, '$1 “');
    
    // Add space after closing quote ” if it's not followed by a space or punctuation
    // Common Chinese punctuation: ，。、：；？！
    text = text.replace(/”([^\s，。、：；？！])/g, '” $1');
    
    return text as unknown as T;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeResponseContent(item)) as unknown as T;
  }

  if (typeof data === 'object' && data !== null) {
    const input = data as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      result[key] = sanitizeResponseContent(value);
    }
    return result as unknown as T;
  }

  return data;
}
