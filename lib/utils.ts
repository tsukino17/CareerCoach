import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function sanitizeResponseContent(data: any): any {
  if (typeof data === 'string') {
    // 1. Replace pairs of single quotes with Chinese double quotes
    let text = data.replace(/'([^']*)'/g, '“$1”');
    
    // 2. Add spaces around Chinese double quotes to prevent crowding
    // Add space before opening quote “ if it's not preceded by a space
    text = text.replace(/([^\s])“/g, '$1 “');
    
    // Add space after closing quote ” if it's not followed by a space or punctuation
    // Common Chinese punctuation: ，。、：；？！
    text = text.replace(/”([^\s，。、：；？！])/g, '” $1');
    
    return text;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeResponseContent(item));
  }

  if (typeof data === 'object' && data !== null) {
    const result: any = {};
    for (const key in data) {
      result[key] = sanitizeResponseContent(data[key]);
    }
    return result;
  }

  return data;
}

