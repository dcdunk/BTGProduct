'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { ArrowUp, Square } from 'lucide-react';
import SkillPicker from './SkillPicker';
import ModelSelector from './ModelSelector';
import McpServerToggles from './McpServerToggles';
import type { McpServer } from '@/types';

interface MessageInputProps {
  onSend: (content: string) => void;
  isStreaming: boolean;
  onStop: () => void;
  agentName: string;
  agentId: string;
  onSkillSelect?: (skillSlug: string) => void;
  pendingSkillSlug?: string | null;
  onSkillSlugConsumed?: () => void;
  provider: string;
  model: string;
  onModelChange: (provider: string, model: string) => void;
  mcpServers: McpServer[];
  enabledMcpServerIds: string[];
  onMcpServerToggle: (ids: string[]) => void;
}

export default function MessageInput({ onSend, isStreaming, onStop, agentName, agentId, onSkillSelect, pendingSkillSlug, onSkillSlugConsumed, provider, model, onModelChange, mcpServers, enabledMcpServerIds, onMcpServerToggle }: MessageInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // When a skill is selected via the picker, prepend /skill {slug} to the textarea
  useEffect(() => {
    if (pendingSkillSlug) {
      setValue(prev => {
        // Remove any existing /skill prefix
        const cleaned = prev.replace(/^\/skill\s+\S+\s*/, '');
        return `/skill ${pendingSkillSlug} ${cleaned}`;
      });
      onSkillSlugConsumed?.();
      textareaRef.current?.focus();
    }
  }, [pendingSkillSlug, onSkillSlugConsumed]);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const lineHeight = 22;
    const maxHeight = lineHeight * 6;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }, []);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSkillSelect = (slug: string) => {
    setValue(prev => {
      const cleaned = prev.replace(/^\/skill\s+\S+\s*/, '');
      return `/skill ${slug} ${cleaned}`;
    });
    textareaRef.current?.focus();
    onSkillSelect?.(slug);
  };

  // Detect active skill command in the text
  const skillMatch = value.match(/^\/skill\s+(\S+)/);

  return (
    <div className="border-t border-subtle bg-base px-6 py-4">
      <div className="max-w-3xl mx-auto">
        {/* Active skill indicator */}
        {skillMatch && (
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan/15 text-cyan text-xs uppercase tracking-wider font-mono">
              Skill: {skillMatch[1]}
            </span>
            <button
              onClick={() => setValue(prev => prev.replace(/^\/skill\s+\S+\s*/, ''))}
              className="text-xs text-tertiary hover:text-secondary"
            >
              Remove
            </button>
          </div>
        )}

        <div className="flex items-end gap-2 bg-elevated border border-default rounded-lg px-3 py-2 focus-within:border-accent focus-within:shadow-glow-cyan-subtle transition-all">
          {/* Skills button */}
          <SkillPicker agentId={agentId} onSkillSelect={handleSkillSelect} />

          {/* Separator */}
          <div className="w-px h-5 bg-subtle self-center flex-shrink-0" />

          {/* Model selector */}
          <ModelSelector provider={provider} model={model} onChange={onModelChange} />

          {/* MCP server toggles */}
          <McpServerToggles servers={mcpServers} enabledIds={enabledMcpServerIds} onChange={onMcpServerToggle} />

          {/* Separator */}
          <div className="w-px h-5 bg-subtle self-center flex-shrink-0" />

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              adjustHeight();
            }}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${agentName}...`}
            rows={1}
            disabled={isStreaming}
            className="flex-1 bg-transparent text-primary text-sm resize-none outline-none placeholder:text-tertiary disabled:opacity-50"
            style={{ minHeight: '22px', maxHeight: `${22 * 6}px` }}
          />

          {/* Send / Stop button */}
          {isStreaming ? (
            <button
              onClick={onStop}
              className="p-1.5 rounded bg-magenta text-on-accent hover:brightness-110 transition-all"
              aria-label="Stop generating"
            >
              <Square size={16} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!value.trim()}
              className="p-1.5 rounded bg-cyan text-on-accent hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              aria-label="Send message"
            >
              <ArrowUp size={16} />
            </button>
          )}
        </div>
        <p className="text-xs text-tertiary mt-2 text-center">
          Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
