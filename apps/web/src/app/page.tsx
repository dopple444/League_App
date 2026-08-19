import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="main-content" id="main-content">
      <div className="content-width">
        <section className="hero">
          <div>
            <p className="eyebrow">The official league source</p>
            <h1>One place for every game night.</h1>
            <p className="lede">
              See the schedule and public team information your league has reviewed and published.
              Staff updates stay traceable from draft to public release.
            </p>
            <div className="action-row">
              <Link className="button" href="/sign-in">
                Staff sign in
              </Link>
              <a className="button secondary" href="#league-features">
                Learn more
              </a>
            </div>
          </div>
          <aside className="hero-card" aria-label="Publication promise">
            <p className="eyebrow">Published with care</p>
            <h2>What you see is official.</h2>
            <p>
              Draft seasons and private participant information never appear on public pages. Every
              published change is attributable to authorized league staff.
            </p>
          </aside>
        </section>
        <section aria-labelledby="features-heading" id="league-features">
          <p className="eyebrow">Built for league day</p>
          <h2 id="features-heading">Clear information, wherever you are.</h2>
          <div className="grid feature-grid">
            <article className="card">
              <h3>Public schedules</h3>
              <p className="muted">
                Game times, matchups, statuses, fields, and approved directions.
              </p>
            </article>
            <article className="card">
              <h3>Safe team pages</h3>
              <p className="muted">Only explicitly approved public team names are displayed.</p>
            </article>
            <article className="card">
              <h3>Audited administration</h3>
              <p className="muted">
                Authorized changes carry versions, request references, and history.
              </p>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
