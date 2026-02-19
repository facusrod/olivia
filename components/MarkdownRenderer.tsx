'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  return (
    <div className={`markdown-content ${className}`}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Headings
        h1: ({ children }) => (
          <h1 className="text-lg font-bold text-gray-900 mt-4 mb-2 first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-base font-bold text-gray-900 mt-4 mb-2 first:mt-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-bold text-gray-900 mt-3 mb-1.5 first:mt-0">{children}</h3>
        ),
        // Paragraphs
        p: ({ children }) => (
          <p className="text-sm text-gray-700 mb-2 last:mb-0 leading-relaxed">{children}</p>
        ),
        // Bold
        strong: ({ children }) => (
          <strong className="font-semibold text-gray-900">{children}</strong>
        ),
        // Italic
        em: ({ children }) => (
          <em className="italic text-gray-600">{children}</em>
        ),
        // Lists
        ul: ({ children }) => (
          <ul className="list-disc list-inside space-y-1 mb-2 text-sm text-gray-700 pl-1">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside space-y-1 mb-2 text-sm text-gray-700 pl-1">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="leading-relaxed">{children}</li>
        ),
        // Tables
        table: ({ children }) => (
          <div className="overflow-x-auto my-3 rounded-lg border border-gray-200">
            <table className="w-full text-sm">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-gray-100 border-b border-gray-200">{children}</thead>
        ),
        tbody: ({ children }) => (
          <tbody className="divide-y divide-gray-100">{children}</tbody>
        ),
        tr: ({ children }) => (
          <tr className="hover:bg-gray-50">{children}</tr>
        ),
        th: ({ children }) => (
          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-900 whitespace-nowrap">{children}</th>
        ),
        td: ({ children }) => (
          <td className="px-3 py-2 text-xs text-gray-700">{children}</td>
        ),
        // Horizontal rule
        hr: () => (
          <hr className="my-3 border-gray-200" />
        ),
        // Code
        code: ({ children, className: codeClassName }) => {
          const isInline = !codeClassName;
          if (isInline) {
            return (
              <code className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-xs font-mono">
                {children}
              </code>
            );
          }
          return (
            <code className="block bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs font-mono text-gray-800 overflow-x-auto my-2">
              {children}
            </code>
          );
        },
        // Blockquote
        blockquote: ({ children }) => (
          <blockquote className="border-l-3 border-primary-300 pl-3 my-2 text-sm text-gray-600 italic">
            {children}
          </blockquote>
        ),
        // Links
        a: ({ children, href }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 hover:text-primary-700 underline"
          >
            {children}
          </a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  );
}
