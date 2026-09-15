export type IntentCode = 'repair_report' | 'repair_progress' | 'warranty_policy' | 'service_process' | 'complaint' | 'human_handoff' | 'greeting' | 'out_of_scope';
export declare const INTENT_LABELS: Record<IntentCode, string>;
export declare const INTENT_COLORS: Record<IntentCode, string>;
export interface IntentResult {
    intent: IntentCode;
    label: string;
    confidence: number;
    matched: string[];
    entities: {
        room: string | null;
        building: number | null;
        phone: string | null;
        ticketNo: string | null;
    };
    suggestion: {
        unit: string;
        trade: string;
        matched: string | null;
    } | null;
    urgent: boolean;
}
export declare function detectIntent(text: string, history?: string[]): IntentResult;
/** 是否应当触发转人工 */
export declare function shouldHandoff(params: {
    intent: IntentCode;
    text: string;
    unresolvedRounds: number;
    lowRating?: boolean;
}): {
    need: boolean;
    reason: string;
};
