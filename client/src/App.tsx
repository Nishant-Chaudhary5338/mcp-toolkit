import { NavBar } from './components/NavBar'
import { Hero } from './sections/Hero'
import { Architecture } from './sections/Architecture'
import { ToolCatalog } from './sections/ToolCatalog'
import { Workflows } from './sections/Workflows'
import { Article } from './sections/Article'
import { Footer } from './sections/Footer'

export default function App() {
  return (
    <>
      <NavBar />
      <main>
        <Hero />
        <Architecture />
        <ToolCatalog />
        <Workflows />
        <Article />
      </main>
      <Footer />
    </>
  )
}
