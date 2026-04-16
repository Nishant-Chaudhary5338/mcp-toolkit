import { useState, useEffect } from 'react'
import { callTool } from './api/client'

// ============================================================================
// CONSTANTS
// ============================================================================

const TEMPLATES = [
  'accordion','alert','aspect-ratio','avatar','badge','breadcrumb',
  'button','calendar','card','checkbox','collapsible','command',
  'context-menu','dialog','drawer','dropdown-menu','form','hover-card',
  'input','input-otp','label','menubar','navigation-menu','pagination',
  'popover','progress','radio-group','scroll-area','select','separator',
  'sheet','skeleton','slider','sonner','switch','table','tabs','textarea',
  'toggle','toggle-group','tooltip',
]

const toPascal = (s: string) => s.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('')

const DEMO_PATH = '/Users/nishantchaudhary/Desktop/mcp-showcase/demo/legacy-app/src'

// ============================================================================
// STYLES
// ============================================================================

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --bg: #0c0c14;
    --surface: #13131f;
    --surface2: #1a1a2e;
    --surface3: #21213a;
    --border: #2a2a45;
    --border2: #363660;
    --text: #e2e4f0;
    --text-2: #9499b8;
    --text-3: #5a5f80;
    --accent: #6c6ef5;
    --accent-dim: #6c6ef518;
    --accent-hover: #7b7df7;
    --green: #4ade80;
    --green-dim: #4ade8015;
    --red: #f87171;
    --red-dim: #f8717115;
    --yellow: #fbbf24;
    --radius: 10px;
    --radius-sm: 6px;
  }

  body {
    font-family: 'Inter', system-ui, sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }

  /* Layout */
  .layout { display: flex; min-height: 100vh; }
  .sidebar {
    width: 220px;
    flex-shrink: 0;
    background: var(--surface);
    border-right: 1px solid var(--border);
    padding: 24px 0;
    display: flex;
    flex-direction: column;
    position: fixed;
    top: 0; left: 0; bottom: 0;
  }
  .main { margin-left: 220px; flex: 1; padding: 32px; max-width: 860px; }

  /* Sidebar */
  .logo { padding: 0 20px 24px; border-bottom: 1px solid var(--border); margin-bottom: 12px; }
  .logo-title { font-size: 15px; font-weight: 700; color: var(--text); letter-spacing: -0.3px; }
  .logo-sub { font-size: 11px; color: var(--text-3); margin-top: 2px; }
  .nav-item {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 20px; cursor: pointer; transition: all 0.15s;
    color: var(--text-2); font-size: 13px; font-weight: 500;
    border-left: 2px solid transparent;
  }
  .nav-item:hover { color: var(--text); background: var(--surface2); }
  .nav-item.active { color: var(--accent); background: var(--accent-dim); border-left-color: var(--accent); }
  .nav-icon { font-size: 15px; width: 20px; text-align: center; }
  .sidebar-footer { margin-top: auto; padding: 16px 20px; border-top: 1px solid var(--border); }
  .status-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--red); display: inline-block; margin-right: 7px; }
  .status-dot.online { background: var(--green); box-shadow: 0 0 6px var(--green); }
  .status-label { font-size: 11px; color: var(--text-3); }

  /* Page header */
  .page-header { margin-bottom: 28px; }
  .page-title { font-size: 22px; font-weight: 700; color: var(--text); letter-spacing: -0.5px; }
  .page-desc { font-size: 13px; color: var(--text-2); margin-top: 4px; }

  /* Cards */
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 24px;
    margin-bottom: 16px;
  }
  .card-title { font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
  .card-title-icon { font-size: 16px; }

  /* Form controls */
  .field { margin-bottom: 16px; }
  .field:last-of-type { margin-bottom: 0; }
  .label {
    display: block; font-size: 11px; font-weight: 600;
    color: var(--text-3); text-transform: uppercase;
    letter-spacing: 0.6px; margin-bottom: 7px;
  }
  .input, .select {
    width: 100%; background: var(--bg);
    border: 1px solid var(--border); border-radius: var(--radius-sm);
    color: var(--text); font-family: inherit; font-size: 13px;
    padding: 9px 12px; outline: none; transition: border-color 0.15s;
    appearance: none;
  }
  .input:focus, .select:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-dim); }
  .select-wrap { position: relative; }
  .select-wrap::after {
    content: '▾'; position: absolute; right: 12px; top: 50%;
    transform: translateY(-50%); color: var(--text-3);
    pointer-events: none; font-size: 12px;
  }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }

  /* Toggle group */
  .toggle-group { display: flex; gap: 6px; flex-wrap: wrap; }
  .toggle-btn {
    padding: 5px 12px; background: var(--surface2);
    border: 1px solid var(--border); border-radius: 20px;
    color: var(--text-2); font-family: inherit; font-size: 11px;
    font-weight: 500; cursor: pointer; transition: all 0.15s;
  }
  .toggle-btn:hover { border-color: var(--border2); color: var(--text); }
  .toggle-btn.on { background: var(--accent-dim); border-color: var(--accent); color: var(--accent); }

  /* Checkboxes */
  .checks { display: flex; gap: 20px; }
  .check-label { display: flex; align-items: center; gap: 7px; font-size: 12px; color: var(--text-2); cursor: pointer; }
  .check-label input[type=checkbox] { accent-color: var(--accent); width: 14px; height: 14px; cursor: pointer; }

  /* Actions */
  .actions { display: flex; gap: 10px; margin-top: 20px; }
  .btn-primary {
    padding: 9px 20px; background: var(--accent); border: none;
    border-radius: var(--radius-sm); color: #fff;
    font-family: inherit; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: background 0.15s;
    display: flex; align-items: center; gap: 7px;
  }
  .btn-primary:hover { background: var(--accent-hover); }
  .btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
  .btn-secondary {
    padding: 9px 16px; background: var(--surface2);
    border: 1px solid var(--border); border-radius: var(--radius-sm);
    color: var(--text-2); font-family: inherit; font-size: 13px;
    font-weight: 500; cursor: pointer; transition: all 0.15s;
  }
  .btn-secondary:hover { border-color: var(--border2); color: var(--text); }

  /* Spinner */
  .spinner {
    width: 13px; height: 13px; border: 2px solid rgba(255,255,255,0.25);
    border-top-color: #fff; border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Result */
  .result { margin-top: 20px; border-top: 1px solid var(--border); padding-top: 20px; }
  .result-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .result-badge {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600;
  }
  .result-badge.success { background: var(--green-dim); color: var(--green); }
  .result-badge.error { background: var(--red-dim); color: var(--red); }
  .result-duration { font-size: 11px; color: var(--text-3); }
  .result-box {
    background: var(--bg); border: 1px solid var(--border);
    border-radius: var(--radius-sm); padding: 14px 16px;
    font-family: 'JetBrains Mono', monospace; font-size: 11.5px;
    line-height: 1.7; white-space: pre-wrap; word-break: break-all;
    max-height: 420px; overflow-y: auto; color: var(--text-2);
  }
  .result-box::-webkit-scrollbar { width: 4px; }
  .result-box::-webkit-scrollbar-track { background: transparent; }
  .result-box::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 4px; }

  /* Info box */
  .info-box {
    background: var(--accent-dim); border: 1px solid var(--accent);
    border-radius: var(--radius-sm); padding: 10px 14px;
    font-size: 12px; color: var(--text-2); line-height: 1.6;
  }
  .info-box b { color: var(--accent); }

  /* Template grid */
  .template-count { font-size: 11px; color: var(--text-3); margin-left: auto; }

  /* Divider */
  .divider { height: 1px; background: var(--border); margin: 20px 0; }

  /* Tag */
  .tag {
    display: inline-block; background: var(--surface3);
    border: 1px solid var(--border); color: var(--text-3);
    font-size: 10px; font-weight: 500; padding: 2px 8px;
    border-radius: 4px; font-family: 'JetBrains Mono', monospace;
  }

  /* Code modernizer path */
  .path-badge {
    display: inline-flex; align-items: center; gap: 6px;
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: var(--radius-sm); padding: 6px 12px;
    font-family: 'JetBrains Mono', monospace; font-size: 11px;
    color: var(--text-2); width: 100%;
  }
  .path-badge-icon { color: var(--text-3); }

  /* Stats row */
  .stats { display: flex; gap: 16px; }
  .stat { flex: 1; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 14px 16px; text-align: center; }
  .stat-val { font-size: 24px; font-weight: 700; color: var(--accent); }
  .stat-label { font-size: 11px; color: var(--text-3); margin-top: 2px; }

  /* Workflow pipeline */
  .pipeline {
    display: flex; align-items: center; gap: 0;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 16px 20px;
    margin-bottom: 28px; overflow-x: auto;
  }
  .pipe-step {
    display: flex; flex-direction: column; align-items: center;
    gap: 6px; flex-shrink: 0; min-width: 72px;
  }
  .pipe-icon {
    width: 36px; height: 36px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-size: 15px; background: var(--surface2); border: 1px solid var(--border);
    transition: all 0.2s;
  }
  .pipe-icon.active {
    background: var(--accent-dim); border-color: var(--accent);
    box-shadow: 0 0 12px var(--accent-dim);
  }
  .pipe-label { font-size: 10px; color: var(--text-3); font-weight: 500; text-align: center; letter-spacing: 0.3px; }
  .pipe-label.active { color: var(--accent); }
  .pipe-arrow { color: var(--border2); font-size: 12px; padding: 0 6px; flex-shrink: 0; margin-top: -10px; }

  /* Sidebar branding */
  .logo-badge {
    display: inline-block; background: var(--accent); color: #fff;
    font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 4px;
    letter-spacing: 0.5px; margin-left: 6px; vertical-align: middle;
  }
`

// ============================================================================
// TYPES
// ============================================================================

interface ToolResult { success: boolean; result?: unknown; error?: string; duration?: number }

// ============================================================================
// RESULT PANEL
// ============================================================================

function ResultPanel({ result }: { result: ToolResult | null }) {
  if (!result) return null
  return (
    <div className="result">
      <div className="result-header">
        <span className={`result-badge ${result.success ? 'success' : 'error'}`}>
          {result.success ? '✓ Success' : '✗ Error'}
        </span>
        {result.duration && <span className="result-duration">{result.duration}ms</span>}
      </div>
      <div className="result-box">
        {result.error ?? JSON.stringify(result.result, null, 2)}
      </div>
    </div>
  )
}

// ============================================================================
// COMPONENT FACTORY PAGE
// ============================================================================

type CFTool = 'list_templates' | 'generate_component' | 'generate_library' | 'review_component' | 'fix_component' | 'improve_component'

const CF_TOOLS: { id: CFTool; label: string; icon: string; desc: string }[] = [
  { id: 'list_templates',      icon: '◈', label: 'List Templates',    desc: 'View all 41 shadcn/ui components' },
  { id: 'generate_component',  icon: '⊕', label: 'Generate',          desc: 'Create a single component' },
  { id: 'generate_library',    icon: '⊞', label: 'Generate Library',  desc: 'Generate multiple at once' },
  { id: 'review_component',    icon: '◎', label: 'Review',            desc: 'Grade quality A–F' },
  { id: 'fix_component',       icon: '⚡', label: 'Fix',               desc: 'Auto-fix common issues' },
  { id: 'improve_component',   icon: '✦', label: 'Improve',           desc: 'Expand tests & stories' },
]

const LIBRARY_DEFAULTS = ['Button', 'Card', 'Input', 'Badge', 'Tabs', 'Dialog', 'Select', 'Checkbox', 'Table', 'Form']

function ComponentFactoryPage() {
  const [tool, setTool] = useState<CFTool>('list_templates')
  const [component, setComponent] = useState('button')
  const [outputPath, setOutputPath] = useState('/tmp/mcp-demo-components')
  const [libraryComponents, setLibraryComponents] = useState<string[]>(LIBRARY_DEFAULTS)
  const [includeTests, setIncludeTests] = useState(true)
  const [includeStories, setIncludeStories] = useState(true)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ToolResult | null>(null)

  const pascalName = toPascal(component)
  const componentPath = `${outputPath}/${pascalName}`

  const toggleLibraryComponent = (name: string) => {
    setLibraryComponents(prev =>
      prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]
    )
  }

  const run = async () => {
    setLoading(true); setResult(null)
    try {
      let server = 'component-factory'
      let toolName = tool as string
      let args: Record<string, unknown> = {}

      if (tool === 'list_templates') {
        args = {}
      } else if (tool === 'generate_component') {
        toolName = 'generate_component'
        args = { name: pascalName, outputPath, includeTests, includeStories, includeTypes: true, includeDocs: true }
      } else if (tool === 'generate_library') {
        toolName = 'generate_component_library'
        args = { components: libraryComponents, outputPath, includeTests, includeStories }
      } else if (tool === 'review_component') {
        args = { path: componentPath }
      } else if (tool === 'fix_component') {
        args = { path: componentPath }
      } else if (tool === 'improve_component') {
        args = { path: componentPath }
      }

      const r = await callTool(server, toolName, args)
      setResult(r)
    } catch (e) {
      setResult({ success: false, error: String(e) })
    } finally {
      setLoading(false)
    }
  }

  const needsComponent = ['generate_component', 'review_component', 'fix_component', 'improve_component'].includes(tool)
  const needsLibrary = tool === 'generate_library'
  const needsOutput = ['generate_component', 'generate_library'].includes(tool)

  // Map tool to pipeline step index
  const pipelineStep: Record<CFTool, number> = {
    list_templates: 0,
    generate_component: 2,
    generate_library: 2,
    review_component: 3,
    fix_component: 4,
    improve_component: 5,
  }

  return (
    <>
      <div className="page-header">
        <div className="page-title">Component Factory</div>
        <div className="page-desc">Generate, review, fix, and improve production-ready React components — automated end-to-end</div>
      </div>

      <Pipeline steps={FACTORY_PIPELINE} activeUpto={result ? pipelineStep[tool] : pipelineStep[tool] - 1} />

      {/* Tool selector */}
      <div className="card">
        <div className="card-title"><span className="card-title-icon">⚙</span> Action</div>
        <div className="toggle-group">
          {CF_TOOLS.map(t => (
            <button
              key={t.id}
              className={`toggle-btn ${tool === t.id ? 'on' : ''}`}
              onClick={() => { setTool(t.id); setResult(null) }}
              title={t.desc}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Component selector */}
      {needsComponent && (
        <div className="card">
          <div className="card-title"><span className="card-title-icon">◈</span> Component</div>
          <div className="row">
            <div className="field">
              <label className="label">Component Name</label>
              <div className="select-wrap">
                <select className="select" value={component} onChange={e => setComponent(e.target.value)}>
                  {TEMPLATES.map(t => (
                    <option key={t} value={t}>{toPascal(t)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label className="label">Output Path</label>
              <input className="input" value={outputPath} onChange={e => setOutputPath(e.target.value)} />
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>
            Will write to <span style={{ fontFamily: 'JetBrains Mono', color: 'var(--text-2)' }}>{componentPath}/</span>
          </div>
        </div>
      )}

      {/* Library selector */}
      {needsLibrary && (
        <div className="card">
          <div className="card-title">
            <span className="card-title-icon">⊞</span> Components to Generate
            <span className="template-count">{libraryComponents.length} selected</span>
          </div>
          <div className="toggle-group" style={{ marginBottom: 16 }}>
            {TEMPLATES.map(t => {
              const name = toPascal(t)
              return (
                <button
                  key={t}
                  className={`toggle-btn ${libraryComponents.includes(name) ? 'on' : ''}`}
                  onClick={() => toggleLibraryComponent(name)}
                >
                  {name}
                </button>
              )
            })}
          </div>
          <div className="field">
            <label className="label">Output Path</label>
            <input className="input" value={outputPath} onChange={e => setOutputPath(e.target.value)} />
          </div>
        </div>
      )}

      {/* Options */}
      {(needsComponent && tool === 'generate_component' || needsLibrary) && (
        <div className="card">
          <div className="card-title"><span className="card-title-icon">◦</span> Options</div>
          <div className="checks">
            <label className="check-label">
              <input type="checkbox" checked={includeTests} onChange={e => setIncludeTests(e.target.checked)} />
              Vitest tests
            </label>
            <label className="check-label">
              <input type="checkbox" checked={includeStories} onChange={e => setIncludeStories(e.target.checked)} />
              Storybook stories
            </label>
          </div>
        </div>
      )}

      <div className="actions">
        <button className="btn-primary" onClick={run} disabled={loading}>
          {loading ? <span className="spinner" /> : null}
          {loading ? 'Running...' : 'Run'}
        </button>
      </div>

      <ResultPanel result={result} />
    </>
  )
}

// ============================================================================
// CODE MODERNIZER PAGE
// ============================================================================

function CodeModernizerPage() {
  const [dryRun, setDryRun] = useState(true)
  const [includeProps, setIncludeProps] = useState(true)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ToolResult | null>(null)
  const [ran, setRan] = useState(false)

  const run = async () => {
    setLoading(true); setResult(null)
    try {
      const r = await callTool('code-modernizer', 'convert-to-typescript', {
        path: DEMO_PATH,
        dryRun,
        includeProps,
      })
      setResult(r)
      setRan(true)
    } catch (e) {
      setResult({ success: false, error: String(e) })
    } finally {
      setLoading(false)
    }
  }

  const stats = result?.result as Record<string, unknown> | undefined
  const summary = stats?.summary as Record<string, number> | undefined

  return (
    <>
      <div className="page-header">
        <div className="page-title">Code Modernizer</div>
        <div className="page-desc">Automated AST-powered migration — scan, infer types, and rewrite entire JS codebases to TypeScript</div>
      </div>

      <Pipeline steps={MODERNIZER_PIPELINE} activeUpto={ran ? 4 : loading ? 1 : 0} />

      {/* Demo project info */}
      <div className="card">
        <div className="card-title"><span className="card-title-icon">📁</span> Demo Project</div>
        <div className="info-box" style={{ marginBottom: 14 }}>
          A real legacy React JS project is bundled in the showcase — 5 files across components, utils, and hooks.
          <br />
          <b>App.jsx, Dashboard.jsx, UserCard.jsx, api.js, useUsers.js</b>
        </div>
        <div className="field">
          <label className="label">Project Path</label>
          <div className="path-badge">
            <span className="path-badge-icon">◈</span>
            {DEMO_PATH}
          </div>
        </div>
      </div>

      {/* Options */}
      <div className="card">
        <div className="card-title"><span className="card-title-icon">◦</span> Options</div>
        <div className="checks">
          <label className="check-label">
            <input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)} />
            Dry run — analyze only, no file changes
          </label>
          <label className="check-label">
            <input type="checkbox" checked={includeProps} onChange={e => setIncludeProps(e.target.checked)} />
            Convert PropTypes → TypeScript interfaces
          </label>
        </div>
      </div>

      {ran && summary && (
        <div className="stats">
          <div className="stat">
            <div className="stat-val">{summary.totalFiles ?? 0}</div>
            <div className="stat-label">JS Files Found</div>
          </div>
          <div className="stat">
            <div className="stat-val">{summary.convertedCount ?? 0}</div>
            <div className="stat-label">Converted</div>
          </div>
          <div className="stat">
            <div className="stat-val">{summary.skippedCount ?? 0}</div>
            <div className="stat-label">Skipped</div>
          </div>
          <div className="stat">
            <div className="stat-val">{summary.errorCount ?? 0}</div>
            <div className="stat-label">Errors</div>
          </div>
        </div>
      )}

      <div className="actions">
        <button className="btn-primary" onClick={run} disabled={loading}>
          {loading ? <span className="spinner" /> : null}
          {loading ? 'Analyzing...' : dryRun ? 'Analyze Project' : 'Convert to TypeScript'}
        </button>
      </div>

      <ResultPanel result={result} />
    </>
  )
}

// ============================================================================
// APP
// ============================================================================

type Page = 'factory' | 'modernizer'

const NAV = [
  { id: 'factory' as Page,    icon: '⬡', label: 'Component Factory' },
  { id: 'modernizer' as Page, icon: '⟳', label: 'Code Modernizer'   },
]

// Workflow steps per page
const FACTORY_PIPELINE = [
  { icon: '◈', label: 'Pick Template' },
  { icon: '⚙', label: 'Configure' },
  { icon: '⊕', label: 'Generate' },
  { icon: '◎', label: 'Review' },
  { icon: '⚡', label: 'Auto-Fix' },
  { icon: '✦', label: 'Improve' },
  { icon: '⬡', label: 'Ship' },
]

const MODERNIZER_PIPELINE = [
  { icon: '📁', label: 'Scan Files' },
  { icon: '🔍', label: 'Parse AST' },
  { icon: '🔁', label: 'Infer Types' },
  { icon: '📝', label: 'Rewrite' },
  { icon: '✅', label: 'Validate' },
]

function Pipeline({ steps, activeUpto }: { steps: typeof FACTORY_PIPELINE; activeUpto: number }) {
  return (
    <div className="pipeline">
      {steps.map((s, i) => (
        <div key={s.label} style={{ display: 'contents' }}>
          <div className="pipe-step">
            <div className={`pipe-icon ${i <= activeUpto ? 'active' : ''}`}>{s.icon}</div>
            <div className={`pipe-label ${i <= activeUpto ? 'active' : ''}`}>{s.label}</div>
          </div>
          {i < steps.length - 1 && <span className="pipe-arrow">→</span>}
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const [page, setPage] = useState<Page>('factory')
  const [online, setOnline] = useState<boolean | null>(null)

  useEffect(() => {
    fetch('http://localhost:3002/health')
      .then(r => setOnline(r.ok))
      .catch(() => setOnline(false))
  }, [])

  return (
    <>
      <style>{css}</style>
      <div className="layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="logo">
            <div className="logo-title">DevForge <span className="logo-badge">MCP</span></div>
            <div className="logo-sub">Automation Toolkit</div>
          </div>
          {NAV.map(n => (
            <div
              key={n.id}
              className={`nav-item ${page === n.id ? 'active' : ''}`}
              onClick={() => setPage(n.id)}
            >
              <span className="nav-icon">{n.icon}</span>
              {n.label}
            </div>
          ))}
          <div className="sidebar-footer">
            <span className={`status-dot ${online ? 'online' : ''}`} />
            <span className="status-label">
              {online === null ? 'Connecting...' : online ? 'Server online' : 'Server offline'}
            </span>
          </div>
        </aside>

        {/* Main */}
        <main className="main">
          {page === 'factory' && <ComponentFactoryPage />}
          {page === 'modernizer' && <CodeModernizerPage />}
        </main>
      </div>
    </>
  )
}
