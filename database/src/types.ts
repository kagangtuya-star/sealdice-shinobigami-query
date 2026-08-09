export type DataRow = Record<string, string>;

export interface CategoryFieldConfig {
  /** 字段名在数据中的原始键 */
  field: string;
  /** 指定字段的比较类型 */
  valueType: 'string' | 'number';
}

export interface CategoryConfig {
  /** 类别的主显示名 */
  key: string;
  /** 可被识别的别名（包含主名） */
  aliases: string[];
  /** 数据源 */
  data: DataRow[];
  /** 主字段（通常为“名字”） */
  primaryField: string;
  /** 搜索字段优先级顺序 */
  searchFields: string[];
  /** 标签筛选字段（#） */
  tagFields: string[];
  /** 分类筛选字段定义（&） */
  categoryFields: CategoryFieldConfig[];
  /** 列表摘要展示字段（按顺序） */
  listItemFields: string[];
  /** 详情展示字段顺序 */
  detailFields: string[];
  /** `.查xxx` 形式的硬编码指令名列表 */
  shortcutCommandNames?: string[];
  /** 非指令前缀（如“查忍法”）支持列表 */
  plainPrefixes?: string[];
  /** 全局速查时的优先级，数值越小优先级越高 */
  globalOrder: number;
}

export interface TagExpression {
  /** 指定字段，未指定时为 undefined 代表任意标签字段 */
  field?: string;
  /** 可接受的备选值列表 */
  values: string[];
}

export type CategoryFilterOperator = 'eq' | 'neq' | 'gt' | 'lt' | 'ge' | 'le' | 'contains';

export interface CategoryFilterCondition {
  field: string;
  operator: CategoryFilterOperator;
  value: string;
  numeric: boolean;
}

export interface ParsedQuery {
  keywords: string[];
  rawKeywordText: string;
  tags: TagExpression[];
  filters: CategoryFilterCondition[];
}

export interface SearchOptions {
  category: CategoryConfig;
  query: ParsedQuery;
}

export interface SearchHit {
  item: DataRow;
  matchType: 'id' | 'primaryExact' | 'primaryPrefix' | 'fieldContains' | 'fallback';
  fieldPriority: number;
  keywordHitCount: number;
}

export interface SuggestionItem {
  item: DataRow;
  distance: number;
  matchedField: string;
  matchedValue: string;
}

export interface SearchResult {
  category: CategoryConfig;
  hits: SearchHit[];
  suggestions: SuggestionItem[];
  filteredTotal: number;
  referenceText: string;
}
