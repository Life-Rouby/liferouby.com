import { Link } from 'react-router-dom'
import projects from '../data/projects'
import useImageTone from '../components/useImageTone'

// One project tile; light images get dark title text.
function ProjectTile({ project }) {
  const tone = useImageTone(project.image)
  return (
    <Link
      to={`/projects/${project.slug}`}
      className={`project-tile${tone === 'light' ? ' is-light' : ''}`}
    >
      <img
        src={project.image}
        alt=""
        className="project-tile-img"
      />
      <div className="project-tile-overlay">
        <h2 className="project-tile-title">{project.title}</h2>
        {project.tagline && (
          <p className="project-tile-tagline">{project.tagline}</p>
        )}
      </div>
    </Link>
  )
}

export default function Projects() {
  return (
    <section className="page">
      <header className="page-header">
        <h1>Projects</h1>
        <p className="page-intro">
          Cool things i've done
        </p>
      </header>

      <div className="project-tile-grid">
        {projects.map((project) => (
          <ProjectTile key={project.slug} project={project} />
        ))}
      </div>
    </section>
  )
}
