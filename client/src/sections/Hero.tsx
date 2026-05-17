import { motion } from 'framer-motion'
import { ArrowDown, BookOpen } from 'lucide-react'

const metrics = [
  { value: '28', label: 'MCP servers' },
  { value: '6', label: 'categories' },
  { value: '5', label: 'workflow recipes' },
  { value: '60+', label: 'exposed tools' },
]

export function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-14 overflow-hidden">
      {/* grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%, black 40%, transparent 100%)',
        }}
      />

      {/* glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />

      <div className="relative max-w-4xl mx-auto text-center">
        {/* eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 text-xs font-mono text-[#6366f1] border border-[#6366f1]/25 bg-[#6366f1]/8 px-3 py-1.5 rounded-full mb-8"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#6366f1] animate-pulse" />
          Model Context Protocol · JSON-RPC · stdio
        </motion.div>

        {/* headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="serif text-6xl sm:text-7xl lg:text-8xl leading-[1.05] mb-6"
        >
          <span className="italic text-[#f8f8f8]">28 MCP tools.</span>
          <br />
          <span className="text-[#52525b]">One protocol.</span>
          <br />
          <span className="italic text-[#6366f1]">Infinite workflows.</span>
        </motion.h1>

        {/* sub */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="text-[#71717a] text-lg max-w-xl mx-auto leading-relaxed mb-10"
        >
          The same server that powers Cline also powers your parallel automation pipeline.
          Component generation, code quality, modernisation — one protocol, two surfaces.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="flex items-center justify-center gap-4 mb-16 flex-wrap"
        >
          <a
            href="#tools"
            className="flex items-center gap-2 bg-[#6366f1] text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-[#5558e8] transition-colors"
          >
            Explore tools
            <ArrowDown size={15} />
          </a>
          <a
            href="#article"
            className="flex items-center gap-2 border border-[#27272a] text-[#a1a1aa] text-sm font-medium px-5 py-2.5 rounded-xl hover:border-[#3f3f46] hover:text-[#f8f8f8] transition-colors"
          >
            <BookOpen size={15} />
            Read the article
          </a>
        </motion.div>

        {/* metrics strip */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.45 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[#1f1f1f] rounded-2xl overflow-hidden border border-[#1f1f1f]"
        >
          {metrics.map(m => (
            <div key={m.label} className="bg-[#0d0d0d] px-6 py-5 text-center">
              <p className="font-mono text-3xl font-medium text-[#f8f8f8] mb-1">{m.value}</p>
              <p className="text-xs text-[#52525b]">{m.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
