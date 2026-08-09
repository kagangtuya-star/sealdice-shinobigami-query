import { CategoryConfig, CategoryFilterCondition, CategoryFilterOperator, ParsedQuery, TagExpression } from './types';
import { normalizeText, tokenize } from './utils';

const splitByFirstColon = (value: string): [string, string | undefined] => {
  const index = value.indexOf(':');
  if (index === -1) {
    return [value, undefined];
  }
  return [value.slice(0, index), value.slice(index + 1)];
};

const resolveFieldName = (category: CategoryConfig, candidate?: string): string | undefined => {
  if (!candidate) return undefined;
  const normalized = normalizeText(candidate);
  const matchInCategory = category.categoryFields.find((field) => normalizeText(field.field) === normalized);
  if (matchInCategory) {
    return matchInCategory.field;
  }
  const matchInTags = category.tagFields.find((field) => normalizeText(field) === normalized);
  if (matchInTags) {
    return matchInTags;
  }
  const matchInSearch = category.searchFields.find((field) => normalizeText(field) === normalized);
  if (matchInSearch) {
    return matchInSearch;
  }
  return undefined;
};

const parseTagToken = (token: string, category: CategoryConfig): TagExpression | null => {
  const content = token.slice(1);
  if (!content) return null;
  const [fieldCandidate, valueCandidate] = splitByFirstColon(content);
  const resolvedField = valueCandidate ? resolveFieldName(category, fieldCandidate) : undefined;
  const rawValues = (valueCandidate ?? fieldCandidate).split('/').map((item) => item.trim()).filter(Boolean);
  if (!rawValues.length) return null;
  return {
    field: resolvedField,
    values: rawValues
  };
};

const operatorMap: Record<string, CategoryFilterOperator> = {
  '=': 'eq',
  '==': 'eq',
  '!=': 'neq',
  '>': 'gt',
  '<': 'lt',
  '>=': 'ge',
  '<=': 'le'
};

const parseFilterToken = (token: string, category: CategoryConfig): CategoryFilterCondition | null => {
  const content = token.slice(1);
  if (!content) return null;
  const [fieldCandidate, expressionRaw] = splitByFirstColon(content);
  if (!expressionRaw) {
    return {
      field: resolveFieldName(category, fieldCandidate) ?? fieldCandidate,
      operator: 'contains',
      value: '',
      numeric: false
    };
  }
  const expression = expressionRaw.trim();
  if (!expression) return null;

  const operatorMatch = expression.match(/^(<=|>=|==|!=|=|<|>)/);
  const operator = operatorMatch ? operatorMap[operatorMatch[0]] : 'eq';
  const value = operatorMatch ? expression.slice(operatorMatch[0].length).trim() : expression;
  const resolvedField = resolveFieldName(category, fieldCandidate) ?? fieldCandidate;
  const numeric = operator !== 'contains' && category.categoryFields.some((item) => item.field === resolvedField && item.valueType === 'number');

  return {
    field: resolvedField,
    operator: operator ?? 'eq',
    value,
    numeric
  };
};

export const parseQuery = (input: string, category: CategoryConfig): ParsedQuery => {
  const tokens = tokenize(input);
  const keywords: string[] = [];
  const tags: TagExpression[] = [];
  const filters: CategoryFilterCondition[] = [];

  tokens.forEach((token) => {
    if (!token) return;
    if (token.startsWith('#')) {
      const tag = parseTagToken(token, category);
      if (tag) tags.push(tag);
      return;
    }
    if (token.startsWith('&')) {
      const filter = parseFilterToken(token, category);
      if (filter) filters.push(filter);
      return;
    }
    keywords.push(token);
  });

  return {
    keywords,
    rawKeywordText: keywords.join(' ').trim(),
    tags,
    filters
  };
};
