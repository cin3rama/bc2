'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useWebsocket } from '@/hooks/useWebsocket';
import { motion } from 'framer-motion';

const MAX_RECTANGLES = 50;
const scaleFactor = 0.05;
const maxWidth = 300;
const rectangleHeight = 40;
const padding = rectangleHeight;

// Define TypeScript types for UserTable.
// tradeKey is optional (for tables with only two columns) and periodColumnName is optional.
interface UserTableProps {
    title: string;
    subtitle?: string;
    data: any[];
    userKey: string;
    tradeKey?: string;
    volumeKey: string;
    periodColumnName?: string;
}

// Updated UserTable component conditionally renders the Trades and Period columns.
const UserTable: React.FC<UserTableProps> = ({
                                                 title,
                                                 subtitle,
                                                 data,
                                                 userKey,
                                                 tradeKey,
                                                 volumeKey,
                                                 periodColumnName,
                                             }) => (
    <div>
        <h2 className="text-m font-bold mt-4">{title}</h2>
        {subtitle && <h3 className="text-xs font-light">{subtitle}</h3>}
        <table className="w-full border-collapse mt-2">
            <thead>
            <tr className="border-b border-gray-300">
                <th className="text-left text-xs font-bold">Addresses</th>
                {tradeKey && <th className="text-left text-xs font-bold">Trades</th>}
                <th className="text-left text-xs font-bold">Volume</th>
                {periodColumnName && (
                    <th className="text-left text-xs font-bold">{periodColumnName}</th>
                )}
            </tr>
            </thead>
            <tbody>
            {data?.map((item, index) => (
                <motion.tr
                    key={index}
                    animate={
                        item.flash
                            ? { backgroundColor: item.flashColor }
                            : { backgroundColor: 'transparent' }
                    }
                    transition={{ duration: 0.5, ease: 'linear' }}
                    className="border-b border-gray-300 text-sm"
                >
                    <td>
                        {String(item[userKey as keyof typeof item]).slice(0, 2)}...
                        {String(item[userKey as keyof typeof item]).slice(-4)}
                    </td>
                    {tradeKey && (
                        <td>{Number(item[tradeKey as keyof typeof item]).toLocaleString()}</td>
                    )}
                    <td>${Number(item[volumeKey as keyof typeof item]).toLocaleString()}</td>
                    {periodColumnName && (
                        <td>
                            {periodColumnName.includes('Accumulation')
                                ? `$${Number(item.periodAccumulation || 0).toLocaleString()}`
                                : `$${Number(item.periodDistributions || 0).toLocaleString()}`}
                        </td>
                    )}
                </motion.tr>
            ))}
            </tbody>
        </table>
    </div>
);

const TradeAnimation = ({ orderflowData }: { orderflowData: any }) => {
    const { orderflow$ } = useWebsocket();
    const [data, setData] = useState<any[]>([]);
    const [duration, setDuration] = useState(4);
    const dataRef = useRef<any[]>([]);
    // Maintain local state for table data so we can update rows on flash events.
    const [tableData, setTableData] = useState(orderflowData);

    // Update tableData if orderflowData prop changes.
    useEffect(() => {
        setTableData(orderflowData);
    }, [orderflowData]);

    // Subscribe to websocket to update rectangle data.
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

    // Handler called when a rectangle finishes its animation.
    const handleRectangleComplete = (rectData: any) => {
        const isBuy = rectData.side === 'BUY';
        const rectColor = isBuy ? 'green' : 'red';
        const volumeDelta = parseFloat(rectData.size);
        const tradeIncrement = 1; // Always increment trades by 1.
        // Compute periodDelta as size * price.
        const periodDelta = parseFloat(rectData.size) * parseFloat(rectData.price);

        // Update each relevant table if the address matches.
        setTableData((prev: any) => {
            const newTableData = { ...prev };

            // Market Makers Buy-Side (buyer table)
            if (newTableData.mm_buyers_rows) {
                newTableData.mm_buyers_rows = newTableData.mm_buyers_rows.map((row: any) => {
                    if (row.user_buyer === rectData.user_buyer) {
                        return {
                            ...row,
                            total_number_of_trades: row.total_number_of_trades + tradeIncrement,
                            total_vol_trades: isBuy
                                ? row.total_vol_trades + volumeDelta
                                : row.total_vol_trades - volumeDelta,
                            periodAccumulation: (row.periodAccumulation || 0) + periodDelta,
                            flash: true,
                            flashColor: rectColor,
                        };
                    }
                    return row;
                });
            }

            // Market Makers Sell-Side (seller table)
            if (newTableData.mm_sellers_rows) {
                newTableData.mm_sellers_rows = newTableData.mm_sellers_rows.map((row: any) => {
                    if (row.user_seller === rectData.user_seller) {
                        return {
                            ...row,
                            total_number_of_trades: row.total_number_of_trades + tradeIncrement,
                            total_vol_trades: isBuy
                                ? row.total_vol_trades + volumeDelta
                                : row.total_vol_trades - volumeDelta,
                            periodDistributions: (row.periodDistributions || 0) - periodDelta,
                            flash: true,
                            flashColor: rectColor,
                        };
                    }
                    return row;
                });
            }

            // Top Accumulators (buyer table)
            if (newTableData.top_accumulators_rows) {
                newTableData.top_accumulators_rows = newTableData.top_accumulators_rows.map((row: any) => {
                    if (row.top_buyer === rectData.user_buyer) {
                        return {
                            ...row,
                            net_holding: isBuy ? row.net_holding + volumeDelta : row.net_holding - volumeDelta,
                            periodAccumulation: (row.periodAccumulation || 0) + periodDelta,
                            flash: true,
                            flashColor: rectColor,
                        };
                    }
                    return row;
                });
            }

            // Top Distributors (seller table)
            if (newTableData.top_distributors_rows) {
                newTableData.top_distributors_rows = newTableData.top_distributors_rows.map((row: any) => {
                    if (row.top_seller === rectData.user_seller) {
                        return {
                            ...row,
                            net_holding: isBuy ? row.net_holding + volumeDelta : row.net_holding - volumeDelta,
                            periodDistributions: (row.periodDistributions || 0) - periodDelta,
                            flash: true,
                            flashColor: rectColor,
                        };
                    }
                    return row;
                });
            }

            return newTableData;
        });

        // Remove the flash flag after 0.5 seconds to reset the row animation.
        setTimeout(() => {
            setTableData((prev: any) => {
                const newTableData = { ...prev };
                if (newTableData.mm_buyers_rows) {
                    newTableData.mm_buyers_rows = newTableData.mm_buyers_rows.map((row: any) => ({
                        ...row,
                        flash: false,
                    }));
                }
                if (newTableData.mm_sellers_rows) {
                    newTableData.mm_sellers_rows = newTableData.mm_sellers_rows.map((row: any) => ({
                        ...row,
                        flash: false,
                    }));
                }
                if (newTableData.top_accumulators_rows) {
                    newTableData.top_accumulators_rows = newTableData.top_accumulators_rows.map((row: any) => ({
                        ...row,
                        flash: false,
                    }));
                }
                if (newTableData.top_distributors_rows) {
                    newTableData.top_distributors_rows = newTableData.top_distributors_rows.map((row: any) => ({
                        ...row,
                        flash: false,
                    }));
                }
                return newTableData;
            });
        }, 500);
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
                    const color = row.side === 'BUY' ? 'green' : 'red';
                    const borderColor = color === 'green' ? 'blue' : 'black';
                    const borderWidth = [
                        '0xd724e5c07d972617cda426a6a11ffcc289ee9844',
                        '0x90326fa293578c6c9ef945aaab0b57f886aca6ec',
                    ].includes(row.user_buyer || row.user_seller)
                        ? '3px'
                        : '1px';
                    const width = calculateWidth(
                        parseFloat(parseFloat(row.size).toFixed(3)),
                        parseFloat(row.price)
                    );
                    const isBuy = row.side === 'BUY';
                    const topPosition = isBuy
                        ? `calc(25% - ${rectangleHeight / 2}px)`
                        : `calc(75% - ${rectangleHeight / 2}px)`;

                    return (
                        <motion.div
                            key={row.created_at}
                            initial={{ x: '-100vw' }}
                            animate={{ x: '100vw' }}
                            transition={{ duration: duration, ease: 'linear' }}
                            onAnimationComplete={() => handleRectangleComplete(row)}
                            style={{
                                position: 'absolute',
                                top: topPosition,
                                width: `${width}px`,
                                height: `${rectangleHeight}px`,
                                backgroundColor: color,
                                borderWidth: borderWidth,
                                borderColor: borderColor,
                                borderStyle: 'solid',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: width === maxWidth ? 'bold' : 'normal',
                                color: width === maxWidth ? 'black' : 'transparent',
                            }}
                        >
                            {width === maxWidth && parseFloat(row.size).toFixed(3)}
                        </motion.div>
                    );
                })}
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
                <UserTable
                    title="Top 10 Market Makers Buy-Side"
                    subtitle="Most Frequent Maker side (limit orders) buyers acquiring Taker Sells (market orders)"
                    data={tableData.mm_buyers_rows || []}
                    userKey="user_buyer"
                    tradeKey="total_number_of_trades"
                    volumeKey="total_vol_trades"
                    periodColumnName="Period Accumulation"
                />

                <UserTable
                    title="Top 10 Market Makers Sell-Side"
                    subtitle="Most Frequent Maker side (limit orders) sellers executing against Taker Buys (market orders)"
                    data={tableData.mm_sellers_rows || []}
                    userKey="user_seller"
                    tradeKey="total_number_of_trades"
                    volumeKey="total_vol_trades"
                    periodColumnName="Period Distributions"
                />

                <UserTable
                    title="Top Accumulators In Period"
                    data={tableData.top_accumulators_rows || []}
                    userKey="top_buyer"
                    volumeKey="net_holding"
                    periodColumnName="Period Accumulation"
                />

                <UserTable
                    title="Top Distributors In Period"
                    data={tableData.top_distributors_rows || []}
                    userKey="top_seller"
                    volumeKey="net_holding"
                    periodColumnName="Period Distributions"
                />
            </div>
        </>
    );
};

const TradeAnimationPage: React.FC = () => {
    const [orderflowData, setOrderflowData] = useState<any>({});
    // New state for ticker and period.
    const [ticker, setTicker] = useState<string>('ETH-USD');
    const [period, setPeriod] = useState<string>('1 day');

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Compute end_time as current UTC time (in seconds).
                const endTime = Math.floor(Date.now() / 1000);
                // Define period mapping.
                const periodMapping: Record<string, number> = {
                    '1 hour': 3600,
                    '4 hours': 14400,
                    '1 day': 86400,
                    '1 week': 604800,
                };
                const periodSeconds = periodMapping[period];
                const startTime = endTime - periodSeconds;
                const url = `https://botpilot8000.ngrok.io/orderflow_activity/?sym=${ticker}&start_time=${startTime}&end_time=${endTime}`;
                const response = await fetch(url);
                if (!response.ok) throw new Error('Network response was not ok');
                const result = await response.json();
                setOrderflowData(result);
            } catch (error) {
                console.error('Error fetching orderflow data:', error);
            }
        };

        fetchData();
    }, [ticker, period]);

    return (
        <div className="p-4">
            {/* Dropdown selectors placed in the upper right-hand side */}
            <div className="flex justify-end space-x-4 mb-4">
                <select
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value)}
                    className="p-2 border rounded bg-white dark:bg-gray-800 text-black dark:text-white border-gray-300 dark:border-gray-700"
                >
                    <option value="BTC-USD">BTC-USD</option>
                    <option value="ETH-USD">ETH-USD</option>
                    <option value="SOL-USD">SOL-USD</option>
                    <option value="VVV-USD">VVV-USD</option>
                    <option value="OM-USD">OM-USD</option>
                </select>
                <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    className="p-2 border rounded bg-white dark:bg-gray-800 text-black dark:text-white border-gray-300 dark:border-gray-700"
                >
                    <option value="1 hour">1 Hour</option>
                    <option value="4 hours">4 Hours</option>
                    <option value="1 day">1 Day</option>
                    <option value="1 week">1 Week</option>
                </select>
            </div>
            <TradeAnimation orderflowData={orderflowData}/>
        </div>
    );
};

export default TradeAnimationPage;
