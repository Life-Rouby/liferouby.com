import { Link } from 'react-router-dom'
import projects from '../data/projects'

export default function Projects() {
  return (
    <section className="page">
      <header className="page-header">
        <p className="eyebrow">Work</p>
        <h1>Projects</h1>
        <p className="page-intro">
          Cool things I've done
        </p>
      </header>

      <div className="project-tile-grid">
        {projects.map((project) => (
          <Link
            key={project.slug}
            to={`/projects/${project.slug}`}
            className="project-tile"
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
        ))}
      </div>
    </section>
  )
}
