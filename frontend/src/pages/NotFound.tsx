import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="empty">
      <h1>Page not found</h1>
      <p>
        <Link to="/">Back to all farmhouses</Link>
      </p>
    </div>
  )
}
