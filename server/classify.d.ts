/**
 * 示例住宅项目 A 地块 责任单位 / 工种自动分类
 * 规则来源：A地块全楼栋责任单位及工种划分规则 v1.1（2026-07-25）
 * 判断顺序：外墙外窗保洁 > 精装总包A跨楼栋专业分包 > 厨房灯带 > 14家专业分包 > 精装总包兜底
 */
export interface ClassifyResult {
    unit: string;
    trade: string;
    matched: string | null;
    level: 'clean' | 'window' | 'structure' | 'public' | 'sub' | 'general' | 'unknown';
}
/** 楼栋 → 精装总包（兜底） */
export declare const GENERAL_CONTRACTOR: Record<number, string>;
/** 14 家专业分包规则（全楼栋统一） */
export declare const SUB_RULES: Array<{
    keywords: string[];
    unit: string;
    trade: string;
}>;
/**
 * 分类主函数
 * @param building 楼栋号，未知传 null
 * @param description 问题描述
 */
export declare function classify(building: number | null, description: string): ClassifyResult;
/** 从文本中提取楼栋-房号，例如 7-2604 / 7栋2604 / 1栋201室 */
export declare function extractRoom(text: string): {
    room: string | null;
    building: number | null;
};
/** 提取手机号 */
export declare function extractPhone(text: string): string | null;
