import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, Loader } from 'lucide-react'

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
  height?: string
}

function LineIcon({ type }: { type: TerminalLine['type'] }) {
  if (type === 'success') return <CheckCircle size={12} className="text-[#46D88A] shrink-0 mt-0.5" />
  if (type === 'error') return <XCircle size={12} className="text-[#F2606A] shrink-0 mt-0.5" />
  if (type === 'running') return (
    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="shrink-0 mt-0.5">
      <Loader size={12} className="text-[#45C7D6]" />
    </motion.div>
  )
  return <span className="text-[#474B52] shrink-0 mt-0.5 w-3 text-center">›</span>
}

function lineColor(type: TerminalLine['type']) {
  if (type === 'success') return 'text-[#46D88A]'
  if (type === 'error') return 'text-[#F2606A]'
  if (type === 'running') return 'text-[#45C7D6]'
  if (type === 'output') return 'text-[#9DA2A9]'
  return 'text-[#6B7079]'
}

export function Terminal({ lines, title = 'terminal', height = 'max-h-64' }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const isAnimating = lines.some(l => l.type === 'running')

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  return (
    <div className="rounded-[10px] border border-[#1A1C1F] overflow-hidden shadow-[0_4px_24px_-4px_rgba(0,0,0,.6)]">
      {/* Title bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#1A1C1F] bg-[#0C0D0F]">
        {/* macOS traffic lights */}
        <div className="flex gap-[6px]">
          <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
          <span className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
          <span className="w-3 h-3 rounded-full bg-[#28C840]" />
        </div>
        <span className="flex-1 text-center mono text-[11px] text-[#474B52]">{title}</span>
        {/* Live indicator */}
        {isAnimating && (
          <span className="flex items-center gap-1.5 mono text-[10px] text-[#46D88A]">
            <span className="w-[6px] h-[6px] rounded-full bg-[#46D88A] animate-pulse" />
            live
          </span>
        )}
      </div>

      {/* Output area */}
      <div className={`p-4 ${height} overflow-y-auto bg-[#050506] space-y-1.5`}>
        {lines.length === 0 && (
          <p className="mono text-[11px] text-[#25282D] py-6 text-center">
            <span className="text-[#FF6A2B]">❯ </span>waiting for input…
          </p>
        )}
        <AnimatePresence initial={false}>
          {lines.map(line => (
            <motion.div
              key={line.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.14 }}
              className="flex items-start gap-2"
            >
              <LineIcon type={line.type} />
              <div className="flex-1 min-w-0">
                {line.tool && (
                  <span className="mono text-[10px] text-[#FF6A2B] mr-2">[{line.tool}]</span>
                )}
                <span className={`mono text-[11px] leading-relaxed ${lineColor(line.type)}`}>
                  {line.message}
                </span>
              </div>
              {line.timestamp !== undefined && (
                <span className="mono text-[10px] text-[#34383E] shrink-0">{line.timestamp}ms</span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
