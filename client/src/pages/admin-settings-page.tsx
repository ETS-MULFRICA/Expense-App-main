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
import { Save, X } from 'lucide-react';

export default function AdminSettingsPage({ embedded = false }: { embedded?: boolean }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  // Base
  const [siteName, setSiteName] = useState('ExpenseTrack');
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  // Removed favicon from site info per request
  const [defaultCurrency, setDefaultCurrency] = useState('XAF');
  const [language, setLanguage] = useState('en');
  const [timezone, setTimezone] = useState('UTC');
  const [dateFormat, setDateFormat] = useState('yyyy-MM-dd');
  // Branding (theme now user-controlled; no admin control here)
  // Features
  const [features, setFeatures] = useState<any>({ allowRegistration: true, announcements: true, moderation: true, reports: true });
  // Security
  const [security, setSecurity] = useState<any>({ require2FA: false, passwordMinLength: 8 });
  // For change tracking
  const [initial, setInitial] = useState<any | null>(null);
  // Maintenance: seed categories
  const [seedUserId, setSeedUserId] = useState<string>('');
  const [seedUsername, setSeedUsername] = useState<string>('');
  const [seeding, setSeeding] = useState(false);
  const [seedProcessed, setSeedProcessed] = useState<number | null>(null);
  const [seedDetails, setSeedDetails] = useState<any[] | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/settings');
      if (!r.ok) throw new Error('Failed to load');
      const s = await r.json();
      if (s) {
        setSiteName(s.site_name ?? 'ExpenseTrack');
        setLogoDataUrl(s.logo_data_url ?? null);
  // favicon removed from UI
        setDefaultCurrency(s.default_currency ?? 'XAF');
        setLanguage(s.language ?? 'en');
        setTimezone(s.timezone ?? 'UTC');
        setDateFormat(s.date_format ?? 'yyyy-MM-dd');
  // themeMode removed from admin settings
  setFeatures(s.features ?? { allowRegistration: true, announcements: true, moderation: true, reports: true });
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

  // favicon upload removed

  const handleSave = async () => {
    const resp = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
  siteName, logoDataUrl, defaultCurrency, language,
  timezone, dateFormat, /* faviconDataUrl removed */ features, security
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

  const seedCategories = async () => {
    setSeeding(true);
    setSeedProcessed(null);
    try {
      const payload: any = {};
      const id = seedUserId.trim();
      const uname = seedUsername.trim();
      if (uname) {
        payload.username = uname;
      } else if (id) {
        const n = Number(id);
        if (!Number.isFinite(n) || n <= 0) {
          toast({ title: 'Invalid user ID', variant: 'destructive' });
          setSeeding(false);
          return;
        }
        payload.userId = n;
      }
      const r = await fetch('/api/admin/seed-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(data?.message || 'Seeding failed');
      setSeedProcessed(data?.processed ?? 0);
      toast({ title: 'Seeding complete', description: `${data?.processed ?? 0} user(s) processed` });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to seed categories', variant: 'destructive' });
    } finally {
      setSeeding(false);
    }
  };

  // Compute modified status consistently on every render (do not place hooks after returns)
  const modified = useMemo(() => {
    if (!initial) return true; // show actions after first load
    const current: any = {
      site_name: siteName,
      logo_data_url: logoDataUrl,
  // favicon_data_url removed
      default_currency: defaultCurrency,
      language,
      timezone,
      date_format: dateFormat,
  // theme_mode removed from admin page
      features,
      security,
    };
    return JSON.stringify(current) !== JSON.stringify({
      site_name: initial.site_name,
      logo_data_url: initial.logo_data_url,
  // favicon_data_url removed
      default_currency: initial.default_currency,
      language: initial.language,
      timezone: initial.timezone,
      date_format: initial.date_format,
  // theme_mode removed
      features: initial.features,
      security: initial.security,
    });
  }, [initial, siteName, logoDataUrl, defaultCurrency, language, timezone, dateFormat, features, security]);

  if (loading) return embedded ? <div className='p-6'>Loading…</div> : <MainLayout><div className='p-6'>Loading…</div></MainLayout>;

  const discard = () => {
    if (!initial) return;
    setSiteName(initial.site_name ?? 'ExpenseTrack');
    setLogoDataUrl(initial.logo_data_url ?? null);
  // favicon removed
    setDefaultCurrency(initial.default_currency ?? 'XAF');
    setLanguage(initial.language ?? 'en');
    setTimezone(initial.timezone ?? 'UTC');
    setDateFormat(initial.date_format ?? 'yyyy-MM-dd');
  // theme_mode removed
  setFeatures(initial.features ?? { allowRegistration: true, announcements: true, moderation: true, reports: true });
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

  // Theme is user-controlled in personal settings; no hooks here to avoid hook-order issues.

  const content = (
    <div className='container max-w-6xl mx-auto px-4 py-6'>
      <div className='flex items-center justify-between mb-3'>
        <div>
          <h2 className='text-2xl font-semibold'>System Settings</h2>
          <p className='text-sm text-gray-600'>Manage app-wide configuration</p>
        </div>
  <div className='flex items-center gap-2'>
          <Button variant='outline' disabled={!modified} onClick={discard}><X className='h-4 w-4 mr-2'/>Discard</Button>
          <Button disabled={!modified} onClick={handleSave}><Save className='h-4 w-4 mr-2'/>Save Changes</Button>
        </div>
      </div>
      <Tabs defaultValue='site'>
        <TabsList className='grid grid-cols-3 md:grid-cols-5'>
          <TabsTrigger value='site'>Site Info</TabsTrigger>
          <TabsTrigger value='appearance'>Appearance</TabsTrigger>
          <TabsTrigger value='localization'>Localization</TabsTrigger>
          <TabsTrigger value='security'>Security</TabsTrigger>
          <TabsTrigger value='features'>Features</TabsTrigger>
        </TabsList>
        <TabsContent value='site' className='space-y-4 mt-4'>
          <Section title='Site Information' badge={modified ? 'Modified' : undefined}>
            <div>
              <Label htmlFor='siteName'>Site Name</Label>
              <Input
                id='siteName'
                value={siteName}
                onChange={e => setSiteName(e.target.value)}
                onKeyDown={(e) => { e.stopPropagation(); }}
                onKeyUp={(e) => { e.stopPropagation(); }}
              />
            </div>
            <div>
              <Label>Logo</Label>
              <div className='flex items-center gap-3'>
                {logoDataUrl ? <img src={logoDataUrl} className='h-10 w-10 object-contain border' /> : <div className='h-10 w-10 border rounded' />}
                <Input type='file' accept='image/*' onChange={handleLogoUpload} />
              </div>
            </div>
            {/* Favicon control removed as requested */}
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
        <TabsContent value='appearance' className='space-y-4 mt-4'>
          <Section title='Appearance' badge={undefined}>
            <div>
              <Label>Theme Mode</Label>
              <Select
                onValueChange={(v)=>{
                  try{ localStorage.setItem('app:theme-mode', v); }catch{}
                  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                  const isDark = v === 'dark' || (v === 'system' && prefersDark);
                  document.documentElement.classList.toggle('dark', isDark);
                }}
                defaultValue={(typeof window!=='undefined' && localStorage.getItem('app:theme-mode')) || 'light'}
              >
                <SelectTrigger><SelectValue placeholder='Theme mode' /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='system'>System</SelectItem>
                  <SelectItem value='light'>Light</SelectItem>
                  <SelectItem value='dark'>Dark</SelectItem>
                </SelectContent>
              </Select>
              <p className='text-xs text-gray-500 mt-1'>Personal preference. Applies to this device.</p>
            </div>
          </Section>
        </TabsContent>
  {/* Branding & Theme removed from admin; theme is set per-user in personal settings */}
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
  {/* Email tab removed per request */}
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
          <Section title='Maintenance' badge={undefined}>
            <div className='space-y-3'>
              <p className='text-sm text-gray-600'>Seed default categories. Provide a username or a user ID. Leave both empty to seed for all users. Safe to run multiple times.</p>
              <div className='grid grid-cols-1 md:grid-cols-3 gap-3 items-end'>
                <div>
                  <Label>Username (optional)</Label>
                  <Input placeholder='e.g., johndoe' value={seedUsername} onChange={e=>setSeedUsername(e.target.value)} />
                </div>
                <div>
                  <Label>User ID (optional)</Label>
                  <Input placeholder='e.g., 42' value={seedUserId} onChange={e=>setSeedUserId(e.target.value)} />
                </div>
                <div className='text-right'>
                  <Button onClick={seedCategories} disabled={seeding}>{seeding ? 'Seeding…' : 'Seed Default Categories'}</Button>
                </div>
              </div>
              {seedProcessed !== null && (
                <div className='space-y-1'>
                  <p className='text-xs text-gray-500'>Processed {seedProcessed} user(s).</p>
                  {Array.isArray(seedDetails) && seedDetails.length > 0 && (
                    <div className='rounded border p-2 bg-gray-50 text-xs text-gray-700'>
                      {seedDetails.map((d, i) => (
                        <div key={i} className='flex items-center justify-between py-0.5'>
                          <span>#{d.id} {d.username}</span>
                          <span className={d.processed ? 'text-green-600' : 'text-red-600'}>
                            {d.processed ? 'ok' : (d.error || 'error')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  );

  return embedded ? content : <MainLayout>{content}</MainLayout>;
}

function DirectEmailPanel() {
  const { toast } = useToast();
  const [toUserId, setToUserId] = useState<string>('');
  const [toEmail, setToEmail] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [sending, setSending] = useState(false);
  const [sendMode, setSendMode] = useState<'auto'|'real'|'preview'>('auto');
  const [sendProvider, setSendProvider] = useState<'auto'|'smtp'|'resend'|'sendgrid'>('auto');
  const [providers, setProviders] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/admin/email/verify');
        const j = await r.json();
        setProviders(j?.providers || null);
      } catch {}
    })();
  }, []);

  const sendEmail = async () => {
    if (!subject.trim() || !body.trim()) { toast({ title: 'Subject and message required', variant: 'destructive' }); return; }
    setSending(true);
    try {
      const r = await fetch('/api/admin/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toUserId: toUserId ? Number(toUserId) : undefined,
          toEmail: toEmail || undefined,
          subject: subject.trim(),
          html: body.includes('<') ? body : undefined,
          text: body.includes('<') ? undefined : body,
          mode: sendMode,
          provider: sendProvider
        })
      });
      const data = await r.json().catch(()=>({}));
      if (!r.ok) {
        throw new Error(data?.message || 'Failed to send');
      }
      if (data?.previewUrl) {
        toast({ title: 'Email sent (preview)', description: `Open preview in new tab.`, });
        try { window.open(data.previewUrl, '_blank'); } catch {}
      } else {
        toast({ title: 'Email sent' });
      }
      setToUserId(''); setToEmail(''); setSubject(''); setBody('');
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label>To (User ID)</Label>
          <Input value={toUserId} onChange={e=>setToUserId(e.target.value)} placeholder="e.g., 42" />
        </div>
        <div className="md:col-span-2">
          <Label>Or To Email</Label>
          <Input value={toEmail} onChange={e=>setToEmail(e.target.value)} placeholder="user@example.com" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label>Send mode</Label>
          <select className="border rounded px-2 py-1 w-full" value={sendMode} onChange={e=>setSendMode(e.target.value as any)}>
            <option value="auto">Auto</option>
            <option value="real">Real (SMTP/Provider)</option>
            <option value="preview">Preview (no delivery)</option>
          </select>
        </div>
        <div>
          <Label>Provider</Label>
          <select className="border rounded px-2 py-1 w-full" value={sendProvider} onChange={e=>setSendProvider(e.target.value as any)}>
            <option value="auto">Auto</option>
            <option value="smtp">SMTP</option>
            <option value="resend">Resend</option>
            <option value="sendgrid">SendGrid</option>
          </select>
        </div>
      </div>
      {providers && (
        <div className="text-xs text-gray-600 border rounded p-2 bg-gray-50">
          <div className="font-semibold mb-1">Detected Providers</div>
          <div>SMTP: {providers.smtp?.configured ? (providers.smtp?.verified ? 'configured ✓' : 'configured (verify failed)') : 'not configured'}</div>
          <div>Resend: {providers.resend?.configured ? 'configured ✓' : 'not configured'}</div>
          <div>SendGrid: {providers.sendgrid?.configured ? 'configured ✓' : 'not configured'}</div>
          {providers.smtp?.configured && providers.smtp?.from && (
            <div>From: {providers.smtp.from}</div>
          )}
        </div>
      )}
      <div>
        <Label>Subject</Label>
        <Input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Subject" />
      </div>
      <div>
        <Label>Message (plain text or HTML)</Label>
        <textarea className="w-full border rounded p-2 text-sm min-h-32" value={body} onChange={e=>setBody(e.target.value)} />
      </div>
      <div className="text-right">
        <Button onClick={sendEmail} disabled={sending}>{sending ? 'Sending…' : 'Send Email'}</Button>
      </div>
    </div>
  );
}
