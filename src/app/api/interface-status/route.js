import { NextResponse } from 'next/server';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

/**
 * Fetch last update for a single interface
 */
async function getInterfaceLastUpdate(interfaceName) {
  try {
    const encodedName = encodeURIComponent(interfaceName);
    const url = `${BASE_URL}/iface/${encodedName}/`;
    const response = await fetch(url, {
      next: { revalidate: 5 } // Cache for 5s
    });
    
    if (!response.ok) {
      return null;
    }
    
    const html = await response.text();
    
    // Extract last update from HTML
    // Format: <li>Last update: Sat Feb 14 18:47:16 2026\n</li>
    const lastUpdateMatch = html.match(/Last update:\s*([^\n<]+)/i);
    
    if (lastUpdateMatch) {
      return lastUpdateMatch[1].trim();
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching last update for ${interfaceName}:`, error);
    return null;
  }
}

export async function POST(request) {
  try {
    const { interfaces } = await request.json();
    
    if (!Array.isArray(interfaces) || interfaces.length === 0) {
      return NextResponse.json({ error: 'Invalid interfaces array' }, { status: 400 });
    }
    
    // Limit to 20 interfaces per request to avoid timeout
    const limitedInterfaces = interfaces.slice(0, 20);
    
    // Fetch last update for all interfaces in parallel
    const statusPromises = limitedInterfaces.map(async (iface) => {
      const lastUpdate = await getInterfaceLastUpdate(iface);
      return {
        interface: iface,
        lastUpdate: lastUpdate
      };
    });
    
    const statuses = await Promise.all(statusPromises);
    
    // Convert to object for easier lookup
    const statusMap = {};
    statuses.forEach(({ interface: iface, lastUpdate }) => {
      statusMap[iface] = lastUpdate;
    });
    
    return NextResponse.json({ statuses: statusMap });
  } catch (error) {
    console.error('Error fetching interface statuses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch interface statuses' },
      { status: 500 }
    );
  }
}

