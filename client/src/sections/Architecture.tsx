import { motion } from 'framer-motion'
import { FlowChart } from '../components/FlowChart'

const protocolNodes = [
  { id: 'client', label: 'Claude Desktop', sublabel: 'MCP client', category: 'surface' as const },
  { id: 'rpc', label: 'JSON-RPC', sublabel: 'stdio transport', category: 'protocol' as const },
  { id: 'server', label: 'MCP Server', sublabel: 'your tool code', category: 'protocol' as const },
  { id: 'tools', label: 'Tool handlers', sublabel: 'scan / generate / fix', category: 'surface' as const },
]

const protocolEdges = [
  { from: 'client', to: 'rpc', label: 'request' },
  { from: 'rpc', to: 'server' },
  { from: 'server', to: 'tools', label: 'dispatch' },
]

const dualNodes = [
  { id: 'server2', label: 'MCP Server', sublabel: 'one process', category: 'protocol' as const },
  { id: 'cline', label: 'Cline / Claude', sublabel: 'interactive AI', category: 'surface' as const },
  { id: 'cli', label: 'CLI script', sublabel: 'pnpm scan / CI', category: 'surface' as const },
]

const dualEdges = [
  { from: 'server2', to: 'cline' },
  { from: 'server2', to: 'cli' },
]

const facts = [
  { title: 'JSON-RPC over stdio', body: 'Not HTTP. Not WebSocket. Just stdin/stdout — which is why the same server works as both an AI tool and a shell script.' },
  { title: 'One server, two clients', body: 'Register the server in .cline/mcp.json and it powers Claude. Wrap it in a CLI and it powers pnpm scripts. Zero duplication.' },
  { title: '~30 server packages', body: 'Each server has a single concern — component generation, dependency auditing, TypeScript enforcement. Small, composable, testable.' },
]

export function Architecture() {
  return (
    <section id="architecture" className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="mb-14"
        >
          <p className="font-mono text-xs text-[#6366f1] mb-3">01 / Architecture</p>
          <h2 className="serif italic text-4xl sm:text-5xl text-[#f8f8f8] mb-4">How MCP works</h2>
          <p className="text-[#71717a] max-w-xl leading-relaxed">
            MCP is just JSON-RPC over stdio. No vendor lock-in, no AI dependency inside the server — pure TypeScript that any client can call.
          </p>
        </motion.div>

        <div className="space-y-16">
          {/* protocol chart */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5 }}
            className="bg-[#0d0d0d] border border-[#1f1f1f] rounded-2xl p-8"
          >
            <p className="text-xs text-[#52525b] font-mono mb-6 uppercase tracking-wider">The protocol</p>
            <div className="overflow-x-auto pb-2">
              <FlowChart nodes={protocolNodes} edges={protocolEdges} direction="horizontal" />
            </div>
          </motion.div>

          {/* dual surface chart */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-[#0d0d0d] border border-[#1f1f1f] rounded-2xl p-8"
          >
            <p className="text-xs text-[#52525b] font-mono mb-2 uppercase tracking-wider">The dual-surface pattern</p>
            <p className="text-sm text-[#71717a] mb-6 max-w-lg">The same server binary powers Claude Desktop interactively <em>and</em> CLI automation scripts. One codebase, two clients.</p>
            <div className="overflow-x-auto pb-2">
              <FlowChart nodes={dualNodes} edges={dualEdges} direction="horizontal" />
            </div>
          </motion.div>

          {/* facts */}
          <div className="grid sm:grid-cols-3 gap-4">
            {facts.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="bg-[#0d0d0d] border border-[#1f1f1f] rounded-xl p-5"
              >
                <p className="font-mono text-sm font-medium text-[#f8f8f8] mb-2">{f.title}</p>
                <p className="text-xs text-[#71717a] leading-relaxed">{f.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
