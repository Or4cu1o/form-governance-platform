// Motor de Dias Uteis (DU) do SLA (Secao 4 do PROMPT.md).
//
// Feriados considerados: apenas os feriados nacionais de observancia
// obrigatoria em todo o Brasil (fixos + Sexta-Feira Santa, calculada a
// partir da Pascoa). Carnaval e Corpus Christi sao "pontos facultativos"
// que variam por orgao/municipio, entao NAO entram no calculo padrao —
// se a organizacao precisar deles, isso deve virar configuracao externa
// (fora do escopo desta Etapa 1), mantendo o core generico.
//
// Todas as datas sao tratadas como meia-noite UTC para evitar bugs de
// fuso horario ao comparar/somar dias.

export function toUtcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// Algoritmo Anonimo Gregoriano (Meeus/Jones/Butcher) para o Domingo de Pascoa.
export function computeEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function addDaysUtc(date: Date, days: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

export function getMandatoryNationalHolidays(year: number): Date[] {
  const easter = computeEasterSunday(year);
  const sextaFeiraSanta = addDaysUtc(easter, -2);

  return [
    new Date(Date.UTC(year, 0, 1)), // Confraternizacao Universal
    sextaFeiraSanta,
    new Date(Date.UTC(year, 3, 21)), // Tiradentes
    new Date(Date.UTC(year, 4, 1)), // Dia do Trabalho
    new Date(Date.UTC(year, 8, 7)), // Independencia
    new Date(Date.UTC(year, 9, 12)), // Nossa Senhora Aparecida
    new Date(Date.UTC(year, 10, 2)), // Finados
    new Date(Date.UTC(year, 10, 15)), // Proclamacao da Republica
    new Date(Date.UTC(year, 11, 25)), // Natal
  ];
}

// Pontos facultativos moveis (Carnaval seg+ter, Corpus Christi) — desligados
// por padrao (SystemSetting.includeOptionalHolidays = false, FR-015) porque
// variam por orgao/municipio; quando a organizacao liga o parametro, entram
// no mesmo calculo de dia util que os feriados nacionais obrigatorios.
export function getOptionalPontosFacultativos(year: number): Date[] {
  const easter = computeEasterSunday(year);
  return [
    addDaysUtc(easter, -48), // Segunda-feira de Carnaval
    addDaysUtc(easter, -47), // Terca-feira de Carnaval
    addDaysUtc(easter, 60), // Corpus Christi
  ];
}

export function getHolidaysForYear(year: number, includeOptionalHolidays: boolean): Date[] {
  const mandatory = getMandatoryNationalHolidays(year);
  return includeOptionalHolidays ? [...mandatory, ...getOptionalPontosFacultativos(year)] : mandatory;
}

export function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

export function isHoliday(date: Date, holidays: Date[]): boolean {
  const target = toUtcMidnight(date).getTime();
  return holidays.some((holiday) => toUtcMidnight(holiday).getTime() === target);
}

export function isBusinessDay(date: Date, holidays: Date[]): boolean {
  return !isWeekend(date) && !isHoliday(date, holidays);
}

// Retorna a data do N-esimo dia util do mes (1-based). Ex.: n=1 -> 1o DU.
export function getNthBusinessDayOfMonth(year: number, monthIndex0: number, n: number, holidays: Date[]): Date {
  let cursor = new Date(Date.UTC(year, monthIndex0, 1));
  let count = 0;
  while (true) {
    if (isBusinessDay(cursor, holidays)) {
      count += 1;
      if (count === n) {
        return cursor;
      }
    }
    cursor = addDaysUtc(cursor, 1);
  }
}

// Retorna o ordinal (1-based) do dia util `date` dentro do seu mes, ou null
// se `date` nao for um dia util.
export function getBusinessDayOrdinalInMonth(date: Date, holidays: Date[]): number | null {
  const target = toUtcMidnight(date);
  if (!isBusinessDay(target, holidays)) {
    return null;
  }
  let cursor = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), 1));
  let count = 0;
  while (cursor.getTime() <= target.getTime()) {
    if (isBusinessDay(cursor, holidays)) {
      count += 1;
    }
    cursor = addDaysUtc(cursor, 1);
  }
  return count;
}

// Soma `count` dias uteis a partir de `start` (start nao entra na contagem).
export function addBusinessDays(start: Date, count: number, holidays: Date[]): Date {
  let cursor = toUtcMidnight(start);
  let remaining = count;
  while (remaining > 0) {
    cursor = addDaysUtc(cursor, 1);
    if (isBusinessDay(cursor, holidays)) {
      remaining -= 1;
    }
  }
  return cursor;
}
