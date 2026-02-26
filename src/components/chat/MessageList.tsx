'use client';

import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import ToolCallDisplay from './ToolCallDisplay';
import type { ActiveToolCall } from './ToolCallDisplay';
import type { Message } from '@/types';

interface MessageListProps {
  messages: Message[];
  streamingContent: string | null;
  isStreaming: boolean;
  activeTools?: ActiveToolCall[];
  onSaveToScratchpad?: (content: string) => void;
}

export default function MessageList({ messages, streamingContent, isStreaming, activeTools, onSaveToScratchpad }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isNearBottom = () => {
    const container = containerRef.current;
    if (!container) return true;
    return container.scrollHeight - container.scrollTop - container.clientHeight < 100;
  };

  useEffect(() => {
    if (isNearBottom()) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingContent]);

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-tertiary text-sm uppercase tracking-wider">
          Start a conversation
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-6 py-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            role={msg.role as 'user' | 'assistant'}
            content={msg.content}
            createdAt={msg.created_at}
            onSaveToScratchpad={msg.role === 'assistant' ? onSaveToScratchpad : undefined}
          />
        ))}
        {isStreaming && activeTools && activeTools.length > 0 && (
          <ToolCallDisplay tools={activeTools} />
        )}
        {isStreaming && streamingContent !== null && (
          <MessageBubble
            role="assistant"
            content={streamingContent}
            isStreaming
          />
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
