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
            // If trendData is an array with one object, extract that first object; otherwise use it directly.
            const periodData = Array.isArray(trendData) ? trendData[0] : trendData;
            if (periodData && periodData['5min'] && Array.isArray(periodData['5min'])) {
                setGroupedData({ '5min': periodData['5min'] });
            }
        }
    }, [trendData]);

    return (
        <div className="flex flex-col items-center mt-8">
            {/* Render the 5min chart; later extend for additional periods */}
            <TrendTimeSeriesChart key="5min" period="5min" data={groupedData['5min'] || []} />
        </div>
    );
};

export default TrendChartsSection;