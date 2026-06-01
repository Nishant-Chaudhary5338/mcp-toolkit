import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Search } from 'lucide-react'
import { ToolCard } from '../components/ToolCard'
import { tools, categories, categoryColors, categoryCount, type ToolCategory } from '../data/tools'

const reveal = {
  hidden: { opacity: 0, y: 22 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.6, ease: [.16, 1, .3, 1], delay: i * 0.06 },
  }),
}

export function ToolCatalog() {
  const [activeCategory, setActiveCategory] = useState<ToolCategory | 'All'>('All')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return tools.filter(t => {
      const matchCat = activeCategory === 'All' || t.category === activeCategory
      const matchQ = !q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
      return matchCat && matchQ
    })
  }, [activeCategory, query])

  return (
    <section id="tools" className="py-32 px-6">
      <div className="max-w-[1200px] mx-auto">

        {/* Section header */}
        <motion.div
          variants={reveal} initial="hidden" whileInView="show" custom={0}
          viewport={{ once: true, margin: '-80px' }}
          className="mb-10"
        >
          <p className="overline text-[10px] text-[#9DA2A9] mb-4">
            <span className="text-[#FF6A2B]">// </span>03 · TOOLS
          </p>
          <h2 className="display-l text-[#F2F3F5] mb-4">
            17 servers. 80+ tools.
          </h2>
          <p className="text-[16px] text-[#9DA2A9] max-w-[520px] leading-relaxed">
            Every server exposes its capabilities as typed MCP actions. Each tool runs identically in your editor and in CI.
          </p>
        </motion.div>

        {/* Category filter — top */}
        <motion.div
          variants={reveal} initial="hidden" whileInView="show" custom={1}
          viewport={{ once: true, margin: '-80px' }}
          className="mb-8"
        >
          <p className="overline text-[10px] text-[#34383E] mb-4">FILTER BY CATEGORY</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveCategory('All')}
              className={[
                'mono text-[11px] px-4 py-2 rounded-full border transition-all duration-150 font-medium',
                activeCategory === 'All'
                  ? 'bg-[#FF6A2B] text-[#08090A] border-[#FF6A2B]'
                  : 'text-[#6B7079] border-[#1A1C1F] hover:border-[#34383E] hover:text-[#F2F3F5]',
              ].join(' ')}
            >
              All servers
            </button>
            {categories.map(cat => {
              const active = activeCategory === cat
              const dot = categoryColors[cat]
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={[
                    'flex items-center gap-2 mono text-[11px] px-4 py-2 rounded-full border transition-all duration-150 font-medium',
                    active
                      ? 'border-transparent text-[#F2F3F5]'
                      : 'text-[#6B7079] border-[#1A1C1F] hover:border-[#34383E] hover:text-[#F2F3F5]',
                  ].join(' ')}
                  style={active ? { background: `${dot}18`, borderColor: `${dot}33`, color: dot } : {}}
                >
                  <span className="w-[5px] h-[5px] rounded-full shrink-0" style={{ background: dot }} />
                  {cat}
                  <span style={{ color: active ? `${dot}99` : '#34383E' }}>{categoryCount[cat]}</span>
                </button>
              )
            })}
          </div>
        </motion.div>

        {/* Search + count row */}
        <motion.div
          variants={reveal} initial="hidden" whileInView="show" custom={2}
          viewport={{ once: true, margin: '-80px' }}
          className="mb-8 flex items-center justify-between gap-4 flex-wrap"
        >
          <p className="mono text-[11px] text-[#34383E]">
            {filtered.length} servers · {filtered.reduce((n, t) => n + t.actions.length, 0)} tools
          </p>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#474B52]" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search tools…"
              className="w-56 pl-8 pr-4 py-2 text-[13px] mono bg-[#111214] border border-[#1A1C1F] rounded-[6px] text-[#F2F3F5] placeholder-[#34383E] focus:outline-none focus:border-[rgba(255,106,43,.28)] transition-colors"
            />
          </div>
        </motion.div>

        {/* Masonry grid */}
        <motion.div
          variants={reveal} initial="hidden" whileInView="show" custom={3}
          viewport={{ once: true, margin: '-80px' }}
        >
          {filtered.length > 0 ? (
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
              {filtered.map(tool => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          ) : (
            <div className="text-center py-24">
              <p className="mono text-[13px] text-[#34383E] mb-3">no tools match "{query}"</p>
              <button
                onClick={() => { setQuery(''); setActiveCategory('All') }}
                className="mono text-[12px] text-[#FF6A2B] hover:text-[#FF8C5A] transition-colors"
              >
                clear filter
              </button>
            </div>
          )}
        </motion.div>

      </div>
    </section>
  )
}
