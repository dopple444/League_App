export default function LoadingPage() {
  return (
    <main aria-busy="true" aria-live="polite" className="main-content" id="main-content">
      <div className="content-width">
        <p>Loading league information…</p>
      </div>
    </main>
  );
}
