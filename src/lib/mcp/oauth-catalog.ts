export interface McpServerTemplate {
  name: string;
  slug: string;
  description: string;
  icon: string;
  url: string;
  transport_type: 'streamable_http';
  auth_type: 'oauth';
  oauth_scopes?: string;
  requiresClientRegistration: boolean;
  registrationInstructions?: string;
  docsUrl?: string;
}

export const MCP_OAUTH_CATALOG: McpServerTemplate[] = [
  {
    name: 'Linear',
    slug: 'linear',
    description: 'Issue tracking, project management, and team workflows',
    icon: '📐',
    url: 'https://mcp.linear.app/sse',
    transport_type: 'streamable_http',
    auth_type: 'oauth',
    oauth_scopes: 'read write',
    requiresClientRegistration: false,
    docsUrl: 'https://linear.app/docs/mcp',
  },
  {
    name: 'Notion',
    slug: 'notion',
    description: 'Workspace docs, databases, and knowledge management',
    icon: '📝',
    url: 'https://mcp.notion.com/mcp',
    transport_type: 'streamable_http',
    auth_type: 'oauth',
    requiresClientRegistration: false,
    docsUrl: 'https://developers.notion.com/docs/mcp',
  },
  {
    name: 'Fireflies',
    slug: 'fireflies',
    description: 'Meeting transcripts, notes, and action items',
    icon: '🔥',
    url: 'https://api.fireflies.ai/mcp',
    transport_type: 'streamable_http',
    auth_type: 'oauth',
    requiresClientRegistration: false,
    docsUrl: 'https://docs.fireflies.ai/getting-started/mcp-configuration',
  },
  {
    name: 'GitHub',
    slug: 'github',
    description: 'Repositories, issues, pull requests, and code search',
    icon: '🐙',
    url: 'https://api.githubcopilot.com/mcp/',
    transport_type: 'streamable_http',
    auth_type: 'oauth',
    requiresClientRegistration: true,
    registrationInstructions: 'Create a GitHub App at github.com/settings/apps with OAuth enabled. Set the callback URL to your app\'s /api/mcp-servers/oauth/callback endpoint.',
    docsUrl: 'https://github.com/github/github-mcp-server',
  },
  {
    name: 'Atlassian',
    slug: 'atlassian',
    description: 'Confluence pages, Jira issues, and team collaboration via Rovo',
    icon: '🔷',
    url: 'https://mcp.atlassian.com/v1/mcp',
    transport_type: 'streamable_http',
    auth_type: 'oauth',
    requiresClientRegistration: true,
    registrationInstructions: 'Register an OAuth 2.0 app at developer.atlassian.com. Set callback URL to your app\'s /api/mcp-servers/oauth/callback endpoint.',
    docsUrl: 'https://support.atlassian.com/atlassian-rovo-mcp-server/',
  },
  {
    name: 'Box',
    slug: 'box',
    description: 'Cloud content management, file search, and collaboration',
    icon: '📦',
    url: 'https://mcp.box.com',
    transport_type: 'streamable_http',
    auth_type: 'oauth',
    requiresClientRegistration: true,
    registrationInstructions: 'Create an app at app.box.com/developers. Configure OAuth 2.0 with callback URL pointing to your app\'s /api/mcp-servers/oauth/callback endpoint.',
    docsUrl: 'https://developer.box.com/guides/box-mcp/remote',
  },
  {
    name: 'Figma',
    slug: 'figma',
    description: 'Design files, components, and design system access',
    icon: '🎨',
    url: 'https://mcp.figma.com',
    transport_type: 'streamable_http',
    auth_type: 'oauth',
    requiresClientRegistration: true,
    registrationInstructions: 'Requires Figma Organization plan. Register at figma.com/developers. OAuth client registration is restricted to approved MCP clients.',
    docsUrl: 'https://developers.figma.com/docs/figma-mcp-server/',
  },
  {
    name: 'Google Workspace',
    slug: 'google-workspace',
    description: 'Gmail, Drive, Calendar, and Docs access',
    icon: '🔵',
    url: 'https://mcp.googleapis.com/workspace',
    transport_type: 'streamable_http',
    auth_type: 'oauth',
    requiresClientRegistration: true,
    registrationInstructions: 'Configure OAuth at console.cloud.google.com. Enable the Google Workspace APIs you need and set the callback URL to your app\'s /api/mcp-servers/oauth/callback endpoint.',
    docsUrl: 'https://docs.cloud.google.com/mcp/authenticate-mcp',
  },
];
