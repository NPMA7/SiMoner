'use client';

import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function TrafficChart({ title, subtitle, data, stats, xKey, yAxisLabel }) {
  const formatValue = (value) => {
    if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}Gb`;
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}Mb`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}Kb`;
    return `${value}b`;
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            {payload[0].payload[xKey]}
          </p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name === 'In' ? 'Masuk' : 'Keluar'}: {formatValue(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        {subtitle && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{subtitle}</p>
        )}
      </div>
      
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
          <XAxis 
            dataKey={xKey} 
            stroke="#6b7280"
            className="dark:text-gray-400"
            tick={{ fill: '#6b7280' }}
          />
          <YAxis 
            label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }}
            stroke="#6b7280"
            tick={{ fill: '#6b7280' }}
            tickFormatter={formatValue}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            formatter={(value) => value === 'In' ? 'Masuk' : 'Keluar'}
          />
          <Bar 
            dataKey="out" 
            name="Out"
            fill="#10b981"
            radius={[4, 4, 0, 0]}
          />
          <Line 
            type="monotone" 
            dataKey="in" 
            name="In"
            stroke="#3b82f6" 
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      
      {stats && (
        <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Max Masuk</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatValue(stats.maxIn)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Rata-rata Masuk</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatValue(stats.avgIn)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Saat Ini Masuk</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatValue(stats.currentIn)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Max Keluar</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatValue(stats.maxOut)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Rata-rata Keluar</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatValue(stats.avgOut)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Saat Ini Keluar</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatValue(stats.currentOut)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

