import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Status } from './Status';

type Props = { children: ReactNode; resetKey?: string };
type State = { error: Error | null; resetKey?: string };

/** Si una pantalla falla, muestra el error sin tumbar el resto de la app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    // Al navegar a otra pantalla, se vuelve a intentar.
    return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Status kind="error" title="Esta pantalla ha fallado">
        <p>
          Tus datos están a salvo en el dispositivo. Detalle técnico: <code>{this.state.error.message}</code>
        </p>
        <button className="btn" onClick={() => location.reload()}>
          Recargar la aplicación
        </button>
      </Status>
    );
  }
}
