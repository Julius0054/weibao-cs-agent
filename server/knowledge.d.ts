export interface SeedFaq {
    id: string;
    category: string;
    question: string;
    answer: string;
    keywords: string;
    unit?: string;
    trade?: string;
}
export declare const SEED_FAQS: SeedFaq[];
/** 初始化：库为空时写入种子数据 */
export declare function seedIfEmpty(): number;
export interface KbHit {
    id: string;
    question: string;
    answer: string;
    category: string;
    unit?: string | null;
    trade?: string | null;
    score: number;
}
/**
 * 检索 FAQ
 * @param queryText 用户提问
 * @param topK 返回条数
 * @param threshold 相关性阈值
 */
export declare function searchFaqs(queryText: string, topK?: number, threshold?: number): KbHit[];
/** 把检索结果拼成注入提示词的上下文 */
export declare function buildKbContext(hits: KbHit[]): string;
