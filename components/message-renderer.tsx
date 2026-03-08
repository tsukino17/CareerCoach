import React from 'react';
import { cn } from '@/lib/utils';

interface MessageRendererProps {
  content: string;
  role: string;
}

export function MessageRenderer({ content, role }: MessageRendererProps) {
  // Split by double newline to get paragraphs
  const paragraphs = content.split(/\n\n+/);

  return (
    <div className={cn("space-y-4 text-sm md:text-base", role === 'assistant' ? "text-left" : "text-left")}>
      {paragraphs.map((paragraph, pIndex) => {
        // Check for blockquote
        if (paragraph.trim().startsWith('>')) {
          const quoteContent = paragraph.split('\n').map(line => line.replace(/^>\s?/, '')).join('\n');
          return (
            <blockquote key={pIndex} className="border-l-4 border-primary/50 bg-primary/5 pl-4 py-2 pr-2 rounded-r-lg italic text-muted-foreground my-2">
              {formatText(quoteContent)}
            </blockquote>
          );
        }

        // Check for bullet list
        // If the paragraph contains lines starting with "-", "*", "•", "🔹", "🔷", "🔸", "🔶", treat as list
        // Also support numbered lists roughly (though we render them as bullets for now to match the design request)
        const listMatchRegex = /^(\s*[-*•🔹🔷🔸🔶]|\d+\.)\s/;
        
        const lines = paragraph.split('\n');
        if (lines.some(line => listMatchRegex.test(line.trim()))) {
            return (
                <ul key={pIndex} className="list-none space-y-2 my-3">
                    {lines.map((line, lIndex) => {
                         const trimmedLine = line.trim();
                         const match = trimmedLine.match(listMatchRegex);
                         
                         if (match) {
                             const content = trimmedLine.substring(match[0].length);
                             return (
                               <li key={lIndex} className="flex gap-3 items-start group">
                                 <span className="flex h-[1.625rem] items-center shrink-0 mt-0.5">
                                    <span className="w-1.5 h-1.5 bg-primary/80 rounded-full group-hover:scale-125 transition-transform duration-300" />
                                 </span>
                                 <span className="flex-1 leading-relaxed text-foreground/90">
                                    {formatText(content)}
                                 </span>
                               </li>
                             );
                         }
                         // Handle lines that are part of the list but don't start with a bullet (continuation)
                         // Only if it's not an empty line
                         if (trimmedLine) {
                            return (
                                <li key={lIndex} className="pl-5 leading-relaxed text-foreground/90 opacity-80">
                                    {formatText(line)}
                                </li>
                            );
                         }
                         return null;
                    })}
                </ul>
            )
        }

        return <p key={pIndex} className="leading-7 tracking-wide">{formatText(paragraph)}</p>;
      })}
    </div>
  );
}

function formatText(text: string) {
  // Split by bold markers (**text**)
  // Also handle single newlines within a paragraph as line breaks if needed, 
  // but standard markdown ignores single newlines. 
  // However, in chat, single newlines are often intentional. 
  // Let's replace single \n with <br/> for better readability in chat context.
  
  const lines = text.split('\n');
  
  return lines.map((line, lineIndex) => {
      const parts = line.split(/(\*\*.*?\*\*)/g);
      const formattedLine = parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={index} className="font-bold text-primary">{part.slice(2, -2)}</strong>;
        }
        return part;
      });

      return (
        <React.Fragment key={lineIndex}>
          {formattedLine}
          {lineIndex < lines.length - 1 && <br />}
        </React.Fragment>
      );
  });
}
