import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { FirecrawlService } from '@/utils/FirecrawlService';
import { Key, ExternalLink } from 'lucide-react';

interface FirecrawlApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfigured: () => void;
}

export const FirecrawlApiKeyDialog = ({ open, onOpenChange, onConfigured }: FirecrawlApiKeyDialogProps) => {
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState('');
  const [isTestingKey, setIsTestingKey] = useState(false);

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      toast({
        title: "Errore",
        description: "Inserisci una API key valida",
        variant: "destructive",
      });
      return;
    }

    setIsTestingKey(true);

    try {
      const isValid = await FirecrawlService.testApiKey(apiKey.trim());
      
      if (isValid) {
        FirecrawlService.saveApiKey(apiKey.trim());
        toast({
          title: "Successo",
          description: "API key Firecrawl configurata correttamente",
        });
        onConfigured();
        onOpenChange(false);
        setApiKey('');
      } else {
        toast({
          title: "Errore",
          description: "API key non valida. Verifica e riprova.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Errore",
        description: "Impossibile verificare l'API key. Riprova più tardi.",
        variant: "destructive",
      });
    } finally {
      setIsTestingKey(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Configura Firecrawl API
          </DialogTitle>
          <DialogDescription>
            Per accedere a sitemap esterne è necessario configurare Firecrawl per bypassare le limitazioni CORS del browser.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <h4 className="font-medium text-sm">Come ottenere l'API key:</h4>
            <ol className="text-sm text-muted-foreground space-y-1">
              <li>1. Vai su <a href="https://firecrawl.dev" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">firecrawl.dev <ExternalLink className="h-3 w-3" /></a></li>
              <li>2. Crea un account gratuito</li>
              <li>3. Copia la tua API key dal dashboard</li>
            </ol>
          </div>

          <div className="space-y-2">
            <Label htmlFor="api-key">API Key Firecrawl</Label>
            <Input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="fc-xxxxxxxxxxxxxxxx"
              onKeyDown={(e) => e.key === 'Enter' && handleSaveApiKey()}
            />
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={handleSaveApiKey} 
              disabled={isTestingKey || !apiKey.trim()}
              variant="warming"
              className="flex-1"
            >
              {isTestingKey ? "Verificando..." : "Salva e Testa"}
            </Button>
            <Button 
              onClick={() => onOpenChange(false)} 
              variant="outline"
            >
              Annulla
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            L'API key viene salvata localmente nel browser e non viene condivisa.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};