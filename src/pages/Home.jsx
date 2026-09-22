import { Link } from 'react-router-dom'
import Timeline from '../components/Timeline'

const sections = [
  { to: '/resume', label: 'Resume' },
  { to: '/projects', label: 'Projects' },
  { to: '/about', label: 'About Me' },
  { to: '/contact', label: 'Contact Me' },
]

export default function Home() {
  return (
    <section className="page home">
      <div className="home-hero">
        <div className="home-headshot">
          <img
            src="/images/headshot/headshot.jpg"
            alt="Life Rouby"
            className="home-headshot-img"
          />
        </div>

        <div className="home-intro">
          <p className="home-eyebrow">Senior · Clemson University · Computer Science</p>
          <h1 className="home-title">
            Hey, I'm <span className="accent">Life</span>
          </h1>
          <p className="home-bio">
            I'm working toward a degree in Computer Science and building a career
            as an app developer.
          </p>
        </div>
      </div>

      <nav className="home-nav" aria-label="Site sections">
        {sections.map(({ to, label }) => (
          <Link key={to} to={to} className="home-nav-link">
            {label}
          </Link>
        ))}
      </nav>

      <div className="resume-section">
        <h2>My Journey</h2>
        <Timeline compact />
      </div>
    </section>
  )
}
