import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search } from 'lucide-react'
import { ToolCard } from '../components/ToolCard'
import { tools, categories, categoryColors, type ToolCategory } from '../data/tools'

export function ToolCatalog() {
  const [activeCategory, setActiveCategory] = useState<ToolCategory | 'All'>('All')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    return tools.filter(t => {
      const matchCat = activeCategory === 'All' || t.category === activeCategory
      const matchQ = !query || t.name.includes(query.toLowerCase()) || t.description.toLowerCase().includes(query.toLowerCase())
      return matchCat && matchQ
    })
  }, [activeCategory, query])

  return (
    <section id="tools" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <p className="font-mono text-xs text-[#6366f1] mb-3">02 / Tool catalog</p>
          <h2 className="serif italic text-4xl sm:text-5xl text-[#f8f8f8] mb-4">28 tools. 6 categories.</h2>
          <p className="text-[#71717a] max-w-xl leading-relaxed">
            Every tool exposes its capabilities as typed MCP actions. Filter by category or search by name.
          </p>
        </motion.div>

        {/* filters + search */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="flex flex-col sm:flex-row gap-3 mb-8 sticky top-14 z-40 bg-[#080808]/90 backdrop-blur-md py-3"
        >
          <div className="flex flex-wrap gap-2 flex-1">
            {(['All', ...categories] as const).map(cat => {
              const active = activeCategory === cat
              const color = cat === 'All' ? '#6366f1' : categoryColors[cat as ToolCategory]
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className="text-xs font-mono px-3 py-1.5 rounded-lg border transition-all"
                  style={{
                    borderColor: active ? `${color}55` : '#27272a',
                    background: active ? `${color}15` : 'transparent',
                    color: active ? color : '#71717a',
                  }}
                >
                  {cat}
                  {cat !== 'All' && (
                    <span className="ml-1.5 opacity-50">
                      {tools.filter(t => t.category === cat).length}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#52525b]" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search tools..."
              className="pl-8 pr-4 py-1.5 text-xs font-mono bg-[#111111] border border-[#27272a] rounded-lg text-[#f8f8f8] placeholder-[#3f3f46] focus:outline-none focus:border-[#6366f1]/50 w-48"
            />
          </div>
        </motion.div>

        {/* grid */}
        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((tool, i) => (
              <motion.div
                key={tool.id}
                layout
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.2, delay: i * 0.02 }}
              >
                <ToolCard tool={tool} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

        {filtered.length === 0 && (
          <p className="text-center text-[#52525b] text-sm py-12 font-mono">No tools match "{query}"</p>
        )}

        {/* count */}
        <p className="text-xs text-[#3f3f46] font-mono mt-6 text-center">
          Showing {filtered.length} of {tools.length} tools
        </p>
      </div>
    </section>
  )
}
