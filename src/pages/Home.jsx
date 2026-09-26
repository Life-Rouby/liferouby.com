import { Link } from 'react-router-dom'
import Timeline from '../components/Timeline'

const sections = [
  { to: '/about', label: 'About Me' },
  { to: '/projects', label: 'Projects' },
  { to: '/resume', label: 'Resume' },
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
            I'm a senior at Clemson University studying Computer Science with a minor in Business Administration, graduating in December 2026.
          </p>
          <p> <br></br></p>
          <p className="home-bio">This site is part portfolio, part résumé, and part personal hub, where I share my projects and keep track of what I'm working on. Thanks for stopping by!</p>
        </div>
      </div>

      <nav className="home-nav" aria-label="Site sections">
        {sections.map(({ to, label }) => (
          <Link key={to} to={to} className="home-nav-link">
            {label}
          </Link>
        ))}
      </nav>
    </section>
  )
}
