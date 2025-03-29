"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Moon, Sun, Menu, X } from "lucide-react";
import { useTickerPeriod } from "@/contexts/TickerPeriodContext";

export default function Header() {
    const { ticker, period, setTicker, setPeriod } = useTickerPeriod();
    const [mounted, setMounted] = useState(false);
    const [darkMode, setDarkMode] = useState(true);
    const [menuOpen, setMenuOpen] = useState(false);

    // Initialize dark mode from localStorage or prefers-color-scheme
    useEffect(() => {
        const storedDarkMode = localStorage.getItem("darkMode");
        if (storedDarkMode !== null) {
            setDarkMode(storedDarkMode === "true");
        } else {
            setDarkMode(window.matchMedia("(prefers-color-scheme: dark)").matches);
        }
        setMounted(true);
    }, []);

    // Update dark mode on <html> and store setting
    useEffect(() => {
        if (mounted) {
            document.documentElement.classList.toggle("dark", darkMode);
            localStorage.setItem("darkMode", String(darkMode));
        }
    }, [darkMode, mounted]);

    // Prevent scrolling when mobile menu is open
    useEffect(() => {
        if (menuOpen) {
            document.documentElement.style.overflow = "hidden";
            document.body.style.overflow = "hidden";
        } else {
            document.documentElement.style.overflow = "";
            document.body.style.overflow = "";
        }
    }, [menuOpen]);

    if (!mounted) return null;

    return (
        <>
            <header className="w-full flex items-center justify-between p-3 sm:p-5 bg-gold dark:bg-darkgold h-[8vh] z-50">
                <div className="flex items-center space-x-4">
                    <img
                        src="/bc_logo_new_1080x1080.png"
                        alt="Bitcoinisle Logo"
                        className="w-14 h-14 rounded-full object-cover max-[500px]:hidden"
                    />
                    <div>
                        <h1 className="text-lg font-semibold text-primary-dark dark:text-primary-dark">
                            Bitcoinisle
                        </h1>
                        <h2 className="text-xs font-light text-primary-dark dark:text-primary-dark">
                            Bitcoin's Isle Of Insights
                        </h2>
                    </div>
                </div>

                {/* Global Navigation Links for larger screens */}
                <nav className="hidden md:flex space-x-5 text-black dark:text-primary-dark">
                    <Link href="https://bitcoinisle.com/">Home</Link>
                    <Link href="https://bitcoinisle.com/about-me">About Me</Link>
                    <Link href="/order-flow">Order Flow</Link>
                    <Link href="https://www.bitcoinisle.com/portfolio/market-sentiment/">Market Sentiment</Link>
                    <Link href="/trends">Trend Analysis</Link>
                </nav>

                {/* Right-side controls */}
                <div className="flex items-center space-x-3">
                    {/* Dropdown selectors */}
                    <div className="flex items-center space-x-1">
                        <select
                            value={ticker}
                            onChange={(e) => setTicker(e.target.value)}
                            className="text-[8px] p-1 w-16 sm:text-[10px] sm:p-1 sm:w-20 md:text-xs md:p-2 md:w-auto rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-black dark:text-white"
                        >
                            <option value="BTC-USD">BTC-USD</option>
                            <option value="ETH-USD">ETH-USD</option>
                            <option value="SOL-USD">SOL-USD</option>
                            {/* Additional options as needed */}
                        </select>
                        <select
                            value={period}
                            onChange={(e) => setPeriod(e.target.value)}
                            className="text-[8px] p-1 w-16 sm:text-[10px] sm:p-1 sm:w-20 md:text-xs md:p-2 md:w-auto rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-black dark:text-white"
                        >
                            <option value="1 hour">1 Hour</option>
                            <option value="4 hours">4 Hours</option>
                            <option value="1 day">1 Day</option>
                            <option value="1 week">1 Week</option>
                        </select>
                    </div>
                    {/* Dark mode toggle */}
                    <button
                        onClick={() => setDarkMode((prev) => !prev)}
                        className="p-1 rounded-full bg-gray-300 dark:bg-gray-700"
                    >
                        {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                    {/* Hamburger menu (visible on mobile) */}
                    <button
                        onClick={() => setMenuOpen((prev) => !prev)}
                        className="md:hidden p-2 rounded-full bg-gray-300 dark:bg-gray-700"
                    >
                        {menuOpen ? <X size={22} /> : <Menu size={22} />}
                    </button>
                </div>
            </header>

            {/* Mobile Navigation Menu */}
            {menuOpen && (
                <nav className="fixed inset-0 z-50 bg-gray-100 dark:bg-gray-800 text-black dark:text-white flex flex-col items-center justify-center w-full max-w-screen-sm mx-auto shadow-lg">
                    <ul className="flex flex-col items-center space-y-4 py-6 w-full">
                        <li>
                            <Link href="https://bitcoinisle.com/" onClick={() => setMenuOpen(false)}>
                                Home
                            </Link>
                        </li>
                        <li>
                            <Link href="https://bitcoinisle.com/about-me" onClick={() => setMenuOpen(false)}>
                                About
                            </Link>
                        </li>
                        <li>
                            <Link href="/order-flow" onClick={() => setMenuOpen(false)}>
                                Order Flow
                            </Link>
                        </li>
                        <li>
                            <Link href="https://www.bitcoinisle.com/portfolio/market-sentiment/" onClick={() => setMenuOpen(false)}>
                                Market Sentiment
                            </Link>
                        </li>
                        <li>
                            <Link href="/trends" onClick={() => setMenuOpen(false)}>
                                Trend Analysis
                            </Link>
                        </li>
                    </ul>
                    <button
                        onClick={() => setMenuOpen(false)}
                        className="absolute top-4 right-4 p-2 rounded-full bg-gray-300 dark:bg-gray-700"
                    >
                        <X size={24} />
                    </button>
                </nav>
            )}
        </>
    );
}
