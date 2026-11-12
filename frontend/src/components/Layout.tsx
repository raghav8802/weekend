import { Link, Outlet } from 'react-router-dom'

export function Layout() {
  return (
    <div className="app">
      <header className="topbar">
        <div className="wrap topbar-inner">
          <Link to="/" className="brand">
            Weekend
          </Link>
          <span className="tagline">Verified farmhouses · Delhi NCR · 0% commission</span>
        </div>
      </header>
      <main className="wrap main">
        <Outlet />
      </main>
      <footer className="footer">
        <div className="wrap">
          Bookings made by calling or messaging a host are agreed directly between you and the host. Never pay an
          advance before you have visited the farmhouse or seen it on a video call.
        </div>
      </footer>
    </div>
  )
}
