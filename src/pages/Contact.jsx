export default function Contact() {
  return (
    <section className="page">
      <header className="page-header">
        <p className="eyebrow">Say hello</p>
        <h1>Contact Me</h1>
        <p className="page-intro">
          coming soon...
        </p>
        {/* 
        <p className="page-intro">
          Have a question, opportunity, or just want to connect? Reach out
          through any of the channels below.
        </p>
        */}
      </header>

      <div className="contact-grid">
        {/* 
        <div className="contact-links card">
          <h2>Direct links</h2>
          <ul className="link-list">
            <li>
              <a href="mailto:hello@life-rouby.com">hello@life-rouby.com</a>
            </li>
            <li>
              <a href="https://github.com/" target="_blank" rel="noopener noreferrer">
                GitHub
              </a>
            </li>
            <li>
              <a href="https://linkedin.com/" target="_blank" rel="noopener noreferrer">
                LinkedIn
              </a>
            </li>
          </ul>
        </div>
        */}
        {/* 
        <form
          className="contact-form card"
          onSubmit={(e) => {
            e.preventDefault()
            alert('Form placeholder — wire this up to a backend or service like Formspree.')
          }}
        >
          <h2>Send a message</h2>
          <label>
            Name
            <input type="text" name="name" required placeholder="Your name" />
          </label>
          <label>
            Email
            <input type="email" name="email" required placeholder="you@example.com" />
          </label>
          <label>
            Message
            <textarea
              name="message"
              required
              rows={5}
              placeholder="What's on your mind?"
            />
          </label>
          <button type="submit" className="btn btn-primary">
            Send message
          </button>
        </form>
        */}
      </div>
    </section>
  )
}
