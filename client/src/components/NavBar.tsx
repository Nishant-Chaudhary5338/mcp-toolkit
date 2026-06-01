import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X } from 'lucide-react'

const SCROLL_THRESHOLD = 24

const navLinks = [
  { label: 'Architecture', href: '#architecture', id: 'architecture' },
  { label: 'Tools',        href: '#tools',         id: 'tools' },
  { label: 'Pipelines',   href: '#workflows',      id: 'workflows' },
]

const GithubIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
  </svg>
)

export function NavBar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('')

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SCROLL_THRESHOLD)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 768) setMenuOpen(false) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Scroll-spy: track which section is in the viewport
  useEffect(() => {
    const sectionIds = navLinks.map(l => l.id)
    const observers: IntersectionObserver[] = []

    const handleIntersect = (entries: IntersectionObserverEntry[]) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id)
        }
      }
    }

    sectionIds.forEach(id => {
      const el = document.getElementById(id)
      if (!el) return
      const obs = new IntersectionObserver(handleIntersect, {
        rootMargin: '-20% 0px -60% 0px',
        threshold: 0,
      })
      obs.observe(el)
      observers.push(obs)
    })

    return () => observers.forEach(o => o.disconnect())
  }, [])

  return (
    <>
      <motion.nav
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [.16,1,.3,1] }}
        className={[
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
          scrolled
            ? 'bg-[rgba(8,9,10,.82)] backdrop-blur-[16px] saturate-150 border-b border-[rgba(255,255,255,.07)]'
            : '',
        ].join(' ')}
      >
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          {/* Wordmark */}
          <a href="/" className="flex items-center gap-2.5 shrink-0">
            <span className="grid grid-cols-2 gap-[3px] w-[14px] h-[14px]" aria-hidden>
              <span className="rounded-[1px] bg-[#F2F3F5] opacity-50" />
              <span className="rounded-[1px] bg-[#F2F3F5] opacity-50" />
              <span className="rounded-[1px] bg-[#FF6A2B]" />
              <span className="rounded-[1px] bg-[#F2F3F5] opacity-50" />
            </span>
            <span className="mono text-sm font-semibold text-[#F2F3F5] tracking-tight">
              MCP<span className="text-[#9DA2A9] font-medium"> Toolkit</span>
            </span>
          </a>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
            {navLinks.map(link => {
              const isActive = activeSection === link.id
              return (
                <a
                  key={link.href}
                  href={link.href}
                  className={[
                    'relative px-3 py-1.5 text-[13px] rounded-md transition-all duration-150 font-medium',
                    isActive ? 'text-[#F2F3F5]' : 'text-[#6B7079] hover:text-[#F2F3F5] hover:bg-[#111214]',
                  ].join(' ')}
                >
                  {link.label}
                  {isActive && (
                    <motion.span
                      layoutId="nav-underline"
                      className="absolute bottom-0 left-3 right-3 h-[2px] bg-[#FF6A2B] rounded-full"
                    />
                  )}
                </a>
              )
            })}
          </div>

          {/* Right cluster */}
          <div className="flex items-center gap-3 shrink-0">
            <a
              href="https://github.com/Nishant-Chaudhary5338/mcp-toolkit"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[#FF6A2B] border border-[rgba(255,106,43,.28)] rounded-md hover:bg-[rgba(255,106,43,.10)] transition-all duration-150"
            >
              <GithubIcon />
              <span>GitHub</span>
            </a>

            <button
              onClick={() => setMenuOpen(v => !v)}
              className="md:hidden p-2 text-[#9DA2A9] hover:text-[#F2F3F5] border border-[#25282D] rounded-md hover:border-[#34383E] transition-all duration-150"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [.16,1,.3,1] }}
            className="fixed inset-0 z-40 pt-16 flex flex-col bg-[#111214] md:hidden"
          >
            <nav className="flex flex-col px-5 py-6 gap-1">
              {navLinks.map(link => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={[
                    'px-4 py-3.5 text-[15px] font-medium rounded-[10px] transition-all duration-150',
                    activeSection === link.id
                      ? 'text-[#FF6A2B] bg-[rgba(255,106,43,.07)]'
                      : 'text-[#9DA2A9] hover:text-[#F2F3F5] hover:bg-[#16181B]',
                  ].join(' ')}
                >
                  {link.label}
                </a>
              ))}
              <a
                href="https://github.com/Nishant-Chaudhary5338/mcp-toolkit"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenuOpen(false)}
                className="mt-4 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-[#FF6A2B] border border-[rgba(255,106,43,.28)] rounded-[10px] hover:bg-[rgba(255,106,43,.10)] transition-all duration-150"
              >
                <GithubIcon />
                View on GitHub
              </a>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
