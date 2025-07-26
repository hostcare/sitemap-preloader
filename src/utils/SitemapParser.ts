interface SitemapUrl {
  url: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
}

interface CrawlConfig {
  sitemapUrl: string;
  delay: number;
  userAgent: string;
  filters: string[];
  authUsername?: string;
  authPassword?: string;
  maxPages?: number;
}

interface CrawlResult {
  url: string;
  status: number;
  responseTime: number;
  timestamp: string;
  error?: string;
}

export class SitemapParser {
  static async parseSitemap(sitemapUrl: string, auth?: { username: string; password: string }): Promise<SitemapUrl[]> {
    console.log('Fetching sitemap:', sitemapUrl);
    
    const headers: HeadersInit = {
      'User-Agent': 'CacheWarmer/1.0 (+https://example.com)'
    };

    if (auth) {
      headers['Authorization'] = `Basic ${btoa(`${auth.username}:${auth.password}`)}`;
    }

    try {
      const response = await fetch(sitemapUrl, { headers });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const xmlText = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

      // Check for XML parsing errors
      const parseError = xmlDoc.querySelector('parsererror');
      if (parseError) {
        throw new Error('Invalid XML format');
      }

      // Check if this is a sitemap index
      const sitemapElements = xmlDoc.querySelectorAll('sitemap');
      if (sitemapElements.length > 0) {
        console.log('Found sitemap index with', sitemapElements.length, 'sitemaps');
        
        // Parse sitemap index
        const allUrls: SitemapUrl[] = [];
        for (const sitemapElement of Array.from(sitemapElements)) {
          const sitemapLocation = sitemapElement.querySelector('loc')?.textContent;
          if (sitemapLocation) {
            console.log('Parsing sub-sitemap:', sitemapLocation);
            const subUrls = await this.parseSitemap(sitemapLocation, auth);
            allUrls.push(...subUrls);
          }
        }
        return allUrls;
      }

      // Parse regular sitemap
      const urlElements = xmlDoc.querySelectorAll('url');
      console.log('Found', urlElements.length, 'URLs in sitemap');

      const urls: SitemapUrl[] = [];
      
      for (const urlElement of Array.from(urlElements)) {
        const loc = urlElement.querySelector('loc')?.textContent;
        if (loc) {
          urls.push({
            url: loc,
            lastmod: urlElement.querySelector('lastmod')?.textContent || undefined,
            changefreq: urlElement.querySelector('changefreq')?.textContent || undefined,
            priority: urlElement.querySelector('priority')?.textContent || undefined,
          });
        }
      }

      return urls;
    } catch (error) {
      console.error('Error parsing sitemap:', error);
      throw new Error(`Failed to parse sitemap: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static filterUrls(urls: SitemapUrl[], filters: string[]): SitemapUrl[] {
    if (filters.length === 0) return urls;

    return urls.filter(urlObj => 
      filters.some(filter => 
        urlObj.url.includes(filter)
      )
    );
  }

  static async crawlUrl(
    url: string, 
    config: { userAgent: string; auth?: { username: string; password: string } }
  ): Promise<CrawlResult> {
    const startTime = Date.now();
    
    const headers: HeadersInit = {
      'User-Agent': config.userAgent
    };

    if (config.auth) {
      headers['Authorization'] = `Basic ${btoa(`${config.auth.username}:${config.auth.password}`)}`;
    }

    try {
      const response = await fetch(url, { 
        method: 'GET',
        headers,
        cache: 'no-cache' // Force fresh request to warm cache
      });

      const responseTime = Date.now() - startTime;

      return {
        url,
        status: response.status,
        responseTime,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        url,
        status: 0,
        responseTime,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  static exportResults(results: CrawlResult[], format: 'csv' | 'json'): string {
    if (format === 'json') {
      return JSON.stringify(results, null, 2);
    }

    // CSV format
    const headers = ['URL', 'Status', 'Response Time (ms)', 'Timestamp', 'Error'];
    const rows = results.map(result => [
      result.url,
      result.status.toString(),
      result.responseTime.toString(),
      result.timestamp,
      result.error || ''
    ]);

    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n');
  }
}

export type { SitemapUrl, CrawlConfig, CrawlResult };