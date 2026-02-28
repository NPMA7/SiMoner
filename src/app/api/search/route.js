import { NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    
    if (!query || query.trim().length === 0) {
      return NextResponse.json({
        interfaces: [],
        total: 0,
      });
    }

    const searchTerm = query.toLowerCase().trim();
    const allInterfaces = [];
    
    // Fetch all pages to search through all interfaces
    // First, get the first page to know total pages
    const firstPageResponse = await fetch(`${API_BASE_URL}/`, {
      cache: 'no-store',
      headers: {
        'Accept': 'text/html',
      },
    });

    if (!firstPageResponse.ok) {
      throw new Error(`HTTP error! status: ${firstPageResponse.status}`);
    }

    const firstPageHtml = await firstPageResponse.text();
    const firstPageData = parseInterfacesPage(firstPageHtml, 1);
    
    // Add interfaces from first page
    allInterfaces.push(...firstPageData.interfaces);
    
    // Get total pages
    let totalPages = firstPageData.totalPages;
    
    // If totalPages is still 1, try to estimate from total interfaces
    if (totalPages === 1 && firstPageData.total > 0) {
      const interfacesPerPage = firstPageData.interfaces.length;
      if (interfacesPerPage > 0) {
        totalPages = Math.ceil(firstPageData.total / interfacesPerPage);
      }
    }
    
    // Fetch remaining pages in parallel (limit to reasonable number)
    const maxPages = Math.min(totalPages, 10); // Limit to 10 pages for performance
    const fetchPromises = [];
    
    for (let page = 2; page <= maxPages; page++) {
      fetchPromises.push(
        fetch(`${API_BASE_URL}/ipage/${page}/`, {
          cache: 'no-store',
          headers: {
            'Accept': 'text/html',
          },
        }).then(async (response) => {
          if (response.ok) {
            const html = await response.text();
            const pageData = parseInterfacesPage(html, page);
            return pageData.interfaces;
          }
          return [];
        }).catch(() => [])
      );
    }
    
    // Wait for all pages to be fetched
    const results = await Promise.all(fetchPromises);
    
    // Combine all interfaces
    results.forEach((interfaces) => {
      allInterfaces.push(...interfaces);
    });
    
    // Filter interfaces by search term
    const filteredInterfaces = allInterfaces.filter(iface =>
      iface.toLowerCase().includes(searchTerm)
    );
    
    return NextResponse.json({
      interfaces: filteredInterfaces,
      total: filteredInterfaces.length,
      searchedPages: maxPages,
    });
  } catch (error) {
    console.error('Error searching interfaces:', error);
    return NextResponse.json(
      { error: 'Failed to search interfaces', message: error.message },
      { status: 500 }
    );
  }
}

function parseInterfacesPage(html, currentPageParam = 1) {
  const interfaces = [];
  const totalMatch = html.match(/You have access to (\d+) interfaces?/i);
  const total = totalMatch ? parseInt(totalMatch[1]) : 0;

  // Extract interface names from HTML
  // Pattern: <li><a href='/graphs/iface/272%5FTIS/'>272_TIS</a>
  // Use the display text from the link (match[2]), not the URL-encoded version
  const linkPattern = /<li><a[^>]*href=["']\/graphs\/iface\/([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
  
  let match;
  const seen = new Set();
  
  // Extract from links in <li> tags
  while ((match = linkPattern.exec(html)) !== null) {
    const urlEncodedName = match[1];
    const displayName = match[2].trim();
    
    // Use display name as primary source (it's already human-readable)
    let interfaceName = displayName;
    
    // If display name is empty, fallback to decoding URL
    if (!interfaceName || interfaceName.length === 0) {
      try {
        interfaceName = decodeURIComponent(urlEncodedName)
          .replace(/%2D/g, '-')
          .replace(/%5F/g, '_')
          .replace(/%20/g, ' ')
          .replace(/%3C/g, '<')
          .replace(/%3E/g, '>')
          .trim();
      } catch (e) {
        interfaceName = urlEncodedName
          .replace(/%2D/g, '-')
          .replace(/%5F/g, '_')
          .replace(/%20/g, ' ')
          .replace(/%3C/g, '<')
          .replace(/%3E/g, '>')
          .trim();
      }
    }
    
    if (interfaceName && !seen.has(interfaceName)) {
      interfaces.push(interfaceName);
      seen.add(interfaceName);
    }
  }
  
  // Fallback: if no <li> tags found, try generic link pattern
  if (interfaces.length === 0) {
    const genericLinkPattern = /<a[^>]*href=["']\/graphs\/iface\/([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
    while ((match = genericLinkPattern.exec(html)) !== null) {
      const displayName = match[2].trim();
      if (displayName && !seen.has(displayName)) {
        interfaces.push(displayName);
        seen.add(displayName);
      }
    }
  }

  // Extract pagination info from <nav class=pager>
  const currentPage = currentPageParam;
  let totalPages = 1;
  
  const pagerMatch = html.match(/<nav[^>]*class=["']?pager["']?[^>]*>([\s\S]*?)<\/nav>/i);
  
  if (pagerMatch) {
    const pagerContent = pagerMatch[1];
    const pageNumbers = [];
    
    const spanMatches = pagerContent.matchAll(/<span[^>]*>(\d+)<\/span>/g);
    for (const spanMatch of spanMatches) {
      const pageNum = parseInt(spanMatch[1]);
      if (!isNaN(pageNum) && pageNum > 0) {
        pageNumbers.push(pageNum);
      }
    }
    
    const linkMatches = pagerContent.matchAll(/<a[^>]*href=["']\/graphs\/ipage\/(\d+)\/[^"']*["'][^>]*>(\d+)<\/a>/g);
    for (const linkMatch of linkMatches) {
      const pageNum = parseInt(linkMatch[2] || linkMatch[1]);
      if (!isNaN(pageNum) && pageNum > 0) {
        pageNumbers.push(pageNum);
      }
    }
    
    if (pageNumbers.length > 0) {
      totalPages = Math.max(...pageNumbers);
    }
  }
  
  if (total > 0 && totalPages === 1 && interfaces.length > 0) {
    const interfacesPerPage = interfaces.length;
    const estimatedPages = Math.ceil(total / interfacesPerPage);
    if (estimatedPages > totalPages) {
      totalPages = estimatedPages;
    }
  }
  
  if (totalPages < 1) {
    totalPages = 1;
  }

  return {
    interfaces,
    total,
    currentPage,
    totalPages,
  };
}

