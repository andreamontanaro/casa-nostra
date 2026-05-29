'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Mappatura degli elementi Markdown allo stile della chat (Tailwind, niente plugin prose).
function buildComponents(
  router: ReturnType<typeof useRouter>,
  onNavigate?: () => void,
): Components {
  return {
  p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0 leading-relaxed">{children}</p>,
  ul: ({ children }) => (
    <ul className="my-1.5 list-disc space-y-1 pl-5 first:mt-0 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-1.5 list-decimal space-y-1 pl-5 first:mt-0 last:mb-0">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ children, href }) => {
    // I link interni (es. /spese/<id>) navigano in-app col router e chiudono la chat;
    // quelli esterni si aprono in una nuova scheda come prima.
    const isInternal = !!href && href.startsWith('/')
    if (isInternal) {
      return (
        <a
          href={href}
          onClick={(e) => {
            e.preventDefault()
            onNavigate?.()
            router.push(href)
          }}
          className="font-medium text-accent underline underline-offset-2"
        >
          {children}
        </a>
      )
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-accent underline underline-offset-2"
      >
        {children}
      </a>
    )
  },
  h1: ({ children }) => <h1 className="my-2 text-base font-semibold first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="my-2 text-base font-semibold first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="my-2 text-sm font-semibold first:mt-0">{children}</h3>,
  hr: () => <hr className="my-2 border-border" />,
  blockquote: ({ children }) => (
    <blockquote className="my-1.5 border-l-2 border-border pl-3 text-muted">{children}</blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-[0.85em]">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="my-1.5 overflow-x-auto rounded-xl bg-surface-sunken p-3 text-[0.85em]">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-1.5 overflow-x-auto">
      <table className="w-full border-collapse text-left text-[0.9em]">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-border px-2 py-1 font-semibold">{children}</th>
  ),
  td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
  }
}

export function Markdown({
  children,
  onNavigate,
}: {
  children: string
  onNavigate?: () => void
}) {
  const router = useRouter()
  const components = useMemo(() => buildComponents(router, onNavigate), [router, onNavigate])
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  )
}
