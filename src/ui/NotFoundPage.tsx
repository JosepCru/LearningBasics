import { Link } from 'react-router';
import { Status } from './Status';
import { useDocumentTitle } from './useDocumentTitle';

export function NotFoundPage() {
  useDocumentTitle('No encontrado');
  return (
    <Status kind="empty" title="Esta página no existe">
      <p>Puede que el enlace sea antiguo o que el contenido se haya movido.</p>
      <Link to="/" className="btn">
        Ir al inicio
      </Link>
    </Status>
  );
}
