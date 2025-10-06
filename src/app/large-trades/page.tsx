'use client';

import React, { useEffect, useState } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import 'highcharts/indicators/indicators-all'; // Import indicators module
import 'highcharts/indicators/indicators'; // Import indicators module
import 'highcharts/indicators/ema'; // Import EMA indicator

interface Row {
    candle_start: string;
    time_started: number;
    period_open: number;
    period_high: number;
    period_low: number;
    period_closed: number;
    trade_count: number;
    maker_count: number;
    taker_count: number;
    net_notional: number;
    net_taker_notional: number;
    ema_metric: number;
    time_started_ms: number;
}

interface Echo {
    ticker: string;
    period: string;
    acct: string;
    start_ms: number;
    end_ms: number;
    ema_len: number;
    metric: string;
}

interface DataObject {
    rows: Row[];
    echo: Echo;
}

const LargeTradesPage: React.FC = () => {
    const [data, setData] = useState<DataObject | null>(null);
    const [chartOptions, setChartOptions] = useState<Highcharts.Options>({});

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch('http://localhost:8000/large-trades?ticker=SOL-USD&start_time=1759081931181&end_time=1759170394572&acct=0xe00902f209ee8ccc06a333a524a973209e605d12');
                const result = await response.json();
                setData(result);
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        };

        fetchData();
    }, []);

    useEffect(() => {
        if (data) {
            const ohlcData = data.rows.map(row => [
                row.time_started_ms, // Ensure this is in milliseconds
                row.period_open,
                row.period_high,
                row.period_low,
                row.period_closed
            ] as [number, number, number, number, number]);

            const emaData = data.rows.map(row => [
                row.time_started_ms, // Ensure this is in milliseconds
                row.ema_metric
            ] as [number, number]);

            const chartOptions: Highcharts.Options = {
                chart: {
                    type: 'candlestick',
                },
                title: {
                    text: 'Large Trades Candlestick Chart'
                },
                xAxis: {
                    type: 'datetime'
                },
                yAxis: {
                    title: {
                        text: 'Price'
                    }
                },
                series: [
                    {
                        name: 'Candlestick',
                        data: ohlcData,
                        type: 'candlestick'
                    },
                    {
                        name: 'EMA',
                        data: emaData,
                        type: 'line',
                        color: 'red'
                    }
                ]
            };

            setChartOptions(chartOptions);
        }
    }, [data]);

    return (
        <div>
            <h1>Large Trades Analysis</h1>
            {data ? (
                <HighchartsReact highcharts={Highcharts} options={chartOptions} />
            ) : (
                <p>Loading data...</p>
            )}
        </div>
    );
};

export default LargeTradesPage;