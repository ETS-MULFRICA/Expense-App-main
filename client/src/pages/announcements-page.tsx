import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import MainLayout from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AnnouncementsPage() {
  const { data: announcements } = useQuery<any[]>({
    queryKey: ['/api/announcements', { limit: 100 }],
    queryFn: async () => {
      const r = await fetch('/api/announcements?limit=100');
      if (!r.ok) throw new Error('Failed to load announcements');
      return r.json();
    }
  });

  useEffect(() => {
    // mark as read on visit
    fetch('/api/announcements/mark-read', { method: 'POST' }).catch(() => {});
  }, []);

  return (
    <MainLayout>
      <div className='container max-w-3xl mx-auto px-4 py-8'>
        <Card>
          <CardHeader>
            <CardTitle>Announcements</CardTitle>
          </CardHeader>
          <CardContent>
            {(!announcements || announcements.length === 0) ? (
              <div className='text-sm text-gray-500'>No announcements</div>
            ) : (
              <ul className='space-y-3'>
                {announcements.map(a => (
                  <li key={a.id} className='border rounded p-3'>
                    <div className='font-medium'>{a.title}</div>
                    <div className='text-sm text-gray-600 mt-1 whitespace-pre-wrap'>{a.message}</div>
                    <div className='text-xs text-gray-400 mt-1'>
                      {new Date(a.created_at).toLocaleString()} {a.author_name ? `• ${a.author_name}` : ''}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}