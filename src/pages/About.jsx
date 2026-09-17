export default function About() {
  return (
    <section className="page">
      <header className="page-header">
        <p className="eyebrow">Who I am</p>
        <h1>About Me</h1>
      </header>

      <div className="about-content">
        <div className="about-text">
          <p>
            My name is Life Rouby! I am a rising senior at Clemson University studying Computer Science.
            Currently, I am participating in American Credit Acceptance's Summer 2026 Internship Program with the IT Department.
            Within IT, I am working with the App Dev Team as a Full Stack Web Developer Intern.
          </p>
          <p>
            Outisde of school and building my career, my hobbies include:
            <ul>
              <li>- Watching College Football</li>
              <li>- Creating Videos on YouTube</li>
              <li>- Playing Volleyball, Basketball, and Football</li>
              <li>- Collecting Pokemon Cards</li>
              <li>- Spending time with my family and friends</li>
            </ul>
          </p>
        </div>

        <aside className="about-aside card">
          <h2>Quick facts</h2>
          <dl className="facts-list">
            <div>
              <dt>Location</dt>
              <dd>Greenville, SC</dd>
            </div>
            <div>
              <dt>Education</dt>
              <dd>Clemson University</dd>
            </div>
            <div>
              <dt>Interests</dt>
              <dd>Web dev, open source, design</dd>
            </div>
          </dl>
        </aside>
      </div>

      <div className="resume-section">
        <h2>My Journey</h2>

        <div className="vtimeline">
          {milestones.map((m, i) => (
            <div
              key={m.year + m.title}
              className={`vtimeline-row ${i % 2 === 0 ? 'is-left' : 'is-right'}`}
            >
              <div className="vtimeline-content">
                <span className="vtimeline-year">{m.year}</span>
                <h3>{m.title}</h3>
                {m.location && <p className="vtimeline-location">{m.location}</p>}
                <p>{m.blurb}</p>
              </div>
              <div className="vtimeline-node" aria-hidden="true" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

const milestones = [
  {
    year: 'May 2005',
    title: 'Born',
    location: 'Greenville, SC'
  },
  {
    year: 'August 2022',
    title: 'Joined J.L. Mann High School Robotics Club',
    blurb: 'My first exposure to working with technology.',
  },
  {
    year: 'May 2023',
    title: 'Graduated from High School',
    blurb: 'J.L. Mann High School',
  },
  {
    year: 'August 2023',
    title: 'Enrolled at Clemson University',
    location: 'Clemson, SC',
    blurb: 'Began my B.S. in Computer Science.',
  },
  {
    year: 'September 2024',
    title: 'Began working at CCIT',
    location: 'Clemson, SC',
    blurb: 'This was my first on-campus job.',
  },
  {
    year: 'January 2025',
    title: 'Began working as a Front End Developer Intern',
    location: 'Clemson, SC',
    blurb: '9x9 Project — first real web development role.',
  },
  {
    year: 'January 2026',
    title: 'Began working as a Baseball Analytics Intern',
    location: 'Clemson, SC',
    blurb: 'Clemson Baseball - first time I combined my love of sports with data.',
  },
  {
    year: 'June 2026',
    title: 'Began working as a Full Stack Web Development Intern',
    location: 'Spartanburg, SC',
    blurb: 'This was my first time working in corporate tech.',
  },
  {
    year: 'December 2027',
    title: 'Graduating Clemson University',
    location: 'Clemson, SC',
    blurb: 'B.S. Computer Science, on to the next chapter.',
  },
]