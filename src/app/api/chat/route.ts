import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getAgentById,
  getConversationById,
  createConversation,
  createMessage,
  getMessagesByConversationId,
  touchConversation,
  updateConversationTitle,
  getApiKeyForProvider,
  getConversationMcpServers,
  getActiveMcpServers,
  setConversationMcpServers,
  updateConversationModel,
} from '@/lib/db';
import { getLLMProvider } from '@/lib/llm';
import { assembleSystemPrompt, parseSkillCommand } from '@/lib/llm/system-prompt';
import { sanitizeForLog } from '@/lib/sanitize';
import { getValidGoogleToken } from '@/lib/google-auth';
import { mcpManager } from '@/lib/mcp/client-manager';
import type { LLMMessage, LLMToolCall, LLMToolDefinition } from '@/lib/llm/provider';
import type { Agent, Conversation, Provider } from '@/types';
import { DEFAULT_PROVIDER, DEFAULT_MODEL, DEFAULT_TEMPERATURE } from '@/types';

const MAX_TOOL_ITERATIONS = 10;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const userId = (session.user as { id: string }).id;

  let body: { agentId: string; conversationId?: string; content: string; provider?: string; model?: string; mcpServerIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid request body', 400);
  }

  const { agentId, conversationId, content } = body;

  if (!agentId || !content?.trim()) {
    return errorResponse('agentId and content are required', 400);
  }

  // Validate agent
  const agent = getAgentById(agentId) as Agent | undefined;
  if (!agent) return errorResponse('Agent not found', 404);

  // Get or create conversation
  let conversation: Conversation;
  if (conversationId) {
    const existing = getConversationById(conversationId);
    if (!existing || existing.user_id !== userId) {
      return errorResponse('Conversation not found', 404);
    }
    conversation = existing;
  } else {
    const initProvider = body.provider || DEFAULT_PROVIDER;
    const initModel = body.model || DEFAULT_MODEL;
    conversation = createConversation(agentId, userId, initProvider, initModel);
    // Persist MCP server selections for new conversation
    if (body.mcpServerIds && body.mcpServerIds.length > 0) {
      setConversationMcpServers(conversation.id, body.mcpServerIds);
    }
  }

  // Resolve provider/model: request body > conversation > defaults
  const activeProvider = body.provider || conversation.provider || DEFAULT_PROVIDER;
  const activeModel = body.model || conversation.model || DEFAULT_MODEL;

  // Update conversation model if changed
  if (body.provider && body.model && (body.provider !== conversation.provider || body.model !== conversation.model)) {
    updateConversationModel(conversation.id, body.provider, body.model);
  }

  // Update MCP servers if provided on existing conversation
  if (conversationId && body.mcpServerIds) {
    setConversationMcpServers(conversation.id, body.mcpServerIds);
  }

  // Resolve authentication: try OAuth token for Google, then API key
  let oauthToken: string | undefined;
  if (activeProvider === 'google') {
    oauthToken = await getValidGoogleToken(userId) ?? undefined;
  }
  const apiKey = getApiKeyForProvider(activeProvider);
  if (!apiKey && !oauthToken) {
    return errorResponse(`No API key configured for ${activeProvider}. Add one in Settings or set the environment variable.`, 400);
  }

  // Parse /skill command
  const { cleanContent, skillSlug } = parseSkillCommand(content.trim());

  // Save user message
  createMessage({
    conversationId: conversation.id,
    role: 'user',
    content: cleanContent,
  });

  // Auto-generate title on first message
  const existingMessages = getMessagesByConversationId(conversation.id);
  if (existingMessages.length === 1) {
    updateConversationTitle(conversation.id, generateTitle(cleanContent));
  }

  // Assemble system prompt (fresh every time)
  const systemPrompt = assembleSystemPrompt({
    agent,
    activeTemplateId: conversation.active_template_id,
    onDemandSkillSlug: skillSlug,
  });

  // Build message history for LLM
  const allMessages = getMessagesByConversationId(conversation.id);
  const llmMessages: LLMMessage[] = allMessages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  // Get MCP tools for this conversation
  const mcpServers = getConversationMcpServers(conversation.id);
  let tools: LLMToolDefinition[] = [];
  if (mcpServers.length > 0) {
    try {
      const mcpTools = await mcpManager.getToolsForAgent(mcpServers, userId);
      tools = mcpTools.map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }));
    } catch (err) {
      console.error('Failed to load MCP tools:', err instanceof Error ? err.message : err);
    }
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const provider = getLLMProvider(activeProvider as Provider);
        let fullContent = '';
        let totalTokensIn = 0;
        let totalTokensOut = 0;

        // Tool execution loop
        for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
          if (request.signal.aborted) break;

          const result = await provider.createStream({
            model: activeModel,
            messages: llmMessages,
            systemPrompt,
            temperature: DEFAULT_TEMPERATURE,
            apiKey: apiKey ?? '',
            oauthToken,
            ...(tools.length > 0 ? { tools } : {}),
          });

          // Collect stream events
          const pendingToolCalls: LLMToolCall[] = [];
          let iterationText = '';

          for await (const event of result.stream) {
            if (request.signal.aborted) break;

            if (event.type === 'text') {
              iterationText += event.content;
              fullContent += event.content;
              send({ type: 'chunk', content: event.content });
            } else if (event.type === 'tool_call') {
              pendingToolCalls.push(event.toolCall);
            }
          }

          const usage = result.getUsage();
          totalTokensIn += usage.tokensIn;
          totalTokensOut += usage.tokensOut;

          // If no tool calls, we're done
          if (pendingToolCalls.length === 0) break;

          // Add assistant message with tool calls to history
          llmMessages.push({
            role: 'assistant',
            content: iterationText,
            toolCalls: pendingToolCalls,
          });

          // Execute each tool call
          for (const tc of pendingToolCalls) {
            send({ type: 'tool_start', name: tc.name, arguments: tc.arguments });

            const serverId = mcpManager.findServerForTool(tc.name);
            let toolResult: { content: string; isError: boolean };

            if (serverId) {
              toolResult = await mcpManager.callTool(serverId, tc.name, tc.arguments);
            } else {
              toolResult = { content: `Tool "${tc.name}" not found on any connected MCP server`, isError: true };
            }

            send({ type: 'tool_result', name: tc.name, result: toolResult.content, isError: toolResult.isError });

            // Add tool result to message history for next LLM iteration
            llmMessages.push({
              role: 'tool_result',
              content: toolResult.content,
              toolCallId: tc.id,
            });
          }

          // Loop continues — LLM will process tool results
        }

        if (request.signal.aborted) {
          // Save partial response on abort
          if (fullContent) {
            createMessage({
              conversationId: conversation.id,
              role: 'assistant',
              content: fullContent,
              provider: activeProvider,
              model: activeModel,
            });
            touchConversation(conversation.id);
          }
          controller.close();
          return;
        }

        // Save assistant message
        createMessage({
          conversationId: conversation.id,
          role: 'assistant',
          content: fullContent,
          provider: agent.provider,
          model: agent.model,
          tokens_in: totalTokensIn,
          tokens_out: totalTokensOut,
        });

        touchConversation(conversation.id);

        // Send done event
        send({
          type: 'done',
          conversationId: conversation.id,
          tokens_in: totalTokensIn,
          tokens_out: totalTokensOut,
        });

        controller.close();
      } catch (err) {
        const message = sanitizeForLog(
          err instanceof Error ? err.message : 'An error occurred'
        );
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', message })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

function generateTitle(content: string): string {
  if (content.length <= 60) return content;
  const trimmed = content.slice(0, 60).replace(/\s+\S*$/, '');
  return (trimmed || content.slice(0, 60)) + '...';
}

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
