'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useWebsocket } from '@/hooks/useWebsocket';
import { motion } from 'framer-motion';
import { useTickerPeriod } from '@/contexts/TickerPeriodContext';
import ClickTooltip from "@/components/ClickTooltip";
import LoadingIndicator from "@/components/LoadingIndicator";

const MAX_RECTANGLES = 50;
const scaleFactor = 0.05;
const maxWidth = 300;
// Updated rectangle height is now 25px.
const rectangleHeight = 25;

interface UserTableProps {
    title: string;
    subtitle?: string;
    data: any[];
    userKey: string;
    tradeKey?: string;
    volumeKey: string;
    periodColumnName?: string;
    showSubTotals?: boolean;
}

const UserTable: React.FC<UserTableProps> = ({
                                                 title,
                                                 subtitle,
                                                 data,
                                                 userKey,
                                                 tradeKey,
                                                 volumeKey,
                                                 periodColumnName,
                                                 showSubTotals,
                                             }) => {
    // Compute sub-totals if required.
    let subTotals = { trades: 0, volume: 0, period: 0 };
    if (showSubTotals && data && data.length) {
        data.forEach((row: any) => {
            if (tradeKey && typeof row[tradeKey] === 'number') {
                subTotals.trades += row[tradeKey];
            }
            if (volumeKey && typeof row[volumeKey] === 'number') {
                subTotals.volume += row[volumeKey];
            }
            if (periodColumnName) {
                if (periodColumnName.includes('Accumulation')) {
                    subTotals.period += row.periodAccumulation || 0;
                } else if (periodColumnName.includes('Distribution')) {
                    subTotals.period += row.periodDistributions || 0;
                }
            }
        });
    }

    return (
        <div className="p-2 mt-0.5 bg-white dark:bg-gray-800 rounded shadow">
            <h2 className="text-m font-bold mt-2">{title}</h2>
            {subtitle && <h3 className="text-xs font-light">{subtitle}</h3>}
            <table className="w-full border-collapse mt-2 text-xs">
                <thead>
                <tr className="border-b border-gray-300">
                    <th className="text-left p-1">Addresses</th>
                    {tradeKey && <th className="text-left p-1">Trades</th>}
                    <th className="text-left p-1">Volume</th>
                    {periodColumnName && (
                        <th className="text-left p-1">{periodColumnName}</th>
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
                                : { backgroundColor: 'rgba(0, 0, 0, 0)' }
                        }
                        transition={{ duration: 0.5, ease: 'linear' }}
                        className="border-b border-gray-300"
                    >
                        <td className="p-1">
                            {String(item[userKey as keyof typeof item]).slice(0, 2)}...
                            {String(item[userKey as keyof typeof item]).slice(-4)}
                        </td>
                        {tradeKey && (
                            <td className="p-1">
                                {Number(item[tradeKey as keyof typeof item]).toLocaleString()}
                            </td>
                        )}
                        <td className="p-1">
                            ${Number(item[volumeKey as keyof typeof item]).toLocaleString()}
                        </td>
                        {periodColumnName && (
                            <td className="p-1">
                                {periodColumnName.includes('Accumulation')
                                    ? `$${Number(item.periodAccumulation || 0).toLocaleString()}`
                                    : `$${Number(item.periodDistributions || 0).toLocaleString()}`}
                            </td>
                        )}
                    </motion.tr>
                ))}
                </tbody>
                {showSubTotals && (
                    <tfoot>
                    <tr className="border-t border-gray-300 font-bold">
                        <td className="p-1">Sub-Totals</td>
                        {tradeKey && <td className="p-1">{subTotals.trades}</td>}
                        <td className="p-1">${subTotals.volume.toLocaleString()}</td>
                        {periodColumnName && (
                            <td className="p-1">${subTotals.period.toLocaleString()}</td>
                        )}
                    </tr>
                    </tfoot>
                )}
            </table>
        </div>
    );
};

interface TradeAnimationProps {
    orderflowData: any;
    duration: number;
    resetStartTime: number;
    period: string;
}

const TradeAnimation: React.FC<TradeAnimationProps> = ({
                                                           orderflowData,
                                                           duration,
                                                           resetStartTime,
                                                           period,
                                                       }) => {
    const { orderflow$ } = useWebsocket();
    const [data, setData] = useState<any[]>([]);
    const dataRef = useRef<any[]>([]);
    const [tableData, setTableData] = useState(orderflowData);
    const [elapsedTime, setElapsedTime] = useState<number>(0);

    // Update tableData when orderflowData changes.
    useEffect(() => {
        setTableData(orderflowData);
    }, [orderflowData]);

    // Subscribe to websocket.
    useEffect(() => {
        const subscription = orderflow$.subscribe((newData) => {
            dataRef.current = [...dataRef.current, ...newData].slice(-MAX_RECTANGLES);
            setData([...dataRef.current]);
        });
        return () => {
            subscription.unsubscribe();
        };
    }, [orderflow$]);

    // Set up a clock that updates every second, using resetStartTime.
    useEffect(() => {
        const interval = setInterval(() => {
            setElapsedTime(Math.floor((Date.now() - resetStartTime) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [resetStartTime]);

    const formatTime = (seconds: number) => {
        const hrs = String(Math.floor(seconds / 3600)).padStart(2, '0');
        const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
        const secs = String(seconds % 60).padStart(2, '0');
        return `${hrs}:${mins}:${secs}`;
    };

    const calculateWidth = (size: number, price: number) => {
        return Math.min(size * price * scaleFactor, maxWidth);
    };

    const handleRectangleComplete = (rectData: any) => {
        const isBuy = rectData.side === 'BUY';
        const tradeValue = parseFloat(rectData.size) * parseFloat(rectData.price);
        const tradeIncrement = 1;
        const periodDelta = tradeValue;
        const rectColor = isBuy ? 'green' : 'red';

        setTableData((prev: any) => {
            const newTableData = { ...prev };

            // Update "Top 10 Market Makers Buying" table.
            if (newTableData.mm_buyers_rows) {
                newTableData.mm_buyers_rows = newTableData.mm_buyers_rows.map((row: any) => {
                    if (rectData.side === 'SELL' && row.user_buyer === rectData.user_buyer) {
                        return {
                            ...row,
                            total_number_of_trades: row.total_number_of_trades + tradeIncrement,
                            total_vol_trades: row.total_vol_trades + tradeValue,
                            periodAccumulation: (row.periodAccumulation || 0) + periodDelta,
                            flash: true,
                            flashColor: rectColor,
                        };
                    }
                    return row;
                });
            }

            // Update "Top 10 Market Makers Selling" table.
            if (newTableData.mm_sellers_rows) {
                newTableData.mm_sellers_rows = newTableData.mm_sellers_rows.map((row: any) => {
                    if (rectData.side === 'BUY' && row.user_seller === rectData.user_seller) {
                        return {
                            ...row,
                            total_number_of_trades: row.total_number_of_trades + tradeIncrement,
                            total_vol_trades: row.total_vol_trades - tradeValue,
                            periodDistributions: (row.periodDistributions || 0) - periodDelta,
                            flash: true,
                            flashColor: rectColor,
                        };
                    }
                    return row;
                });
            }

            // Update "Top Accumulators In Period" table.
            if (newTableData.top_accumulators_rows) {
                newTableData.top_accumulators_rows = newTableData.top_accumulators_rows.map((row: any) => {
                    if (rectData.side === 'BUY' && row.top_buyer === rectData.user_buyer) {
                        return {
                            ...row,
                            net_holding: row.net_holding + tradeValue,
                            periodAccumulation: (row.periodAccumulation || 0) + periodDelta,
                            flash: true,
                            flashColor: rectColor,
                        };
                    }
                    if (rectData.side === 'SELL' && row.top_buyer === rectData.user_seller) {
                        return {
                            ...row,
                            net_holding: row.net_holding - tradeValue,
                            periodAccumulation: (row.periodAccumulation || 0) - periodDelta,
                            flash: true,
                            flashColor: rectColor,
                        };
                    }
                    return row;
                });
            }

            // Update "Top Distributors In Period" table.
            if (newTableData.top_distributors_rows) {
                newTableData.top_distributors_rows = newTableData.top_distributors_rows.map((row: any) => {
                    if (rectData.side === 'SELL' && row.top_seller === rectData.user_seller) {
                        return {
                            ...row,
                            net_holding: row.net_holding - tradeValue,
                            periodDistributions: (row.periodDistributions || 0) - periodDelta,
                            flash: true,
                            flashColor: rectColor,
                        };
                    }
                    if (rectData.side === 'BUY' && row.top_seller === rectData.user_buyer) {
                        return {
                            ...row,
                            net_holding: row.net_holding + tradeValue,
                            periodDistributions: (row.periodDistributions || 0) + periodDelta,
                            flash: true,
                            flashColor: rectColor,
                        };
                    }
                    return row;
                });
            }

            return newTableData;
        });

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

    // Aggregated Totals Calculation.
    const mmBuyers = tableData.mm_buyers_rows || [];
    const mmSellers = tableData.mm_sellers_rows || [];
    const topAccums = tableData.top_accumulators_rows || [];
    const topDistrs = tableData.top_distributors_rows || [];

    const mmNetTradeVolume =
        mmBuyers.reduce((acc: number, row: any) => acc + (row.total_vol_trades || 0), 0) +
        mmSellers.reduce((acc: number, row: any) => acc + (row.total_vol_trades || 0), 0);
    const mmNetAccDistVolume =
        mmBuyers.reduce((acc: number, row: any) => acc + (row.periodAccumulation || 0), 0) +
        mmSellers.reduce((acc: number, row: any) => acc + (row.periodDistributions || 0), 0);
    const netPositionsTradeVolume =
        topAccums.reduce((acc: number, row: any) => acc + (row.net_holding || 0), 0) +
        topDistrs.reduce((acc: number, row: any) => acc + (row.net_holding || 0), 0);
    const netPositionsPeriodAccDist =
        topAccums.reduce((acc: number, row: any) => acc + (row.periodAccumulation || 0), 0) +
        topDistrs.reduce((acc: number, row: any) => acc + (row.periodDistributions || 0), 0);

// ... inside TradeAnimation component, after computing mmNetAccDistVolume:
// New state and refs for 1-minute change calculation
    const [currentOneMinChg, setCurrentOneMinChg] = useState(0);
    const [prevOneMinChg, setPrevOneMinChg] = useState(0);

// Ref to store the start time and starting volume for the current 1-minute cycle
    const oneMinCycleRef = useRef({ start: Date.now(), startVolume: mmNetAccDistVolume });

// Ref to keep the latest mmNetAccDistVolume value
    const mmNetAccDistVolumeRef = useRef(mmNetAccDistVolume);
    useEffect(() => {
        mmNetAccDistVolumeRef.current = mmNetAccDistVolume;
    }, [mmNetAccDistVolume]);

// Set up a 1-second interval to update the running 1-minute change calculation
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            const currentVolume = mmNetAccDistVolumeRef.current;
            const { start, startVolume } = oneMinCycleRef.current;

            if (now - start >= 60000) {
                // 1 minute elapsed: store the current change as the previous value,
                // reset the cycle start time and starting volume, and clear current change.
                setPrevOneMinChg(currentVolume - startVolume);
                oneMinCycleRef.current = { start: now, startVolume: currentVolume };
                setCurrentOneMinChg(0);
            } else {
                // Update running total for the current 1-minute change
                setCurrentOneMinChg(currentVolume - startVolume);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // @ts-ignore
    return (
        <>
            {/* Animated Rectangles Container */}
            <div className="relative w-full h-28 overflow-hidden">
                {data.map((row) => {
                    const color = row.side === 'BUY' ? 'green' : 'red';
                    const borderColor = row.side === 'BUY' ? 'D3D3D3' : 'black';
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
                    const topPosition =
                        row.side === 'BUY'
                            ? `calc(50% - ${rectangleHeight / 2 + 2.5}px)`
                            : `calc(50% + 2.5px)`;

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

            {/* Aggregated Totals, Clock, and Change Headings Section */}
            <div className="p-2 mt-2 bg-white dark:bg-gray-800 rounded shadow flex flex-wrap md:flex-nowrap justify-between items-start">
                {/* Left side: Title, Subtitle, and Totals */}
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <h2 className="text-m font-bold">Net Buy/Sell Action</h2>
                        <ClickTooltip
                            content="This section shows a summary of Market Maker & Top Accumulator (Whales) net activity in real-time."
                            link="https://bitcoinisle.com/portfolio/orderflow"
                            linkText="Learn more..."
                        />
                    </div>

                    <h3 className="text-xs font-light">
                        Top Market Maker & Large Holder Net Totals (Accumulations - Distributions)
                    </h3>
                    <div className="mt-2 flex flex-col space-y-1">
                        <div className="text-sm">
                            {`${period} Market Makers Net Trade Volume: `}
                            <span className="font-bold">${mmNetTradeVolume.toLocaleString()}</span>
                        </div>
                        <div className="text-sm">
                            {`Market Makers Net Acc/Dist Volume: `}
                            <span className="font-bold">${mmNetAccDistVolume.toLocaleString()}</span>
                        </div>
                        <div className="text-sm">
                            {`${period} Net Positions Trade Volume: `}
                            <span className="font-bold">${netPositionsTradeVolume.toLocaleString()}</span>
                        </div>
                        <div className="text-sm">
                            {`Net Positions Period Acc/Dist: `}
                            <span className="font-bold">${netPositionsPeriodAccDist.toLocaleString()}</span>
                        </div>
                    </div>

                </div>
                {/* New 4 Horizontal Sub-Columns Headings with 1MIN values */}
                <div className="flex flex-col mt-2 md:mt-0">
                    <div className="flex space-x-4">
                        <span className="text-xs font-bold">
                          PREV 1MIN CHG: {prevOneMinChg.toLocaleString()}
                        </span>
                        <span className="text-xs font-bold">
                          1MIN CHG: {currentOneMinChg.toLocaleString()}
                        </span>
                    </div>
                </div>
                {/* Clock on the right */}
                <div className="text-sm mt-2 md:mt-0">
                    <div className="font-light">Period Timer:</div>
                    <div className="font-bold float-right mr-1">{formatTime(elapsedTime)}</div>
                </div>
            </div>


            {/* UserTables Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <UserTable
                    title="Top 10 Market Makers Buying"
                    subtitle="Market Makers (other-side) from SELL trades"
                    data={tableData.mm_buyers_rows || []}
                    userKey="user_buyer"
                    tradeKey="total_number_of_trades"
                    volumeKey="total_vol_trades"
                    periodColumnName="Period Accumulation"
                    showSubTotals={true}
                />
                <UserTable
                    title="Top 10 Market Makers Selling"
                    subtitle="Market Makers (other-side) from BUY trades"
                    data={tableData.mm_sellers_rows || []}
                    userKey="user_seller"
                    tradeKey="total_number_of_trades"
                    volumeKey="total_vol_trades"
                    periodColumnName="Period Distribution"
                    showSubTotals={true}
                />
                <UserTable
                    title="Top Accumulators In Period"
                    subtitle="Top Net Long Positions In Period"
                    data={tableData.top_accumulators_rows || []}
                    userKey="top_buyer"
                    volumeKey="net_holding"
                    periodColumnName="Period Accumulation"
                    showSubTotals={true}
                />
                <UserTable
                    title="Top Distributors In Period"
                    subtitle="Top Net Short Positions In Period"
                    data={tableData.top_distributors_rows || []}
                    userKey="top_seller"
                    volumeKey="net_holding"
                    periodColumnName="Period Distribution"
                    showSubTotals={true}
                />
            </div>
        </>
    );
};

interface TradeAnimationPageProps {}

const TradeAnimationPage: React.FC<TradeAnimationPageProps> = () => {
    const [orderflowData, setOrderflowData] = useState<any>({});
    const { ticker, period } = useTickerPeriod();
    const [duration, setDuration] = useState<number>(1);
    const [resetStartTime, setResetStartTime] = useState<number>(Date.now());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const endTime = Math.floor(Date.now() / 1000);
                const periodMapping: Record<string, number> = {
                    '1 hour': 3600,
                    '4 hours': 14400,
                    '1 day': 86400,
                    '1 week': 604800,
                };
                const periodSeconds = periodMapping[period];
                const startTime = endTime - periodSeconds;
                const url = `https://botpilot--8000.ngrok.io/orderflow_activity/?sym=${ticker}&start_time=${startTime}&end_time=${endTime}`;
                const response = await fetch(url);
                if (!response.ok) throw new Error('Network response was not ok');
                const result = await response.json();
                setOrderflowData(result);
                // Instead of using a created_at value from the data, reset the clock using Date.now()
                setResetStartTime(Date.now());
            } catch (error) {
                console.error('Error fetching orderflow data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [ticker, period]);

    if (loading) {
        return <LoadingIndicator />;
    }

    return (
        <div className="p-4">
            {/* Controls container */}
            <div className="max-w-[600px] flex flex-wrap gap-4">
                {/* Titles Block: Always full width */}
                <div className="order-1 w-full">
                    <h2 className="text-2xl font-bold">Orderflow Analysis</h2>
                    <div className="flex items-center gap-2">
                    <h3 className="text-sm font-light">
                        Visual Buy & Sell Transactions Stream
                    </h3>
                    <ClickTooltip
                        content="The section below shows the live transaction stream by size. For example, big green rectanges are big buys & small red are small sells. Adjust track speed with slider."
                        link="https://bitcoinisle.com/portfolio/orderflow"
                        linkText="Learn more..."
                    />
                    </div>
                </div>

                {/* Slider: Adjusted to max-w-[225px] and range from 1-4 */}
                <div className="order-2 w-full max-w-[225px]">
                    <input
                        type="range"
                        min="1"
                        max="4"
                        value={duration}
                        onChange={(e) => setDuration(parseFloat(e.target.value))}
                        className="w-full"
                    />
                    <span className="text-sm block">{duration}s</span>
                </div>
            </div>

            {/* Animation and tables, with aggregated totals section */}
            <TradeAnimation
                orderflowData={orderflowData}
                duration={duration}
                resetStartTime={resetStartTime}
                period={period}
            />
        </div>
    );
};

export default TradeAnimationPage;
