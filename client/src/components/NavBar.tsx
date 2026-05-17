import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

const links = [
  { label: 'Architecture', href: '#architecture' },
  { label: 'Tools', href: '#tools' },
  { label: 'Workflows', href: '#workflows' },
  { label: 'Article', href: '#article' },
]

export function NavBar() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 48)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <motion.nav
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-[#080808]/90 backdrop-blur-md border-b border-[#1f1f1f]' : ''
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <a href="#" className="font-mono text-sm font-medium text-[#f8f8f8] hover:text-[#6366f1] transition-colors">
          mcp-toolkit
        </a>
        <div className="flex items-center gap-6">
          {links.map(l => (
            <a
              key={l.href}
              href={l.href}
              className="text-xs text-[#71717a] hover:text-[#f8f8f8] transition-colors hidden sm:block"
            >
              {l.label}
            </a>
          ))}
          <a
            href="https://github.com/Nishant-Chaudhary5338/mcp-toolkit"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-[#6366f1] border border-[#6366f1]/30 px-3 py-1.5 rounded-lg hover:bg-[#6366f1]/10 transition-colors"
          >
            GitHub
          </a>
        </div>
      </div>
    </motion.nav>
  )
}
