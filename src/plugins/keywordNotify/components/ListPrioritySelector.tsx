/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Select } from "@webpack/common";

import { ListType } from "..";
const t = (msg: any, values?: any): string => {
    const text = typeof msg === "string" ? msg : String(msg);
    return values ? text.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? "")) : text;
};

export function ListPrioritySelector({ listType, setListPriority }: { listType: ListType; setListPriority: (v: ListType) => void; }) {
    return (
        <Select
            options={[
                { label: "Whitelist", value: ListType.Whitelist },
                { label: "Blacklist", value: ListType.BlackList }
            ]}
            placeholder={t("Select a list type")}
            isSelected={v => v === listType}
            closeOnSelect={true}
            select={setListPriority}
            serialize={v => v}
        />
    );
}
