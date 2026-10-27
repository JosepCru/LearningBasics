import { Status } from '../../ui/Status';
import type { TopicState } from './content';

/** Muestra carga o error de un tema; devuelve null cuando ya está listo. */
export function TopicLoadState({ state }: { state: TopicState }) {
  if (state.status === 'loading') return <Status kind="loading" title="Cargando el tema" />;
  if (state.status === 'error') {
    return (
      <Status kind="error" title="No se pudo cargar el tema">
        <p>
          {navigator.onLine
            ? 'Puede que la aplicación se haya actualizado. Recarga la página.'
            : 'Estás sin conexión y este tema aún no está guardado en el dispositivo. Conéctate y vuelve a intentarlo.'}
        </p>
        <button className="btn" onClick={state.retry}>
          Volver a intentarlo
        </button>
      </Status>
    );
  }
  return null;
}
