// SegmentTable.tsx
import React from 'react';

type SegmentTableProps = {
    segmentKey: 'marketMakers' | 'accDistributors' | 'dust' | 'retail';
    data: any;
};

const configMap = {
    marketMakers: {
        title: 'Market Makers',
        rowsKey: ['mm_buyers_rows', 'mm_sellers_rows'],
        userKey: ['user_buyer', 'user_seller'],
    },
    accDistributors: {
        title: 'Accumulators / Distributors',
        rowsKey: ['top_accumulators_rows', 'top_distributors_rows'],
        userKey: ['top_buyer', 'top_seller'],
    },
    dust: {
        title: 'Dust Orders',
        rowsKey: ['top_dust_buyer_rows', 'top_dust_sellers_rows'],
        userKey: ['user_buyer', 'user_seller'],
    },
    retail: {
        title: 'Retail (Computed)',
        rowsKey: ['retail_buy_rows', 'retail_sell_rows'], // assumed keys, to be computed in future
        userKey: ['user_buyer', 'user_seller'],
    },
};

const SegmentTable: React.FC<SegmentTableProps> = ({ segmentKey, data }) => {
    const config = configMap[segmentKey];
    const [buyersKey, sellersKey] = config.rowsKey;
    const [buyerField, sellerField] = config.userKey;
    const buyerRows = data[buyersKey] || [];
    const sellerRows = data[sellersKey] || [];

    return (
        <div className="p-2 bg-white dark:bg-gray-800 rounded shadow">
            <h2 className="text-m font-bold mb-1">{config.title}</h2>

            <table className="w-full text-xs">
                <thead>
                <tr className="border-b border-gray-300">
                    <th className="text-left p-1">Type</th>
                    <th className="text-left p-1">Address</th>
                    <th className="text-left p-1">Trades</th>
                    <th className="text-left p-1">Volume ($)</th>
                </tr>
                </thead>
                <tbody>
                {buyerRows.map((row: any, i: number) => (
                    <tr key={`b-${i}`} className="border-b border-gray-200">
                        <td className="p-1 text-green-700 dark:text-green-400">BUY</td>
                        <td className="p-1">
                            {String(row[buyerField]).slice(0, 4)}...{String(row[buyerField]).slice(-4)}
                        </td>
                        <td className="p-1">{row.total_number_of_trades?.toLocaleString()}</td>
                        <td className="p-1">${Math.abs(row.total_vol_trades || row.net_holding || 0).toLocaleString()}</td>
                    </tr>
                ))}

                {sellerRows.map((row: any, i: number) => (
                    <tr key={`s-${i}`} className="border-b border-gray-200">
                        <td className="p-1 text-red-700 dark:text-red-400">SELL</td>
                        <td className="p-1">
                            {String(row[sellerField]).slice(0, 4)}...{String(row[sellerField]).slice(-4)}
                        </td>
                        <td className="p-1">{row.total_number_of_trades?.toLocaleString()}</td>
                        <td className="p-1">${Math.abs(row.total_vol_trades || row.net_holding || 0).toLocaleString()}</td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    );
};

export default SegmentTable;
