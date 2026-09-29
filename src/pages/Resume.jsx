export default function Resume() {
  const skills = [
    'Python',
    'JavaScript',
    'SQL',
    'Java',
    'C/C++',
    'HTML/CSS',
    'React',
    'React Native',
    'OpenCV',
    'Streamlit',
    'Pandas',
    'AWS',
    'MySQL',
    'Git',
    'GitHub',
    'GitHub Actions',
    'CI/CD',
    'VS Code',
    'phpMyAdmin',
  ]

  return (
    <section className="page">
      <header className="page-header">
        <h1>Resume</h1>
        <a
          href="/resume/life-rouby-resume.pdf"
          download="Life-Rouby-Resume.pdf"
          className="btn btn-primary resume-download-btn"
          onClick={() => window.open('/resume/life-rouby-resume.pdf', '_blank', 'noopener,noreferrer')}
        >
          Download Resume (PDF)
        </a>
      </header>

      <div className="resume-section">
        <h2>Experience</h2>

        <div className="timeline">
          <article className="timeline-item">
            <div className="timeline-meta">
              <span className="timeline-date">Aug 2026 — Present</span>
              <span className="timeline-location">Clemson, SC</span>
            </div>
            <h3>AWS Cloud Engineer (Capstone)</h3>
            <p className="timeline-company">
              Axio LLC – Clemson School of Computing Capstone
            </p>
            <ul>
              <li>
                Building a chain-of-custody mission control platform to
                monitor and log autonomous medical drone delivery missions.
              </li>
              <li>
                Designing a serverless AWS backend with API Gateway, Lambda,
                and RDS, secured with Cognito authentication.
              </li>
              <li>
                Collaborating with a cross-disciplinary team of engineers,
                pilots, and developers to deliver sponsor milestones.
              </li>
              <li>
                Technologies: React, AWS (S3, Lambda, RDS, Cognito, API
                Gateway), SQL, GitHub.
              </li>
            </ul>
          </article>

          <article className="timeline-item">
            <div className="timeline-meta">
              <span className="timeline-date">Jun 2026 — Aug 2026</span>
              <span className="timeline-location">Spartanburg, SC</span>
            </div>
            <h3>Full-Stack Web Development Intern</h3>
            <p className="timeline-company">
              American Credit Acceptance
            </p>
            <ul>
              <li>
                Built a full-stack React platform that automated business
                users' manual paper template management into one central
                system, saving an estimated $65K per year.
              </li>
              <li>
                Implemented secure authentication and role-based access
                controls, and deployed the SQL-backed app on AWS with GitHub
                Actions CI/CD.
              </li>
              <li>
                Technologies: React, AWS (S3, Lambda, RDS, Cognito), SQL,
                GitHub Actions.
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
                Developed a coach-facing prospect comparison tool that
                benchmarks current roster players against future prospects on
                key stats and KPIs, replacing manual player-by-player lookups.
              </li>
              <li>
                Built and maintained data pipelines for player tracking and
                game performance analytics.
              </li>
              <li>
                Technologies: Python, Pandas, SQL, Streamlit.
              </li>
            </ul>
          </article>

          <article className="timeline-item">
            <div className="timeline-meta">
              <span className="timeline-date">Jan 2025 — Dec 2025</span>
              <span className="timeline-location">Clemson, SC</span>
            </div>
            <h3>Front-End Developer Intern</h3>
            <p className="timeline-company">
              9x9 Project – Clemson University
            </p>
            <ul>
              <li>
                Developed and maintained a responsive web platform for
                interactive puzzle-solving and user data management.
              </li>
              <li>
                Collaborated with a small team to enhance UX, optimize data
                handling, and ensure cross-browser compatibility.
              </li>
              <li>
                Technologies: HTML/CSS, JavaScript, PHP, MySQL, phpMyAdmin,
                Git/GitHub, Hostinger.
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
            <span className="timeline-date">Aug 2023 — Dec 2026</span>
          </div>

          <h3>B.S. Computer Science, Minor in Business Administration</h3>

          <p className="timeline-company">
            Clemson University
          </p>

          <p>
            GPA: 3.47/4.00
          </p>
        </article>
      </div>
    </section>
  )
}