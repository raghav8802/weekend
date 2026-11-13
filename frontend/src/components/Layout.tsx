import { Link, Outlet, useLocation } from 'react-router-dom'

const YEAR = new Date().getFullYear()

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="Weekend home">
      <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill="var(--brand)" />
        <path d="M7 15.5 16 8l9 7.5" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 14v10h12V14" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinejoin="round" />
        <path d="M14.5 24v-5h3v5" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" />
      </svg>
      <span>weekend</span>
    </Link>
  )
}

export function Layout() {
  const { pathname } = useLocation()
  const staff = pathname.startsWith('/admin') || pathname.startsWith('/host')
  return (
    <div className="app">
      <header className="header">
        <div className="container header-inner">
          <Logo />
          {staff ? (
            <span className="header-note">{pathname.startsWith('/admin') ? 'Team' : 'Host'} dashboard</span>
          ) : (
            <span className="header-note">Verified farmhouses in Delhi NCR · 0% commission</span>
          )}
        </div>
      </header>
      <main className={staff ? 'main main-staff' : 'main'}>
        <Outlet />
      </main>
      <footer className="footer">
        <div className="container footer-inner">
          <div>
            <Logo />
            <p className="muted">Farmhouses for day-outs, parties and stays across Delhi, Gurugram, Noida and Faridabad.</p>
          </div>
          <div>
            <h4>Booking safely</h4>
            <p className="muted">
              When you call or message a host, the booking is agreed directly between you and them. Visit or video-call
              the farmhouse before paying any advance.
            </p>
          </div>
          <div>
            <h4>For hosts</h4>
            <p className="muted">List your farmhouse with zero commission. Founding hosts list free for 12 months.</p>
          </div>
        </div>
        <div className="container footer-base muted">© {YEAR} weekend</div>
      </footer>
    </div>
  )
}
