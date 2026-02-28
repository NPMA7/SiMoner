import { NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');

    const url = page === 1 
      ? `${API_BASE_URL}/`
      : `${API_BASE_URL}/ipage/${page}/`;
    
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
    const result = parseInterfacesPage(html, page);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching interfaces:', error);
    return NextResponse.json(
      { error: 'Failed to fetch interfaces', message: error.message },
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
    // This handles cases like "272_TIS", "ARJASARI-ANCOLMEKAR", etc.
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
        // If decoding fails, use URL name as is with manual replacements
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
  // Format: <nav class=pager><span>&lt;</span> <span>1</span>
  //         <a href='/graphs/ipage/2/'>2</a>
  //         <a href='/graphs/ipage/3/'>3</a>
  //         ...
  //         <a href='/graphs/ipage/2/'>&gt;</a>
  //         </nav>
  
  const currentPage = currentPageParam;
  let totalPages = 1;
  
  // Find the nav.pager section
  const pagerMatch = html.match(/<nav[^>]*class=["']?pager["']?[^>]*>([\s\S]*?)<\/nav>/i);
  
  if (pagerMatch) {
    const pagerContent = pagerMatch[1];
    
    // Extract all page numbers from <span> and <a> tags
    const pageNumbers = [];
    
    // Get numbers from <span> tags (current page)
    const spanMatches = pagerContent.matchAll(/<span[^>]*>(\d+)<\/span>/g);
    for (const spanMatch of spanMatches) {
      const pageNum = parseInt(spanMatch[1]);
      if (!isNaN(pageNum) && pageNum > 0) {
        pageNumbers.push(pageNum);
      }
    }
    
    // Get numbers from <a> tags (other pages)
    const linkMatches = pagerContent.matchAll(/<a[^>]*href=["']\/graphs\/ipage\/(\d+)\/[^"']*["'][^>]*>(\d+)<\/a>/g);
    for (const linkMatch of linkMatches) {
      const pageNum = parseInt(linkMatch[2] || linkMatch[1]);
      if (!isNaN(pageNum) && pageNum > 0) {
        pageNumbers.push(pageNum);
      }
    }
    
    if (pageNumbers.length > 0) {
      // The maximum number in pagination is the total pages
      totalPages = Math.max(...pageNumbers);
    }
  } else {
    // Fallback: try old pattern "< 1 2 3 4 5 >"
    let paginationMatch = html.match(/< (\d+)(?:\s+(\d+))?(?:\s+(\d+))?(?:\s+(\d+))?(?:\s+(\d+))?[\\\s]*>/);
    
    if (!paginationMatch) {
      paginationMatch = html.match(/< (\d+)(?:\s+(\d+))?(?:\s+(\d+))?(?:\s+(\d+))?(?:\s+(\d+))? \\>/);
    }
    
    if (paginationMatch) {
      const pages = paginationMatch.slice(1)
        .filter(p => p !== undefined)
        .map(p => parseInt(p))
        .filter(p => !isNaN(p) && p > 0);
      
      if (pages.length > 0) {
        totalPages = Math.max(...pages);
      }
    }
  }
  
  // If we have total interfaces and interfaces per page, calculate total pages as fallback
  if (total > 0 && totalPages === 1 && interfaces.length > 0) {
    // Estimate: calculate based on actual interfaces found per page
    const interfacesPerPage = interfaces.length;
    const estimatedPages = Math.ceil(total / interfacesPerPage);
    if (estimatedPages > totalPages) {
      totalPages = estimatedPages;
    }
  }
  
  // Ensure totalPages is at least 1
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

