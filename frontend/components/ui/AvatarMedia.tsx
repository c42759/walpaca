"use client";
/* eslint-disable @next/next/no-img-element */

import React from "react";
import { isVideoAvatar } from "@/lib/characterUtils";

export interface AvatarMediaProps {
    src?: string | null;
    alt?: string;
    className?: string;
    title?: string;
    onClick?: React.MouseEventHandler<HTMLElement>;
    onError?: React.ReactEventHandler<HTMLElement>;
}

export const AvatarMedia: React.FC<AvatarMediaProps> = ({
    src,
    alt = "Avatar",
    className = "w-full h-full object-cover",
    title,
    onClick,
    onError,
}) => {
    if (!src) return null;

    if (isVideoAvatar(src)) {
        return (
            <video
                src={src}
                aria-label={alt}
                title={title}
                className={className}
                autoPlay
                loop
                muted
                playsInline
                onClick={onClick as React.MouseEventHandler<HTMLVideoElement>}
                onError={onError as React.ReactEventHandler<HTMLVideoElement>}
            />
        );
    }

    return (
        <img
            src={src}
            alt={alt}
            title={title}
            className={className}
            onClick={onClick as React.MouseEventHandler<HTMLImageElement>}
            onError={onError as React.ReactEventHandler<HTMLImageElement>}
        />
    );
};
