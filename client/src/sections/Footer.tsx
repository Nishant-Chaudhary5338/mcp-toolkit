const servers = [
  'component-factory', 'component-reviewer', 'component-fixer',
  'quality-pipeline', 'generate-tests', 'code-modernizer',
  'dep-auditor', 'monorepo-manager', 'utils-scaffolder',
]

const resources = [
  { label: 'MCP Protocol Spec', href: 'https://modelcontextprotocol.io' },
  { label: 'Claude Desktop', href: 'https://claude.ai/download' },
  { label: 'Cline Extension', href: 'https://marketplace.visualstudio.com/items?itemName=saoudrizwan.claude-dev' },
  { label: 'Cursor Editor', href: 'https://cursor.sh' },
]

const GithubIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
  </svg>
)

export function Footer() {
  return (
    <footer className="border-t border-[#1A1C1F] py-16 px-6">
      <div className="max-w-[1200px] mx-auto">

        {/* 4-col grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">

          {/* Brand */}
          <div>
            {/* Wordmark */}
            <div className="flex items-center gap-2 mb-4">
              <span className="grid grid-cols-2 gap-[3px] w-[14px] h-[14px]" aria-hidden>
                <span className="rounded-[1px] bg-[#F2F3F5] opacity-40" />
                <span className="rounded-[1px] bg-[#F2F3F5] opacity-40" />
                <span className="rounded-[1px] bg-[#FF6A2B]" />
                <span className="rounded-[1px] bg-[#F2F3F5] opacity-40" />
              </span>
              <span className="mono text-sm font-semibold text-[#F2F3F5]">
                MCP<span className="text-[#9DA2A9] font-medium"> Toolkit</span>
              </span>
            </div>
            <p className="text-[13px] text-[#9DA2A9] leading-relaxed mb-5 max-w-[200px]">
              9 MCP servers for React + TypeScript development. One protocol, two surfaces.
            </p>
            {/* Install pill */}
            <span className="mono text-[11px] text-[#9DA2A9] bg-[#111214] border border-[#1A1C1F] px-3 py-1.5 rounded-[6px] inline-block">
              <span className="text-[#FF6A2B]">$ </span>npx @mcp-toolkit/init
            </span>
          </div>

          {/* Servers */}
          <div>
            <p className="overline text-[10px] text-[#9DA2A9] mb-4">SERVERS</p>
            <ul className="space-y-2">
              {servers.map(s => (
                <li key={s}>
                  <span className="mono text-[12px] text-[#9DA2A9] hover:text-[#FF6A2B] transition-colors cursor-default">
                    {s}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <p className="overline text-[10px] text-[#9DA2A9] mb-4">RESOURCES</p>
            <ul className="space-y-2.5">
              {resources.map(r => (
                <li key={r.label}>
                  <a
                    href={r.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[13px] text-[#9DA2A9] hover:text-[#F2F3F5] transition-colors"
                  >
                    {r.label} ↗
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Project */}
          <div>
            <p className="overline text-[10px] text-[#9DA2A9] mb-4">PROJECT</p>
            <ul className="space-y-2.5">
              <li>
                <a
                  href="https://github.com/Nishant-Chaudhary5338/mcp-toolkit"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[13px] text-[#9DA2A9] hover:text-[#FF6A2B] transition-colors"
                >
                  <GithubIcon />
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/Nishant-Chaudhary5338/mcp-toolkit/blob/main/LICENSE"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] text-[#9DA2A9] hover:text-[#F2F3F5] transition-colors"
                >
                  MIT License
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/Nishant-Chaudhary5338/mcp-toolkit/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] text-[#9DA2A9] hover:text-[#F2F3F5] transition-colors"
                >
                  Issues
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/Nishant-Chaudhary5338/mcp-toolkit/blob/main/CHANGELOG.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] text-[#9DA2A9] hover:text-[#F2F3F5] transition-colors"
                >
                  Changelog
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-[#1A1C1F] pt-6 flex items-center justify-between gap-4 flex-wrap">
          <p className="mono text-[11px] text-[#9DA2A9]">
            © 2025 Nishant Chaudhary · MIT License
          </p>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/Nishant-Chaudhary5338/mcp-toolkit"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 mono text-[11px] text-[#9DA2A9] hover:text-[#FF6A2B] transition-colors"
            >
              <GithubIcon />
              GitHub
            </a>
            <span className="flex items-center gap-1.5 mono text-[11px] text-[#46D88A]">
              <span className="w-[6px] h-[6px] rounded-full bg-[#46D88A]" />
              all systems green
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
