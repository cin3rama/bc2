'use client';

import React, { useEffect, useState } from 'react';
import TrendTimeSeriesChart, { TrendDataPoint } from './TrendTimeSeriesChart';

// Define the expected props type.
interface TrendChartsSectionProps {
    // Adjust this type if you have a more specific interface for your raw data.
    trendData: any;
}

const TrendChartsSection: React.FC<TrendChartsSectionProps> = ({ trendData }) => {
    const [groupedData, setGroupedData] = useState<{ [key: string]: TrendDataPoint[] }>({});

    useEffect(() => {
        if (trendData) {
            // If trendData is an array with one object, extract that first object.
            const periodData = Array.isArray(trendData) ? trendData[0] : trendData;
            const newGrouped: { [key: string]: TrendDataPoint[] } = {};
            // Loop over expected periods.
            ['5min', '15min', '30min', '1h', '4h', '24h'].forEach(period => {
                if (periodData[period] && Array.isArray(periodData[period])) {
                    newGrouped[period] = periodData[period];
                }
            });
            setGroupedData(newGrouped);
        }
    }, [trendData]);


    return (
        <div className="flex flex-col w-full items-center mt-8">
            {['5min', '15min', '30min', '1h', '4h', '24h'].map(period => (
                <TrendTimeSeriesChart key={period} period={period} data={groupedData[period] || []} />
            ))}
        </div>
    );
};

export default TrendChartsSection;