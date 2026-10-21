import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, CheckCircle2, Clock, HardHat, FileText, ArrowRight, Loader2 } from 'lucide-react';

export default function ContractorNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/notifications')
      .then((res) => {
        setNotifications(Array.isArray(res.data) ? res.data : []);
      })
      .catch((err) => {
        console.error('Failed to fetch notifications:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  const markAllAsRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="h-7 w-7 text-primary" />
            Contractor Notifications
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Assignment alerts, estimate approvals, and work verification feedback from municipal authorities.
          </p>
        </div>

        {notifications.some((n) => !n.read) && (
          <Button variant="outline" size="sm" onClick={markAllAsRead}>
            Mark All as Read
          </Button>
        )}
      </div>

      <Card className="shadow-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Recent Alerts & Updates</CardTitle>
          <CardDescription className="text-xs">
            Chronological log of activities related to your assigned field operations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-16 text-center text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span>Loading notifications...</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground space-y-2">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
              <p className="font-medium text-foreground">No notifications yet</p>
              <p className="text-xs">When department heads assign works or review estimates, alerts will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((n) => (
                <div
                  key={n.id || n._id}
                  className={`p-4 rounded-xl border transition-colors flex items-start justify-between gap-4 ${
                    !n.read ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
                      <HardHat className="h-4 w-4" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{n.title}</span>
                        {!n.read && (
                          <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5">
                            New
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{n.message}</p>
                      <span className="text-[11px] text-muted-foreground block pt-1">
                        {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
                      </span>
                    </div>
                  </div>

                  {n.link && (
                    <Button size="sm" variant="ghost" className="shrink-0 text-xs" asChild>
                      <Link to={n.link.startsWith('/contractor') ? n.link : '/contractor/jobs'}>
                        View <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </Link>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
