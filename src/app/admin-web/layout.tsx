// /src/app/admin-web/layout.tsx
import React from "react";
import { AdminSessionProvider } from "@/components/admin-web/AdminSessionProvider";
import AdminRouteChrome from "@/components/admin-web/AdminRouteChrome";

export default function AdminWebLayout({
                                           children,
                                       }: {
    children: React.ReactNode;
}) {
    return (
        <AdminSessionProvider>
            <AdminRouteChrome>{children}</AdminRouteChrome>
        </AdminSessionProvider>
    );
}
