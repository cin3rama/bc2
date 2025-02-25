'use client';
import React from "react"
import { useState, useEffect } from "react";
import Link from "next/link";
import { Moon, Sun } from "lucide-react";
import "./tailwind.scss";

export default function Layout({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false);
    const [darkMode, setDarkMode] = useState(false);
    // const [darkMode, setDarkMode] = useState(() => {
    //     if (typeof window !== 'undefined') {
    //         return localStorage.getItem("darkMode") === "true";
    //     }
    //     return false;
    // });

    // Only run on the client
    useEffect(() => {
        setMounted(true);
        const storedDarkMode = localStorage.getItem("darkMode") === "true";
        setDarkMode(storedDarkMode);
    }, []);


    useEffect(() => {
        document.documentElement.classList.toggle("dark", darkMode);
        localStorage.setItem("darkMode", String(darkMode));
    }, [darkMode]);

    // Avoid rendering until we've mounted to prevent hydration mismatches
    if (!mounted) {
        return null; // or a loading spinner
    }

    return (
        <html lang="en" className={darkMode ? "dark" : ""}>
        <body className={`min-h-screen flex flex-col ${darkMode ? "bg-black text-white" : "bg-white text-black"}`}>
        {/* Header */}
        <header className="w-full flex items-center justify-between p-6 bg-gold dark:bg-darkgold h-[10vh]">
            <div className="flex items-center space-x-4">
                <img
                    src="/bc_logo_new_1080x1080.png"
                    alt="Bitcoinisle Logo"
                    className="w-16 h-16 rounded-full object-cover"
                />
                <div>
                    <h1 className="text-xl font-semibold text-primary-dark dark:text-primary-dark">Bitcoinisle</h1>
                    <h2 className="text-s font-regular text-primary-dark dark:text-primary-dark">Bitcoin's Isle Of Insights</h2>
                </div>
            </div>
            <nav className="flex space-x-6 text-black dark:accent-primary-dark">
                <Link href="/">Home</Link>
                <Link href="/about">About</Link>
                <Link href="/order-flow">Order Flow</Link>
                <Link href="sentiment">Market Sentiment</Link>
                <Link href="/trends">Trend Analysis</Link>
            </nav>
            <button onClick={() => setDarkMode(prev => !prev)} className="p-2 rounded-full bg-gray-300 dark:bg-gray-700">
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
        </header>

        {/* Page Content */}
        <main className="flex-grow p-8 md:p-12 lg:p-16 xl:p-20 bg-secondary dark:bg-secondary-dark text-text dark:text-text-dark">
            {children}
        </main>

        {/* Footer */}
        <footer className="w-full h-[6vh] flex items-center justify-center bg-gold dark:bg-darkgold text-text dark:primary-dark">
            <div className="flex space-x-4">
                <span>Social 1</span>
                <span>Social 2</span>
                <span>Reference 1</span>
                <span>Reference 2</span>
            </div>
        </footer>
        </body>
        </html>
    );
}