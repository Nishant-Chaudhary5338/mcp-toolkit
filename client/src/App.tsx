import { Suspense, lazy } from 'react'
import { NavBar } from './components/NavBar'
import { Hero } from './sections/Hero'
import { Architecture } from './sections/Architecture'
import { Footer } from './sections/Footer'

const ToolCatalog = lazy(() => import('./sections/ToolCatalog').then(m => ({ default: m.ToolCatalog })))
const Workflows   = lazy(() => import('./sections/Workflows').then(m => ({ default: m.Workflows })))

function SectionSkeleton() {
  return (
    <div className="py-32 px-6 flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-[#25282D] border-t-[#FF6A2B] animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <>
      <NavBar />
      <main>
        <Hero />
        <Architecture />
        <Suspense fallback={<SectionSkeleton />}>
          <ToolCatalog />
        </Suspense>
        <Suspense fallback={<SectionSkeleton />}>
          <Workflows />
        </Suspense>
      </main>
      <Footer />
    </>
  )
}
