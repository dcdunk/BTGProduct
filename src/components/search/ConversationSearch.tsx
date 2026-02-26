'use client';

import { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

interface SearchResult {
  message_id: string;
  conversation_id: string;
  conversation_title: string | null;
  agent_id: string;
  agent_name: string;
  agent_slug: string;
  agent_emoji: string;
  role: string;
  content: string;
  created_at: string;
}

function getSnippet(content: string, query: string, maxLen = 200): string {
  const lower = content.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return content.slice(0, maxLen) + (content.length > maxLen ? '...' : '');

  const start = Math.max(0, idx - 80);
  const end = Math.min(content.length, idx + query.length + 80);
  let snippet = content.slice(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < content.length) snippet = snippet + '...';
  return snippet;
}

export default function ConversationSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/conversations/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
        setSearched(true);
      }
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const inputClasses = 'w-full bg-elevated border border-subtle rounded-lg px-4 py-3 pl-10 text-primary text-sm focus:border-cyan focus:outline-none focus:shadow-glow-cyan-subtle transition-all';

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-xl font-medium uppercase tracking-wider text-primary mb-6">
        Search Conversations
      </h1>

      {/* Search input */}
      <div className="relative mb-6">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className={inputClasses}
          placeholder="Search across all conversations..."
          autoFocus
        />
      </div>

      {/* Results */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-pulse text-tertiary text-sm uppercase tracking-wider">Searching...</div>
        </div>
      )}

      {!loading && !searched && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search size={48} className="text-tertiary mb-4 opacity-30" />
          <p className="text-secondary text-sm">
            Search across all your conversations
          </p>
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-secondary text-sm">
            No messages matching &quot;{query}&quot;
          </p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-3">
          {results.map(result => (
            <Link
              key={result.message_id}
              href={`/agents/${result.agent_slug}?conversationId=${result.conversation_id}`}
            >
              <div className="bg-elevated border border-subtle rounded-lg p-4 hover:border-cyan hover:shadow-glow-cyan-subtle transition-all cursor-pointer">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{result.agent_emoji}</span>
                  <span className="text-xs text-secondary uppercase tracking-wider font-mono">
                    {result.agent_name}
                  </span>
                  {result.conversation_title && (
                    <>
                      <span className="text-tertiary">·</span>
                      <span className="text-xs text-tertiary truncate">{result.conversation_title}</span>
                    </>
                  )}
                  <span className="ml-auto text-xs text-tertiary">
                    {formatDistanceToNow(new Date(result.created_at + 'Z'), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm text-primary leading-relaxed">
                  <span className="text-xs text-tertiary uppercase mr-1">
                    {result.role === 'user' ? 'You:' : 'Agent:'}
                  </span>
                  {getSnippet(result.content, query)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
