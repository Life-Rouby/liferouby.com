import { Link, useParams } from 'react-router-dom'
import projects from '../data/projects'

const sections = [
  { key: 'inspiration', heading: 'Inspiration' },
  { key: 'whatItDoes', heading: 'What it does' },
  { key: 'howWeBuiltIt', heading: 'How we built it' },
  { key: 'whatWeLearned', heading: 'What we learned' },
]

export default function ProjectDetail() {
  const { slug } = useParams()
  const project = projects.find((p) => p.slug === slug)

  if (!project) {
    return (
      <section className="page">
        <header className="page-header">
          <h1>Project not found</h1>
        </header>
        <Link to="/projects" className="btn btn-secondary">
          &larr; Back to projects
        </Link>
      </section>
    )
  }

  return (
    <section className="page project-detail">
      <Link to="/projects" className="project-detail-back">
        &larr; Back to projects
      </Link>

      <div className="project-detail-hero">
        <img src={project.image} alt="" className="project-detail-hero-img" />
        <div className="project-detail-hero-overlay">
          <h1 className="project-detail-title">{project.title}</h1>
          {project.tagline && (
            <p className="project-detail-tagline">{project.tagline}</p>
          )}
        </div>
      </div>

      <div className="project-detail-body">
        {(project.link || project.github) && (
          <div className="project-links">
            {project.link && (
              <a href={project.link} target="_blank" rel="noopener noreferrer">
                Demo
              </a>
            )}
            {project.github && (
              <a href={project.github} target="_blank" rel="noopener noreferrer">
                GitHub
              </a>
            )}
          </div>
        )}

        {sections.map(
          ({ key, heading }) =>
            project[key] &&
            project[key].length > 0 && (
              <div key={key} className="project-detail-section">
                <h2>{heading}</h2>
                {project[key].map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>
            )
        )}

        {project.tech && project.tech.length > 0 && (
          <div className="project-detail-section">
            <h2>Technologies</h2>
            <div className="skill-tags">
              {project.tech.map((t) => (
                <span key={t} className="tag tag--small">
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {project.collaborators && project.collaborators.length > 0 && (
          <div className="project-detail-section">
            <h2>Collaborators</h2>
            <div className="skill-tags">
              {project.collaborators.map((c) => (
                <span key={c} className="tag tag--small">
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        {project.gallery && project.gallery.length > 0 && (
          <div className="project-detail-section">
            <h2>Gallery</h2>
            <div className="project-detail-gallery">
              {project.gallery.map((src, i) => (
                <img key={i} src={src} alt="" className="project-detail-gallery-img" />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
