'use client';

import { useState } from 'react';
import { Check, Copy, Bookmark } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { parseTimestamp } from '@/lib/dates';
import MarkdownRenderer from './MarkdownRenderer';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
  isStreaming?: boolean;
  onSaveToScratchpad?: (content: string) => void;
}

export default function MessageBubble({ role, content, createdAt, isStreaming, onSaveToScratchpad }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const isUser = role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const timestamp = createdAt
    ? formatDistanceToNow(parseTimestamp(createdAt), { addSuffix: true })
    : null;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} group`}>
      <div
        className={`relative ${
          isUser
            ? 'bg-cyan-muted border border-accent rounded-[12px_12px_2px_12px] max-w-[75%]'
            : 'bg-elevated border border-subtle rounded-[12px_12px_12px_2px] max-w-[85%]'
        } px-4 py-3`}
      >
        {/* Content */}
        <div className="text-primary text-sm leading-relaxed">
          {isUser ? (
            <p className="whitespace-pre-wrap">{content}</p>
          ) : (
            <MarkdownRenderer content={content} />
          )}
          {isStreaming && (
            <span className="inline-block w-2 h-[18px] bg-cyan rounded-sm animate-pulse-glow ml-0.5 align-middle" />
          )}
        </div>

        {/* Hover actions (agent messages only) */}
        {!isUser && !isStreaming && content && (
          <div className="absolute -bottom-8 left-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="p-1 rounded text-tertiary hover:text-primary transition-colors"
              aria-label="Copy message"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
            <button
              onClick={() => {
                onSaveToScratchpad?.(content);
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
              }}
              className={`p-1 rounded transition-colors ${saved ? 'text-cyan' : 'text-tertiary hover:text-primary'}`}
              aria-label="Save to scratchpad"
            >
              <Bookmark size={14} fill={saved ? 'currentColor' : 'none'} />
            </button>
          </div>
        )}

        {/* Timestamp */}
        {timestamp && !isStreaming && (
          <div className={`text-xs text-tertiary mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${isUser ? 'text-right' : ''}`}>
            {timestamp}
          </div>
        )}
      </div>
    </div>
  );
}
