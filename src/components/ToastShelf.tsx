// src/components/ui/ToastShelf.tsx
"use client";
import React from "react";

export type Toast = { id: string; text: string; cls: string; ts: number };

export default function ToastShelf({ toasts, onDismiss }:{
    toasts: Toast[];
    onDismiss: (id: string) => void;
}) {
    return (
        <div className="fixed right-4 bottom-4 z-50 space-y-2">
            {toasts.map(t => (
                <div key={t.id}
                     className={`px-3 py-2 rounded shadow-md text-sm ${t.cls}`}
                     onClick={() => onDismiss(t.id)}>
                    {t.text}
                </div>
            ))}
        </div>
    );
}
