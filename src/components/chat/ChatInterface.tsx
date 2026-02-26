'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ConversationSidebar from './ConversationSidebar';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import TemplatePicker from './TemplatePicker';
import type { ActiveToolCall } from './ToolCallDisplay';
import type { Agent, Message, McpServer } from '@/types';
import { DEFAULT_PROVIDER, DEFAULT_MODEL } from '@/types';

interface ConversationItem {
  id: string;
  title: string | null;
  updated_at: string;
}

export default function ChatInterface({ agent }: { agent: Agent }) {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [skillSlug, setSkillSlug] = useState<string | null>(null);
  const [activeTools, setActiveTools] = useState<ActiveToolCall[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>(DEFAULT_PROVIDER);
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL);
  const [allMcpServers, setAllMcpServers] = useState<McpServer[]>([]);
  const [enabledMcpServerIds, setEnabledMcpServerIds] = useState<string[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const searchParams = useSearchParams();
  const initialConversationId = useRef(searchParams.get('conversationId'));

  // Fetch conversations and active MCP servers on mount
  useEffect(() => {
    fetchConversations().then(() => {
      // Deep-link from search results
      if (initialConversationId.current) {
        setActiveConversationId(initialConversationId.current);
        initialConversationId.current = null;
      }
    });
    fetch('/api/mcp-servers/active')
      .then(r => r.json())
      .then((data: McpServer[]) => setAllMcpServers(data))
      .catch(() => {});
  }, [agent.id]);

  const fetchConversations = async () => {
    try {
      const res = await fetch(`/api/conversations?agentId=${agent.id}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch {
      // Silently fail — sidebar just stays empty
    }
  };

  // Load messages and conversation settings when switching conversations
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      setSelectedProvider(DEFAULT_PROVIDER);
      setSelectedModel(DEFAULT_MODEL);
      setEnabledMcpServerIds([]);
      return;
    }
    // Load conversation data (messages + provider/model)
    fetch(`/api/conversations/${activeConversationId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        setMessages(data.messages || []);
        if (data.conversation?.provider) setSelectedProvider(data.conversation.provider);
        if (data.conversation?.model) setSelectedModel(data.conversation.model);
      })
      .catch(() => {});
    // Load conversation's MCP server selections
    fetch(`/api/conversations/${activeConversationId}/mcp-servers`)
      .then(r => r.json())
      .then((servers: McpServer[]) => setEnabledMcpServerIds(servers.map(s => s.id)))
      .catch(() => {});
  }, [activeConversationId]);

  const handleSend = useCallback(async (content: string) => {
    setError(null);
    setIsStreaming(true);
    setStreamingContent('');
    setActiveTools([]);

    // Optimistically add user message to UI
    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: activeConversationId || '',
      role: 'user',
      content,
      provider: null,
      model: null,
      tokens_in: null,
      tokens_out: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agent.id,
          conversationId: activeConversationId || undefined,
          content,
          provider: selectedProvider,
          model: selectedModel,
          mcpServerIds: enabledMcpServerIds,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';
      let newConversationId: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'chunk') {
              fullContent += data.content;
              setStreamingContent(fullContent);
            } else if (data.type === 'tool_start') {
              setActiveTools(prev => [...prev, {
                name: data.name,
                arguments: data.arguments || {},
                status: 'running',
              }]);
            } else if (data.type === 'tool_result') {
              setActiveTools(prev =>
                prev.map(t =>
                  t.name === data.name && t.status === 'running'
                    ? { ...t, status: data.isError ? 'error' : 'done', result: data.result }
                    : t
                )
              );
            } else if (data.type === 'done') {
              newConversationId = data.conversationId;
            } else if (data.type === 'error') {
              setError(data.message);
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }

      // Finalize
      if (fullContent) {
        const assistantMsg: Message = {
          id: `temp-assistant-${Date.now()}`,
          conversation_id: newConversationId || activeConversationId || '',
          role: 'assistant',
          content: fullContent,
          provider: selectedProvider,
          model: selectedModel,
          tokens_in: null,
          tokens_out: null,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }

      // Update conversation ID if new
      if (newConversationId && !activeConversationId) {
        setActiveConversationId(newConversationId);
      }

      // Refresh conversation list
      await fetchConversations();
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError((err as Error).message || 'An error occurred');
      }
    } finally {
      setIsStreaming(false);
      setStreamingContent(null);
      abortControllerRef.current = null;
    }
  }, [activeConversationId, agent.id, selectedProvider, selectedModel, enabledMcpServerIds]);

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const handleNewConversation = useCallback(() => {
    setActiveConversationId(null);
    setMessages([]);
    setError(null);
    setActiveTemplateId(null);
    setSelectedProvider(DEFAULT_PROVIDER);
    setSelectedModel(DEFAULT_MODEL);
    setEnabledMcpServerIds([]);
  }, []);

  const handleSkillSelect = useCallback((slug: string) => {
    setSkillSlug(slug);
  }, []);

  const handleSelectConversation = useCallback((id: string) => {
    if (isStreaming) return;
    setActiveConversationId(id);
    setError(null);
  }, [isStreaming]);

  const handleSaveToScratchpad = useCallback(async (content: string) => {
    try {
      const title = content.slice(0, 60).replace(/\n/g, ' ').trim() + (content.length > 60 ? '...' : '');
      await fetch('/api/scratchpad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          sourceAgentId: agent.id,
          sourceConversationId: activeConversationId,
        }),
      });
    } catch {
      // Silently fail — the bookmark icon feedback is enough
    }
  }, [agent.id, activeConversationId]);

  const handleDeleteConversation = useCallback(async (id: string) => {
    if (isStreaming) return;
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (activeConversationId === id) {
          setActiveConversationId(null);
          setMessages([]);
        }
        await fetchConversations();
      }
    } catch {
      // Silently fail
    }
  }, [activeConversationId, isStreaming]);

  const handleExportConversation = useCallback((id: string) => {
    window.open(`/api/conversations/${id}/export?format=markdown`, '_blank');
  }, []);

  return (
    <div className="flex h-screen">
      {/* Conversation sidebar */}
      <ConversationSidebar
        conversations={conversations}
        activeId={activeConversationId}
        onSelect={handleSelectConversation}
        onNew={handleNewConversation}
        onDelete={handleDeleteConversation}
        onExport={handleExportConversation}
      />

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Agent header */}
        <div className="border-b border-subtle bg-base px-6 py-3 flex items-center gap-3">
          <span className="text-2xl">{agent.avatar_emoji}</span>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-sm font-medium uppercase tracking-wider text-primary truncate">
              {agent.name}
            </h2>
            {agent.description && (
              <p className="text-xs text-tertiary truncate">{agent.description}</p>
            )}
          </div>
          <TemplatePicker
            agentId={agent.id}
            activeTemplateId={activeTemplateId}
            conversationId={activeConversationId}
            onTemplateChange={setActiveTemplateId}
          />
        </div>

        {/* Error banner */}
        {error && (
          <div className="bg-magenta-muted border-b border-magenta/30 px-6 py-2">
            <p className="text-sm text-primary">{error}</p>
          </div>
        )}

        {/* Messages */}
        <MessageList
          messages={messages}
          streamingContent={streamingContent}
          isStreaming={isStreaming}
          activeTools={activeTools}
          onSaveToScratchpad={handleSaveToScratchpad}
        />

        {/* Input */}
        <MessageInput
          onSend={handleSend}
          isStreaming={isStreaming}
          onStop={handleStop}
          agentName={agent.name}
          agentId={agent.id}
          onSkillSelect={handleSkillSelect}
          pendingSkillSlug={skillSlug}
          onSkillSlugConsumed={() => setSkillSlug(null)}
          provider={selectedProvider}
          model={selectedModel}
          onModelChange={(p, m) => { setSelectedProvider(p); setSelectedModel(m); }}
          mcpServers={allMcpServers}
          enabledMcpServerIds={enabledMcpServerIds}
          onMcpServerToggle={setEnabledMcpServerIds}
        />
      </div>
    </div>
  );
}
