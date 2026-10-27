/**
 * Servidor simulado para tests: imita public.events (seq creciente, duplicados ignorados,
 * cada usuario solo ve lo suyo) y permite provocar fallos.
 */
import { RemoteError, type OutgoingRow, type Remote, type RemoteRow } from './remote';

export class FakeServer {
  rows: RemoteRow[] = [];
  private seq = 0;
  /** IDs que el servidor rechazará como inválidos. */
  rejectIds = new Set<string>();

  insert(userId: string, rows: OutgoingRow[]): void {
    for (const r of rows) {
      if (r.user_id !== userId) throw new RemoteError('rejected', 'new row violates row-level security policy');
      if (this.rejectIds.has(r.id)) throw new RemoteError('rejected', `check constraint violated (${r.id})`);
    }
    for (const r of rows) {
      if (this.rows.some((x) => x.id === r.id)) continue; // ON CONFLICT DO NOTHING
      this.rows.push({ ...r, seq: ++this.seq });
    }
  }

  /** Simula una transacción que obtuvo su seq antes pero confirmó después. */
  insertLate(row: OutgoingRow, seq: number): void {
    this.rows.push({ ...row, seq });
    this.rows.sort((a, b) => a.seq - b.seq);
  }

  nextSeq(): number {
    return ++this.seq;
  }

  client(userId: string): FakeRemote {
    return new FakeRemote(this, userId);
  }
}

export class FakeRemote implements Remote {
  /** Fallo a provocar en la próxima llamada (se consume al usarse). */
  failNext: { op: 'push' | 'pull'; kind: RemoteError['kind'] } | null = null;
  pushCalls = 0;

  constructor(
    private server: FakeServer,
    private userId: string,
  ) {}

  private maybeFail(op: 'push' | 'pull') {
    if (this.failNext?.op === op) {
      const { kind } = this.failNext;
      this.failNext = null;
      throw new RemoteError(kind, `fallo simulado (${kind})`);
    }
  }

  async push(rows: OutgoingRow[]): Promise<void> {
    this.pushCalls++;
    this.maybeFail('push');
    this.server.insert(this.userId, rows);
  }

  async pull(afterSeq: number, limit: number): Promise<RemoteRow[]> {
    this.maybeFail('pull');
    return this.server.rows
      .filter((r) => r.user_id === this.userId && r.seq > afterSeq)
      .sort((a, b) => a.seq - b.seq)
      .slice(0, limit)
      .map((r) => structuredClone(r));
  }
}
