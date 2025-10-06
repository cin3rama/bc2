"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Moon, Sun, Menu, X } from "lucide-react";
import { useHeaderConfig } from "@/contexts/HeaderConfigContext";
import { useTickerPeriod } from "@/contexts/TickerPeriodContext";
import { usePathname } from "next/navigation";

export default function Header() {
    const { ticker, period, setTicker, setPeriod } = useTickerPeriod();
    const pathname = usePathname();
    // Decide which dropdowns to show based on the route:
    // const showTicker = true;
    // const showPeriod = pathname.startsWith("/order-flow"); // Only show period on order-flow page
    const { showTicker, showPeriod } = useHeaderConfig();
    const [mounted, setMounted] = useState(false);
    const [darkMode, setDarkMode] = useState(true);
    const [menuOpen, setMenuOpen] = useState(false);

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
                    <a href="https://bitcoinisle.com">
                        <img
                            src="https://dynji4p6lpoc6.cloudfront.net/2025/03/bc_logo_new_1080x1080.png"
                            alt="Bitcoinisle Logo"
                            className="w-14 h-14 rounded-full object-cover max-[500px]:hidden"
                        />
                    </a>
                    <div>
                        <h1 className="text-lg font-semibold text-text dark:text-text-inverted">
                            Bitcoinisle
                        </h1>
                        <h2 className="text-xs font-light text-text dark:text-text-inverted">
                            Bitcoin's Isle of Insights
                        </h2>
                    </div>
                </div>

                {/* Global Navigation Links for larger screens */}
                <nav className="hidden md:flex space-x-5 text-black dark:text-text-inverted">
                    <Link href="https://bitcoinisle.com/" className="nav-link">Home</Link>
                    <Link href="/order-flow" className="nav-link">Order Flow</Link>
                    <Link href="/trends" className="nav-link">Trend Analysis</Link>
                    <Link href="https://www.bitcoinisle.com/hype-lama/" className="nav-link">Hype Lama</Link>
                    <Link href="https://bitcoinisle.com/fundamentals" className="nav-link">Fundamentals</Link>
                    <Link href="https://bitcoinisle.com/about-me" className="nav-link">About Me</Link>
                </nav>

                {/* Right-side controls */}
                <div className="flex items-center space-x-3">
                    {/* Dropdown selectors */}
                    {(showTicker || showPeriod) && (
                        <div className="flex items-center space-x-1">
                            {showTicker && (
                                <select
                                    value={ticker}
                                    onChange={(e) => setTicker(e.target.value)}
                                    className="text-[8px] p-1 w-16 sm:text-[10px] sm:p-1 sm:w-20 md:text-xs md:p-2 md:w-auto rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-black dark:text-white"
                                >
                                    <option value="BTC-USD">BTC-USD</option>
                                    <option value="ETH-USD">ETH-USD</option>
                                    <option value="SOL-USD">SOL-USD</option>
                                    <option value="VVV-USD">VVV-USD</option>
                                    <option value="OM-USD">OM-USD</option>
                                </select>
                            )}
                            {showPeriod && (
                                <select
                                    value={period}
                                    onChange={(e) => setPeriod(e.target.value)}
                                    className="text-[8px] p-1 w-16 sm:text-[10px] sm:p-1 sm:w-20 md:text-xs md:p-2 md:w-auto rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-black dark:text-white"
                                >
                                    <option value="15min">15 Mins</option>
                                    <option value="1h">1 Hour</option>
                                    <option value="4h">4 Hours</option>
                                    <option value="1d">1 Day</option>
                                    <option value="1w">1 Week</option>
                                </select>
                            )}
                        </div>
                    )}
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
                            <Link
                                href="https://www.bitcoinisle.com/portfolio/market-sentiment/"
                                onClick={() => setMenuOpen(false)}
                            >
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
