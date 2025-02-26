'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useWebsocket } from '@/hooks/useWebsocket';
import { motion } from 'framer-motion';

const MAX_RECTANGLES = 50;
const scaleFactor = 0.05;
const maxWidth = 300;
const rectangleHeight = 40;
const padding = rectangleHeight;

// Define TypeScript types
interface UserTableProps {
    title: string;
    subtitle?: string;
    data: any[];
    userKey: string;
    tradeKey: string;
    volumeKey: string;
}

// Reusable UserTable component
const UserTable: React.FC<UserTableProps> = ({ title, subtitle, data, userKey, tradeKey, volumeKey }) => (
    <div>
        <h2 className="text-m font-bold mt-4">{title}</h2>
        {subtitle && <h3 className="text-xs font-light">{subtitle}</h3>}
        <ul>
            {data?.map((item, index) => (
                <li key={index} className="text-sm border-b border-gray-300 py-1">
                    {/*{item[userKey as keyof typeof item]}: Trades: {item[tradeKey as keyof typeof item]} | Volume: ${item[volumeKey as keyof typeof item]}*/}
                    {item[userKey as keyof typeof item]}: Trades: {Number(item[tradeKey as keyof typeof item]).toLocaleString()} | Volume: ${Number(item[volumeKey as keyof typeof item]).toLocaleString()}
                </li>
            ))}
        </ul>
    </div>
);

const TradeAnimation = ({ orderflowData }: { orderflowData: any }) => {
    const { orderflow$, sendMessage, close } = useWebsocket();
    const [data, setData] = useState<any[]>([]);
    const [duration, setDuration] = useState(4);
    const dataRef = useRef<any[]>([]);

    useEffect(() => {
        const subscription = orderflow$.subscribe((newData) => {
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
            <h2 className="text-2xl font-bold">Orderflow Analysis</h2>
            <h3 className="text-sm font-light">Visual Buy & Sell Transactions Stream</h3>

            <div className="grid grid-cols-2 gap-4 mt-4">
                <UserTable
                    title="Top 10 Market Makers Buy-Side"
                    subtitle="Most Frequent Maker side (limit orders) buyers acquiring Taker Sells (market orders)"
                    data={orderflowData.mm_buyers_rows || []}
                    userKey="user_buyer"
                    tradeKey="total_number_of_trades"
                    volumeKey="total_vol_trades"
                />

                <UserTable
                    title="Top 10 Market Makers Sell-Side"
                    subtitle="Most Frequent Maker side (limit orders) sellers executing against Taker Buys (market orders)"
                    data={orderflowData.mm_sellers_rows || []}
                    userKey="user_seller"
                    tradeKey="total_number_of_trades"
                    volumeKey="total_vol_trades"
                />

                <UserTable
                    title="Top Accumulators In Period"
                    data={orderflowData.top_accumulators_rows || []}
                    userKey="top_buyer"
                    tradeKey="net_holding"
                    volumeKey="net_holding"
                />

                <UserTable
                    title="Top Distributors In Period"
                    data={orderflowData.top_distributors_rows || []}
                    userKey="top_seller"
                    tradeKey="net_holding"
                    volumeKey="net_holding"
                />
            </div>
        </>
    );
};

const TradeAnimationPage: React.FC = () => {
    const [orderflowData, setOrderflowData] = useState<any>({});

    useEffect(() => {
        (async () => {
            try {
                const response = await fetch('https://botpilot8000.ngrok.io/orderflow_activity/?sym=ETH-USD');
                if (!response.ok) throw new Error('Network response was not ok');
                const result = await response.json();
                setOrderflowData(result);
            } catch (error) {
                console.error('Error fetching orderflow data:', error);
            }
        })();
    }, []);

    return <TradeAnimation orderflowData={orderflowData}/>;
};

export default TradeAnimationPage;
