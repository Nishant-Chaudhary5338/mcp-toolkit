import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Terminal } from 'lucide-react'
import { type McpTool, categoryColors } from '../data/tools'

interface Props {
  tool: McpTool
}

export function ToolCard({ tool }: Props) {
  const [open, setOpen] = useState(false)
  const color = categoryColors[tool.category]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      style={{ borderColor: open ? `${color}55` : '#27272a' }}
      className="rounded-xl border bg-[#111111] overflow-hidden cursor-pointer transition-colors hover:border-[#3f3f46]"
      onClick={() => setOpen(o => !o)}
    >
      {/* header */}
      <div className="p-4 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span
              className="text-[10px] font-mono px-2 py-0.5 rounded-full border"
              style={{ color, borderColor: `${color}44`, background: `${color}11` }}
            >
              {tool.category}
            </span>
          </div>
          <p className="font-mono text-sm font-medium text-[#f8f8f8]">{tool.name}</p>
          <p className="text-xs text-[#71717a] mt-1 leading-relaxed line-clamp-2">{tool.description}</p>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={16} className="text-[#52525b] mt-0.5 shrink-0" />
        </motion.div>
      </div>

      {/* action chips */}
      <div className="px-4 pb-3 flex flex-wrap gap-1.5">
        {tool.actions.slice(0, 3).map(a => (
          <span key={a} className="text-[10px] font-mono text-[#a1a1aa] bg-[#1a1a1a] border border-[#27272a] px-2 py-0.5 rounded">
            {a}
          </span>
        ))}
        {tool.actions.length > 3 && (
          <span className="text-[10px] font-mono text-[#52525b] px-1">+{tool.actions.length - 3}</span>
        )}
      </div>

      {/* expanded detail */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-[#1f1f1f] px-4 py-4 space-y-3">
              {/* all actions */}
              <div>
                <p className="text-[10px] text-[#52525b] uppercase tracking-wider mb-2">Exposed tools</p>
                <div className="flex flex-wrap gap-1.5">
                  {tool.actions.map(a => (
                    <span key={a} className="text-[11px] font-mono text-[#a1a1aa] bg-[#1a1a1a] border border-[#27272a] px-2 py-0.5 rounded">
                      {a}
                    </span>
                  ))}
                </div>
              </div>

              {/* server path */}
              <div>
                <p className="text-[10px] text-[#52525b] uppercase tracking-wider mb-1">Server path</p>
                <code className="text-[11px] text-[#6366f1] font-mono">{tool.serverPath}</code>
              </div>

              {/* example */}
              {tool.example && (
                <div>
                  <p className="text-[10px] text-[#52525b] uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Terminal size={10} /> Example input
                  </p>
                  <pre className="text-[11px] font-mono text-[#a1a1aa] bg-[#0d0d0d] rounded-lg p-3 overflow-x-auto leading-relaxed border border-[#1f1f1f]">
                    {tool.example}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
