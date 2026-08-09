export const normalizeText = (text: string): string => text.trim().toLowerCase();

const whitespaceRegex = /\s/;

export const tokenize = (input: string): string[] => {
  const tokens: string[] = [];
  let current = '';
  let quote: string | null = null;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (quote) {
      if (ch === quote) {
        tokens.push(current);
        current = '';
        quote = null;
      } else if (ch === '\\' && i + 1 < input.length) {
        current += input[i + 1];
        i += 1;
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === '\\' && i + 1 < input.length) {
      current += input[i + 1];
      i += 1;
      continue;
    }

    if (ch === '"' || ch === '\'') {
      if (current) {
        tokens.push(current);
        current = '';
      }
      quote = ch;
      continue;
    }

    if (whitespaceRegex.test(ch)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += ch;
  }

  if (quote) {
    tokens.push(current);
  } else if (current) {
    tokens.push(current);
  }

  return tokens;
};

export const isPureNumber = (value: string): boolean => /^\d+$/.test(value.trim());

export const tryParseNumber = (value: string): number | null => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

export const uniqueBy = <T>(items: T[], resolver: (item: T) => string): T[] => {
  const seen = new Set<string>();
  const result: T[] = [];
  items.forEach((item) => {
    const key = resolver(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  });
  return result;
};
