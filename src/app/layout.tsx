"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Moon, Sun, Menu, X } from "lucide-react";
import "./tailwind.scss";

export default function Layout({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false);
    const [darkMode, setDarkMode] = useState(true);
    const [menuOpen, setMenuOpen] = useState(false); // Hamburger menu state

    useEffect(() => {
        const storedDarkMode = localStorage.getItem("darkMode");
        if (storedDarkMode !== null) {
            setDarkMode(storedDarkMode === "true");
        } else {
            setDarkMode(window.matchMedia("(prefers-color-scheme: dark)").matches);
        }
        setMounted(true);
    }, []);

    useEffect(() => {
        if (mounted) {
            document.documentElement.classList.toggle("dark", darkMode);
            localStorage.setItem("darkMode", String(darkMode));
        }
    }, [darkMode, mounted]);

    // Prevent page scrolling when mobile menu is open
    useEffect(() => {
        if (menuOpen) {
            document.documentElement.style.overflow = "hidden";
            document.body.style.overflow = "hidden";
        } else {
            document.documentElement.style.overflow = "";
            document.body.style.overflow = "";
        }
    }, [menuOpen]);

    if (!mounted) {
        return null;
    }

    return (
        <html lang="en" className={darkMode ? "dark" : ""}>
        <body className={`min-h-screen flex flex-col ${darkMode ? "bg-black text-white" : "bg-white text-black"} overflow-auto`}>

        {/* Header (Reduced Height) */}
        <header className="w-full flex items-center justify-between p-3 sm:p-5 bg-gold dark:bg-darkgold h-[8vh]">
            <div className="flex items-center space-x-4">
                <img src="/bc_logo_new_1080x1080.png" alt="Bitcoinisle Logo" className="w-14 h-14 rounded-full object-cover" />
                <div>
                    <h1 className="text-lg font-semibold text-primary-dark dark:text-primary-dark">Bitcoinisle</h1>
                    <h2 className="text-xs font-regular text-primary-dark dark:text-primary-dark">Bitcoin's Isle Of Insights</h2>
                </div>
            </div>

            <nav className="hidden md:flex space-x-5 text-black dark:text-primary-dark">
                <Link href="/">Home</Link>
                <Link href="/about">About</Link>
                <Link href="/order-flow">Order Flow</Link>
                <Link href="/sentiment">Market Sentiment</Link>
                <Link href="/trends">Trend Analysis</Link>
            </nav>

            <div className="flex items-center space-x-3">
                <button onClick={() => setDarkMode((prev) => !prev)} className="p-1 rounded-full bg-gray-300 dark:bg-gray-700">
                    {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                </button>

                <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2 rounded-full bg-gray-300 dark:bg-gray-700">
                    {menuOpen ? <X size={22} /> : <Menu size={22} />}
                </button>
            </div>
        </header>

        {/* Mobile Navigation Menu (Fixed, Full Width, Covers Entire Viewport) */}
        {menuOpen && (
            <nav className="fixed inset-0 z-50 bg-gray-100 dark:bg-gray-800 text-black dark:text-white flex flex-col items-center justify-center w-full max-w-screen-sm mx-auto shadow-lg">
                <ul className="flex flex-col items-center space-y-4 py-6 w-full">
                    <li><Link href="/" onClick={() => setMenuOpen(false)}>Home</Link></li>
                    <li><Link href="/about" onClick={() => setMenuOpen(false)}>About</Link></li>
                    <li><Link href="/order-flow" onClick={() => setMenuOpen(false)}>Order Flow</Link></li>
                    <li><Link href="/sentiment" onClick={() => setMenuOpen(false)}>Market Sentiment</Link></li>
                    <li><Link href="/trends" onClick={() => setMenuOpen(false)}>Trend Analysis</Link></li>
                </ul>
                <button
                    onClick={() => setMenuOpen(false)}
                    className="absolute top-4 right-4 p-2 rounded-full bg-gray-300 dark:bg-gray-700"
                >
                    <X size={24} />
                </button>
            </nav>
        )}

        {/* Reduced Padding in Main */}
        <main className="flex-grow p-1 md:p-6 lg:p-8 bg-secondary dark:bg-secondary-dark text-text dark:text-text-dark max-h-[86vh] overflow-auto">
            {children}
        </main>

        {/* Footer */}
        <footer className="w-full h-[6vh] flex items-center justify-center bg-gold dark:bg-darkgold text-text dark:primary-dark p-1">
            <div className="flex flex-wrap justify-center items-center gap-3">
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
