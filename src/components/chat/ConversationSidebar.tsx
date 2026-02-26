'use client';

import { Plus, Trash2, Download } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ConversationItem {
  id: string;
  title: string | null;
  updated_at: string;
}

interface ConversationSidebarProps {
  conversations: ConversationItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onExport?: (conversationId: string) => void;
}

export default function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onExport,
}: ConversationSidebarProps) {
  return (
    <div className="w-[260px] border-r border-subtle bg-base flex flex-col h-full">
      {/* New conversation button */}
      <div className="p-3">
        <button
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 bg-elevated border border-subtle px-4 py-2.5 rounded-lg text-xs font-medium uppercase tracking-wider text-primary hover:border-cyan hover:shadow-glow-cyan-subtle transition-all"
        >
          <Plus size={14} />
          New Conversation
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {conversations.length === 0 ? (
          <p className="text-tertiary text-xs text-center py-6 uppercase tracking-wider">
            No conversations yet
          </p>
        ) : (
          <div className="space-y-0.5">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={`group w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all ${
                  conv.id === activeId
                    ? 'bg-surface-active border-l-2 border-l-cyan text-primary'
                    : 'text-secondary hover:bg-surface-hover hover:text-primary'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="truncate text-xs">
                    {conv.title || 'New conversation'}
                  </span>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {onExport && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onExport(conv.id);
                        }}
                        className="p-0.5 rounded text-tertiary hover:text-cyan opacity-0 group-hover:opacity-100 transition-all"
                        aria-label="Export conversation"
                      >
                        <Download size={12} />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(conv.id);
                      }}
                      className="p-0.5 rounded text-tertiary hover:text-magenta opacity-0 group-hover:opacity-100 transition-all"
                      aria-label="Delete conversation"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <span className="text-xs text-tertiary">
                  {formatDistanceToNow(new Date(conv.updated_at + 'Z'), { addSuffix: true })}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
