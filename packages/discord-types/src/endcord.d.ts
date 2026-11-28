// Extra types used by plugins ported from Endcord.
export interface Quest {
    id: string;
    name: string;
    description?: string;
    [key: string]: unknown;
}

export type QuestUserStatus = Record<string, unknown>;
