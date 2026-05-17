import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Play, CheckCircle2, ArrowRight } from 'lucide-react'
import { FlowChart } from '../components/FlowChart'
import { Terminal, type TerminalLine } from '../components/Terminal'
import { workflows } from '../data/workflows'
import { categoryColors } from '../data/tools'

function WorkflowPanel({ workflow }: { workflow: typeof workflows[0] }) {
  const [lines, setLines] = useState<TerminalLine[]>([])
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)

  const addLine = useCallback((line: Omit<TerminalLine, 'id'>) => {
    setLines(prev => [...prev, { ...line, id: `${Date.now()}-${Math.random()}` }])
  }, [])

  const runDemo = useCallback(async () => {
    if (running) return
    setRunning(true)
    setDone(false)
    setLines([])

    addLine({ type: 'info', message: `Starting workflow: ${workflow.title}` })
    await new Promise(r => setTimeout(r, 300))

    for (const step of workflow.steps) {
      addLine({ type: 'running', tool: step.tool, message: `${step.action} — ${step.description}` })
      const dur = 800 + Math.random() * 600
      await new Promise(r => setTimeout(r, dur))
      addLine({ type: 'success', tool: step.tool, message: step.outputSummary, timestamp: Math.round(dur) })
    }

    await new Promise(r => setTimeout(r, 200))
    addLine({ type: 'success', message: `Workflow complete — all ${workflow.steps.length} steps passed.` })
    setRunning(false)
    setDone(true)
  }, [running, workflow, addLine])

  const flowNodes = workflow.steps.map((s, i) => ({
    id: `s${i}`,
    label: s.tool,
    sublabel: s.action,
    category: s.category,
  }))
  const flowEdges = workflow.steps.slice(0, -1).map((_, i) => ({ from: `s${i}`, to: `s${i + 1}` }))

  return (
    <div className="bg-[#0d0d0d] border border-[#1f1f1f] rounded-2xl overflow-hidden">
      {/* header */}
      <div className="px-6 py-5 border-b border-[#1a1a1a]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-mono text-base font-medium text-[#f8f8f8] mb-1">{workflow.title}</h3>
            <p className="text-xs text-[#71717a] leading-relaxed">{workflow.tagline}</p>
          </div>
          <button
            onClick={runDemo}
            disabled={running}
            className={`flex items-center gap-1.5 text-xs font-mono px-4 py-2 rounded-lg border transition-all shrink-0 ${
              done
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                : running
                ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-400 cursor-not-allowed'
                : 'border-[#27272a] text-[#a1a1aa] hover:border-[#6366f1]/40 hover:text-[#6366f1] hover:bg-[#6366f1]/5'
            }`}
          >
            {done ? <CheckCircle2 size={13} /> : <Play size={13} />}
            {done ? 'Done' : running ? 'Running…' : 'Run Demo'}
          </button>
        </div>

        {/* use case */}
        <p className="mt-3 text-xs text-[#52525b] italic border-l-2 border-[#27272a] pl-3 leading-relaxed">
          {workflow.useCase}
        </p>
      </div>

      {/* flowchart */}
      <div className="px-6 py-5 border-b border-[#1a1a1a] overflow-x-auto">
        <FlowChart nodes={flowNodes} edges={flowEdges} direction="horizontal" />
      </div>

      {/* steps */}
      <div className="px-6 py-5 space-y-2 border-b border-[#1a1a1a]">
        {workflow.steps.map((step, i) => {
          const color = categoryColors[step.category]
          return (
            <div key={i} className="flex items-start gap-3">
              <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                <span className="font-mono text-[10px] text-[#3f3f46] w-4">{i + 1}</span>
                {i < workflow.steps.length - 1 && (
                  <ArrowRight size={10} className="text-[#27272a]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-[#f8f8f8]">{step.tool}</span>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                    style={{ color, background: `${color}15` }}
                  >
                    {step.action}
                  </span>
                </div>
                <p className="text-[11px] text-[#71717a] mt-0.5">{step.description}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* terminal */}
      <div className="p-6">
        <Terminal lines={lines} title={`${workflow.id} · output`} />
      </div>
    </div>
  )
}

export function Workflows() {
  return (
    <section id="workflows" className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="mb-12"
        >
          <p className="font-mono text-xs text-[#6366f1] mb-3">03 / Automation workflows</p>
          <h2 className="serif italic text-4xl sm:text-5xl text-[#f8f8f8] mb-4">5 workflow recipes</h2>
          <p className="text-[#71717a] max-w-xl leading-relaxed">
            Tools compose into end-to-end automation pipelines. Click "Run Demo" on any workflow to see simulated live output.
          </p>
        </motion.div>

        <div className="space-y-8">
          {workflows.map((wf, i) => (
            <motion.div
              key={wf.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
            >
              <WorkflowPanel workflow={wf} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
