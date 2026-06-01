import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { workflows } from '../data/workflows'
import { categoryColors } from '../data/tools'

const reveal = {
  hidden: { opacity: 0, y: 22 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.6, ease: [.16, 1, .3, 1], delay: i * 0.06 },
  }),
}

// Estimated step timings in ms per workflow
const TIMINGS: Record<string, number[]> = {
  'component-pipeline': [180, 340, 210, 290, 160],
  'modernization':      [450, 1180, 280, 540],
  'quality-audit':      [680, 320, 410, 490],
  'dep-health':         [380, 520, 640, 290],
  'new-feature':        [200, 340, 190, 430],
}

function PipelineRail({ workflow, isActive }: { workflow: typeof workflows[0]; isActive: boolean }) {
  const [litStep, setLitStep] = useState(-1)
  const timings = TIMINGS[workflow.id] ?? workflow.steps.map(() => 300)
  const totalMs = timings.reduce((a, b) => a + b, 0)

  useEffect(() => {
    if (!isActive) { setLitStep(-1); return }

    let step = 0
    let cancelled = false

    function advance() {
      if (cancelled) return
      setLitStep(step)
      const isLast = step === workflow.steps.length - 1
      if (!isLast) {
        step++
        setTimeout(advance, 650)
      } else {
        setTimeout(() => {
          if (!cancelled) { step = 0; setLitStep(-1); setTimeout(advance, 400) }
        }, 2800)
      }
    }

    const start = setTimeout(advance, 500)
    return () => { cancelled = true; clearTimeout(start) }
  }, [isActive, workflow.id, workflow.steps.length])

  return (
    <div>
      {/* Step rail — horizontally scrollable */}
      <div className="overflow-x-auto pb-3">
        <div className="flex items-start gap-0 min-w-max">
          {workflow.steps.map((step, i) => {
            const isLit = litStep >= i
            const dotColor = categoryColors[step.category]
            const timing = timings[i]

            return (
              <div key={i} className="flex items-center">
                {/* Node card */}
                <motion.div
                  animate={
                    isLit
                      ? { borderColor: 'rgba(255,106,43,.35)', boxShadow: '0 0 14px rgba(255,106,43,.10)' }
                      : { borderColor: '#1A1C1F', boxShadow: 'none' }
                  }
                  transition={{ duration: 0.3 }}
                  className="w-36 p-3 rounded-[8px] border bg-[#0C0D0F]"
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="w-[5px] h-[5px] rounded-full shrink-0" style={{ background: dotColor }} />
                    <span className="mono text-[9px] text-[#474B52] uppercase tracking-wide">{step.category}</span>
                  </div>
                  <p className="mono text-[11px] font-semibold text-[#F2F3F5] leading-snug mb-1">{step.tool}</p>
                  <p className="mono text-[10px] text-[#474B52] mb-2">{step.action}</p>
                  <motion.p
                    animate={{ color: isLit ? '#FF6A2B' : '#25282D' }}
                    transition={{ duration: 0.25 }}
                    className="mono text-[10px] font-semibold"
                  >
                    {isLit ? `${timing}ms` : '···'}
                  </motion.p>
                </motion.div>

                {/* Connector */}
                {i < workflow.steps.length - 1 && (
                  <div className="w-9 flex items-center shrink-0">
                    <div className="relative flex-1 h-px bg-[#1A1C1F] overflow-hidden">
                      <motion.div
                        className="absolute inset-0 bg-[#FF6A2B] origin-left"
                        animate={{ scaleX: litStep > i ? 1 : 0 }}
                        transition={{ duration: 0.4, ease: [.16, 1, .3, 1] }}
                      />
                    </div>
                    <div className="w-1.5 h-1.5 border-r border-t border-[#25282D] rotate-45 shrink-0 -ml-[3px]" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Caption row */}
      <div className="mt-5 pt-5 border-t border-[#1A1C1F] flex items-end justify-between gap-4 flex-wrap">
        <p className="text-[13px] text-[#6B7079] leading-relaxed max-w-[520px]">
          {workflow.useCase}
        </p>
        <div className="flex items-baseline gap-2 shrink-0">
          <span className="mono text-[10px] text-[#474B52] uppercase tracking-wide">Σ elapsed</span>
          <span className="mono text-[15px] font-semibold text-[#FF6A2B]">
            {totalMs >= 1000 ? `${(totalMs / 1000).toFixed(1)}s` : `${totalMs}ms`}
          </span>
        </div>
      </div>
    </div>
  )
}

export function Workflows() {
  const [activeIdx, setActiveIdx] = useState(0)

  return (
    <section id="workflows" className="py-32 px-6">
      <div className="max-w-[1200px] mx-auto">

        {/* Header */}
        <motion.div
          variants={reveal} initial="hidden" whileInView="show" custom={0}
          viewport={{ once: true, margin: '-80px' }}
          className="mb-12"
        >
          <p className="overline text-[10px] text-[#9DA2A9] mb-4">
            <span className="text-[#FF6A2B]">// </span>04 · PIPELINES
          </p>
          <h2 className="display-l text-[#F2F3F5] mb-4">
            5 automation pipelines.
          </h2>
          <p className="text-[16px] text-[#9DA2A9] max-w-[520px] leading-relaxed">
            Tools chain into end-to-end workflows. Each pipeline runs the same way in your editor as it does in CI.
          </p>
        </motion.div>

        {/* Tab panel */}
        <motion.div
          variants={reveal} initial="hidden" whileInView="show" custom={1}
          viewport={{ once: true, margin: '-80px' }}
          className="rounded-[14px] border border-[#1A1C1F] overflow-hidden"
          style={{ background: 'linear-gradient(180deg, #111214, #0C0D0F)' }}
        >
          {/* Mobile tab strip */}
          <div className="md:hidden overflow-x-auto border-b border-[#1A1C1F]">
            <div className="flex px-4 pt-3 pb-0 gap-1 min-w-max">
              {workflows.map((wf, i) => (
                <button
                  key={wf.id}
                  onClick={() => setActiveIdx(i)}
                  aria-label={wf.title}
                  aria-pressed={activeIdx === i}
                  className={[
                    'mono text-[11px] px-3 pb-3 border-b-2 transition-all duration-150 whitespace-nowrap font-medium',
                    activeIdx === i
                      ? 'text-[#FF6A2B] border-[#FF6A2B]'
                      : 'text-[#474B52] border-transparent hover:text-[#9DA2A9]',
                  ].join(' ')}
                >
                  {wf.title}
                </button>
              ))}
            </div>
          </div>

          <div className="flex">
            {/* Desktop left sidebar */}
            <div className="hidden md:block w-56 shrink-0 border-r border-[#1A1C1F]">
              {workflows.map((wf, i) => (
                <button
                  key={wf.id}
                  onClick={() => setActiveIdx(i)}
                  aria-label={wf.title}
                  aria-pressed={activeIdx === i}
                  className={[
                    'relative w-full text-left px-5 py-4 border-b border-[#1A1C1F] last:border-b-0 transition-colors duration-150',
                    activeIdx === i ? 'bg-[rgba(255,106,43,.04)]' : 'hover:bg-[#0C0D0F]',
                  ].join(' ')}
                >
                  {/* Ember tick */}
                  {activeIdx === i && (
                    <motion.div
                      layoutId="wf-tick"
                      className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#FF6A2B] rounded-r-full"
                    />
                  )}
                  <p className={`mono text-[11px] font-semibold mb-0.5 transition-colors ${activeIdx === i ? 'text-[#FF6A2B]' : 'text-[#9DA2A9]'}`}>
                    {wf.title}
                  </p>
                  <p className="text-[10px] text-[#474B52] leading-snug">{wf.tagline}</p>
                </button>
              ))}
            </div>

            {/* Right content panel */}
            <div className="flex-1 p-6 sm:p-8 min-w-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeIdx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                >
                  {/* Panel header */}
                  <div className="mb-6">
                    <p className="mono text-[12px] font-semibold text-[#F2F3F5] mb-1">
                      {workflows[activeIdx].title}
                    </p>
                    <p className="text-[13px] text-[#6B7079]">{workflows[activeIdx].tagline}</p>
                  </div>

                  <PipelineRail workflow={workflows[activeIdx]} isActive={true} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
