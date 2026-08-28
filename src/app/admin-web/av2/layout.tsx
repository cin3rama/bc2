// /src/app/admin-web/av2/layout.tsx
"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const AV2_NAV_ITEMS = [
    {
        href: "/admin-web/av2/status",
        label: "Status / Monitoring",
    },
    {
        href: "/admin-web/av2/performance",
        label: "Performance Reporting",
    },
    {
        href: "/admin-web/av2/controls",
        label: "Controls / Administration",
    },
];

export default function Av2Layout({
                                      children,
                                  }: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    return (
        <div className="flex flex-col gap-2">
            <nav
                aria-label="AV2 navigation"
                className="sticky top-0 z-40 rounded-2xl border border-gray-300 bg-white p-2 shadow-sm dark:border-gray-700 dark:bg-gray-900"
            >
                <div className="flex flex-wrap gap-2">
                    {AV2_NAV_ITEMS.map((item) => {
                        const active =
                            pathname === item.href ||
                            pathname.startsWith(`${item.href}/`);

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                aria-current={active ? "page" : undefined}
                                className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors md:text-xs ${
                                    active
                                        ? "border-primary-dark bg-primary text-black dark:border-primary dark:bg-primary-dark dark:text-white"
                                        : "border-gray-300 bg-white text-gray-800 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                                }`}
                            >
                                {item.label}
                            </Link>
                        );
                    })}
                </div>
            </nav>

            {children}
        </div>
    );
}
