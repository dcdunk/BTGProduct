'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

function CodeBlock({ children, className }: { children: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group/code">
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded bg-surface-hover text-tertiary hover:text-primary opacity-0 group-hover/code:opacity-100 transition-opacity"
        aria-label="Copy code"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
      <pre className="bg-void border border-default rounded-lg p-4 overflow-x-auto text-sm">
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
}

export default function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        pre({ children }) {
          // Extract code element props
          const codeElement = children as React.ReactElement<{
            children: string;
            className?: string;
          }>;
          if (codeElement?.props) {
            return (
              <CodeBlock className={codeElement.props.className}>
                {String(codeElement.props.children).replace(/\n$/, '')}
              </CodeBlock>
            );
          }
          return <pre className="bg-void border border-default rounded-lg p-4 overflow-x-auto text-sm">{children}</pre>;
        },
        code({ children, className }) {
          // Inline code (not inside pre)
          const isInline = !className;
          if (isInline) {
            return (
              <code className="bg-surface-hover px-1.5 py-0.5 rounded text-cyan text-sm">
                {children}
              </code>
            );
          }
          return <code className={className}>{children}</code>;
        },
        a({ href, children }) {
          return (
            <a href={href} className="text-cyan hover:underline" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          );
        },
        p({ children }) {
          return <p className="mb-3 last:mb-0">{children}</p>;
        },
        ul({ children }) {
          return <ul className="list-disc pl-6 mb-3 space-y-1">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="list-decimal pl-6 mb-3 space-y-1">{children}</ol>;
        },
        h1({ children }) {
          return <h1 className="text-lg font-bold mb-3 mt-4 first:mt-0">{children}</h1>;
        },
        h2({ children }) {
          return <h2 className="text-md font-bold mb-2 mt-3 first:mt-0">{children}</h2>;
        },
        h3({ children }) {
          return <h3 className="text-base font-semibold mb-2 mt-3 first:mt-0">{children}</h3>;
        },
        table({ children }) {
          return (
            <div className="overflow-x-auto mb-3">
              <table className="w-full border-collapse border border-subtle text-sm">{children}</table>
            </div>
          );
        },
        thead({ children }) {
          return <thead className="bg-elevated">{children}</thead>;
        },
        th({ children }) {
          return <th className="border border-subtle px-3 py-2 text-left font-medium uppercase tracking-wider text-xs">{children}</th>;
        },
        td({ children }) {
          return <td className="border border-subtle px-3 py-2">{children}</td>;
        },
        blockquote({ children }) {
          return <blockquote className="border-l-2 border-cyan pl-4 italic text-secondary mb-3">{children}</blockquote>;
        },
        hr() {
          return <hr className="border-subtle my-4" />;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
