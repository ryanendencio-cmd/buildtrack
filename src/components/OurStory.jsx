import React from 'react'

export default function OurStory() {
  return (
    <section id="about" className="our-story-section">
      {/* Top row: big heading left + paragraph right */}
      <div className="our-story-top">
        <div className="our-story-heading-wrap">
          <p className="our-story-label">Our Story</p>
          <h2 className="our-story-heading">
            Built around the needs of Sotalbo Construction.
          </h2>
        </div>
        <div className="our-story-right">
          <p className="our-story-desc">
            BuildTrack is designed around the company's real construction
            operations, with a focus on better organization, visibility,
            and day-to-day control.
          </p>
          <a href="#features" className="our-story-btn">
            Learn More <span className="our-story-arrow">→</span>
          </a>
          <div className="our-story-img-sm">
            <img src="/hero-bg.jpg" alt="Construction site" />
          </div>
          <div className="our-story-who">
            <p className="our-story-who-label">Who We Are</p>
            <p className="our-story-who-text">
              We are Sotalbo Construction, your strategic partner for construction
              and infrastructure solutions — bringing complex projects to life through
              dedicated craftsmanship and day-to-day accountability.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom row: two large photos + mission/vision cards */}
      <div className="our-story-bottom">
        <div className="our-story-photo-wrap">
          <img src="/hero-bg.jpg" alt="Workers on site" className="our-story-photo" />
          <div className="our-story-mission-card">
            <div className="mission-icon">🏗</div>
            <div>
              <p className="mission-card-label">Statement:</p>
              <p className="mission-card-title">Our Mission</p>
              <p className="mission-card-text">
                To organize and streamline Sotalbo Construction's daily
                project operations — expenses, manpower, and materials —
                all in one place.
              </p>
            </div>
          </div>
        </div>
        <div className="our-story-photo-wrap">
          <img src="/hero-bg.jpg" alt="City skyline" className="our-story-photo" />
          <div className="our-story-mission-card">
            <div className="mission-icon">🎯</div>
            <div>
              <p className="mission-card-label">Statement:</p>
              <p className="mission-card-title">Our Vision</p>
              <p className="mission-card-text">
                To be the most organized and transparent construction
                company in the region — setting the standard for
                accountability and project excellence.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
