import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Flame, 
  Globe, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Download, 
  Play, 
  Pause, 
  RotateCcw,
  Filter,
  Shield,
  Zap,
  Key,
  AlertTriangle
} from 'lucide-react';
import { SitemapParser, type SitemapUrl, type CrawlResult } from '@/utils/SitemapParser';
import { FirecrawlService } from '@/utils/FirecrawlService';
import { FirecrawlApiKeyDialog } from '@/components/FirecrawlApiKeyDialog';
import heroImage from '@/assets/hero-warming.jpg';

interface CrawlStats {
  total: number;
  completed: number;
  successful: number;
  errors: number;
  avgResponseTime: number;
}

export const CacheWarmerDashboard = () => {
  const { toast } = useToast();
  
  // Configuration state
  const [sitemapUrl, setSitemapUrl] = useState('https://surfcamp.it/sitemap_index.xml');
  const [delay, setDelay] = useState(1000);
  const [userAgent, setUserAgent] = useState('Mozilla/5.0 (compatible; CacheWarmer/1.0)');
  const [filters, setFilters] = useState<string[]>([]);
  const [filterInput, setFilterInput] = useState('');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [maxPages, setMaxPages] = useState(100);

  // Firecrawl state
  const [isFirecrawlConfigured, setIsFirecrawlConfigured] = useState(false);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);

  // Crawling state
  const [urls, setUrls] = useState<SitemapUrl[]>([]);
  const [crawlResults, setCrawlResults] = useState<CrawlResult[]>([]);
  const [isCrawling, setIsCrawling] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [stats, setStats] = useState<CrawlStats>({
    total: 0,
    completed: 0,
    successful: 0,
    errors: 0,
    avgResponseTime: 0
  });

  useEffect(() => {
    setIsFirecrawlConfigured(FirecrawlService.isConfigured());
  }, []);

  const updateStats = (results: CrawlResult[]) => {
    const successful = results.filter(r => r.status >= 200 && r.status < 400).length;
    const errors = results.filter(r => r.status === 0 || r.status >= 400).length;
    const avgResponseTime = results.length > 0 
      ? Math.round(results.reduce((sum, r) => sum + r.responseTime, 0) / results.length)
      : 0;

    setStats({
      total: urls.length,
      completed: results.length,
      successful,
      errors,
      avgResponseTime
    });
  };

  const handleLoadSitemap = async () => {
    // Check if we need Firecrawl for external URLs
    const isExternalUrl = !sitemapUrl.startsWith(window.location.origin);
    
    if (isExternalUrl && !isFirecrawlConfigured) {
      toast({
        title: "Configurazione Richiesta",
        description: "Per accedere a sitemap esterne è necessario configurare Firecrawl",
        variant: "destructive",
      });
      setShowApiKeyDialog(true);
      return;
    }

    try {
      toast({
        title: "Caricamento Sitemap",
        description: "Analizzando la sitemap...",
      });

      const auth = authUsername && authPassword 
        ? { username: authUsername, password: authPassword }
        : undefined;

      const parsedUrls = await SitemapParser.parseSitemap(sitemapUrl, auth, isExternalUrl);
      
      // Apply filters
      const filteredUrls = filters.length > 0 
        ? SitemapParser.filterUrls(parsedUrls, filters)
        : parsedUrls;

      // Limit to maxPages
      const limitedUrls = filteredUrls.slice(0, maxPages);
      
      setUrls(limitedUrls);
      setCrawlResults([]);
      
      toast({
        title: "Sitemap Caricata",
        description: `Trovati ${limitedUrls.length} URL da scansionare`,
      });

      updateStats([]);
    } catch (error) {
      toast({
        title: "Errore",
        description: error instanceof Error ? error.message : "Errore nel caricamento della sitemap",
        variant: "destructive",
      });
    }
  };

  const handleStartCrawling = async () => {
    if (urls.length === 0) {
      toast({
        title: "Errore",
        description: "Carica prima una sitemap",
        variant: "destructive",
      });
      return;
    }

    setIsCrawling(true);
    setIsPaused(false);
    
    const config = {
      userAgent,
      auth: authUsername && authPassword 
        ? { username: authUsername, password: authPassword }
        : undefined
    };

    for (let i = crawlResults.length; i < urls.length; i++) {
      if (isPaused) break;
      
      const url = urls[i].url;
      setCurrentUrl(url);

      try {
        const result = await SitemapParser.crawlUrl(url, config);
        const newResults = [...crawlResults, result];
        setCrawlResults(newResults);
        updateStats(newResults);

        toast({
          title: result.status >= 200 && result.status < 400 ? "Successo" : "Errore",
          description: `${url} - Status: ${result.status} (${result.responseTime}ms)`,
          variant: result.status >= 200 && result.status < 400 ? "default" : "destructive",
        });

        // Wait delay between requests
        if (i < urls.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        console.error('Error crawling URL:', url, error);
      }
    }

    setIsCrawling(false);
    setCurrentUrl('');
    
    toast({
      title: "Crawling Completato",
      description: `Processati ${crawlResults.length} URL`,
    });
  };

  const handlePauseCrawling = () => {
    setIsPaused(true);
    setIsCrawling(false);
  };

  const handleResetCrawling = () => {
    setCrawlResults([]);
    setCurrentUrl('');
    setIsCrawling(false);
    setIsPaused(false);
    updateStats([]);
  };

  const handleAddFilter = () => {
    if (filterInput.trim() && !filters.includes(filterInput.trim())) {
      setFilters([...filters, filterInput.trim()]);
      setFilterInput('');
    }
  };

  const handleRemoveFilter = (filter: string) => {
    setFilters(filters.filter(f => f !== filter));
  };

  const handleExportResults = (format: 'csv' | 'json') => {
    if (crawlResults.length === 0) {
      toast({
        title: "Errore",
        description: "Nessun risultato da esportare",
        variant: "destructive",
      });
      return;
    }

    const exportData = SitemapParser.exportResults(crawlResults, format);
    const blob = new Blob([exportData], { 
      type: format === 'csv' ? 'text/csv' : 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cache-warming-results.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const progressPercentage = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;

  const handleFirecrawlConfigured = () => {
    setIsFirecrawlConfigured(true);
    toast({
      title: "Firecrawl Configurato",
      description: "Ora puoi caricare sitemap esterne",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Hero Section */}
      <div className="relative bg-gradient-warming text-primary-foreground">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative container mx-auto px-4 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Flame className="h-8 w-8" />
                <span className="text-2xl font-bold">Cache Warmer Pro</span>
              </div>
              <h1 className="text-4xl font-bold mb-4">
                Pre-carica la Cache del tuo WordPress
              </h1>
              <p className="text-xl mb-6 text-primary-foreground/90">
                Scansiona automaticamente le sitemap e visita tutti gli URL per migliorare le performance del sito.
              </p>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  <span>Supporto Sitemap Index</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  <span>Intervalli Configurabili</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  <span>Auth Basic Support</span>
                </div>
              </div>
            </div>
            <div className="lg:justify-self-end">
              <img 
                src={heroImage} 
                alt="Cache Warming Dashboard" 
                className="rounded-lg shadow-warming max-w-full h-auto"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Dashboard */}
      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="config" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="config">Configurazione</TabsTrigger>
            <TabsTrigger value="monitor">Monitoraggio</TabsTrigger>
            <TabsTrigger value="results">Risultati</TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sitemap Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Configurazione Sitemap
                  </CardTitle>
                  <CardDescription>
                    Configura l'URL della sitemap e le opzioni di scansione
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!isFirecrawlConfigured && (
                    <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2 text-warning">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="font-medium text-sm">Limitazione CORS</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Per sitemap esterne è necessario configurare Firecrawl per bypassare le limitazioni del browser.
                      </p>
                      <Button 
                        onClick={() => setShowApiKeyDialog(true)} 
                        variant="outline" 
                        size="sm"
                        className="w-full"
                      >
                        <Key className="h-4 w-4" />
                        Configura Firecrawl
                      </Button>
                    </div>
                  )}
                  
                  <div>
                    <Label htmlFor="sitemap-url">URL Sitemap</Label>
                    <Input
                      id="sitemap-url"
                      value={sitemapUrl}
                      onChange={(e) => setSitemapUrl(e.target.value)}
                      placeholder="https://example.com/sitemap.xml"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="delay">Intervallo (ms)</Label>
                      <Input
                        id="delay"
                        type="number"
                        value={delay}
                        onChange={(e) => setDelay(parseInt(e.target.value))}
                        min="100"
                        max="10000"
                      />
                    </div>
                    <div>
                      <Label htmlFor="max-pages">Max Pagine</Label>
                      <Input
                        id="max-pages"
                        type="number"
                        value={maxPages}
                        onChange={(e) => setMaxPages(parseInt(e.target.value))}
                        min="1"
                        max="1000"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="user-agent">User Agent</Label>
                    <Input
                      id="user-agent"
                      value={userAgent}
                      onChange={(e) => setUserAgent(e.target.value)}
                      placeholder="Mozilla/5.0..."
                    />
                  </div>

                  <Button 
                    onClick={handleLoadSitemap} 
                    variant="performance" 
                    className="w-full"
                  >
                    <Globe className="h-4 w-4" />
                    Carica Sitemap
                  </Button>
                </CardContent>
              </Card>

              {/* Filters & Auth */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Filter className="h-5 w-5" />
                    Filtri e Autenticazione
                  </CardTitle>
                  <CardDescription>
                    Filtri per sezioni specifiche e credenziali di accesso
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="filter">Aggiungi Filtro URL</Label>
                    <div className="flex gap-2">
                      <Input
                        id="filter"
                        value={filterInput}
                        onChange={(e) => setFilterInput(e.target.value)}
                        placeholder="/blog/ o /shop/"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddFilter()}
                      />
                      <Button onClick={handleAddFilter} size="sm">
                        Aggiungi
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {filters.map((filter) => (
                      <Badge key={filter} variant="secondary" className="cursor-pointer" onClick={() => handleRemoveFilter(filter)}>
                        {filter} ×
                      </Badge>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="auth-username">Username (opzionale)</Label>
                      <Input
                        id="auth-username"
                        value={authUsername}
                        onChange={(e) => setAuthUsername(e.target.value)}
                        placeholder="username"
                      />
                    </div>
                    <div>
                      <Label htmlFor="auth-password">Password (opzionale)</Label>
                      <Input
                        id="auth-password"
                        type="password"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        placeholder="password"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="monitor" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Totale URL</p>
                      <p className="text-2xl font-bold">{stats.total}</p>
                    </div>
                    <Globe className="h-8 w-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Completati</p>
                      <p className="text-2xl font-bold text-primary">{stats.completed}</p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-primary" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Successi</p>
                      <p className="text-2xl font-bold text-success">{stats.successful}</p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-success" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Errori</p>
                      <p className="text-2xl font-bold text-destructive">{stats.errors}</p>
                    </div>
                    <XCircle className="h-8 w-8 text-destructive" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Tempo Medio</p>
                      <p className="text-2xl font-bold">{stats.avgResponseTime}ms</p>
                    </div>
                    <Clock className="h-8 w-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Progress */}
            <Card>
              <CardHeader>
                <CardTitle>Progresso Crawling</CardTitle>
                <CardDescription>
                  {currentUrl ? `Processando: ${currentUrl}` : 'In attesa...'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Progress value={progressPercentage} className="w-full" />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{stats.completed} di {stats.total} URL processati</span>
                  <span>{Math.round(progressPercentage)}%</span>
                </div>

                <div className="flex gap-2">
                  {!isCrawling && !isPaused && (
                    <Button 
                      onClick={handleStartCrawling} 
                      variant="warming"
                      disabled={urls.length === 0}
                    >
                      <Play className="h-4 w-4" />
                      Avvia Crawling
                    </Button>
                  )}
                  
                  {isCrawling && (
                    <Button onClick={handlePauseCrawling} variant="secondary">
                      <Pause className="h-4 w-4" />
                      Pausa
                    </Button>
                  )}

                  <Button onClick={handleResetCrawling} variant="outline">
                    <RotateCcw className="h-4 w-4" />
                    Reset
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="results" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Risultati Crawling</span>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => handleExportResults('csv')} 
                      variant="outline" 
                      size="sm"
                      disabled={crawlResults.length === 0}
                    >
                      <Download className="h-4 w-4" />
                      CSV
                    </Button>
                    <Button 
                      onClick={() => handleExportResults('json')} 
                      variant="outline" 
                      size="sm"
                      disabled={crawlResults.length === 0}
                    >
                      <Download className="h-4 w-4" />
                      JSON
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {crawlResults.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      Nessun risultato disponibile. Avvia un crawling per vedere i risultati.
                    </p>
                  ) : (
                    crawlResults.map((result, index) => (
                      <div 
                        key={index} 
                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                      >
                        <div className="flex-1">
                          <p className="font-medium truncate">{result.url}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(result.timestamp).toLocaleString()} - {result.responseTime}ms
                          </p>
                          {result.error && (
                            <p className="text-sm text-destructive">{result.error}</p>
                          )}
                        </div>
                        <Badge 
                          variant={
                            result.status >= 200 && result.status < 300 ? "default" :
                            result.status >= 300 && result.status < 400 ? "secondary" :
                            "destructive"
                          }
                        >
                          {result.status || 'Error'}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <FirecrawlApiKeyDialog 
          open={showApiKeyDialog}
          onOpenChange={setShowApiKeyDialog}
          onConfigured={handleFirecrawlConfigured}
        />
      </div>
    </div>
  );
};