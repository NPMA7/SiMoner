import { NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export async function GET(request, { params }) {
  try {
    const resolvedParams = params && typeof params.then === 'function' ? await params : params;
    const interfaceName = resolvedParams?.name || '';
    const decodedName = decodeURIComponent(interfaceName);

    // Encode interface name untuk URL
    const encodedName = encodeURIComponent(decodedName).replace(/-/g, '%2D');
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
    const result = parseInterfaceDetailPage(html, decodedName);
    
    // Construct proxy URLs for graph images to avoid Mixed Content issues
    // The proxy route will fetch from HTTP and serve through HTTPS
    const baseImageUrl = `${API_BASE_URL}/iface/${encodedName}/`;
    const getProxyUrl = (imagePath) => {
      if (!imagePath) return null;
      const fullUrl = imagePath.startsWith('http') ? imagePath : `${baseImageUrl}${imagePath}`;
      return `/api/proxy-image?url=${encodeURIComponent(fullUrl)}`;
    };
    
    result.graphImages = {
      daily: getProxyUrl(result.graphImages.daily),
      weekly: getProxyUrl(result.graphImages.weekly),
      monthly: getProxyUrl(result.graphImages.monthly),
      yearly: getProxyUrl(result.graphImages.yearly),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching interface data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch interface data', message: error.message },
      { status: 500 }
    );
  }
}

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

  // Extract GIF image URLs for each graph type
  // Pattern: <img src='daily.gif' alt="Daily Graph">
  const graphImages = {
    daily: extractGraphImage(html, 'daily'),
    weekly: extractGraphImage(html, 'weekly'),
    monthly: extractGraphImage(html, 'monthly'),
    yearly: extractGraphImage(html, 'yearly'),
  };

  // Generate chart data based on stats (as fallback if images fail to load)
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
    graphImages,
  };
}

function extractGraphImage(html, graphType) {
  // Look for img tag with src containing the graph type (daily.gif, weekly.gif, etc.)
  // Pattern: <img src='daily.gif' alt="Daily Graph">
  const imgPattern = new RegExp(`<img[^>]*src=["']([^"']*${graphType}[^"']*\\.gif)["'][^>]*>`, 'i');
  const match = html.match(imgPattern);
  
  if (match && match[1]) {
    // Extract the image filename (e.g., "daily.gif", "weekly.gif")
    let imagePath = match[1];
    
    // If it's already a full URL, return as is
    if (imagePath.startsWith('http')) {
      return imagePath;
    }
    
    // If it's relative (just filename like "daily.gif"), return the filename
    // The full URL will be constructed in the route handler
    return imagePath;
  }
  
  return null;
}

function extractStats(html, graphType) {
  // Find the section for this graph type
  // Structure: <div class="box"><h3>"Daily" Graph...</h3><img...><p><em>Max <span>In</span>: 216b;...</em></p></div>
  
  // First, find the h3 tag with the graph type
  const h3Pattern = new RegExp(`<h3>["']?${graphType}["']?[^<]*Graph[^<]*</h3>`, 'i');
  const h3Match = html.match(h3Pattern);
  
  if (!h3Match) {
    return { maxIn: 0, avgIn: 0, currentIn: 0, maxOut: 0, avgOut: 0, currentOut: 0 };
  }
  
  const h3Index = html.indexOf(h3Match[0]);
  
  // Find the <p> tag after the h3 (should be after <img> tag)
  const pStart = html.indexOf('<p>', h3Index);
  if (pStart === -1) {
    return { maxIn: 0, avgIn: 0, currentIn: 0, maxOut: 0, avgOut: 0, currentOut: 0 };
  }
  
  // Find the closing </p> tag
  const pEnd = html.indexOf('</p>', pStart);
  if (pEnd === -1) {
    return { maxIn: 0, avgIn: 0, currentIn: 0, maxOut: 0, avgOut: 0, currentOut: 0 };
  }
  
  // Extract the paragraph content
  const statsText = html.substring(pStart + 3, pEnd);
  
  // Extract stats directly from HTML using regex
  // Pattern from HTML: <em>Max <span style="color: #00cc00">In</span>: 216b; Average <span style="color: #00cc00">In</span>: 216b; Current <span style="color: #00cc00">In</span>: 216b; </em>
  // We need to match: Max ... In ... : NUMBERb (where ... can be any HTML tags)
  
  // Remove all HTML tags first, then parse
  // This converts: Max <span style="color: #00cc00">In</span>: 216b
  // To: Max In: 216b
  const cleanText = statsText
    .replace(/<[^>]+>/g, ' ')  // Remove all HTML tags
    .replace(/\s+/g, ' ')       // Normalize spaces
    .trim();
  
  // Now parse the cleaned text: "Max In: 216b; Average In: 216b; Current In: 216b; Max Out: 224b; Average Out: 224b; Current Out: 224b;"
  const maxInMatch = cleanText.match(/Max\s+In\s*:\s*(\d+)\s*b/i);
  const avgInMatch = cleanText.match(/Average\s+In\s*:\s*(\d+)\s*b/i);
  const currentInMatch = cleanText.match(/Current\s+In\s*:\s*(\d+)\s*b/i);
  const maxOutMatch = cleanText.match(/Max\s+Out\s*:\s*(\d+)\s*b/i);
  const avgOutMatch = cleanText.match(/Average\s+Out\s*:\s*(\d+)\s*b/i);
  const currentOutMatch = cleanText.match(/Current\s+Out\s*:\s*(\d+)\s*b/i);

  const result = {
    maxIn: maxInMatch ? parseInt(maxInMatch[1]) : 0,
    avgIn: avgInMatch ? parseInt(avgInMatch[1]) : 0,
    currentIn: currentInMatch ? parseInt(currentInMatch[1]) : 0,
    maxOut: maxOutMatch ? parseInt(maxOutMatch[1]) : 0,
    avgOut: avgOutMatch ? parseInt(avgOutMatch[1]) : 0,
    currentOut: currentOutMatch ? parseInt(currentOutMatch[1]) : 0,
  };
  
  return result;
}

function generateChartDataFromStats(stats, type) {
  const data = [];
  
  if (type === 'daily') {
    for (let hour = 0; hour < 24; hour++) {
      // Generate data based on stats with variation
      const baseIn = stats.avgIn || 0;
      const baseOut = stats.avgOut || 0;
      const inRange = stats.maxIn - baseIn;
      const outRange = stats.maxOut - baseOut;
      
      const inValue = baseIn + (Math.random() * inRange * 2) - inRange;
      const outValue = baseOut + (Math.random() * outRange * 2) - outRange;
      
      data.push({
        time: hour,
        in: Math.max(0, Math.round(inValue)),
        out: Math.max(0, Math.round(outValue)),
      });
    }
  } else if (type === 'weekly') {
    const days = ['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'];
    days.forEach((day) => {
      const baseIn = stats.avgIn || 0;
      const baseOut = stats.avgOut || 0;
      const inRange = stats.maxIn - baseIn;
      const outRange = stats.maxOut - baseOut;
      
      const inValue = baseIn + (Math.random() * inRange * 2) - inRange;
      const outValue = baseOut + (Math.random() * outRange * 2) - outRange;
      
      data.push({
        day: day,
        in: Math.max(0, Math.round(inValue)),
        out: Math.max(0, Math.round(outValue)),
      });
    });
  } else if (type === 'monthly') {
    for (let week = 2; week <= 6; week++) {
      const baseIn = stats.avgIn || 0;
      const baseOut = stats.avgOut || 0;
      const inRange = stats.maxIn - baseIn;
      const outRange = stats.maxOut - baseOut;
      
      const inValue = baseIn + (Math.random() * inRange * 2) - inRange;
      const outValue = baseOut + (Math.random() * outRange * 2) - outRange;
      
      data.push({
        week: `Week ${week}`,
        in: Math.max(0, Math.round(inValue)),
        out: Math.max(0, Math.round(outValue)),
      });
    }
  } else if (type === 'yearly') {
    const months = ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'];
    months.forEach((month) => {
      const baseIn = stats.avgIn || 0;
      const baseOut = stats.avgOut || 0;
      const inRange = stats.maxIn - baseIn;
      const outRange = stats.maxOut - baseOut;
      
      const inValue = baseIn + (Math.random() * inRange * 2) - inRange;
      const outValue = baseOut + (Math.random() * outRange * 2) - outRange;
      
      data.push({
        month: month,
        in: Math.max(0, Math.round(inValue)),
        out: Math.max(0, Math.round(outValue)),
      });
    });
  }
  
  return data;
}

