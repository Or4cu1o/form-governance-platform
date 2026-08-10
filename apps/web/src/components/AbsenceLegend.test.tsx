import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AbsenceLegend } from './AbsenceLegend';

describe('AbsenceLegend', () => {
  it('renders every absence code and its description as visible text, not as a tooltip', () => {
    render(
      <AbsenceLegend
        legend={{
          NA_FORA_DO_NIVEL: 'Fora do nível.',
          NAO_PREENCHIDO: 'Não preenchido.',
        }}
      />,
    );

    expect(screen.getByText('NA_FORA_DO_NIVEL')).toBeVisible();
    expect(screen.getByText('Fora do nível.')).toBeVisible();
    expect(screen.getByText('NAO_PREENCHIDO')).toBeVisible();
    expect(screen.getByText('Não preenchido.')).toBeVisible();
  });

  it('renders nothing when there is no legend to show, instead of an empty box', () => {
    const { container } = render(<AbsenceLegend legend={{}} />);

    expect(container).toBeEmptyDOMElement();
  });
});
