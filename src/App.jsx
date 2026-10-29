import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Resume from './pages/Resume'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import About from './pages/About'
import CFBowledgePage from './cfbowledge/CFBowledgePage'
import CFBNilComparisonToolPage from './cfb-nil-comparison-tool/CFBNilComparisonToolPage'
import TeamPage from './cfb-nil-comparison-tool/TeamPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="resume" element={<Resume />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:slug" element={<ProjectDetail />} />
        <Route path="about" element={<About />} />
        <Route path="cfb-nil-comparison-tool" element={<CFBNilComparisonToolPage />} />
        <Route path="cfb-nil-comparison-tool/team/:slug" element={<TeamPage />} />
      </Route>
      <Route path="/cfbowledge" element={<CFBowledgePage />} />
    </Routes>
  )
}
