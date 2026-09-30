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
            Hello, my name is Life Rouby! I am currently a senior at Clemson University, where I am majoring in Computer Science with a minor in Business Administration.
          </p>
          <p>Over the past summer, I participated in American Credit Acceptance's Summer 2026 Internship Program within the IT Department. At ACA, I spent my time working with the App Development and DevOps teams, where I gained experience as a Full Stack Web Developer Intern. My main contribution over the summer was a template management app, which is estimated to save the business over $65,000 annually.</p>
          <p>I am looking to continue building my career as an app developer, and I enjoy making things that make other people's day-to-day lives easier.</p>
          <p>Outside of tech, I spend my time watching college football, creating videos on YouTube, playing volleyball, basketball, and football, collecting Pokémon cards, and spending time with my family and friends.</p>
          <p>Thank you for visiting my website! If you want to get in contact with me, the best way is to email me at liferouby@gmail.com.</p>
        </div>
      </div>

      <div className="resume-section journey-window">
        <h2>My Journey</h2>
        <Timeline />
      </div>
    </section>
  )
}
