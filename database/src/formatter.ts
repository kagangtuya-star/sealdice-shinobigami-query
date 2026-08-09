import { SearchResult } from './types';

const MAX_LIST_DISPLAY = 20;
const SNIPPET_LENGTH = 36;

const getFieldValue = (item: Record<string, string>, field: string): string => {
  const value = item[field];
  if (value === undefined || value === null) return '';
  return String(value).trim();
};

const buildSnippet = (value: string, limit = SNIPPET_LENGTH): string => {
  if (!value) return '';
  const trimmed = value.trim();
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, limit)}…`;
};

const buildDetailLines = (item: Record<string, string>, orderedFields: string[]): string[] => {
  const fields = orderedFields.length ? orderedFields : Object.keys(item);
  const lines: string[] = [];
  fields.forEach((field) => {
    if (field.startsWith('__')) return;
    const value = getFieldValue(item, field);
    if (!value) return;
    lines.push(`${field}：${value}`);
  });
  return lines;
};

const formatListLine = (item: Record<string, string>, primaryField: string, listFields: string[]): string => {
  const id = getFieldValue(item, '序号') || '-';
  const title = getFieldValue(item, primaryField) || '(未命名)';
  const metaValues = listFields
    .map((field) => buildSnippet(getFieldValue(item, field)))
    .filter((value) => value.length > 0);
  const meta = metaValues.length ? ` [${metaValues.join(' / ')}]` : '';
  return `${id}. ${title}${meta}`;
};

export interface FormattedOutput {
  lines: string[];
  mode: 'detail' | 'list' | 'empty';
  topHitIds: string[];
}

export const formatSearchResult = (result: SearchResult): FormattedOutput => {
  const { hits, category } = result;

  if (!hits.length) {
    const lines: string[] = ['未找到符合条件的结果。'];
    if (result.suggestions.length) {
      lines.push('或许你想查：');
      const reference = (result.referenceText || '').replace(/\s+/g, '');
      result.suggestions.forEach((suggestion) => {
        const id = getFieldValue(suggestion.item, '序号') || '-';
        const title = getFieldValue(suggestion.item, category.primaryField) || '(未命名)';
        const candidate = suggestion.matchedValue.replace(/\s+/g, '');
        const baseLength = Math.max(reference.length, candidate.length, 1);
        const similarity = Math.max(0, 1 - suggestion.distance / baseLength);
        const percentage = Math.round(similarity * 100);
        lines.push(`- ${id}. ${title}（字段：${suggestion.matchedField}，相似度 ${percentage}%）`);
      });
    }
    return { lines, mode: 'empty', topHitIds: [] };
  }

  if (hits.length === 1) {
    const item = hits[0].item;
    const title = getFieldValue(item, category.primaryField) || '(未命名)';
    const lines = [`【${category.key}】${title}`];
    lines.push(...buildDetailLines(item, category.detailFields));
    return { lines, mode: 'detail', topHitIds: [getFieldValue(item, '序号')].filter(Boolean) };
  }

  const totalHits = hits.length;
  const displayCount = Math.min(totalHits, MAX_LIST_DISPLAY);
  const header = totalHits > displayCount
    ? `查询到 ${totalHits} 条结果，显示前 ${displayCount} 条：`
    : `查询到 ${totalHits} 条结果：`;

  const lines = [header];
  for (let index = 0; index < displayCount; index += 1) {
    lines.push(formatListLine(hits[index].item, category.primaryField, category.listItemFields));
  }

  return {
    lines,
    mode: 'list',
    topHitIds: hits.slice(0, displayCount).map((hit) => getFieldValue(hit.item, '序号')).filter(Boolean)
  };
};
