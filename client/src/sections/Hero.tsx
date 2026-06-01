import { useState, useEffect, useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Check, Copy, ArrowRight } from 'lucide-react'

const INSTALL_CMD = 'npx @mcp-toolkit/init'

interface Stat {
  value: number
  prefix?: string
  suffix?: string
  label: string
  duration: number
}

const stats: Stat[] = [
  { value: 17,  label: 'MCP SERVERS',   duration: 800  },
  { value: 80,  suffix: '+', label: 'TOOLS EXPOSED',  duration: 1100 },
  { value: 450, label: 'TESTS PASSING', duration: 1400 },
  { value: 500, prefix: '<', suffix: 'ms', label: 'FULL PIPELINE', duration: 1200 },
]

function useCountUp(target: number, duration: number, active: boolean) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!active) return
    const start = performance.now()
    let raf: number
    const tick = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(eased * target))
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, target, duration])
  return count
}

function StatCell({ stat, active }: { stat: Stat; active: boolean }) {
  const n = useCountUp(stat.value, stat.duration, active)
  return (
    <div className="flex flex-col items-center justify-center px-4 py-5 gap-1">
      <p className="mono text-2xl sm:text-3xl font-semibold text-[#F2F3F5] leading-none">
        {stat.prefix ?? ''}
        {n}
        <span className="text-[#FF6A2B] text-[0.65em]">{stat.suffix ?? ''}</span>
      </p>
      <p className="overline text-[#6B7079] text-[10px]">{stat.label}</p>
    </div>
  )
}

const reveal = {
  hidden: { opacity: 0, y: 22 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.6, ease: [.16,1,.3,1], delay: i * 0.06 },
  }),
}

export function Hero() {
  const [copied, setCopied] = useState(false)
  const statsRef = useRef<HTMLDivElement>(null)
  const statsInView = useInView(statsRef, { once: true, margin: '-20px' })

  async function copyCmd() {
    await navigator.clipboard.writeText(INSTALL_CMD)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <section className="relative min-h-[100svh] flex flex-col items-center justify-center px-6 pt-20 pb-16 overflow-hidden">
      {/* Technical grid */}
      <div className="absolute inset-0 pointer-events-none tech-grid" />

      {/* Ember aurora — top right */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '-5%', right: '-10%',
          width: 'clamp(320px, 50vw, 640px)',
          height: 'clamp(240px, 35vw, 480px)',
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, rgba(255,106,43,.18), transparent 70%)',
          filter: 'blur(40px)',
          animation: 'drift-ember 16s ease-in-out infinite',
        }}
      />

      {/* Signal aurora — bottom left */}
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: '5%', left: '-8%',
          width: 'clamp(240px, 40vw, 520px)',
          height: 'clamp(180px, 28vw, 380px)',
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, rgba(63,217,196,.10), transparent 70%)',
          filter: 'blur(50px)',
          animation: 'drift-signal 20s ease-in-out infinite',
        }}
      />

      {/* Ember center pulse (subtle) */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '35%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 'clamp(300px, 60vw, 800px)',
          height: 'clamp(200px, 40vw, 500px)',
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, rgba(255,106,43,.04), transparent 65%)',
          filter: 'blur(60px)',
        }}
      />

      <style>{`
        @keyframes drift-ember {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-4%, 6%) scale(1.05); }
          66% { transform: translate(3%, -4%) scale(.97); }
        }
        @keyframes drift-signal {
          0%, 100% { transform: translate(0, 0) scale(1); }
          40% { transform: translate(5%, -7%) scale(1.04); }
          70% { transform: translate(-3%, 4%) scale(.98); }
        }
      `}</style>

      {/* Content */}
      <div className="relative max-w-[1080px] mx-auto text-center w-full">

        {/* Eyebrow */}
        <motion.div
          variants={reveal} initial="hidden" animate="show" custom={0}
          className="inline-flex items-center gap-2 mb-10"
        >
          <span className="overline text-[#9DA2A9]">
            <span className="text-[#3FD9C4]">// </span>
            LOCAL-FIRST · MCP-NATIVE · ZERO CLOUD
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          variants={reveal} initial="hidden" animate="show" custom={1}
          className="display-xl text-[#F2F3F5] mb-6 max-w-[820px] mx-auto"
        >
          Deterministic dev automation that never leaves your machine.
        </motion.h1>

        {/* Subhead */}
        <motion.p
          variants={reveal} initial="hidden" animate="show" custom={2}
          className="text-[17px] text-[#9DA2A9] max-w-[580px] mx-auto leading-relaxed mb-12"
        >
          Seventeen MCP servers that scaffold, migrate, test, and grade React + TypeScript projects
          — running natively in Claude Desktop, Cline, and Cursor.{' '}
          <span className="text-[#F2F3F5]">No API keys. No inference. Nothing uploaded.</span>
        </motion.p>

        {/* CTAs */}
        <motion.div
          variants={reveal} initial="hidden" animate="show" custom={3}
          className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16"
        >
          <button
            onClick={copyCmd}
            className="group flex items-center gap-3 px-5 py-3 bg-[#111214] border border-[#25282D] hover:border-[rgba(255,106,43,.35)] rounded-[10px] transition-all duration-200 font-medium"
            aria-label="$ npx @mcp-toolkit/init — copy install command"
          >
            <span className="mono text-sm text-[#9DA2A9]">
              <span className="text-[#FF6A2B]">$ </span>
              {INSTALL_CMD}
            </span>
            <span className="flex items-center justify-center w-6 h-6 rounded-md text-[#9DA2A9] group-hover:text-[#FF6A2B] transition-colors">
              {copied
                ? <Check size={13} className="text-[#3FD9C4]" />
                : <Copy size={13} />
              }
            </span>
          </button>

          <a
            href="#architecture"
            className="group flex items-center gap-2 px-5 py-3 text-sm font-medium text-[#9DA2A9] hover:text-[#F2F3F5] transition-colors"
          >
            How it works
            <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform duration-150" />
          </a>
        </motion.div>

        {/* Stats strip — count-up on view */}
        <motion.div
          ref={statsRef}
          variants={reveal} initial="hidden" animate="show" custom={4}
          className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-[#1A1C1F] border border-[#1A1C1F] rounded-[14px] overflow-hidden"
          style={{ background: 'linear-gradient(180deg, #111214, #0C0D0F)' }}
        >
          {stats.map(s => (
            <StatCell key={s.label} stat={s} active={statsInView} />
          ))}
        </motion.div>

        {/* Terminal hint */}
        <motion.div
          variants={reveal} initial="hidden" animate="show" custom={5}
          className="mt-10 flex items-center justify-center gap-2"
        >
          <span className="mono text-xs text-[#474B52]">
            <span className="text-[#FF6A2B]">❯</span> mcp quality-pipeline ./packages/ui --grade
          </span>
          <span className="w-[7px] h-[13px] bg-[#474B52] animate-pulse rounded-sm" />
        </motion.div>
      </div>
    </section>
  )
}
