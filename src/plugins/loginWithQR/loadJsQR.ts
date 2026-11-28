/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Daucord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

interface Point {
    x: number;
    y: number;
}

export interface QRCode {
    data: string;
    location?: {
        topLeftCorner: Point;
        topRightCorner: Point;
        bottomLeftCorner: Point;
        bottomRightCorner: Point;
    };
}

type JsQR = (data: Uint8ClampedArray, width: number, height: number) => QRCode | null;

const JSQR_URL = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";
const JSQR_INTEGRITY = "sha256-vEDIoVGWI2sjFNsIVvcsoLSZgM1UE7jIUqc0n1/uCFk=";

let loading: Promise<JsQR> | undefined;

async function fetchJsQR(): Promise<JsQR> {
    const script = document.createElement("script");
    script.src = JSQR_URL;
    script.integrity = JSQR_INTEGRITY;
    script.crossOrigin = "anonymous";
    try {
        await new Promise<void>((resolve, reject) => {
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Couldn't load the QR reader"));
            document.head.append(script);
        });
    } finally {
        script.remove();
    }

    const loaded = (window as unknown as { jsQR?: JsQR & { default?: JsQR; }; }).jsQR;
    const jsQR = loaded?.default ?? loaded;
    if (typeof jsQR !== "function") throw new Error("The QR reader didn't load");
    return jsQR;
}

/** jsQR, loaded once on first use */
export function loadJsQR() {
    loading ??= fetchJsQR().catch(e => {
        loading = undefined;
        throw e;
    });
    return loading;
}
