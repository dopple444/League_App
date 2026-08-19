'use client';

export default function GlobalError({ reset }: { readonly reset: () => void }) {
  return (
    <main className="main-content" id="main-content">
      <div className="content-width">
        <section className="empty-state" role="alert">
          <p className="eyebrow">Something went wrong</p>
          <h1>We could not finish loading this page.</h1>
          <p>No changes were made. You can safely try again.</p>
          <button onClick={reset} type="button">
            Try again
          </button>
        </section>
      </div>
    </main>
  );
}
