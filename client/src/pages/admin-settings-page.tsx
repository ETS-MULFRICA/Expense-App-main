import { useEffect, useState } from 'react';
import MainLayout from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

export default function AdminSettingsPage({ embedded = false }: { embedded?: boolean }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [siteName, setSiteName] = useState('ExpenseTrack');
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [defaultCurrency, setDefaultCurrency] = useState('XAF');
  const [language, setLanguage] = useState('en');
  const [emailFrom, setEmailFrom] = useState('');
  const [emailTemplates, setEmailTemplates] = useState<any>({});

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(r => r.ok ? r.json() : null)
      .then(s => {
        if (s) {
          if (s.site_name) setSiteName(s.site_name);
          if (s.logo_data_url) setLogoDataUrl(s.logo_data_url);
          if (s.default_currency) setDefaultCurrency(s.default_currency);
          if (s.language) setLanguage(s.language);
          if (s.email_from) setEmailFrom(s.email_from);
          if (s.email_templates) setEmailTemplates(s.email_templates);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    const resp = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteName, logoDataUrl, defaultCurrency, language, emailFrom, emailTemplates })
    });
    if (!resp.ok) {
      toast({ title: 'Error', description: 'Failed to save settings', variant: 'destructive' });
      return;
    }
    toast({ title: 'Settings saved' });
  };

  if (loading) return embedded ? <div className='p-6'>Loading…</div> : <MainLayout><div className='p-6'>Loading…</div></MainLayout>;

  const content = (
      <div className='container max-w-4xl mx-auto px-4 py-8'>
        <Card>
          <CardHeader>
            <CardTitle>System Settings</CardTitle>
            <CardDescription>Manage app-wide configuration</CardDescription>
          </CardHeader>
          <CardContent className='space-y-6'>
            <div>
              <Label>Site Name</Label>
              <Input value={siteName} onChange={e => setSiteName(e.target.value)} />
            </div>
            <div>
              <Label>Logo</Label>
              <div className='flex items-center gap-3'>
                {logoDataUrl ? <img src={logoDataUrl} className='h-10 w-10 object-contain border' /> : <div className='h-10 w-10 border rounded' />}
                <Input type='file' accept='image/*' onChange={handleLogoUpload} />
              </div>
            </div>
            <div>
              <Label>Default Currency</Label>
              <Select value={defaultCurrency} onValueChange={setDefaultCurrency}>
                <SelectTrigger><SelectValue placeholder='Select currency' /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='XAF'>XAF - CFA Franc</SelectItem>
                  <SelectItem value='USD'>USD - US Dollar</SelectItem>
                  <SelectItem value='EUR'>EUR - Euro</SelectItem>
                  <SelectItem value='GBP'>GBP - British Pound</SelectItem>
                  <SelectItem value='JPY'>JPY - Japanese Yen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger><SelectValue placeholder='Select language' /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='en'>English</SelectItem>
                  <SelectItem value='fr'>French</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>From Email (optional)</Label>
              <Input value={emailFrom} onChange={e => setEmailFrom(e.target.value)} placeholder='no-reply@example.com' />
            </div>
            <div>
              <Label>Email Templates JSON (optional)</Label>
              <textarea className='w-full border rounded p-2 text-sm' rows={6} value={JSON.stringify(emailTemplates, null, 2)} onChange={e => {
                try { setEmailTemplates(JSON.parse(e.target.value)); } catch {}
              }} />
            </div>
            <div className='flex justify-end'>
              <Button onClick={handleSave}>Save Settings</Button>
            </div>
          </CardContent>
        </Card>
    </div>
  );

  return embedded ? content : <MainLayout>{content}</MainLayout>;
}
