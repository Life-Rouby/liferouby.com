import { useEffect, useRef } from 'react'

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

export default function Timeline({ compact = false }) {
  const timelineRef = useRef(null)

  useEffect(() => {
    const el = timelineRef.current
    if (!el) return

    const onWheel = (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }

    let isDragging = false
    let startX = 0
    let startScroll = 0

    const onPointerDown = (e) => {
      if (e.pointerType !== 'mouse') return
      isDragging = true
      startX = e.clientX
      startScroll = el.scrollLeft
      el.classList.add('is-dragging')
    }

    const onPointerMove = (e) => {
      if (!isDragging) return
      el.scrollLeft = startScroll - (e.clientX - startX)
    }

    const stopDragging = () => {
      isDragging = false
      el.classList.remove('is-dragging')
    }

    const updateEdgeFade = () => {
      el.classList.toggle('at-start', el.scrollLeft <= 1)
      el.classList.toggle('at-end', el.scrollLeft + el.clientWidth >= el.scrollWidth - 1)
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', stopDragging)
    el.addEventListener('pointerleave', stopDragging)
    el.addEventListener('scroll', updateEdgeFade, { passive: true })
    window.addEventListener('resize', updateEdgeFade)
    updateEdgeFade()

    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', stopDragging)
      el.removeEventListener('pointerleave', stopDragging)
      el.removeEventListener('scroll', updateEdgeFade)
      window.removeEventListener('resize', updateEdgeFade)
    }
  }, [])

  return (
    <div className={`vtimeline ${compact ? 'vtimeline--compact' : ''}`} ref={timelineRef}>
      <div className="vtimeline-track">
        {milestones.map((m, i) => (
          <div
            key={m.year + m.title}
            className={`vtimeline-row ${i % 2 === 0 ? 'is-left' : 'is-right'}`}
          >
            <div className="vtimeline-content">
              <span className="vtimeline-year">{m.year}</span>
              <h3>{m.title}</h3>
            </div>
            <div className="vtimeline-node" aria-hidden="true" />
          </div>
        ))}
      </div>
    </div>
  )
}
