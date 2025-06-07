

import React from 'react';
import { HeaderConfigProvider } from "@/contexts/HeaderConfigContext";
import Header from '@/components/Header'; // Header is a client component
import { TickerPeriodProvider } from '@/contexts/TickerPeriodContext';
import './tailwind.scss';


export default function RootLayout({ children }: {
        children: React.ReactNode;
    }) {
        return (
            <html lang="en">
                {/*<body className="min-h-screen flex flex-col overflow-auto">*/}
                <body className="flex-grow p-1 md:p-6 lg:p-8 bg-surface dark:bg-secondary-dark text-text dark:text-text-dark max-h-[86vh] overflow-auto">
                <HeaderConfigProvider>
                    <TickerPeriodProvider>
                        <Header/>
                        {children}
                        <footer
                            className="w-full h-[10vh] flex items-center justify-center bg-primary dark:bg-primary-dark text-text dark:text-text-dark p-1">
                            <div className="flex flex-wrap justify-center items-center gap-3">
                                <p className="bg-gold dark:bg-darkgold text-text dark:text-text-inverted p-1">Disclaimer: The contents of this site is for informational purposes only. Nothing contained herein is intended as advice of any kind.</p>
                                <div className="mb-6"></div>
                            </div>
                        </footer>
                    </TickerPeriodProvider>
                </HeaderConfigProvider>
                </body>
            </html>

    );
}
