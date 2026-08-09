import {
  addBusinessDays,
  computeEasterSunday,
  getBusinessDayOrdinalInMonth,
  getHolidaysForYear,
  getMandatoryNationalHolidays,
  getNthBusinessDayOfMonth,
  getOptionalPontosFacultativos,
  isBusinessDay,
} from './business-days.util';

describe('business-days.util', () => {
  test('computes Easter Sunday correctly for known reference years', () => {
    expect(computeEasterSunday(2026).toISOString().slice(0, 10)).toBe('2026-04-05');
    expect(computeEasterSunday(2027).toISOString().slice(0, 10)).toBe('2027-03-28');
    expect(computeEasterSunday(2024).toISOString().slice(0, 10)).toBe('2024-03-31');
  });

  test('derives Sexta-Feira Santa as two days before Easter', () => {
    const holidays2026 = getMandatoryNationalHolidays(2026);
    const goodFriday = holidays2026.find((d) => d.toISOString().slice(0, 10) === '2026-04-03');
    expect(goodFriday).toBeDefined();
  });

  // Julho/2026: dia 1 e quarta-feira, sem feriados nacionais no mes.
  test('computes the 1st, 6th, 8th and 10th business days of July 2026', () => {
    const holidays = getMandatoryNationalHolidays(2026);

    expect(getNthBusinessDayOfMonth(2026, 6, 1, holidays).toISOString().slice(0, 10)).toBe('2026-07-01');
    expect(getNthBusinessDayOfMonth(2026, 6, 6, holidays).toISOString().slice(0, 10)).toBe('2026-07-08');
    expect(getNthBusinessDayOfMonth(2026, 6, 8, holidays).toISOString().slice(0, 10)).toBe('2026-07-10');
    expect(getNthBusinessDayOfMonth(2026, 6, 10, holidays).toISOString().slice(0, 10)).toBe('2026-07-14');
  });

  test('treats Jan 1st 2026 (Thursday, holiday) as not a business day', () => {
    const holidays = getMandatoryNationalHolidays(2026);
    expect(isBusinessDay(new Date(Date.UTC(2026, 0, 1)), holidays)).toBe(false);
  });

  test('returns the correct ordinal for a known business day and null for a weekend', () => {
    const holidays = getMandatoryNationalHolidays(2026);
    // 2026-07-08 (quarta) e o 6o dia util calculado acima.
    expect(getBusinessDayOrdinalInMonth(new Date(Date.UTC(2026, 6, 8)), holidays)).toBe(6);
    // 2026-07-11 e sabado.
    expect(getBusinessDayOrdinalInMonth(new Date(Date.UTC(2026, 6, 11)), holidays)).toBeNull();
  });

  test('adds 2 business days skipping the weekend', () => {
    const holidays = getMandatoryNationalHolidays(2026);
    // 2026-07-10 e sexta-feira; +2 DU pula sab/dom e cai em 2026-07-14 (terca).
    const result = addBusinessDays(new Date(Date.UTC(2026, 6, 10)), 2, holidays);
    expect(result.toISOString().slice(0, 10)).toBe('2026-07-14');
  });

  // T071/research.md D10: Carnaval e Corpus Christi sao pontos facultativos
  // moveis, calculados a partir da Pascoa — igual ao que ja se faz para a
  // Sexta-Feira Santa, so que desligados por padrao.
  describe('pontos facultativos moveis (Carnaval, Corpus Christi)', () => {
    test('derives Carnaval Monday/Tuesday and Corpus Christi from Easter 2026', () => {
      const optional = getOptionalPontosFacultativos(2026);
      const isoDates = optional.map((d) => d.toISOString().slice(0, 10));

      expect(isoDates).toContain('2026-02-16'); // Segunda-feira de Carnaval
      expect(isoDates).toContain('2026-02-17'); // Terca-feira de Carnaval
      expect(isoDates).toContain('2026-06-04'); // Corpus Christi
    });

    test('getHolidaysForYear excludes optional holidays by default (includeOptionalHolidays=false)', () => {
      const holidays = getHolidaysForYear(2026, false);
      expect(isBusinessDay(new Date(Date.UTC(2026, 1, 17)), holidays)).toBe(true); // Terca de Carnaval util
      expect(isBusinessDay(new Date(Date.UTC(2026, 5, 4)), holidays)).toBe(true); // Corpus Christi util
    });

    test('getHolidaysForYear includes optional holidays when includeOptionalHolidays=true', () => {
      const holidays = getHolidaysForYear(2026, true);
      expect(isBusinessDay(new Date(Date.UTC(2026, 1, 17)), holidays)).toBe(false); // Terca de Carnaval feriado
      expect(isBusinessDay(new Date(Date.UTC(2026, 5, 4)), holidays)).toBe(false); // Corpus Christi feriado
      // Feriados nacionais obrigatorios continuam presentes junto dos opcionais.
      expect(isBusinessDay(new Date(Date.UTC(2026, 0, 1)), holidays)).toBe(false);
    });

    test('getHolidaysForYear(includeOptional=true) still contains every mandatory national holiday', () => {
      const mandatory = getMandatoryNationalHolidays(2026);
      const withOptional = getHolidaysForYear(2026, true);
      for (const holiday of mandatory) {
        expect(withOptional.some((d) => d.getTime() === holiday.getTime())).toBe(true);
      }
    });
  });
});
