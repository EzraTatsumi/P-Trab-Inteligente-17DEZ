import React from 'react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

interface MarkdownViewerProps {
  content: string;
  className?: string;
}

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ content, className }) => {
  return (
    <div className={cn("prose dark:prose-invert max-w-none", className)}>
      <ReactMarkdown
        components={{
          // Custom components for better styling consistency
          h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mt-6 mb-3 border-b pb-2 text-primary" {...props} />,
          h2: ({ node, ...props }) => <h2 className="text-xl font-semibold mt-5 mb-2 text-foreground" {...props} />,
          h3: ({ node, ...props }) => <h3 className="text-lg font-semibold mt-4 mb-1 text-foreground" {...props} />,
          p: ({ node, ...props }) => <p className="text-sm mb-3 leading-relaxed text-muted-foreground" {...props} />,
          ul: ({ node, ...props }) => <ul className="list-disc list-inside pl-5 space-y-1 text-sm text-muted-foreground" {...props} />,
          ol: ({ node, ...props }) => <ol className="list-decimal list-inside pl-5 space-y-1 text-sm text-muted-foreground" {...props} />,
          li: ({ node, ...props }) => <li className="mb-1" {...props} />,
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-4">
              <table className="w-full text-sm border border-border" {...props} />
            </div>
          ),
          th: ({ node, ...props }) => <th className="bg-muted p-2 border border-border text-left font-semibold text-foreground" {...props} />,
          td: ({ node, ...props }) => <td className="p-2 border border-border align-top text-muted-foreground" {...props} />,
          code: ({ node, inline, ...props }) => {
            if (inline) {
              return <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono text-primary" {...props} />;
            }
            return <pre className="bg-muted p-3 rounded-md overflow-x-auto text-xs font-mono" {...props} />;
          },
          a: ({ node, ...props }) => <a className="text-primary hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};