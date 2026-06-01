import { type McpTool, categoryColors } from '../data/tools'

interface Props {
  tool: McpTool
}

const categoryGradients: Record<string, string> = {
  'Component Dev':  'linear-gradient(135deg, rgba(70,216,138,.06) 0%, transparent 60%)',
  'Code Quality':   'linear-gradient(135deg, rgba(91,157,255,.06) 0%, transparent 60%)',
  'Analysis':       'linear-gradient(135deg, rgba(69,199,214,.06) 0%, transparent 60%)',
  'Testing':        'linear-gradient(135deg, rgba(199,146,234,.06) 0%, transparent 60%)',
  'Modernization':  'linear-gradient(135deg, rgba(245,181,68,.06) 0%, transparent 60%)',
  'Utilities':      'linear-gradient(135deg, rgba(157,162,169,.04) 0%, transparent 60%)',
}

export function ToolCard({ tool }: Props) {
  const dotColor = categoryColors[tool.category]
  const gradient = categoryGradients[tool.category] ?? 'none'

  return (
    <div
      className="break-inside-avoid mb-4 rounded-[12px] border border-[#1A1C1F] overflow-hidden"
      style={{ background: `${gradient}, #111214` }}
    >
      {/* Category accent bar */}
      <div
        className="h-[3px] w-full"
        style={{ background: `linear-gradient(90deg, ${dotColor}55, transparent)` }}
      />

      <div className="p-5">
        {/* Category + action count row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: dotColor }} />
            <span className="overline text-[10px]" style={{ color: dotColor }}>
              {tool.category}
            </span>
          </div>
          <span
            className="mono text-[10px] font-semibold px-2 py-0.5 rounded-full border"
            style={{
              color: dotColor,
              borderColor: `${dotColor}33`,
              background: `${dotColor}0D`,
            }}
          >
            {tool.actions.length} tools
          </span>
        </div>

        {/* Tool name */}
        <p className="mono text-[14px] font-semibold text-[#F2F3F5] mb-2 leading-snug">
          {tool.name}
        </p>

        {/* Description — full, no truncation */}
        <p className="text-[13px] text-[#6B7079] leading-relaxed mb-4">
          {tool.description}
        </p>

        {/* All action chips */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {tool.actions.map(a => (
            <span
              key={a}
              className="mono text-[10px] border px-2 py-0.5 rounded-[4px]"
              style={{
                color: dotColor,
                borderColor: `${dotColor}28`,
                background: `${dotColor}08`,
              }}
            >
              {a}
            </span>
          ))}
        </div>

        {/* Example input if present */}
        {tool.example && (
          <pre className="mono text-[10px] text-[#474B52] bg-[#050506] border border-[#1A1C1F] rounded-[6px] p-2.5 overflow-x-auto leading-relaxed mb-4">
            {tool.example}
          </pre>
        )}

        {/* Footer: server path + source link */}
        <div className="flex items-center justify-between pt-3 border-t border-[#1A1C1F]">
          <code className="mono text-[10px] text-[#34383E]">{tool.serverPath}</code>
          <a
            href={`https://github.com/Nishant-Chaudhary5338/mcp-toolkit/tree/main/${tool.serverPath}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mono text-[11px] text-[#474B52] hover:text-[#FF6A2B] transition-colors"
          >
            source ↗
          </a>
        </div>
      </div>
    </div>
  )
}
