import { aliasMap, categories, plainPrefixEntries, sortedCategoriesForGlobalSearch } from './data';
import { formatSearchResult } from './formatter';
import { parseQuery } from './parser';
import { searchInCategory } from './search';
import { CategoryConfig, SearchResult } from './types';
import { normalizeText, tokenize } from './utils';

const EXTENSION_NAME = 'shinobigami-query';
const EXTENSION_AUTHOR = '星尘';
const EXTENSION_VERSION = '1.0.0';

const CATEGORY_NAMES = categories.map((item) => item.key).join('、');

const ensureExtension = (): seal.ExtInfo => {
  let ext = seal.ext.find(EXTENSION_NAME);
  if (!ext) {
    ext = seal.ext.new(EXTENSION_NAME, EXTENSION_AUTHOR, EXTENSION_VERSION);
    seal.ext.register(ext);
  }
  return ext;
};

const resolveCategory = (input: string | undefined): CategoryConfig | undefined => {
  if (!input) return undefined;
  return aliasMap.get(normalizeText(input));
};

const findCategoryByPrimaryExact = (keyword: string): CategoryConfig | null => {
  const normalized = normalizeText(keyword);
  if (!normalized) return null;
  for (const category of sortedCategoriesForGlobalSearch) {
    const found = category.data.some((item) => normalizeText(item[category.primaryField] || '') === normalized);
    if (found) {
      return category;
    }
  }
  return null;
};

const findCategoryByPrimaryContains = (keyword: string): CategoryConfig | null => {
  const normalized = normalizeText(keyword);
  if (!normalized) return null;
  for (const category of sortedCategoriesForGlobalSearch) {
    const found = category.data.some((item) => normalizeText(item[category.primaryField] || '').includes(normalized));
    if (found) {
      return category;
    }
  }
  return null;
};

const buildHintLine = (category: CategoryConfig, topIds: string[], mode: 'detail' | 'list' | 'empty'): string => {
  if (mode !== 'list') return '';
  if (!topIds.length) return '';
  const id = topIds[0];
  const baseShortcut = category.shortcutCommandNames?.[0] ?? `查${category.key}`;
  const hints = [`.${baseShortcut} ${id}`, `速查 ${category.key} ${id}`];
  return `可输入 ${hints.join(' / ')} 查看详情`;
};

const replySearchResult = (
  ctx: seal.MsgContext,
  msg: seal.Message,
  result: SearchResult,
  options?: { prefix?: string }
): void => {
  const formatted = formatSearchResult(result);
  const lines: string[] = [];
  if (options?.prefix) {
    lines.push(options.prefix);
  }
  lines.push(...formatted.lines);
  if (formatted.mode !== 'empty') {
    const hint = buildHintLine(result.category, formatted.topHitIds, formatted.mode);
    if (hint) {
      lines.push(hint);
    }
  }
  seal.replyToSender(ctx, msg, lines.join('\n'));
};

const replyText = (ctx: seal.MsgContext, msg: seal.Message, text: string): void => {
  seal.replyToSender(ctx, msg, text);
};

const buildCommandResult = (solved: boolean): seal.CmdExecuteResult => {
  const ret = seal.ext.newCmdExecuteResult(solved);
  ret.showHelp = !solved;
  return ret;
};

const runCategorySearch = (
  ctx: seal.MsgContext,
  msg: seal.Message,
  category: CategoryConfig,
  queryText: string
): void => {
  const query = parseQuery(queryText, category);
  const result = searchInCategory(category, query);
  replySearchResult(ctx, msg, result);
};

const sendGeneralHelp = (ctx: seal.MsgContext, msg: seal.Message): void => {
  const lines = [
    '查询指令使用方式：',
    '查<类别> [关键词] [#标签] [&分类]（别名 .q）',
    '速查 [类别] <关键词>（类别可省略）',
    '当前装载类别 谜团 外道忍法 敌人 奥义开发 妖魔武器 人格假面 惟神 仪式忍法 背景 忍法 战场',
    '示例：查忍法 影分身 / 速查 忍法 影分身'
  ];
  replyText(ctx, msg, lines.join('\n'));
};

const tryHandlePlainCategoryQuery = (
  ctx: seal.MsgContext,
  msg: seal.Message,
  text: string
): boolean => {
  for (const entry of plainPrefixEntries) {
    if (!text.startsWith(entry.prefix)) continue;
    const rest = text.slice(entry.prefix.length);
    if (rest.length > 0 && !/^[\s#&0-9]/.test(rest)) {
      continue;
    }
    const queryText = rest.trim();
    if (!queryText) {
      sendGeneralHelp(ctx, msg);
      return true;
    }
    runCategorySearch(ctx, msg, entry.category, queryText);
    return true;
  }
  return false;
};

const handleAdvancedQuery = (
  ctx: seal.MsgContext,
  msg: seal.Message,
  args: string[]
): seal.CmdExecuteResult => {
  if (!args.length) {
    replyText(ctx, msg, `请提供查询类别。例如：.查 忍法 影分身。可用类别：${CATEGORY_NAMES}`);
    return buildCommandResult(true);
  }
  const [categoryToken, ...rest] = args;
  const category = resolveCategory(categoryToken);
  if (!category) {
    replyText(ctx, msg, `未识别的类别“${categoryToken}”。可用类别：${CATEGORY_NAMES}`);
    return buildCommandResult(true);
  }
  const queryText = rest.join(' ').trim();
  if (!queryText) {
    sendGeneralHelp(ctx, msg);
    return buildCommandResult(true);
  }
  runCategorySearch(ctx, msg, category, queryText);
  return buildCommandResult(true);
};

const registerAdvancedCommands = (ext: seal.ExtInfo): void => {
  const helpText = `.查 <类别> [关键词] [#标签] [&分类]\n`.concat(
    '示例：\n',
    '.查 忍法 影分身\n',
    '.查 忍法 伤害 #鞍马神流 &花费:<=2',
    '当前装载类别 谜团 外道忍法 敌人 奥义开发 妖魔武器 人格假面 惟神 仪式忍法 背景 忍法 战场'
  );

  const cmd = seal.ext.newCmdItemInfo();
  cmd.name = '查';
  cmd.help = helpText;
  cmd.solve = (ctx, msg, cmdArgs) =>
    handleAdvancedQuery(ctx, msg, cmdArgs.args);
  ext.cmdMap['查'] = cmd; // 直接使用字符串 '查' 作为键

  const alias = seal.ext.newCmdItemInfo();
  alias.name = 'q';
  alias.help = helpText;
  alias.solve = (ctx, msg, cmdArgs) =>
    handleAdvancedQuery(ctx, msg, cmdArgs.args);
  ext.cmdMap['q'] = alias; // 直接使用字符串 'q' 作为键
};

const registerShortcutCommands = (ext: seal.ExtInfo): void => {
  categories.forEach((category) => {
    const commandNames = category.shortcutCommandNames ?? [];
    commandNames.forEach((commandName) => {
      const cmd = seal.ext.newCmdItemInfo();
      cmd.name = commandName;
      cmd.help = `${commandName} <关键词/筛选>`;
      cmd.solve = (ctx, msg, cmdArgs) => {
        const queryText = cmdArgs.args.join(' ').trim();
        if (!queryText) {
          sendGeneralHelp(ctx, msg);
          return buildCommandResult(true);
        }
        runCategorySearch(ctx, msg, category, queryText);
        return buildCommandResult(true);
      };
      ext.cmdMap[commandName] = cmd;
    });
  });
};

const handleQuickSearch = (ctx: seal.MsgContext, msg: seal.Message, content: string): boolean => {
  const payload = content.trim();
  if (!payload) {
    sendGeneralHelp(ctx, msg);
    return true;
  }

  const tokens = tokenize(payload);
  const [firstToken, ...restTokens] = tokens;
  const directCategory = resolveCategory(firstToken);

  if (directCategory) {
    const queryText = restTokens.join(' ').trim();
    if (!queryText) {
      sendGeneralHelp(ctx, msg);
      return true;
    }
    runCategorySearch(ctx, msg, directCategory, queryText);
    return true;
  }

  if (tokens.length === 1 && firstToken && !firstToken.startsWith('#') && !firstToken.startsWith('&')) {
    const exactCategory = findCategoryByPrimaryExact(firstToken);
    if (exactCategory) {
      runCategorySearch(ctx, msg, exactCategory, firstToken);
      return true;
    }
    const containsCategory = findCategoryByPrimaryContains(firstToken);
    if (containsCategory) {
      runCategorySearch(ctx, msg, containsCategory, firstToken);
      return true;
    }
  }

  let bestSuggestion: { result: SearchResult; category: CategoryConfig } | null = null;

  for (const category of sortedCategoriesForGlobalSearch) {
    const query = parseQuery(payload, category);
    const result = searchInCategory(category, query);
    if (result.hits.length) {
      replySearchResult(ctx, msg, result, { prefix: `在【${category.key}】中找到：` });
      return true;
    }
    if (result.suggestions.length) {
      if (!bestSuggestion || result.suggestions[0].distance < bestSuggestion.result.suggestions[0].distance) {
        bestSuggestion = { result, category };
      }
    }
  }

  if (bestSuggestion) {
    const { result, category } = bestSuggestion;
    const formatted = formatSearchResult(result);
    const lines = [`未直接找到结果，可参考【${category.key}】中的以下相近条目：`, ...formatted.lines.slice(1)];
    seal.replyToSender(ctx, msg, lines.join('\n'));
    return true;
  }

  replyText(ctx, msg, '未在数据库中找到相关信息，请尝试调整关键词或指定类别。');
  return true;
};

const registerQuickSearchListener = (ext: seal.ExtInfo): void => {
  ext.onNotCommandReceived = (ctx, msg) => {
    const text = msg.message.trim();
    if (!text) return;
    if (text.startsWith('速查')) {
      const payload = text.slice('速查'.length);
      handleQuickSearch(ctx, msg, payload);
      return;
    }
    if (tryHandlePlainCategoryQuery(ctx, msg, text)) {
      return;
    }
  };
};

function main() {
  const ext = ensureExtension();
  registerAdvancedCommands(ext);
  registerShortcutCommands(ext);
  registerQuickSearchListener(ext);
}

main();
