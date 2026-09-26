import { useLayoutEffect, useRef, useState } from 'react'

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

const VISIBLE_COUNT = 4

export default function Timeline({ compact = false }) {
  const viewportRef = useRef(null)
  const trackRef = useRef(null)
  const [itemWidth, setItemWidth] = useState(0)
  const [rowHeight, setRowHeight] = useState(0)
  const [start, setStart] = useState(0)

  const maxStart = Math.max(0, milestones.length - VISIBLE_COUNT)

  useLayoutEffect(() => {
    const el = viewportRef.current
    if (!el) return

    const update = () => setItemWidth(el.getBoundingClientRect().width / VISIBLE_COUNT)
    update()

    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Row height must fit the tallest wrapped title at the current item width —
  // measure every content block (not just the visible page) and size to the max.
  useLayoutEffect(() => {
    if (!itemWidth || !trackRef.current) return

    const measure = () => {
      const contents = trackRef.current.querySelectorAll('.vtimeline-content')
      let max = 0
      contents.forEach((c) => {
        max = Math.max(max, c.getBoundingClientRect().height)
      })
      if (max) setRowHeight(Math.ceil(max * 2 + 48))
    }

    measure()
    // Re-measure once web fonts finish loading — text can reflow taller
    // than the fallback-font measurement taken on first paint.
    document.fonts?.ready.then(measure)
  }, [itemWidth])

  const goPrev = () => setStart((s) => Math.max(0, s - VISIBLE_COUNT))
  const goNext = () => setStart((s) => Math.min(maxStart, s + VISIBLE_COUNT))

  return (
    <div className={`vtimeline ${compact ? 'vtimeline--compact' : ''}`}>
      <button
        type="button"
        className="vtimeline-arrow vtimeline-arrow--prev"
        onClick={goPrev}
        disabled={start === 0}
        aria-label="Show earlier milestones"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M15 5 L8 12 L15 19" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className="vtimeline-viewport" ref={viewportRef}>
        <div
          className="vtimeline-track"
          ref={trackRef}
          style={{ transform: `translateX(-${start * itemWidth}px)` }}
        >
          {milestones.map((m, i) => (
            <div
              key={m.year + m.title}
              className={`vtimeline-row ${i % 2 === 0 ? 'is-left' : 'is-right'}`}
              style={
                itemWidth
                  ? { width: itemWidth, flexBasis: itemWidth, height: rowHeight || undefined }
                  : undefined
              }
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

      <button
        type="button"
        className="vtimeline-arrow vtimeline-arrow--next"
        onClick={goNext}
        disabled={start === maxStart}
        aria-label="Show later milestones"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M9 5 L16 12 L9 19" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  )
}
