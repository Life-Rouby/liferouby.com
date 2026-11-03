import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Resume from './pages/Resume'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import About from './pages/About'
import CFBowledgePage from './cfbowledge/CFBowledgePage'
import CFBargainPage from './cfbargain/CFBargainPage'
import TeamPage from './cfbargain/TeamPage'
import PlayerPage from './cfbargain/PlayerPage'

// CFBargain used to live at /cfb-nil-comparison-tool and then /portal-comp-tool;
// keep old links working (query strings like ?season= carry over).
const OLD_CFBARGAIN_PATHS = ['cfb-nil-comparison-tool', 'portal-comp-tool']

function OldCFBargainRedirect() {
  const { '*': rest } = useParams()
  const { search } = useLocation()
  return <Navigate to={`/cfbargain${rest ? `/${rest}` : ''}${search}`} replace />
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
        <Route path="cfbargain" element={<CFBargainPage />} />
        <Route path="cfbargain/team/:slug" element={<TeamPage />} />
        <Route path="cfbargain/player/:id" element={<PlayerPage />} />
        {OLD_CFBARGAIN_PATHS.map((path) => (
          <Route key={path} path={`${path}/*`} element={<OldCFBargainRedirect />} />
        ))}
      </Route>
      <Route path="/cfbowledge" element={<CFBowledgePage />} />
    </Routes>
  )
}
