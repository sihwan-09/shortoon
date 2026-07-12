import { ComicFeed } from "./components/ComicFeed";

export default function Home() {
  return (
    <main className="app-shell">
      <header className="app-header" aria-label="Shorttoon header">
        <a className="brand" href="/" aria-label="Shorttoon home"><span className="brand-logo" role="img" aria-label="Shorttoon" /></a>
        <button className="search-button" type="button" aria-label="Search shorttoons"><span aria-hidden="true" /></button>
      </header>
      <ComicFeed />
      <nav className="bottom-nav" aria-label="Main navigation">
        <a className="bottom-nav-item is-active" href="/" aria-current="page" aria-label="Home">
          <span className="home-icon" aria-hidden="true" />
          <small>HOME</small>
        </a>
        <button className="bottom-nav-item upload-nav-item" type="button" aria-label="Upload shorttoon">
          <span className="plus-icon" aria-hidden="true">+</span>
          <small>UPLOAD</small>
        </button>
        <button className="bottom-nav-item" type="button" aria-label="My page">
          <span className="my-icon" aria-hidden="true">MY</span>
          <small>MY</small>
        </button>
      </nav>
    </main>
  );
}
