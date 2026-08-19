import Link from 'next/link';

export default function NotFoundPage() {
  return (
    <main className="main-content" id="main-content">
      <div className="content-width">
        <section className="empty-state">
          <p className="eyebrow">Not found</p>
          <h1>This page is not published.</h1>
          <p>It may not exist, or league staff may not have published it.</p>
          <Link className="button" href="/">
            Return home
          </Link>
        </section>
      </div>
    </main>
  );
}
