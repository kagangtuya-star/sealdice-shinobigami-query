# excel_to_js_converter.py

import pandas as pd
import json
import os
import re

# --- 配置区域 ---

# 1. 指定你的忍神Excel数据库文件名
EXCEL_FILE_PATH = '忍神数据库.xlsx'

# 2. 指定生成的JS文件存放的目录名
OUTPUT_DIR = 'database'

# 3. 工作表名到JS变量/文件名的映射
#    - Key: Excel中的工作表名 (Sheet Name)
#    - Value: 用于生成JS文件名和变量名的英文标识 (小写)
SHEET_NAME_MAPPING = {
    '忍法': 'ninpo',
    '背景': 'background',
    '妖魔武器': 'yoma_weapons',
    '惟神': 'yuigami',
    '仪式忍法': 'ritual_ninpo',
    '战场': 'battlefield',
    '变调': 'variant',
    '人格假面': 'persona',
    '奥义开发': 'ougi_kaihatsu',
    '谜团'  : 'mystery',
    '外道忍法'  : 'gedo_ninpo',
    '敌人'  : 'enemies',
    # 示例，根据你的Excel添加或修改
    # 在这里添加更多你需要转换的工作表
}

# --- 转换工具核心代码 ---

def convert_excel_to_js(excel_path, output_dir):
    """
    读取Excel文件，并将每个符合要求的工作表转换为独立的JS数据文件。
    """
    # 检查Excel文件是否存在
    if not os.path.exists(excel_path):
        print(f"错误：找不到Excel文件 '{excel_path}'。")
        print("请确保该文件与此脚本放在同一目录下，或者提供完整路径。")
        return

    # 创建输出目录（如果不存在）
    os.makedirs(output_dir, exist_ok=True)
    print(f"数据文件将输出到 '{output_dir}/' 目录中。")

    try:
        # 加载整个Excel文件
        xls = pd.ExcelFile(excel_path)
    except Exception as e:
        print(f"读取Excel文件时出错: {e}")
        return

    # 遍历所有工作表
    for sheet_name in xls.sheet_names:
        if sheet_name in SHEET_NAME_MAPPING:
            print(f"正在处理工作表: '{sheet_name}'...")

            # 读取当前工作表数据
            df = pd.read_excel(xls, sheet_name=sheet_name)

            # --- 数据清洗 ---
            # 将所有列名中的空格和特殊字符替换掉，以保证是合法的JS键名
            df.columns = [re.sub(r'\s+', '', str(col)) for col in df.columns]
            # 将所有NaN/NaT等空值替换为空字符串
            df.fillna('', inplace=True)
            # 将所有数据都转换为字符串，以避免json转换时出现类型问题
            df = df.astype(str)

            # 将DataFrame转换为字典列表 ( [{row1}, {row2}, ...] )
            records = df.to_dict(orient='records')

            # 从映射中获取英文名
            base_name = SHEET_NAME_MAPPING[sheet_name]
            # 生成JS变量名 (例如: ninpoData)
            variable_name = f"{base_name}Data"
            # 生成JS文件名 (例如: ninpo.js)
            output_filename = os.path.join(output_dir, f"{base_name}.js")

            # 使用json库来格式化数据，确保中文正确显示且格式美观
            # indent=2: 缩进为2个空格
            # ensure_ascii=False: 允许输出中文字符
            json_data = json.dumps(records, indent=2, ensure_ascii=False)

            # 构建完整的JS文件内容
            js_content = f"export const {variable_name} = {json_data};\n"

            # 写入文件
            try:
                with open(output_filename, 'w', encoding='utf-8') as f:
                    f.write(js_content)
                print(f"✅ 成功生成文件: {output_filename}")
            except IOError as e:
                print(f"❌ 写入文件 '{output_filename}' 时出错: {e}")

        else:
            print(f"⏭️  跳过工作表: '{sheet_name}' (未在SHEET_NAME_MAPPING中配置)")

    print("\n所有工作表处理完毕。")


if __name__ == '__main__':
    convert_excel_to_js(EXCEL_FILE_PATH, OUTPUT_DIR)
