'use client';

import { useState } from 'react';

export default function GraphImage({ 
  title, 
  subtitle, 
  imageUrl, 
  stats, 
  fallbackData,
  xKey,
  yAxisLabel 
}) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const formatValue = (value) => {
    if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}Gb`;
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}Mb`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}Kb`;
    return `${value}b`;
  };

  return (
    <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/50 dark:border-gray-800/50 overflow-hidden hover:shadow-xl transition-all duration-300">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800/50 px-5 sm:px-6 py-4 border-b border-gray-200/50 dark:border-gray-700/50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">{subtitle}</p>
            )}
          </div>
        </div>
      </div>
      
      {/* Graph Image */}
      <div className="p-5 sm:p-6">
        {imageUrl && !imageError ? (
          <div className="relative bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl p-4 sm:p-5 border border-gray-200 dark:border-gray-700 shadow-inner">
            {imageLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-xl z-10">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-3 border-blue-200 border-t-blue-600"></div>
              </div>
            )}
            <img
              src={imageUrl}
              alt={`${title} Graph`}
              className="w-full h-auto rounded-lg border border-gray-300 dark:border-gray-600 max-h-64 sm:max-h-72 object-contain shadow-sm"
              onLoad={() => setImageLoading(false)}
              onError={() => {
                setImageError(true);
                setImageLoading(false);
              }}
              style={{ display: imageLoading ? 'none' : 'block' }}
            />
          </div>
        ) : (
          <div className="w-full h-48 sm:h-56 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700">
            <div className="text-center">
              <svg className="mx-auto h-10 w-10 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                {imageError ? 'Failed to load graph' : 'Loading graph...'}
              </p>
            </div>
          </div>
        )}
      </div>
      
      {/* Statistics */}
      {stats && (
        <div className="px-5 sm:px-6 pb-5 sm:pb-6">
          <div className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-xl p-4 sm:p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
            {/* Incoming Stats - 2 rows, 3 columns */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <p className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">Incoming Traffic</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-blue-200/50 dark:border-blue-800/50">
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-medium mb-1">Max In</p>
                  <p className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">{formatValue(stats.maxIn)}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-blue-200/50 dark:border-blue-800/50">
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-medium mb-1">Average In</p>
                  <p className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">{formatValue(stats.avgIn)}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-green-200/50 dark:border-green-800/50">
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-medium mb-1">Current In</p>
                  <p className="text-base sm:text-lg font-bold text-green-600 dark:text-green-400">{formatValue(stats.currentIn)}</p>
                </div>
              </div>
            </div>
            
            {/* Outgoing Stats - 2 rows, 3 columns */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                <p className="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider">Outgoing Traffic</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-purple-200/50 dark:border-purple-800/50">
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-medium mb-1">Max Out</p>
                  <p className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">{formatValue(stats.maxOut)}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-purple-200/50 dark:border-purple-800/50">
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-medium mb-1">Average Out</p>
                  <p className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">{formatValue(stats.avgOut)}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-green-200/50 dark:border-green-800/50">
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-medium mb-1">Current Out</p>
                  <p className="text-base sm:text-lg font-bold text-green-600 dark:text-green-400">{formatValue(stats.currentOut)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

