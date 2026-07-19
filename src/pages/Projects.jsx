const projects = [
  {
    title: 'Project One',
    description:
      'A brief description of what this project does and why you built it. Mention the problem it solves.',
    tech: ['React', 'Node.js', 'PostgreSQL'],
    link: '#',
    github: '#',
  },
  {
    title: 'Project Two',
    description:
      'Another project summary. Keep it concise — one or two sentences about the goal and outcome.',
    tech: ['Python', 'FastAPI', 'Docker'],
    link: '#',
    github: '#',
  },
  {
    title: 'Project Three',
    description:
      'A side project, open-source contribution, or school assignment you are proud of.',
    tech: ['TypeScript', 'Next.js', 'Tailwind'],
    link: null,
    github: '#',
  },
]

export default function Projects() {
  return (
    <section className="page">
      <header className="page-header">
        <p className="eyebrow">Work</p>
        <h1>Projects</h1>
        <p className="page-intro">
          coming soon...
        </p>
        {/* 
        <p className="page-intro">
          A selection of things I&apos;ve built. Replace these placeholders
          with your own projects and links.
        </p>
        */}
      </header>

      <div className="project-grid">
        {/* 
        {projects.map((project) => (
          <article key={project.title} className="card project-card">
            <h2>{project.title}</h2>
            <p>{project.description}</p>
            <div className="skill-tags">
              {project.tech.map((t) => (
                <span key={t} className="tag tag--small">
                  {t}
                </span>
              ))}
            </div>
            <div className="project-links">
              {project.link && (
                <a href={project.link} target="_blank" rel="noopener noreferrer">
                  Live demo
                </a>
              )}
              {project.github && (
                <a href={project.github} target="_blank" rel="noopener noreferrer">
                  GitHub
                </a>
              )}
            </div>
          </article>
        ))}
        */}
      </div>
    </section>
  )
}
