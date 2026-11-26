/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Daucord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Compatibility wrapper for Endcord plugins.
import {
    ModalCloseButton as CloseButton,
    ModalContent as Content,
    ModalFooter as Footer,
    ModalHeader as Header,
    ModalRoot as Root
} from "@utils/modal";

export const ModalRoot = Root as any;
export const ModalHeader = Header as any;
export const ModalContent = Content as any;
export const ModalFooter = Footer as any;
export const ModalCloseButton = CloseButton as any;
export const EndcordModal = Root as any;
