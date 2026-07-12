import { ComicFeed } from "./components/ComicFeed";

export default function Home() {
  return (
    <main className="app-shell">
      <header className="app-header" aria-label="Shorttoon header">
        <a className="brand" href="/" aria-label="Shorttoon home"><span className="brand-logo" role="img" aria-label="Shorttoon" /></a>
        <button className="search-button" type="button" aria-label="Search shorttoons"><span aria-hidden="true" /></button>
      </header>
      <ComicFeed />
    </main>
  );
}
