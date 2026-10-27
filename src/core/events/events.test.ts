import { describe, expect, it } from 'vitest';
import { AppEvent, withoutVoided } from './schemas';
import { UUID_RE, uuidv7 } from './uuid';

describe('uuidv7', () => {
  it('tiene formato UUID, versión 7 y variante RFC', () => {
    const id = uuidv7();
    expect(id).toMatch(UUID_RE);
    expect(id[14]).toBe('7');
    expect('89ab').toContain(id[19]);
  });

  it('se ordena por momento de creación', () => {
    const ids = [1_700_000_000_000, 1_700_000_000_001, 1_800_000_000_000].map((t) => uuidv7(t));
    expect([...ids].sort()).toEqual(ids);
  });

  it('codifica la marca de tiempo en los primeros 48 bits', () => {
    const t = 1_767_225_600_000;
    const id = uuidv7(t).replace(/-/g, '');
    expect(parseInt(id.slice(0, 12), 16)).toBe(t);
  });

  it('no repite IDs', () => {
    const ids = new Set(Array.from({ length: 2000 }, () => uuidv7(1_700_000_000_000)));
    expect(ids.size).toBe(2000);
  });
});

const base = {
  userId: 'local',
  deviceId: 'dev-1',
  clientCreatedAt: '2026-01-01T10:00:00.000Z',
  schemaVersion: 1 as const,
};

describe('esquema de eventos', () => {
  it('acepta un repaso válido y rechaza una valoración fuera de 1–4', () => {
    const review = {
      ...base,
      id: uuidv7(),
      type: 'review',
      payload: { cardId: 'c1', cardRevision: 1, rating: 3, reviewedAt: base.clientCreatedAt, durationMs: 100 },
    };
    expect(AppEvent.safeParse(review).success).toBe(true);
    expect(AppEvent.safeParse({ ...review, payload: { ...review.payload, rating: 5 } }).success).toBe(false);
  });

  it('rechaza campos desconocidos y versiones de esquema futuras', () => {
    const lesson = { ...base, id: uuidv7(), type: 'lesson', payload: { lessonId: 'l1', action: 'completed' } };
    expect(AppEvent.safeParse(lesson).success).toBe(true);
    expect(AppEvent.safeParse({ ...lesson, extra: 1 }).success).toBe(false);
    expect(AppEvent.safeParse({ ...lesson, schemaVersion: 2 }).success).toBe(false);
  });

  it('withoutVoided descarta los eventos anulados y los propios void', () => {
    const a = AppEvent.parse({ ...base, id: uuidv7(), type: 'lesson', payload: { lessonId: 'l1', action: 'completed' } });
    const b = AppEvent.parse({ ...base, id: uuidv7(), type: 'lesson', payload: { lessonId: 'l2', action: 'completed' } });
    const v = AppEvent.parse({ ...base, id: uuidv7(), type: 'void', payload: { targetEventId: a.id, reason: 'error' } });
    expect(withoutVoided([a, b, v])).toEqual([b]);
  });
});
