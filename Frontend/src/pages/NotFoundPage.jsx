import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="state-message">
      <h1>We can't find that page</h1>
      <p>The link may be old, or the list may have been renamed.</p>
      <Link className="button" to="/">Go to dashboard</Link>
    </div>
  );
}
