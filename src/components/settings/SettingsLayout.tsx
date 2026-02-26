'use client';

import { useState } from 'react';
import WorkspaceContextEditor from './WorkspaceContextEditor';
import ApiKeysManager from './ApiKeysManager';
import McpServersManager from './McpServersManager';

type Tab = 'context' | 'api-keys' | 'mcp-servers';

interface SettingsLayoutProps {
  isAdmin: boolean;
}

export default function SettingsLayout({ isAdmin }: SettingsLayoutProps) {
  const [activeTab, setActiveTab] = useState<Tab>('context');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'context', label: 'Workspace Context' },
    { key: 'api-keys', label: 'API Keys' },
    { key: 'mcp-servers', label: 'MCP Servers' },
  ];

  return (
    <div>
      {/* Tab nav */}
      <div className="flex items-center gap-1 mb-8 border-b border-subtle">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium uppercase tracking-wider transition-all border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-cyan text-cyan'
                : 'border-transparent text-tertiary hover:text-secondary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'context' && <WorkspaceContextEditor />}
      {activeTab === 'api-keys' && <ApiKeysManager isAdmin={isAdmin} />}
      {activeTab === 'mcp-servers' && <McpServersManager isAdmin={isAdmin} />}
    </div>
  );
}
