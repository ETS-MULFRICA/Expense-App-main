import { useEffect, useMemo, useState } from 'react';
import MainLayout from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, Save, X } from 'lucide-react';

export default function AdminSettingsPage({ embedded = false }: { embedded?: boolean }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  // Base
  const [siteName, setSiteName] = useState('ExpenseTrack');
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [faviconDataUrl, setFaviconDataUrl] = useState<string | null>(null);
  const [defaultCurrency, setDefaultCurrency] = useState('XAF');
  const [language, setLanguage] = useState('en');
  const [timezone, setTimezone] = useState('UTC');
  const [dateFormat, setDateFormat] = useState('yyyy-MM-dd');
  // Branding
  const [primaryColor, setPrimaryColor] = useState('#0ea5e9');
  const [themeMode, setThemeMode] = useState<'light'|'dark'|'system'>('system');
  // Email
  const [emailFrom, setEmailFrom] = useState('');
  const [emailTemplates, setEmailTemplates] = useState<any>({});
  // Features
  const [features, setFeatures] = useState<any>({ allowRegistration: true, announcements: true, moderation: true, backups: true, reports: true });
  // Security
  const [security, setSecurity] = useState<any>({ require2FA: false, passwordMinLength: 8 });
  // For change tracking
  const [initial, setInitial] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/settings');
      if (!r.ok) throw new Error('Failed to load');
      const s = await r.json();
      if (s) {
        setSiteName(s.site_name ?? 'ExpenseTrack');
        setLogoDataUrl(s.logo_data_url ?? null);
        setFaviconDataUrl(s.favicon_data_url ?? null);
        setDefaultCurrency(s.default_currency ?? 'XAF');
        setLanguage(s.language ?? 'en');
        setTimezone(s.timezone ?? 'UTC');
        setDateFormat(s.date_format ?? 'yyyy-MM-dd');
        setPrimaryColor(s.primary_color ?? '#0ea5e9');
        setThemeMode((s.theme_mode as any) ?? 'system');
        setEmailFrom(s.email_from ?? '');
        setEmailTemplates(s.email_templates ?? {});
        setFeatures(s.features ?? { allowRegistration: true, announcements: true, moderation: true, backups: true, reports: true });
        setSecurity(s.security ?? { require2FA: false, passwordMinLength: 8 });
        setInitial(s);
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to load settings', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleFaviconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setFaviconDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    const resp = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteName, logoDataUrl, defaultCurrency, language, emailFrom, emailTemplates,
        timezone, dateFormat, primaryColor, themeMode, faviconDataUrl, features, security
      })
    });
    if (!resp.ok) {
      toast({ title: 'Error', description: 'Failed to save settings', variant: 'destructive' });
      return;
    }
    const saved = await resp.json();
    setInitial(saved);
    toast({ title: 'Settings saved' });
  };

  // Compute modified status consistently on every render (do not place hooks after returns)
  const modified = useMemo(() => {
    if (!initial) return true; // show actions after first load
    const current: any = {
      site_name: siteName,
      logo_data_url: logoDataUrl,
      favicon_data_url: faviconDataUrl,
      default_currency: defaultCurrency,
      language,
      timezone,
      date_format: dateFormat,
      primary_color: primaryColor,
      theme_mode: themeMode,
      email_from: emailFrom,
      email_templates: emailTemplates,
      features,
      security,
    };
    return JSON.stringify(current) !== JSON.stringify({
      site_name: initial.site_name,
      logo_data_url: initial.logo_data_url,
      favicon_data_url: initial.favicon_data_url,
      default_currency: initial.default_currency,
      language: initial.language,
      timezone: initial.timezone,
      date_format: initial.date_format,
      primary_color: initial.primary_color,
      theme_mode: initial.theme_mode,
      email_from: initial.email_from,
      email_templates: initial.email_templates,
      features: initial.features,
      security: initial.security,
    });
  }, [initial, siteName, logoDataUrl, faviconDataUrl, defaultCurrency, language, timezone, dateFormat, primaryColor, themeMode, emailFrom, emailTemplates, features, security]);

  if (loading) return embedded ? <div className='p-6'>Loading…</div> : <MainLayout><div className='p-6'>Loading…</div></MainLayout>;

  const discard = () => {
    if (!initial) return;
    setSiteName(initial.site_name ?? 'ExpenseTrack');
    setLogoDataUrl(initial.logo_data_url ?? null);
    setFaviconDataUrl(initial.favicon_data_url ?? null);
    setDefaultCurrency(initial.default_currency ?? 'XAF');
    setLanguage(initial.language ?? 'en');
    setTimezone(initial.timezone ?? 'UTC');
    setDateFormat(initial.date_format ?? 'yyyy-MM-dd');
    setPrimaryColor(initial.primary_color ?? '#0ea5e9');
    setThemeMode((initial.theme_mode as any) ?? 'system');
    setEmailFrom(initial.email_from ?? '');
    setEmailTemplates(initial.email_templates ?? {});
    setFeatures(initial.features ?? { allowRegistration: true, announcements: true, moderation: true, backups: true, reports: true });
    setSecurity(initial.security ?? { require2FA: false, passwordMinLength: 8 });
  };

  const Section = ({ title, badge, children }: { title: string; badge?: 'Public'|'Private'|'Modified'; children: any; }) => (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between'>
        <div>
          <CardTitle className='text-base'>{title}</CardTitle>
          <CardDescription>Update {title.toLowerCase()}</CardDescription>
        </div>
        {badge && <Badge variant={badge==='Modified' ? 'secondary' : 'outline'}>{badge}</Badge>}
      </CardHeader>
      <CardContent className='space-y-4'>{children}</CardContent>
    </Card>
  );

  const content = (
    <div className='container max-w-6xl mx-auto px-4 py-6'>
      <div className='flex items-center justify-between mb-3'>
        <div>
          <h2 className='text-2xl font-semibold'>System Settings</h2>
          <p className='text-sm text-gray-600'>Manage app-wide configuration</p>
        </div>
        <div className='flex items-center gap-2'>
          <Button variant='outline' onClick={load}><RefreshCw className='h-4 w-4 mr-2'/>Refresh</Button>
          <Button variant='outline' disabled={!modified} onClick={discard}><X className='h-4 w-4 mr-2'/>Discard</Button>
          <Button disabled={!modified} onClick={handleSave}><Save className='h-4 w-4 mr-2'/>Save Changes</Button>
        </div>
      </div>
      <Tabs defaultValue='site'>
        <TabsList className='grid grid-cols-3 md:grid-cols-6'>
          <TabsTrigger value='site'>Site Info</TabsTrigger>
          <TabsTrigger value='branding'>Branding & Theme</TabsTrigger>
          <TabsTrigger value='localization'>Localization</TabsTrigger>
          <TabsTrigger value='email'>Email</TabsTrigger>
          <TabsTrigger value='security'>Security</TabsTrigger>
          <TabsTrigger value='features'>Features</TabsTrigger>
        </TabsList>
        <TabsContent value='site' className='space-y-4 mt-4'>
          <Section title='Site Information' badge={modified ? 'Modified' : undefined}>
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
              <Label>Favicon</Label>
              <div className='flex items-center gap-3'>
                {faviconDataUrl ? <img src={faviconDataUrl} className='h-8 w-8 object-contain border' /> : <div className='h-8 w-8 border rounded' />}
                <Input type='file' accept='image/*' onChange={handleFaviconUpload} />
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
          </Section>
        </TabsContent>
        <TabsContent value='branding' className='space-y-4 mt-4'>
          <Section title='Branding & Theme' badge={modified ? 'Modified' : undefined}>
            <div>
              <Label>Primary Color</Label>
              <Input type='color' value={primaryColor} onChange={e=>setPrimaryColor(e.target.value)} className='h-10 w-24 p-1' />
            </div>
            <div>
              <Label>Theme Mode</Label>
              <Select value={themeMode} onValueChange={(v)=>setThemeMode(v as any)}>
                <SelectTrigger><SelectValue placeholder='Theme mode' /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='system'>System</SelectItem>
                  <SelectItem value='light'>Light</SelectItem>
                  <SelectItem value='dark'>Dark</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Section>
        </TabsContent>
        <TabsContent value='localization' className='space-y-4 mt-4'>
          <Section title='Localization' badge={modified ? 'Modified' : undefined}>
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
              <Label>Timezone</Label>
              <Input value={timezone} onChange={e=>setTimezone(e.target.value)} placeholder='e.g., UTC or Africa/Douala' />
            </div>
            <div>
              <Label>Date Format</Label>
              <Input value={dateFormat} onChange={e=>setDateFormat(e.target.value)} placeholder='e.g., yyyy-MM-dd' />
            </div>
          </Section>
        </TabsContent>
        <TabsContent value='email' className='space-y-4 mt-4'>
          <Section title='Email Settings' badge={modified ? 'Modified' : undefined}>
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
          </Section>
        </TabsContent>
        <TabsContent value='security' className='space-y-4 mt-4'>
          <Section title='Security' badge={modified ? 'Modified' : undefined}>
            <div className='flex items-center justify-between'>
              <div>
                <Label>Require 2FA</Label>
                <p className='text-xs text-gray-500'>Prompt users to enable two-factor authentication.</p>
              </div>
              <Switch checked={!!security.require2FA} onCheckedChange={(v)=>setSecurity((s:any)=>({ ...s, require2FA: !!v }))} />
            </div>
            <div>
              <Label>Password Min Length</Label>
              <Input type='number' min={6} max={64} value={security.passwordMinLength ?? 8} onChange={e=>setSecurity((s:any)=>({ ...s, passwordMinLength: Number(e.target.value)||8 }))} className='w-32' />
            </div>
          </Section>
        </TabsContent>
        <TabsContent value='features' className='space-y-4 mt-4'>
          <Section title='Features' badge={modified ? 'Modified' : undefined}>
            {[
              { key: 'allowRegistration', label: 'Allow Registration', desc: 'Users can sign up without invitation.' },
              { key: 'announcements', label: 'Announcements', desc: 'Enable global announcements.' },
              { key: 'moderation', label: 'Moderation', desc: 'Enable reporting and moderation tools.' },
              { key: 'backups', label: 'Backups', desc: 'Allow DB backup/restore from Admin.' },
              { key: 'reports', label: 'Reports & Analytics', desc: 'Enable reporting pages.' },
            ].map(item => (
              <div key={item.key} className='flex items-center justify-between py-1'>
                <div>
                  <Label>{item.label}</Label>
                  <p className='text-xs text-gray-500'>{item.desc}</p>
                </div>
                <Switch checked={!!features[item.key]} onCheckedChange={(v)=>setFeatures((f:any)=>({ ...f, [item.key]: !!v }))} />
              </div>
            ))}
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  );

  return embedded ? content : <MainLayout>{content}</MainLayout>;
}
