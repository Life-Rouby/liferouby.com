import Timeline from '../components/Timeline'

export default function About() {
  return (
    <section className="page">
      <div className="journey-window about-photos">
        <img
          src="/images/about/photo-collage.jpg"
          alt="Collage of photos from Life's life — football games, travel, friends, and family"
          className="about-photos-img"
        />
      </div>

      <header className="page-header">
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
      </div>

      <div className="resume-section journey-window">
        <h2>My Journey</h2>
        <Timeline />
      </div>
    </section>
  )
}
