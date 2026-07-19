export default function Resume() {
  const skills = [
    'Python',
    'JavaScript',
    'React',
    'React Native',
    'SQL',
    'AWS',
    'Streamlit',
    'Pandas',
    'Git',
    'GitHub',
    'GitHub Actions',
    'Java',
    'C/C++',
    'HTML/CSS',
    'MySQL',
    'CI/CD',
  ]

  return (
    <section className="page">
      <header className="page-header">
        <p className="eyebrow">Background</p>
        <h1>Resume</h1>
        <p className="page-intro">
          Computer Science student at Clemson University with experience in
          full-stack web development, data analytics, and software engineering.
        </p>
      </header>

      <div className="resume-section">
        <h2>Experience</h2>

        <div className="timeline">
          <article className="timeline-item">
            <div className="timeline-meta">
              <span className="timeline-date">Jun 2026 — Present</span>
              <span className="timeline-location">Spartanburg, SC</span>
            </div>
            <h3>Full Stack Web Development Intern</h3>
            <p className="timeline-company">
              American Credit Acceptance
            </p>
            <ul>
              <li>
                Developed a full-stack React application with secure
                authentication and role-based access controls.
              </li>
              <li>
                Designed and deployed a SQL-backed solution on AWS with
                automated CI/CD pipelines using GitHub Actions.
              </li>
            </ul>
          </article>

          <article className="timeline-item">
            <div className="timeline-meta">
              <span className="timeline-date">Jan 2026 — May 2026</span>
              <span className="timeline-location">Clemson, SC</span>
            </div>
            <h3>Baseball Analytics Intern</h3>
            <p className="timeline-company">
              Clemson Baseball – Clemson University
            </p>
            <ul>
              <li>
                Built and maintained data pipelines for player tracking and
                game performance analytics.
              </li>
              <li>
                Developed a coach-facing comparison tool for evaluating player
                performance and matchup insights.
              </li>
            </ul>
          </article>

          <article className="timeline-item">
            <div className="timeline-meta">
              <span className="timeline-date">Jan 2025 — Dec 2025</span>
              <span className="timeline-location">Clemson, SC</span>
            </div>
            <h3>Front End Developer Intern</h3>
            <p className="timeline-company">
              9x9 Project – Clemson University
            </p>
            <ul>
              <li>
                Developed and maintained a responsive web platform for
                interactive puzzle-solving and user data management.
              </li>
              <li>
                Collaborated with a development team to improve UX, optimize
                data handling, and ensure cross-browser compatibility.
              </li>
            </ul>
          </article>

          <article className="timeline-item">
            <div className="timeline-meta">
              <span className="timeline-date">Sep 2024 — Dec 2024</span>
              <span className="timeline-location">Clemson, SC</span>
            </div>
            <h3>Laptop Support Technician</h3>
            <p className="timeline-company">
              CCIT – Clemson University
            </p>
            <ul>
              <li>
                Resolved 400+ IT support requests through troubleshooting,
                software support, and customer service.
              </li>
            </ul>
          </article>
        </div>
      </div>

      <div className="resume-section">
        <h2>Skills</h2>

        <div className="skill-tags">
          {skills.map((skill) => (
            <span key={skill} className="tag">
              {skill}
            </span>
          ))}
        </div>
      </div>

      <div className="resume-section">
        <h2>Education</h2>

        <article className="timeline-item">
          <div className="timeline-meta">
            <span className="timeline-date">Aug 2023 — May 2027</span>
          </div>

          <h3>B.S. Computer Science</h3>

          <p className="timeline-company">
            Clemson University
          </p>

          <p>
            Minor in Business Administration • GPA: 3.30/4.00
          </p>

          <p>
            Coursework: Data Structures & Algorithms, Discrete Structures,
            Computer Organization, Software Development Foundations
          </p>
        </article>
      </div>
    </section>
  )
}