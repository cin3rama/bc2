'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useWebsocket } from '@/hooks/useWebsocket';
import { motion } from 'framer-motion';

const MAX_RECTANGLES = 50; // Limit number of rectangles to prevent excessive re-renders
const scaleFactor = 0.05; // Adjustable factor for better trade value scaling
const maxWidth = 300; // Maximum width constraint for rectangles
const rectangleHeight = 20; // Define height for rectangles
const padding = rectangleHeight; // Padding between channels

const TradeAnimation: React.FC = () => {
    const { orderflow$, sendMessage, close } = useWebsocket();
    const [data, setData] = useState<any[]>([]);
    const [frequentBuyers, setFrequentBuyers] = useState<any[]>([]);
    const [duration, setDuration] = useState(4); // Default duration
    const dataRef = useRef<any[]>([]);

    useEffect(() => {
        (async () => {
            try {
                const response = await fetch('https://botpilot8000.ngrok.io/orderflow_activity/?sym=ETH-USD');
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                const result = await response.json();
                console.log('Fetched Frequent Buyers:', result);
                setFrequentBuyers(result);
            } catch (error) {
                console.error('Error fetching frequent buyers:', error);
            }
        })(); // IIFE
    }, []);

    useEffect(() => {
        const subscription = orderflow$.subscribe((newData) => {
            console.log('New WebSocket Data:', newData);
            dataRef.current = [...dataRef.current, ...newData].slice(-MAX_RECTANGLES);
            setData([...dataRef.current]);
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [orderflow$]);

    const calculateWidth = (size: number, price: number) => {
        return Math.min(size * price * scaleFactor, maxWidth);
    };

    return (
        <>
            <h2 className="text-2xl font-bold">Orderflow Analysis</h2>
            <h3 className="text-sm font-light">Visual Buy & Sell Transactions Stream</h3>
            <div className="relative w-full h-12 flex justify-center items-center">
                <input
                    type="range"
                    min="1"
                    max="12"
                    value={duration}
                    onChange={(e) => setDuration(parseFloat(e.target.value))}
                    className="w-1/3"
                />
                <span className="ml-2">{duration}s</span>
            </div>
            <div className="relative w-full h-64 overflow-hidden">
                {data.map((row) => {
                    const color = row.side === "BUY" ? "green" : "red";
                    const borderColor = color === "green" ? "blue" : "black";
                    const borderWidth = ["0xd724e5c07d972617cda426a6a11ffcc289ee9844", "0x90326fa293578c6c9ef945aaab0b57f886aca6ec"].includes(row.user_buyer || row.user_seller) ? "3px" : "1px";
                    const width = calculateWidth(parseFloat(parseFloat(row.size).toFixed(3)), parseFloat(row.price));
                    const isBuy = row.side === "BUY";
                    const topPosition = isBuy ? `calc(25% - ${rectangleHeight / 2}px)` : `calc(75% - ${rectangleHeight / 2}px)`;

                    return (
                        <motion.div
                            key={row.created_at} // Ensure unique key for React re-renders
                            initial={{x: "-100vw"}}
                            animate={{x: "100vw"}}
                            transition={{duration: duration, ease: "linear"}}
                            style={{
                                position: "absolute",
                                top: topPosition,
                                width: `${width}px`,
                                height: `${rectangleHeight}px`,
                                backgroundColor: color,
                                borderWidth: borderWidth,
                                borderColor: borderColor,
                                borderStyle: "solid",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: width === maxWidth ? "bold" : "normal",
                                color: width === maxWidth ? "black" : "transparent",
                            }}
                        >
                            {width === maxWidth && parseFloat(row.size).toFixed(3)}
                        </motion.div>
                    );
                })}
            </div>
            <div>
                <h1>Orderflow Activity</h1>
            </div>
            <div>
                <h2 className="text-m font-bold mt-4">Top 10 Market Makers Buy-Side</h2>
                <h3 className="text-xs font-light">Most Frequent Maker side (limit orders) buyers acquiring Taker Sells (market orders)</h3>
                <ul>
                    {frequentBuyers.map((buyer, index) => (
                        <li key={index} className="text-sm border-b border-gray-300 py-1">
                            {buyer.user_buyer}: Trades: {buyer.total_number_of_trades} | Volume:
                            ${buyer.total_vol_trades}
                        </li>
                    ))}
                </ul>
            </div>
        </>
    );
};

export default TradeAnimation;
