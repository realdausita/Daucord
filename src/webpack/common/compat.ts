/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Compatibility exports for plugins ported from Endcord.
import { BaseText as _BaseText } from "@components/BaseText";
import { Button as _Button } from "@components/Button";
import { Heading } from "@components/Heading";
import { Text as _Text } from "@components/Text";
import {
    ModalCloseButton as _ModalCloseButton,
    ModalContent as _ModalContent,
    ModalFooter as _ModalFooter,
    ModalHeader as _ModalHeader,
    ModalRoot as _ModalRoot
} from "@utils/modal";

import { showToast } from "./utils";

export const BaseText = _BaseText as any;
export const Button = _Button as any;
export const Text = _Text as any;
export const ModalRoot = _ModalRoot as any;
export const ModalHeader = _ModalHeader as any;
export const ModalContent = _ModalContent as any;
export const ModalFooter = _ModalFooter as any;
export const ModalCloseButton = _ModalCloseButton as any;

export const Toasts = {
    Type: {
        SUCCESS: "success",
        FAILURE: "critical",
        ERROR: "critical",
        WARNING: "warning",
        MESSAGE: "success"
    },
    Position: { TOP: "top", BOTTOM: "bottom" },
    genId: () => Math.random().toString(36).slice(2),
    show: ({ message, type, options }: any) =>
        showToast({ text: message, variant: type, position: options?.position } as any)
};

export const Forms = {
    FormTitle: Heading,
    FormSection: ({ children }: any) => children,
    FormText: Text
} as any;

// Compatibility exports for Endcord plugin APIs.
export const ReadStateUtils: any = {};
export const useDrag: any = () => [{}, () => {}];
export const useDrop: any = () => [{}, () => {}];
export const CloudUploader: any = {};
export const VoiceActions: any = {};
export const ChannelActions: any = {};
