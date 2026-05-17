import { Github, Mail, ExternalLink } from 'lucide-react'

const projects = [
  { name: 'Monorepo', href: 'https://github.com/Nishant-Chaudhary5338/Monorepo' },
  { name: 'dashcraft', href: 'https://github.com/Nishant-Chaudhary5338/dashcraft' },
  { name: 'react-present', href: 'https://github.com/Nishant-Chaudhary5338/react-present' },
  { name: 'ai-builder', href: 'https://github.com/Nishant-Chaudhary5338/ai-builder' },
  { name: 'modern-ui', href: 'https://github.com/Nishant-Chaudhary5338/modern-ui' },
]

export function Footer() {
  return (
    <footer className="border-t border-[#1a1a1a] py-14 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="grid sm:grid-cols-3 gap-10 mb-10">
          {/* brand */}
          <div>
            <p className="font-mono text-sm font-medium text-[#f8f8f8] mb-2">mcp-toolkit</p>
            <p className="text-xs text-[#52525b] leading-relaxed max-w-xs">
              28 MCP servers for React + TypeScript development automation. One protocol, two surfaces.
            </p>
            <div className="flex items-center gap-3 mt-4">
              <a
                href="https://github.com/Nishant-Chaudhary5338"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#52525b] hover:text-[#f8f8f8] transition-colors"
              >
                <Github size={16} />
              </a>
              <a
                href="mailto:nishantchaudhary.dev@gmail.com"
                className="text-[#52525b] hover:text-[#f8f8f8] transition-colors"
              >
                <Mail size={16} />
              </a>
            </div>
          </div>

          {/* other projects */}
          <div>
            <p className="text-[10px] text-[#3f3f46] font-mono uppercase tracking-wider mb-3">Other projects</p>
            <ul className="space-y-2">
              {projects.map(p => (
                <li key={p.name}>
                  <a
                    href={p.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-[#71717a] hover:text-[#f8f8f8] transition-colors font-mono"
                  >
                    {p.name}
                    <ExternalLink size={10} />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* availability */}
          <div>
            <p className="text-[10px] text-[#3f3f46] font-mono uppercase tracking-wider mb-3">Availability</p>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-[#71717a]">Open to EU remote</span>
            </div>
            <p className="text-xs text-[#52525b] leading-relaxed">
              Senior Frontend Engineer · System Architect<br />
              React 19 · TypeScript · MCP · AI tooling
            </p>
            <a
              href="mailto:nishantchaudhary.dev@gmail.com"
              className="inline-flex items-center gap-1.5 mt-4 text-xs font-mono text-[#6366f1] border border-[#6366f1]/25 px-3 py-1.5 rounded-lg hover:bg-[#6366f1]/10 transition-colors"
            >
              <Mail size={12} />
              nishantchaudhary.dev@gmail.com
            </a>
          </div>
        </div>

        <div className="border-t border-[#1a1a1a] pt-6 flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs text-[#3f3f46] font-mono">Built by Nishant Chaudhary · MIT</p>
          <p className="text-xs text-[#3f3f46] font-mono">React 19 · TypeScript · Framer Motion · Tailwind CSS v4</p>
        </div>
      </div>
    </footer>
  )
}
