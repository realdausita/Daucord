/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Daucord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Endcord's header bar buttons are mapped to Vencord's chat bar buttons so the
// ported plugins get a usable button without patching Discord's channel header.

import "./HeaderBar.css";

import { React } from "@webpack/common";

import { addChatBarButton, removeChatBarButton } from "./ChatButtons";

type ButtonProps = {
    icon?: any;
    tooltip?: string;
    onClick?: (event: React.MouseEvent) => void;
    onContextMenu?: (event: React.MouseEvent) => void;
    className?: string;
    disabled?: boolean;
    selected?: boolean;
    "aria-label"?: string;
    children?: React.ReactNode;
};

type Factory = (props?: any) => React.ReactElement | null;

export function HeaderBarButton(props: ButtonProps) {
    const Icon = typeof props.icon === "function" || typeof props.icon === "string"
        ? props.icon as any
        : null;
    return (
        <div
            className={`vc-headerbar-button ${props.selected ? "is-selected" : ""} ${props.className ?? ""}`}
            role="button"
            tabIndex={props.disabled ? -1 : 0}
            aria-label={props["aria-label"] ?? props.tooltip}
            title={props.tooltip}
            onClick={props.disabled ? undefined : props.onClick}
            onContextMenu={props.onContextMenu}
        >
            {Icon && <Icon size={18} />}
            {props.children}
        </div>
    );
}

export const ChannelToolbarButton = HeaderBarButton;

export function addHeaderBarButton(name: string, factory: Factory, _priority?: number) {
    addChatBarButton(name, () => <>{factory()}</> as any, () => null);
}

export function removeHeaderBarButton(name: string) {
    removeChatBarButton(name);
}

export const addChannelToolbarButton = addHeaderBarButton;
export const removeChannelToolbarButton = removeHeaderBarButton;
