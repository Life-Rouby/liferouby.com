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
    </section>
  )
}
