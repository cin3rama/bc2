

import React from 'react';
import Header from '@/components/Header'; // Header is a client component
import { TickerPeriodProvider } from '@/contexts/TickerPeriodContext';
import './tailwind.scss';


export default function RootLayout({ children }: {
        children: React.ReactNode;
    }) {
        return (
            <html lang="en">
                {/*<body className="min-h-screen flex flex-col overflow-auto">*/}
                <body className="flex-grow p-1 md:p-6 lg:p-8 bg-secondary dark:bg-secondary-dark text-text dark:text-text-dark max-h-[86vh] overflow-auto">
                    <TickerPeriodProvider>
                        <Header/>
                        {children}
                        <footer
                            className="w-full h-[6vh] flex items-center justify-center bg-gold dark:bg-darkgold text-text dark:text-text-dark p-1">
                            <div className="flex flex-wrap justify-center items-center gap-3">
                                <span>Social 1</span>
                                <span>Social 2</span>
                                <span>Reference 1</span>
                                <span>Reference 2</span>
                            </div>
                        </footer>
                    </TickerPeriodProvider>
                </body>
            </html>

    );
}
