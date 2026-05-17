import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import { Clock, Tag } from 'lucide-react'

export function Article() {
  const [content, setContent] = useState('')

  useEffect(() => {
    import('../article.md?raw').then(m => setContent(m.default)).catch(() => {
      setContent('# Article\n\nCould not load article content.')
    })
  }, [])

  return (
    <section id="article" className="py-24 px-6">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <p className="font-mono text-xs text-[#6366f1] mb-3">04 / Deep dive</p>
          <h2 className="serif italic text-4xl sm:text-5xl text-[#f8f8f8] mb-4">
            One protocol, two surfaces
          </h2>
          <p className="text-[#71717a] leading-relaxed mb-4">
            Building a frontend MCP toolkit: ~30 server packages, 60+ tools, 27 CLI wrappers.
          </p>
          <div className="flex items-center gap-4 text-xs text-[#52525b]">
            <span className="flex items-center gap-1.5"><Clock size={12} /> 14 min read</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Tag size={12} />
              {['mcp', 'model-context-protocol', 'cline', 'frontend-platform', 'ai-tooling'].map(t => (
                <span key={t} className="font-mono text-[10px] border border-[#27272a] px-1.5 py-0.5 rounded text-[#52525b]">{t}</span>
              ))}
            </div>
          </div>
        </motion.div>

        <div className="w-full h-px bg-gradient-to-r from-transparent via-[#27272a] to-transparent mb-10" />

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="prose-custom"
        >
          <style>{`
            .prose-custom { color: #a1a1aa; font-size: 15px; line-height: 1.8; }
            .prose-custom h1, .prose-custom h2, .prose-custom h3 {
              font-family: 'Instrument Serif', Georgia, serif;
              font-style: italic;
              color: #f8f8f8;
              line-height: 1.2;
              margin-top: 2.5rem;
              margin-bottom: 1rem;
            }
            .prose-custom h1 { font-size: 2rem; }
            .prose-custom h2 { font-size: 1.5rem; }
            .prose-custom h3 { font-size: 1.2rem; color: #d4d4d8; }
            .prose-custom p { margin-bottom: 1.2rem; }
            .prose-custom a { color: #6366f1; text-decoration: underline; text-decoration-color: #6366f1/40; }
            .prose-custom a:hover { color: #818cf8; }
            .prose-custom blockquote {
              border-left: 2px solid #6366f1;
              padding-left: 1.25rem;
              margin: 1.5rem 0;
              color: #71717a;
              font-style: italic;
            }
            .prose-custom code:not(pre code) {
              font-family: 'JetBrains Mono', monospace;
              font-size: 13px;
              color: #a5b4fc;
              background: #1a1a1a;
              border: 1px solid #27272a;
              padding: 1px 6px;
              border-radius: 4px;
            }
            .prose-custom pre {
              background: #0d0d0d !important;
              border: 1px solid #1f1f1f;
              border-radius: 12px;
              padding: 1.25rem;
              overflow-x: auto;
              margin: 1.5rem 0;
              font-size: 13px;
              font-family: 'JetBrains Mono', monospace;
            }
            .prose-custom ul, .prose-custom ol { padding-left: 1.5rem; margin-bottom: 1.2rem; }
            .prose-custom li { margin-bottom: 0.4rem; }
            .prose-custom ul li::marker { color: #6366f1; }
            .prose-custom hr { border-color: #1f1f1f; margin: 2.5rem 0; }
            .prose-custom strong { color: #e4e4e7; font-weight: 600; }
            .prose-custom table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; font-size: 13px; }
            .prose-custom th { border-bottom: 1px solid #27272a; padding: 0.5rem 0.75rem; text-align: left; color: #71717a; font-weight: 500; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
            .prose-custom td { border-bottom: 1px solid #1a1a1a; padding: 0.5rem 0.75rem; }
            .prose-custom tr:last-child td { border-bottom: none; }
          `}</style>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
          >
            {content}
          </ReactMarkdown>
        </motion.div>
      </div>
    </section>
  )
}
