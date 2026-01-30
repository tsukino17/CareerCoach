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
        // If the paragraph contains lines starting with "- ", treat the whole thing as a list candidate
        if (paragraph.match(/^- /m)) {
            const lines = paragraph.split('\n');
            return (
                <ul key={pIndex} className="list-none space-y-2 my-2">
                    {lines.map((line, lIndex) => {
                         if (line.trim().startsWith('- ')) {
                             return (
                               <li key={lIndex} className="flex gap-2 items-start">
                                 <span className="text-primary mt-1.5 text-[0.6rem]">●</span>
                                 <span className="flex-1">{formatText(line.replace(/^- /, ''))}</span>
                               </li>
                             );
                         }
                         return <li key={lIndex} className="pl-5">{formatText(line)}</li>
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
