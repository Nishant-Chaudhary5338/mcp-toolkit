import { useRef, useMemo, useEffect, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

// ── Scene nodes ─────────────────────────────────────────────────────────────
const NODES = [
  { id: 'clients', label: 'Clients',   sub: '3 surfaces', pos: [-4.0, 0, 0] as const, tone: 'signal' },
  { id: 'proto',   label: 'JSON‑RPC', sub: 'stdio',  pos: [-1.6, 0, 0] as const, tone: 'neutral' },
  { id: 'server',  label: 'MCP Server',sub: '9 servers',  pos: [ 0.8, 0, 0] as const, tone: 'ember', isHub: true },
  { id: 'proc',    label: 'Node.js',   sub: 'subprocess', pos: [ 3.2, 0, 0] as const, tone: 'ember' },
  { id: 'disk',    label: 'Disk',      sub: 'your files', pos: [ 5.6, 0, 0] as const, tone: 'ember' },
]

const C_TEAL  = new THREE.Color('#3FD9C4')
const C_EMBER = new THREE.Color('#FF6A2B')
const C_DARK  = new THREE.Color('#474B52')

function nodeColor(tone: string) {
  if (tone === 'signal')  return C_TEAL
  if (tone === 'ember')   return C_EMBER
  return C_DARK
}

// ── Traveling packet along a curve ──────────────────────────────────────────
function Packet({
  curve, color, speed, phase, reverse = false,
}: {
  curve: THREE.CatmullRomCurve3
  color: THREE.Color
  speed: number
  phase: number
  reverse?: boolean
}) {
  const mesh = useRef<THREE.Mesh>(null!)
  const t = useRef(phase)
  const pt = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, dt) => {
    t.current = (t.current + dt * speed) % 1
    const u = reverse ? 1 - t.current : t.current
    curve.getPoint(u, pt)
    mesh.current.position.copy(pt)
    const alpha = Math.sin(t.current * Math.PI)
    ;(mesh.current.material as THREE.MeshBasicMaterial).opacity = 0.15 + alpha * 0.85
  })

  return (
    <mesh ref={mesh}>
      <sphereGeometry args={[0.1, 12, 12]} />
      <meshBasicMaterial color={color} transparent />
    </mesh>
  )
}

// ── Connection line between nodes ───────────────────────────────────────────
function Connector({ from, to }: { from: THREE.Vector3; to: THREE.Vector3 }) {
  const lineObj = useMemo(() => {
    const geom = new THREE.BufferGeometry().setFromPoints([from, to])
    const mat  = new THREE.LineBasicMaterial({ color: '#25282D' })
    return new THREE.Line(geom, mat)
  }, [from, to])

  return <primitive object={lineObj} />
}

// ── Station node sphere ──────────────────────────────────────────────────────
function Station({ node }: { node: typeof NODES[0] }) {
  const mat  = useRef<THREE.MeshStandardMaterial>(null!)
  const color = nodeColor(node.tone)
  const isHub = 'isHub' in node && node.isHub

  useFrame(({ clock }) => {
    if (!mat.current) return
    const t = clock.getElapsedTime()
    if (isHub) {
      mat.current.emissiveIntensity = 0.5 + Math.sin(t * 1.8) * 0.2
    }
  })

  return (
    <group position={node.pos}>
      <mesh castShadow>
        <sphereGeometry args={[isHub ? 0.32 : 0.20, 24, 24]} />
        <meshStandardMaterial
          ref={mat}
          color={color}
          emissive={color}
          emissiveIntensity={isHub ? 0.55 : 0.28}
          roughness={0.25}
          metalness={0.45}
        />
      </mesh>

      {/* Outer glow ring around hub */}
      {isHub && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.60, 0.014, 8, 56]} />
          <meshBasicMaterial color={C_EMBER} transparent opacity={0.40} />
        </mesh>
      )}

      {/* Second pulsing ring on hub */}
      {isHub && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.85, 0.008, 8, 56]} />
          <meshBasicMaterial color={C_EMBER} transparent opacity={0.18} />
        </mesh>
      )}

      {/* Label chip */}
      <Html
        position={[0, isHub ? 0.72 : 0.52, 0]}
        center
        distanceFactor={8}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div style={{
          background: 'rgba(5,5,6,.92)',
          border: `1px solid ${node.tone === 'signal' ? 'rgba(63,217,196,.32)' : node.tone === 'ember' ? 'rgba(255,106,43,.32)' : '#25282D'}`,
          borderRadius: 6,
          padding: '4px 10px',
          whiteSpace: 'nowrap',
          wordBreak: 'keep-all',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 2px 8px rgba(0,0,0,.5)',
        }}>
          <p style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: '#F2F3F5', fontWeight: 600, margin: 0, lineHeight: 1.4 }}>{node.label}</p>
          <p style={{ fontFamily: 'Geist Mono, monospace', fontSize: 9, color: '#6B7079', margin: 0, lineHeight: 1.4 }}>{node.sub}</p>
        </div>
      </Html>
    </group>
  )
}

// ── Camera parallax ──────────────────────────────────────────────────────────
function CameraParallax() {
  const { camera } = useThree()
  const mouse = useRef({ x: 0, y: 0 })
  const base = useMemo(() => new THREE.Vector3(0.8, 1.4, 6.5), [])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth - 0.5) * 2
      mouse.current.y = (e.clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  useFrame(() => {
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, base.x + mouse.current.x * 0.5, 0.04)
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, base.y - mouse.current.y * 0.3, 0.04)
    camera.lookAt(0.8, 0, 0)
  })

  return null
}

// ── Scene ────────────────────────────────────────────────────────────────────
function Scene() {
  const curve = useMemo(() => {
    const pts = NODES.map(n => new THREE.Vector3(...n.pos))
    return new THREE.CatmullRomCurve3(pts)
  }, [])

  const connectors = useMemo(() =>
    NODES.slice(0, -1).map((n, i) => ({
      from: new THREE.Vector3(...n.pos),
      to:   new THREE.Vector3(...NODES[i + 1].pos),
    })),
  [])

  return (
    <>
      <ambientLight intensity={0.20} />
      <pointLight position={[0.8, 3, 4]} intensity={1.2} color="#FF6A2B" distance={12} />
      <pointLight position={[-4.0, 2, 3]} intensity={0.6} color="#3FD9C4" distance={10} />
      <pointLight position={[5.6, 1, 3]} intensity={0.4} color="#FF8C5A" distance={8} />

      {connectors.map((c, i) => <Connector key={i} from={c.from} to={c.to} />)}
      {NODES.map(n => <Station key={n.id} node={n} />)}

      {/* Request packets — teal, left→right */}
      <Packet curve={curve} color={C_TEAL}  speed={0.20} phase={0.0} />
      <Packet curve={curve} color={C_TEAL}  speed={0.20} phase={0.50} />

      {/* Result packets — ember, right→left */}
      <Packet curve={curve} color={C_EMBER} speed={0.16} phase={0.25} reverse />
      <Packet curve={curve} color={C_EMBER} speed={0.16} phase={0.75} reverse />

      <CameraParallax />
    </>
  )
}

// ── FPS guard hook ───────────────────────────────────────────────────────────
function useFPSGuard(onFail: () => void) {
  const frames = useRef<number[]>([])
  const last   = useRef(performance.now())
  const failed = useRef(false)

  const measure = useCallback(() => {
    if (failed.current) return
    const now = performance.now()
    frames.current.push(now - last.current)
    last.current = now
    if (frames.current.length >= 150) {
      const avg = frames.current.reduce((a, b) => a + b, 0) / frames.current.length
      if (avg > 40) { failed.current = true; onFail() }
      frames.current = []
    }
  }, [onFail])

  return measure
}

// ── Internal canvas wrapper with FPS guard ───────────────────────────────────
function CanvasWithFPS({ onFallback }: { onFallback: () => void }) {
  const measure = useFPSGuard(onFallback)

  useFrame(() => { measure() })

  return null
}

// ── Public component with WebGL guard + FPS fallback ────────────────────────
export function ProtocolFlow3D({ onFallback }: { onFallback: () => void }) {
  const webglOk = useMemo(() => {
    try {
      const canvas = document.createElement('canvas')
      return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
    } catch { return false }
  }, [])

  useEffect(() => { if (!webglOk) onFallback() }, [webglOk, onFallback])

  if (!webglOk) return null

  return (
    <div style={{ width: '100%', height: 360 }}>
      <Canvas
        camera={{ position: [0.8, 1.4, 6.5], fov: 44 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 1.5]}
        style={{ background: 'transparent' }}
      >
        <Scene />
        <CanvasWithFPS onFallback={onFallback} />
      </Canvas>
    </div>
  )
}
