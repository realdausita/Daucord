/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EndcordModal } from "@components/EndcordModal";
import { RenderModalProps } from "@vencord/discord-types";
import { React } from "@webpack/common";

import { sendRemix } from ".";
import { brushCanvas, canvas, cropCanvas, ctx, exportImg, shapeCanvas } from "./editor/components/Canvas";
import { Editor } from "./editor/Editor";
import { resetBounds } from "./editor/tools/crop";
import { SendIcon } from "./icons/SendIcon";
const t = (msg: any, values?: any): string => {
    const text = typeof msg === "string" ? msg : String(msg);
    return values ? text.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? "")) : text;
};

type Props = {
    modalProps: RenderModalProps;
    close: () => void;
    url?: string;
};

function reset() {
    resetBounds();

    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    brushCanvas.clearRect(0, 0, canvas.width, canvas.height);
    shapeCanvas.clearRect(0, 0, canvas.width, canvas.height);
    cropCanvas.clearRect(0, 0, canvas.width, canvas.height);
}

async function closeModal(closeFunc: () => void, save?: boolean) {
    if (save) sendRemix(await exportImg());
    reset();
    closeFunc();
}

export default function RemixModal({ modalProps, close, url }: Props) {
    return (
        <EndcordModal
            {...modalProps}
            size="lg"
            title={t("Remix")}
            actions={[
                {
                    text: (
                        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <SendIcon />{" "}{t("Send")}</span>
                    ) as any,
                    variant: "primary",
                    onClick: () => closeModal(close, true)
                },
                {
                    text: "Close",
                    variant: "dangerPrimary",
                    onClick: () => closeModal(close)
                }
            ]}
        >
            <Editor url={url} />
        </EndcordModal>
    );
}
