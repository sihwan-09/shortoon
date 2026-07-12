import { ComicFeed } from "./components/ComicFeed";

export default function Home() {
  return (
    <main className="app-shell">
      <header className="app-header" aria-label="Shorttoon header">
        <div className="header-title"><span>FOR YOU</span><strong>Today&apos;s shorttoon</strong></div>
        <a className="brand" href="/" aria-label="Shorttoon home"><span className="brand-logo" role="img" aria-label="Shorttoon" /></a>
      </header>
      <ComicFeed />
    </main>
  );
}
