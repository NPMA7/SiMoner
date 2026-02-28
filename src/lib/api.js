const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

/**
 * Fetch dan parse daftar interface dari halaman utama
 */
export async function fetchInterfaces(page = 1) {
  try {
    const url = page === 1 
      ? `${API_BASE_URL}/`
      : `${API_BASE_URL}/ipage/${page}/`;
    
    const response = await fetch(url, {
      cache: 'no-store', // Always fetch fresh data
      headers: {
        'Accept': 'text/html',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    return parseInterfacesPage(html);
  } catch (error) {
    console.error('Error fetching interfaces:', error);
    throw error;
  }
}

/**
 * Parse HTML untuk extract daftar interface
 */
function parseInterfacesPage(html) {
  const interfaces = [];
  const totalMatch = html.match(/You have access to (\d+) interfaces/);
  const total = totalMatch ? parseInt(totalMatch[1]) : 0;

  // Extract interface names from HTML
  // Pattern: interface names appear as list items or links
  const linkPattern = /<a[^>]*href=["']\/graphs\/iface\/([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
  const listPattern = /\* ([^\n<]+)/g;
  
  let match;
  
  // Try to extract from links first
  while ((match = linkPattern.exec(html)) !== null) {
    const interfaceName = decodeURIComponent(match[1].replace(/%2D/g, '-').replace(/%5F/g, '_'));
    if (interfaceName && !interfaces.includes(interfaceName)) {
      interfaces.push(interfaceName);
    }
  }
  
  // If no links found, try list pattern
  if (interfaces.length === 0) {
    while ((match = listPattern.exec(html)) !== null) {
      let interfaceName = match[1].trim();
      // Clean up interface name
      interfaceName = interfaceName.replace(/^<|>$/g, '').trim();
      if (interfaceName && !interfaces.includes(interfaceName)) {
        interfaces.push(interfaceName);
      }
    }
  }

  // Extract pagination info
  const paginationMatch = html.match(/< (\d+) (\d+) (\d+) (\d+) (\d+) >/);
  const currentPage = paginationMatch ? parseInt(paginationMatch[2]) : 1;
  const totalPages = paginationMatch ? parseInt(paginationMatch[paginationMatch.length - 2]) : 1;

  return {
    interfaces,
    total,
    currentPage,
    totalPages,
  };
}

/**
 * Fetch data detail interface
 */
export async function fetchInterfaceData(interfaceName) {
  try {
    // Encode interface name untuk URL
    const encodedName = encodeURIComponent(interfaceName).replace(/-/g, '%2D');
    const url = `${API_BASE_URL}/iface/${encodedName}/`;
    
    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        'Accept': 'text/html',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    return parseInterfaceDetailPage(html, interfaceName);
  } catch (error) {
    console.error('Error fetching interface data:', error);
    throw error;
  }
}

/**
 * Parse HTML untuk extract data detail interface
 */
function parseInterfaceDetailPage(html, interfaceName) {
  // Extract last update time
  const lastUpdateMatch = html.match(/Last update: ([^\n<]+)/);
  const lastUpdate = lastUpdateMatch ? lastUpdateMatch[1].trim() : new Date().toLocaleString();

  // Extract statistics for each graph type
  const stats = {
    daily: extractStats(html, 'Daily'),
    weekly: extractStats(html, 'Weekly'),
    monthly: extractStats(html, 'Monthly'),
    yearly: extractStats(html, 'Yearly'),
  };

  // Generate chart data based on stats (since we can't get actual time series from HTML)
  // In production, you might want to fetch actual graph data from API if available
  const chartData = {
    daily: generateChartDataFromStats(stats.daily, 'daily'),
    weekly: generateChartDataFromStats(stats.weekly, 'weekly'),
    monthly: generateChartDataFromStats(stats.monthly, 'monthly'),
    yearly: generateChartDataFromStats(stats.yearly, 'yearly'),
  };

  return {
    name: interfaceName,
    lastUpdate,
    stats,
    chartData,
  };
}

/**
 * Extract statistics from HTML for a specific graph type
 */
function extractStats(html, graphType) {
  const graphSection = html.split(`"${graphType}"`)[1]?.split('###')[0] || '';
  
  const maxInMatch = graphSection.match(/Max In: (\d+)b/);
  const avgInMatch = graphSection.match(/Average In: (\d+)b/);
  const currentInMatch = graphSection.match(/Current In: (\d+)b/);
  const maxOutMatch = graphSection.match(/Max Out: (\d+)b/);
  const avgOutMatch = graphSection.match(/Average Out: (\d+)b/);
  const currentOutMatch = graphSection.match(/Current Out: (\d+)b/);

  return {
    maxIn: maxInMatch ? parseInt(maxInMatch[1]) : 0,
    avgIn: avgInMatch ? parseInt(avgInMatch[1]) : 0,
    currentIn: currentInMatch ? parseInt(currentInMatch[1]) : 0,
    maxOut: maxOutMatch ? parseInt(maxOutMatch[1]) : 0,
    avgOut: avgOutMatch ? parseInt(avgOutMatch[1]) : 0,
    currentOut: currentOutMatch ? parseInt(currentOutMatch[1]) : 0,
  };
}

/**
 * Generate chart data based on statistics
 * Note: This generates synthetic data. In production, fetch actual time series data if available.
 */
function generateChartDataFromStats(stats, type) {
  const data = [];
  
  if (type === 'daily') {
    for (let hour = 0; hour < 24; hour++) {
      // Generate data based on stats with some variation
      const inValue = stats.avgIn + (Math.random() * (stats.maxIn - stats.avgIn) * 2) - (stats.maxIn - stats.avgIn);
      const outValue = stats.avgOut + (Math.random() * (stats.maxOut - stats.avgOut) * 2) - (stats.maxOut - stats.avgOut);
      data.push({
        time: hour,
        in: Math.max(0, Math.round(inValue)),
        out: Math.max(0, Math.round(outValue)),
      });
    }
  } else if (type === 'weekly') {
    const days = ['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'];
    days.forEach(() => {
      const inValue = stats.avgIn + (Math.random() * (stats.maxIn - stats.avgIn) * 2) - (stats.maxIn - stats.avgIn);
      const outValue = stats.avgOut + (Math.random() * (stats.maxOut - stats.avgOut) * 2) - (stats.maxOut - stats.avgOut);
      data.push({
        day: days[data.length],
        in: Math.max(0, Math.round(inValue)),
        out: Math.max(0, Math.round(outValue)),
      });
    });
  } else if (type === 'monthly') {
    for (let week = 2; week <= 6; week++) {
      const inValue = stats.avgIn + (Math.random() * (stats.maxIn - stats.avgIn) * 2) - (stats.maxIn - stats.avgIn);
      const outValue = stats.avgOut + (Math.random() * (stats.maxOut - stats.avgOut) * 2) - (stats.maxOut - stats.avgOut);
      data.push({
        week: `Week ${week}`,
        in: Math.max(0, Math.round(inValue)),
        out: Math.max(0, Math.round(outValue)),
      });
    }
  } else if (type === 'yearly') {
    const months = ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'];
    months.forEach((month) => {
      const inValue = stats.avgIn + (Math.random() * (stats.maxIn - stats.avgIn) * 2) - (stats.maxIn - stats.avgIn);
      const outValue = stats.avgOut + (Math.random() * (stats.maxOut - stats.avgOut) * 2) - (stats.maxOut - stats.avgOut);
      data.push({
        month: month,
        in: Math.max(0, Math.round(inValue)),
        out: Math.max(0, Math.round(outValue)),
      });
    });
  }
  
  return data;
}

