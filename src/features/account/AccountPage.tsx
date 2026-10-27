import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { sendCode, signOut, verifyCode } from '../../sync/auth';
import { syncNow } from '../../sync/manager';
import { Status } from '../../ui/Status';
import { useDocumentTitle } from '../../ui/useDocumentTitle';
import { useNow, useQuarantineCount, useSyncState } from '../learning/learning';
import styles from './account.module.css';
import { syncSummary, timeAgo } from './syncText';

export function AccountPage() {
  useDocumentTitle('Cuenta y sincronización');
  const sync = useSyncState();

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Cuenta y sincronización</h1>
      {sync.phase === 'disabled' ? (
        <Status kind="empty" title="La sincronización no está configurada en esta versión">
          <p>
            Todo funciona y se guarda en este dispositivo. Para sincronizar entre dispositivos hay que conectar un
            proyecto de Supabase (ver docs/DEPLOY.md).
          </p>
        </Status>
      ) : sync.phase === 'signed-out' ? (
        <SignIn />
      ) : (
        <SignedIn />
      )}
      <p className={styles.note}>
        Tu historial siempre se guarda primero en este dispositivo y funciona sin conexión. La cuenta solo sirve para
        copiarlo a la nube y tenerlo en tus otros dispositivos. Puedes descargar una copia en{' '}
        <Link to="/progress">Progreso</Link>.
      </p>
    </section>
  );
}

function SignIn() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitEmail = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await sendCode(email);
    setBusy(false);
    if (result.ok) setStep('code');
    else setError(result.message);
  };

  const submitCode = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await verifyCode(email, code);
    setBusy(false);
    if (!result.ok) setError(result.message);
    // Si va bien, el cambio de sesión actualiza la página solo.
  };

  return (
    <div className={styles.box}>
      {step === 'email' ? (
        <form onSubmit={submitEmail} className={styles.form}>
          <p>Inicia sesión para sincronizar tu progreso. Te enviaremos un código de 6 dígitos por correo.</p>
          <label className={styles.field}>
            <span>Correo electrónico</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
            />
          </label>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Enviando…' : 'Enviar código'}
          </button>
        </form>
      ) : (
        <form onSubmit={submitCode} className={styles.form}>
          <p>
            Hemos enviado un código a <strong>{email}</strong>. Puede tardar un minuto; revisa también el correo no
            deseado.
          </p>
          <label className={styles.field}>
            <span>Código</span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]{6,8}"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={`${styles.input} ${styles.code}`}
            />
          </label>
          <div className={styles.row}>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? 'Comprobando…' : 'Entrar'}
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => (setStep('email'), setCode(''), setError(null))}>
              Usar otro correo
            </button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}

function SignedIn() {
  const sync = useSyncState();
  const quarantined = useQuarantineCount();
  const now = useNow(30_000);
  const { text, tone } = syncSummary(sync.phase, sync.pending, sync.storedLastSuccessAt, now);

  return (
    <div className={styles.box}>
      <p>
        Sesión iniciada como <strong>{sync.email ?? '…'}</strong>.
      </p>
      <dl className={styles.facts}>
        <div>
          <dt>Estado</dt>
          <dd className={styles[`tone-${tone}`]}>{text}</dd>
        </div>
        <div>
          <dt>Última sincronización</dt>
          <dd>{timeAgo(sync.storedLastSuccessAt, now)}</dd>
        </div>
        <div>
          <dt>Cambios pendientes de subir</dt>
          <dd>{sync.pending ?? '…'}</dd>
        </div>
      </dl>

      {sync.phase === 'account-mismatch' && (
        <p role="alert" className={styles.error}>
          Este dispositivo ya tiene progreso de otra cuenta, así que no se mezclará con esta. Cierra la sesión y entra
          con la cuenta original, o descarga una copia en Progreso antes de usar otra cuenta.
        </p>
      )}
      {sync.phase === 'auth-required' && (
        <p role="alert" className={styles.error}>
          Tu sesión ha caducado. Cierra la sesión y vuelve a entrar; los cambios pendientes se subirán después.
        </p>
      )}
      {(sync.phase === 'error' || sync.phase === 'offline') && sync.lastError && (
        <p className={styles.meta}>Detalle: {sync.lastError}. Se reintentará automáticamente.</p>
      )}
      {quarantined ? (
        <p className={styles.meta}>
          {quarantined} registros no se pudieron sincronizar y se han apartado. Siguen en tu dispositivo y en tus copias.
        </p>
      ) : null}

      <div className={styles.row}>
        <button className="btn btn-primary" disabled={sync.phase === 'syncing'} onClick={() => void syncNow({ manual: true })}>
          Sincronizar ahora
        </button>
        <button className="btn" onClick={() => void signOut()}>
          Cerrar sesión
        </button>
      </div>
      <p className={styles.meta}>Cerrar sesión no borra nada de este dispositivo.</p>
    </div>
  );
}
