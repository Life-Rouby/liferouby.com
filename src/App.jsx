import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Resume from './pages/Resume'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import About from './pages/About'
import CFBowledgePage from './cfbowledge/CFBowledgePage'
import PortalCompToolPage from './portal-comp-tool/PortalCompToolPage'
import TeamPage from './portal-comp-tool/TeamPage'
import PlayerPage from './portal-comp-tool/PlayerPage'

// The tool used to live at /cfb-nil-comparison-tool; keep old links working.
function OldTeamRedirect() {
  const { slug } = useParams()
  return <Navigate to={`/portal-comp-tool/team/${slug}`} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="resume" element={<Resume />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:slug" element={<ProjectDetail />} />
        <Route path="about" element={<About />} />
        <Route path="portal-comp-tool" element={<PortalCompToolPage />} />
        <Route path="portal-comp-tool/team/:slug" element={<TeamPage />} />
        <Route path="portal-comp-tool/player/:id" element={<PlayerPage />} />
        <Route path="cfb-nil-comparison-tool" element={<Navigate to="/portal-comp-tool" replace />} />
        <Route path="cfb-nil-comparison-tool/team/:slug" element={<OldTeamRedirect />} />
      </Route>
      <Route path="/cfbowledge" element={<CFBowledgePage />} />
    </Routes>
  )
}
