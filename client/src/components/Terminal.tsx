import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, Loader, Terminal as TermIcon } from 'lucide-react'

export interface TerminalLine {
  id: string
  type: 'info' | 'success' | 'error' | 'running' | 'output'
  tool?: string
  message: string
  timestamp?: number
}

interface Props {
  lines: TerminalLine[]
  title?: string
}

const icon = (type: TerminalLine['type']) => {
  if (type === 'success') return <CheckCircle size={13} className="text-emerald-400 shrink-0 mt-0.5" />
  if (type === 'error') return <XCircle size={13} className="text-rose-400 shrink-0 mt-0.5" />
  if (type === 'running') return (
    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="shrink-0 mt-0.5">
      <Loader size={13} className="text-indigo-400" />
    </motion.div>
  )
  return <span className="text-[#52525b] shrink-0 mt-0.5 w-[13px]">›</span>
}

const lineColor = (type: TerminalLine['type']) => {
  if (type === 'success') return 'text-emerald-400'
  if (type === 'error') return 'text-rose-400'
  if (type === 'running') return 'text-indigo-300'
  if (type === 'output') return 'text-[#a1a1aa]'
  return 'text-[#71717a]'
}

export function Terminal({ lines, title = 'Terminal' }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  return (
    <div className="rounded-xl border border-[#27272a] bg-[#0a0a0a] overflow-hidden font-mono text-sm">
      {/* title bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#1f1f1f] bg-[#111111]">
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#27272a]" />
          <span className="w-3 h-3 rounded-full bg-[#27272a]" />
          <span className="w-3 h-3 rounded-full bg-[#27272a]" />
        </div>
        <div className="flex items-center gap-1.5 ml-2">
          <TermIcon size={12} className="text-[#52525b]" />
          <span className="text-[11px] text-[#52525b]">{title}</span>
        </div>
      </div>

      {/* output */}
      <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
        {lines.length === 0 && (
          <div className="text-[#3f3f46] text-xs py-4 text-center">
            Click "Run Demo" to see live output
          </div>
        )}
        <AnimatePresence initial={false}>
          {lines.map(line => (
            <motion.div
              key={line.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-start gap-2"
            >
              {icon(line.type)}
              <div className="flex-1 min-w-0">
                {line.tool && (
                  <span className="text-[10px] text-[#6366f1] mr-2">[{line.tool}]</span>
                )}
                <span className={`text-xs leading-relaxed ${lineColor(line.type)}`}>
                  {line.message}
                </span>
              </div>
              {line.timestamp !== undefined && (
                <span className="text-[10px] text-[#3f3f46] shrink-0">{line.timestamp}ms</span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
