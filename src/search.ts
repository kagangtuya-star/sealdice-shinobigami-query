import { CategoryConfig, ParsedQuery, SearchHit, SearchResult, SuggestionItem } from './types';
import { isPureNumber, normalizeText, tryParseNumber, uniqueBy } from './utils';

const getFieldValue = (item: Record<string, string>, field: string): string => {
  const value = item[field];
  if (value === undefined || value === null) {
    return '';
  }
  return String(value);
};

const matchesTag = (item: Record<string, string>, category: CategoryConfig, tag: { field?: string; values: string[] }): boolean => {
  const fields = tag.field ? [tag.field] : category.tagFields;
  if (!fields.length) return false;
  const normalizedValues = tag.values.map((value) => normalizeText(value));
  return fields.some((field) => {
    const value = normalizeText(getFieldValue(item, field));
    if (!value) return false;
    return normalizedValues.some((tagValue) => tagValue && value.includes(tagValue));
  });
};

const compareNumbers = (left: number, right: number, operator: string): boolean => {
  switch (operator) {
    case 'eq':
      return left === right;
    case 'neq':
      return left !== right;
    case 'gt':
      return left > right;
    case 'lt':
      return left < right;
    case 'ge':
      return left >= right;
    case 'le':
      return left <= right;
    default:
      return false;
  }
};

const compareStrings = (left: string, right: string, operator: string): boolean => {
  switch (operator) {
    case 'eq':
      return left === right;
    case 'neq':
      return left !== right;
    case 'gt':
      return left > right;
    case 'lt':
      return left < right;
    case 'ge':
      return left >= right;
    case 'le':
      return left <= right;
    case 'contains':
      return left.includes(right);
    default:
      return false;
  }
};

const matchesFilter = (
  item: Record<string, string>,
  filter: { field: string; operator: string; value: string; numeric: boolean }
): boolean => {
  const rawValue = getFieldValue(item, filter.field).trim();
  if (!rawValue && filter.operator !== 'contains') {
    return false;
  }
  if (filter.operator === 'contains') {
    if (!filter.value) {
      return rawValue.length > 0;
    }
    return normalizeText(rawValue).includes(normalizeText(filter.value));
  }

  const normalizedTarget = normalizeText(filter.value);
  const normalizedSource = normalizeText(rawValue);

  const parsedValue = tryParseNumber(rawValue);
  const parsedTarget = tryParseNumber(filter.value);
  const shouldUseNumber =
    filter.numeric || ['gt', 'lt', 'ge', 'le'].includes(filter.operator) || (parsedValue !== null && parsedTarget !== null);

  if (shouldUseNumber && parsedValue !== null && parsedTarget !== null) {
    return compareNumbers(parsedValue, parsedTarget, filter.operator);
  }

  return compareStrings(normalizedSource, normalizedTarget, filter.operator);
};

const applyFilters = (
  category: CategoryConfig,
  data: Record<string, string>[],
  query: ParsedQuery
): Record<string, string>[] => {
  return data.filter((item) => {
    if (query.tags.length && !query.tags.every((tag) => matchesTag(item, category, tag))) {
      return false;
    }
    if (query.filters.length && !query.filters.every((filter) => matchesFilter(item, filter))) {
      return false;
    }
    return true;
  });
};

const collectMatches = (
  category: CategoryConfig,
  filteredData: Record<string, string>[],
  query: ParsedQuery
): SearchHit[] => {
  const hits: SearchHit[] = [];
  const seen = new Set<string>();

  const register = (item: Record<string, string>, matchType: SearchHit['matchType'], fieldPriority: number, keywordHitCount: number) => {
    const key = `${category.key}::${getFieldValue(item, '序号') || getFieldValue(item, category.primaryField)}`;
    if (seen.has(key)) return;
    seen.add(key);
    hits.push({ item, matchType, fieldPriority, keywordHitCount });
  };

  const normalizedRawKeyword = normalizeText(query.rawKeywordText);
  const normalizedCompactKeyword = normalizeText(query.keywords.join(''));
  const normalizedKeywords = query.keywords.map((keyword) => normalizeText(keyword)).filter(Boolean);
  const effectivePrimaryKeyword = normalizedRawKeyword || normalizedCompactKeyword;

  filteredData.forEach((item) => {
    const primaryValue = normalizeText(getFieldValue(item, category.primaryField));
    const exactMatch = effectivePrimaryKeyword && primaryValue === effectivePrimaryKeyword;
    if (exactMatch) {
      register(item, 'primaryExact', 0, normalizedKeywords.length || 1);
      return;
    }
    const prefixMatch =
      effectivePrimaryKeyword && effectivePrimaryKeyword.length > 0 && primaryValue.startsWith(effectivePrimaryKeyword);
    if (prefixMatch) {
      register(item, 'primaryPrefix', 1, normalizedKeywords.length || 1);
    }
  });

  filteredData.forEach((item) => {
    const primaryValue = normalizeText(getFieldValue(item, category.primaryField));
    const alreadyCaptured = hits.some((hit) => hit.item === item);
    if (alreadyCaptured) return;

    const fields = category.searchFields.map((field) => normalizeText(getFieldValue(item, field)));
    if (!normalizedKeywords.length) {
      const fieldPriority = Math.min(...fields.map((_, index) => index));
      register(item, 'fieldContains', fieldPriority === Infinity ? Number.MAX_SAFE_INTEGER : fieldPriority, 0);
      return;
    }

    let minimalFieldIndex = Number.MAX_SAFE_INTEGER;
    let matchCount = 0;
    const allMatched = normalizedKeywords.every((keyword) => {
      if (!keyword) return true;
      for (let index = 0; index < fields.length; index += 1) {
        if (fields[index].includes(keyword)) {
          minimalFieldIndex = Math.min(minimalFieldIndex, index);
          matchCount += 1;
          return true;
        }
      }
      return false;
    });

    if (allMatched) {
      register(item, 'fieldContains', minimalFieldIndex === Number.MAX_SAFE_INTEGER ? Number.MAX_SAFE_INTEGER : minimalFieldIndex, matchCount);
    }
  });

  const sorted = hits.sort((a, b) => {
    if (a.matchType !== b.matchType) {
      const order: Record<SearchHit['matchType'], number> = {
        id: 0,
        primaryExact: 1,
        primaryPrefix: 2,
        fieldContains: 3,
        fallback: 4
      };
      return order[a.matchType] - order[b.matchType];
    }
    if (a.fieldPriority !== b.fieldPriority) {
      return a.fieldPriority - b.fieldPriority;
    }
    if (a.keywordHitCount !== b.keywordHitCount) {
      return b.keywordHitCount - a.keywordHitCount;
    }
    const aId = getFieldValue(a.item, '序号');
    const bId = getFieldValue(b.item, '序号');
    if (aId && bId) {
      return Number(aId) - Number(bId);
    }
    return 0;
  });

  return uniqueBy(sorted, (hit) => `${category.key}::${getFieldValue(hit.item, '序号') || getFieldValue(hit.item, category.primaryField)}`);
};

const levenshteinDistance = (source: string, target: string): number => {
  if (source === target) return 0;
  if (!source.length) return target.length;
  if (!target.length) return source.length;

  const dp: number[][] = Array.from({ length: source.length + 1 }, () => Array(target.length + 1).fill(0));

  for (let i = 0; i <= source.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= target.length; j += 1) dp[0][j] = j;

  for (let i = 1; i <= source.length; i += 1) {
    for (let j = 1; j <= target.length; j += 1) {
      const cost = source[i - 1] === target[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[source.length][target.length];
};

const buildSuggestions = (
  category: CategoryConfig,
  reference: string,
  limit: number
): SuggestionItem[] => {
  const normalizedReference = normalizeText(reference).replace(/\s+/g, '');
  if (!normalizedReference) return [];

  const candidates: SuggestionItem[] = [];
  category.searchFields.forEach((field) => {
    category.data.forEach((item) => {
      const original = getFieldValue(item, field);
      const value = normalizeText(original).replace(/\s+/g, '');
      if (!value) return;
      const distance = levenshteinDistance(value, normalizedReference);
      candidates.push({ item, distance, matchedField: field, matchedValue: original });
    });
  });

  return candidates
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
};

export const searchInCategory = (category: CategoryConfig, query: ParsedQuery): SearchResult => {
  if (query.rawKeywordText && isPureNumber(query.rawKeywordText)) {
    const targetId = query.rawKeywordText.trim();
    const found = category.data.find((item) => getFieldValue(item, '序号') === targetId);
    if (found) {
      return {
        category,
        hits: [
          {
            item: found,
            matchType: 'id',
            fieldPriority: 0,
            keywordHitCount: 1
          }
        ],
        suggestions: [],
        filteredTotal: 1,
        referenceText: query.rawKeywordText
      };
    }
  }

  const filteredData = applyFilters(category, category.data, query);
  const hits = collectMatches(category, filteredData, query);
  const referenceText = query.rawKeywordText || query.keywords.join(' ');
  const suggestions = hits.length === 0 ? buildSuggestions(category, referenceText, 5) : [];

  return {
    category,
    hits,
    suggestions,
    filteredTotal: filteredData.length,
    referenceText
  };
};
