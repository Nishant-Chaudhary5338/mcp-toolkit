import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { categoryColors, type ToolCategory } from '../data/tools'

export interface FlowNode {
  id: string
  label: string
  sublabel?: string
  category?: ToolCategory | 'protocol' | 'surface'
}

export interface FlowEdge {
  from: string
  to: string
  label?: string
}

interface Props {
  nodes: FlowNode[]
  edges: FlowEdge[]
  direction?: 'horizontal' | 'vertical'
}

const NODE_W = 160
const NODE_H = 52
const GAP_H = 80
const GAP_V = 64

const nodeColor = (category?: FlowNode['category']): string => {
  if (!category) return '#27272a'
  if (category === 'protocol') return '#6366f1'
  if (category === 'surface') return '#10b981'
  return categoryColors[category as ToolCategory] ?? '#27272a'
}

export function FlowChart({ nodes, edges, direction = 'horizontal' }: Props) {
  const ref = useRef<SVGSVGElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  const positions: Record<string, { x: number; y: number }> = {}
  nodes.forEach((n, i) => {
    positions[n.id] = direction === 'horizontal'
      ? { x: i * (NODE_W + GAP_H), y: 0 }
      : { x: 0, y: i * (NODE_H + GAP_V) }
  })

  const svgW = direction === 'horizontal'
    ? nodes.length * (NODE_W + GAP_H) - GAP_H
    : NODE_W
  const svgH = direction === 'horizontal'
    ? NODE_H + 24
    : nodes.length * (NODE_H + GAP_V) - GAP_V

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${svgW} ${svgH}`}
      width="100%"
      style={{ maxWidth: svgW, overflow: 'visible' }}
      aria-label="Workflow flowchart"
      role="img"
    >
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#6366f1" opacity="0.7" />
        </marker>
      </defs>

      {/* edges */}
      {edges.map((edge, i) => {
        const from = positions[edge.from]
        const to = positions[edge.to]
        if (!from || !to) return null

        const x1 = direction === 'horizontal' ? from.x + NODE_W : from.x + NODE_W / 2
        const y1 = direction === 'horizontal' ? from.y + NODE_H / 2 : from.y + NODE_H
        const x2 = direction === 'horizontal' ? to.x : to.x + NODE_W / 2
        const y2 = direction === 'horizontal' ? to.y + NODE_H / 2 : to.y

        const mx = (x1 + x2) / 2
        const my = (y1 + y2) / 2
        const d = direction === 'horizontal'
          ? `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`
          : `M${x1},${y1} L${x2},${y2}`

        return (
          <g key={i}>
            <motion.path
              d={d}
              fill="none"
              stroke="#6366f1"
              strokeWidth="1.5"
              strokeOpacity="0.5"
              markerEnd="url(#arrow)"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={inView ? { pathLength: 1, opacity: 1 } : {}}
              transition={{ duration: 0.6, delay: 0.2 + i * 0.15, ease: 'easeInOut' }}
            />
            {/* traveling dot */}
            {inView && (
              <motion.circle r="3" fill="#6366f1" opacity={0.9}>
                <animateMotion
                  dur="2.5s"
                  repeatCount="indefinite"
                  begin={`${0.8 + i * 0.15}s`}
                  path={d}
                />
              </motion.circle>
            )}
            {edge.label && (
              <text x={mx} y={my - 6} textAnchor="middle" fill="#6b7280" fontSize="10" fontFamily="JetBrains Mono, monospace">
                {edge.label}
              </text>
            )}
          </g>
        )
      })}

      {/* nodes */}
      {nodes.map((node, i) => {
        const pos = positions[node.id]
        const color = nodeColor(node.category)
        return (
          <motion.g
            key={node.id}
            transform={`translate(${pos.x}, ${pos.y})`}
            initial={{ opacity: 0, y: 8 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4, delay: i * 0.1 }}
          >
            {/* glow */}
            <rect x={-2} y={-2} width={NODE_W + 4} height={NODE_H + 4} rx="10" fill={color} opacity="0.08" />
            {/* border */}
            <rect x={0} y={0} width={NODE_W} height={NODE_H} rx="8" fill="#111111" stroke={color} strokeWidth="1.5" strokeOpacity="0.6" />
            {/* label */}
            <text
              x={NODE_W / 2}
              y={node.sublabel ? NODE_H / 2 - 6 : NODE_H / 2 + 5}
              textAnchor="middle"
              fill="#f8f8f8"
              fontSize="12"
              fontFamily="JetBrains Mono, monospace"
              fontWeight="500"
            >
              {node.label}
            </text>
            {node.sublabel && (
              <text x={NODE_W / 2} y={NODE_H / 2 + 10} textAnchor="middle" fill={color} fontSize="10" fontFamily="Inter, sans-serif">
                {node.sublabel}
              </text>
            )}
          </motion.g>
        )
      })}
    </svg>
  )
}
