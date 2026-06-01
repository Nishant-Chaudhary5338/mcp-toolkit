import { useState, Suspense, lazy, useCallback } from 'react'
import { motion } from 'framer-motion'

const ProtocolFlow3D = lazy(() =>
  import('../components/ProtocolFlow3D').then(m => ({ default: m.ProtocolFlow3D }))
)

const reveal = {
  hidden: { opacity: 0, y: 22 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.6, ease: [.16,1,.3,1], delay: i * 0.06 },
  }),
}

const clients = ['Claude Desktop', 'Cline', 'Cursor']

const stations = [
  {
    id: 'clients',
    label: 'Clients',
    sub: '3 surfaces',
    tone: 'signal' as const,
    tags: ['Claude Desktop', 'Cline', 'Cursor'],
  },
  {
    id: 'proto',
    label: 'JSON-RPC',
    sub: 'over stdio',
    tone: 'neutral' as const,
    tags: ['stdio', 'spec'],
  },
  {
    id: 'server',
    label: 'MCP Server',
    sub: '9 servers',
    tone: 'ember' as const,
    tags: ['60+ tools'],
  },
  {
    id: 'proc',
    label: 'Node subprocess',
    sub: 'child_process',
    tone: 'ember' as const,
    tags: ['tsc', 'vitest'],
  },
  {
    id: 'disk',
    label: 'Your files',
    sub: 'on disk',
    tone: 'ember' as const,
    tags: ['AST', 'regex'],
  },
]

const captions = [
  {
    title: 'Same binary, two surfaces',
    body: 'The component-factory server Claude Desktop calls over stdio is the exact one your CI invokes as a CLI. No adapters, no drift.',
  },
  {
    title: 'Deterministic, not generative',
    body: 'No model inference in the hot path. Tools read files, run AST transforms, execute shell commands — same input, same output, every time.',
  },
  {
    title: 'Zero round-trips',
    body: 'No network, no API keys, no telemetry. The full 5-stage pipeline grades a project in under 500ms, locally.',
  },
]

type Tone = 'signal' | 'ember' | 'neutral'

function dotColor(tone: Tone) {
  if (tone === 'signal') return '#3FD9C4'
  if (tone === 'ember')  return '#FF6A2B'
  return '#474B52'
}

function borderColor(tone: Tone) {
  if (tone === 'signal') return 'rgba(63,217,196,.25)'
  if (tone === 'ember')  return 'rgba(255,106,43,.25)'
  return '#25282D'
}

export function Architecture() {
  const [view3D, setView3D] = useState(false)
  const [fallback, setFallback] = useState(false)
  const handleFallback = useCallback(() => { setView3D(false); setFallback(true) }, [])
  const show3D = view3D && !fallback

  return (
    <section id="architecture" className="py-32 px-6 bg-[#0C0D0F]">
      <div className="max-w-[1200px] mx-auto">
        {/* Header */}
        <motion.div
          variants={reveal} initial="hidden" whileInView="show" custom={0}
          viewport={{ once: true, margin: '-80px' }}
          className="mb-16"
        >
          <p className="overline text-[10px] text-[#9DA2A9] mb-4">
            <span className="text-[#FF6A2B]">// </span>02 · ARCHITECTURE
          </p>
          <h2 className="display-l text-[#F2F3F5] mb-4">
            The same binary your editor calls<br className="hidden sm:block" /> is the one your CI runs.
          </h2>
          <p className="text-[16px] text-[#9DA2A9] max-w-[540px] leading-relaxed">
            MCP is JSON-RPC over stdio. Watch a tool call travel from the client, across the protocol boundary,
            into a Node.js subprocess, onto disk — and back.
          </p>
        </motion.div>

        {/* Protocol Flow Diagram */}
        <motion.div
          variants={reveal} initial="hidden" whileInView="show" custom={1}
          viewport={{ once: true, margin: '-80px' }}
          className="rounded-[14px] border border-[#1A1C1F] overflow-hidden mb-6"
          style={{ background: 'linear-gradient(180deg, #111214, #0C0D0F)' }}
        >
          {/* Diagram chrome header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#1A1C1F]">
            <div className="flex items-center gap-3">
              <span className="mono text-[11px] text-[#474B52] uppercase tracking-wider">Live System Diagram</span>
              {/* 2D/3D toggle */}
              <div className="flex items-center gap-0 border border-[#25282D] rounded-[6px] overflow-hidden">
                <button
                  onClick={() => setView3D(false)}
                  className={`mono text-[10px] px-2.5 py-1 transition-colors ${!show3D ? 'bg-[#1A1C1F] text-[#F2F3F5]' : 'text-[#474B52] hover:text-[#9DA2A9]'}`}
                >2D</button>
                <button
                  onClick={() => setView3D(true)}
                  disabled={fallback}
                  className={`mono text-[10px] px-2.5 py-1 transition-colors ${show3D ? 'bg-[rgba(255,106,43,.15)] text-[#FF6A2B]' : 'text-[#474B52] hover:text-[#9DA2A9]'} disabled:opacity-30`}
                >3D</button>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-3">
              <span className="flex items-center gap-1.5 mono text-[10px] text-[#3FD9C4]">
                <span className="w-2 h-2 rounded-full bg-[#3FD9C4]" />
                request
              </span>
              <span className="flex items-center gap-1.5 mono text-[10px] text-[#FF6A2B]">
                <span className="w-2 h-2 rounded-full bg-[#FF6A2B]" />
                result
              </span>
            </div>
          </div>

          {/* 3D Flow */}
          {show3D && (
            <Suspense fallback={
              <div className="h-[340px] flex items-center justify-center">
                <div className="w-5 h-5 rounded-full border-2 border-[#1A1C1F] border-t-[#FF6A2B] animate-spin" />
              </div>
            }>
              <ProtocolFlow3D onFallback={handleFallback} />
            </Suspense>
          )}

          {/* 2D Flow stations */}
          {!show3D && (
          <div className="p-8 overflow-x-auto">
            <div className="flex items-stretch gap-0 min-w-[640px]">
              {stations.map((s, i) => (
                <div key={s.id} className="flex items-center flex-1">
                  {/* Station chip */}
                  <div
                    className="flex-1 rounded-[10px] p-4 border transition-all duration-200 hover:border-[#34383E]"
                    style={{
                      background: s.tone === 'neutral' ? '#0C0D0F' : s.tone === 'ember' ? 'rgba(255,106,43,.04)' : 'rgba(63,217,196,.04)',
                      borderColor: borderColor(s.tone),
                    }}
                  >
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="w-[6px] h-[6px] rounded-full" style={{ background: dotColor(s.tone) }} />
                      <span className="mono text-[11px] font-semibold text-[#F2F3F5]">{s.label}</span>
                    </div>
                    <p className="mono text-[10px] text-[#6B7079] mb-2">{s.sub}</p>
                    <div className="flex flex-wrap gap-1">
                      {s.tags.map(tag => (
                        <span key={tag} className="mono text-[9px] text-[#474B52] bg-[#16181B] border border-[#25282D] px-1.5 py-0.5 rounded-[3px]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Arrow connector */}
                  {i < stations.length - 1 && (
                    <div className="relative flex items-center justify-center w-10 shrink-0">
                      <svg width="40" height="20" viewBox="0 0 40 20" className="overflow-visible" aria-hidden>
                        <line x1="2" y1="10" x2="32" y2="10" stroke="#25282D" strokeWidth="1" />
                        <polyline points="28,6 34,10 28,14" fill="none" stroke="#25282D" strokeWidth="1" />
                        {/* Traveling dot — teal (request) */}
                        <circle r="2.5" fill="#3FD9C4" opacity="0.85">
                          <animateMotion dur="2s" repeatCount="indefinite" begin="0s">
                            <mpath xlinkHref={`#path-${i}`} />
                          </animateMotion>
                        </circle>
                        {/* Traveling dot — ember (result, offset) */}
                        <circle r="2" fill="#FF6A2B" opacity="0.7">
                          <animateMotion dur="2s" repeatCount="indefinite" begin="1s" keyPoints="1;0" keyTimes="0;1" calcMode="linear">
                            <mpath xlinkHref={`#path-${i}`} />
                          </animateMotion>
                        </circle>
                        <path id={`path-${i}`} d="M4,10 L34,10" fill="none" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          )}

          {/* Client stack callout */}
          <div className="px-8 pb-6">
            <div className="border-t border-[#1A1C1F] pt-5">
              <div className="flex items-start gap-6 flex-wrap">
                <div>
                  <p className="overline text-[10px] text-[#474B52] mb-2">CLIENT SURFACES</p>
                  <div className="flex gap-2">
                    {clients.map(c => (
                      <span key={c} className="mono text-[11px] text-[#9DA2A9] bg-[rgba(63,217,196,.07)] border border-[rgba(63,217,196,.18)] px-2.5 py-1 rounded-[6px]">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="overline text-[10px] text-[#474B52] mb-2">PROTOCOL</p>
                  <span className="mono text-[11px] text-[#9DA2A9] bg-[#16181B] border border-[#25282D] px-2.5 py-1 rounded-[6px]">
                    JSON-RPC 2.0 · stdio transport
                  </span>
                </div>
                <div>
                  <p className="overline text-[10px] text-[#474B52] mb-2">EXECUTION</p>
                  <span className="mono text-[11px] text-[#FF8C5A] bg-[rgba(255,106,43,.07)] border border-[rgba(255,106,43,.18)] px-2.5 py-1 rounded-[6px]">
                    100% local · no network · no inference
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Wire protocol snippet */}
        <motion.div
          variants={reveal} initial="hidden" whileInView="show" custom={2}
          viewport={{ once: true, margin: '-80px' }}
          className="mb-10 rounded-[10px] border border-[#1A1C1F] bg-[#050506] overflow-hidden"
        >
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#1A1C1F]">
            <span className="mono text-[11px] text-[#6B7079]">tools/call · JSON-RPC over stdio</span>
          </div>
          <pre
            className="p-5 mono text-[12px] leading-relaxed overflow-x-auto text-[#9DA2A9]"
            dangerouslySetInnerHTML={{ __html:
              `<span style="color:#5C6066">// Claude Desktop sends this over stdin:</span>\n` +
              `{ <span style="color:#82AAFF">"jsonrpc"</span>: <span style="color:#A8E05F">"2.0"</span>, <span style="color:#82AAFF">"method"</span>: <span style="color:#A8E05F">"tools/call"</span>, <span style="color:#82AAFF">"id"</span>: <span style="color:#F5B544">7</span>,\n` +
              `  <span style="color:#82AAFF">"params"</span>: { <span style="color:#82AAFF">"name"</span>: <span style="color:#A8E05F">"component-factory.create"</span>,\n` +
              `              <span style="color:#82AAFF">"arguments"</span>: { <span style="color:#82AAFF">"name"</span>: <span style="color:#A8E05F">"Button"</span>, <span style="color:#82AAFF">"template"</span>: <span style="color:#A8E05F">"action"</span> } } }\n\n` +
              `<span style="color:#5C6066">// Your CI calls the same binary as a plain CLI:</span>\n` +
              `<span style="color:#FF6A2B">$</span> mcp component-factory create Button --template=action`
            }}
          />
        </motion.div>

        {/* Caption row — 3 facts */}
        <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#1A1C1F] border border-[#1A1C1F] rounded-[14px] overflow-hidden">
          {captions.map((c, i) => (
            <motion.div
              key={c.title}
              variants={reveal} initial="hidden" whileInView="show" custom={i}
              viewport={{ once: true, margin: '-40px' }}
              className="p-6"
            >
              <p className="text-[13px] font-semibold text-[#F2F3F5] mb-2">{c.title}</p>
              <p className="text-[13px] text-[#6B7079] leading-relaxed">{c.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
