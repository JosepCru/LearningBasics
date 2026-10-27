// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CompiledMultipleChoice, CompiledNumeric } from '../../core/content/compiled';
import { ExerciseCard } from './ExerciseCard';

afterEach(cleanup);

const common = {
  objective: 'x.o1',
  difficulty: 1,
  revision: 1,
  tags: [],
  explanationHtml: '<p>Porque sí.</p>',
};

const numeric: CompiledNumeric = {
  ...common,
  id: 'x.ex01',
  type: 'numeric',
  promptHtml: '<p>Masa molar del CO2</p>',
  hintsHtml: ['<p>Suma masas.</p>'],
  solutionHtml: '<p>12.01 + 32.00</p>',
  answer: { value: 44.01, unit: 'g/mol', tolerance: { relative: 0.005 }, acceptEquivalentUnits: true },
};

const choice: CompiledMultipleChoice = {
  ...common,
  id: 'x.ex02',
  type: 'multiple-choice',
  shuffle: false,
  promptHtml: '<p>¿Anión?</p>',
  hintsHtml: [],
  options: [
    { id: 'a', textHtml: 'Na+', correct: false, misconception: 'charge-sign', feedbackHtml: '<p>Es positivo.</p>' },
    { id: 'b', textHtml: 'Cl-', correct: true },
  ],
};

describe('ExerciseCard', () => {
  it('numérico: corrige, guía y clasifica el resultado como "con ayuda"', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<ExerciseCard exercise={numeric} seed="s" onDone={onDone} isLast={false} />);

    // La solución no está disponible antes del primer intento.
    expect(screen.queryByRole('button', { name: 'Ver solución' })).toBeNull();

    const input = screen.getByLabelText('Tu respuesta (número y unidad)');
    await user.type(input, '44.01{Enter}');
    expect(screen.getByRole('status')).toHaveTextContent('El número es correcto, pero falta la unidad');
    expect(screen.getByRole('button', { name: 'Ver solución' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ver pista 1 de 1' }));
    expect(screen.getByText('Suma masas.')).toBeInTheDocument();

    await user.type(input, ' g/mol{Enter}');
    expect(screen.getByRole('status')).toHaveTextContent('Correcto.');
    expect(screen.getByText('Porque sí.')).toBeInTheDocument();

    const next = screen.getByRole('button', { name: 'Siguiente ejercicio' });
    expect(next).toHaveFocus();
    await user.click(next);
    expect(onDone).toHaveBeenCalledWith(
      'correct-with-help',
      expect.objectContaining({
        exerciseId: 'x.ex01',
        objectiveId: 'x.o1',
        result: 'correct',
        tries: 2,
        hintsUsed: 1,
        solutionViewed: false,
        feedback: ['missing-unit', 'correct'],
        lastResponse: '44.01 g/mol',
      }),
    );
  });

  it('numérico: acierto a la primera sin ayuda', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<ExerciseCard exercise={numeric} seed="s" onDone={onDone} isLast />);
    await user.type(screen.getByLabelText('Tu respuesta (número y unidad)'), '44,0 g/mol{Enter}');
    await user.click(screen.getByRole('button', { name: 'Ver resumen' }));
    expect(onDone).toHaveBeenCalledWith('correct-unaided', expect.objectContaining({ tries: 1, hintsUsed: 0 }));
  });

  it('una respuesta vacía no cuenta como intento', async () => {
    const user = userEvent.setup();
    render(<ExerciseCard exercise={numeric} seed="s" onDone={() => {}} isLast={false} />);
    await user.click(screen.getByRole('button', { name: 'Comprobar' }));
    expect(screen.getByRole('status')).toHaveTextContent('No entiendo el número');
    expect(screen.queryByRole('button', { name: 'Ver solución' })).toBeNull();
  });

  it('opción múltiple: muestra el feedback del distractor y permite rendirse', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<ExerciseCard exercise={choice} seed="s" onDone={onDone} isLast={false} />);

    await user.click(screen.getByRole('radio', { name: 'Na+' }));
    await user.click(screen.getByRole('button', { name: 'Comprobar' }));
    expect(screen.getByRole('status')).toHaveTextContent('No es correcto.');
    expect(screen.getByRole('status')).toHaveTextContent('Es positivo.');

    await user.click(screen.getByRole('button', { name: 'Ver solución' }));
    await user.click(screen.getByRole('button', { name: 'Siguiente ejercicio' }));
    expect(onDone).toHaveBeenCalledWith(
      'not-solved',
      expect.objectContaining({ result: 'incorrect', solutionViewed: true, errorTags: ['charge-sign'], lastResponse: 'a' }),
    );
  });
});
