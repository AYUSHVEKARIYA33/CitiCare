import { useEffect, useState, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useComplaints } from '@/hooks/useComplaints';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  MapPin,
  ExternalLink,
  Navigation,
  AlertTriangle,
  Clock,
  Calendar,
  CheckCircle2,
  HardHat,
  Search,
  Filter,
  Eye,
  Loader2
} from 'lucide-react';

const statusColorMap = {
  assigned: { color: '#f59e0b', label: 'Needs Acceptance', bg: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  accepted: { color: '#3b82f6', label: 'In Progress', bg: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  in_progress: { color: '#3b82f6', label: 'In Progress', bg: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  completed: { color: '#8b5cf6', label: 'Under Verification', bg: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
  verified: { color: '#10b981', label: 'Verified & Solved', bg: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
};

export default function ContractorMap() {
  const { data: complaints = [], isLoading } = useComplaints();

  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [locatingUser, setLocatingUser] = useState(false);
  const [userCoords, setUserCoords] = useState(null);

  const mapInstanceRef = useRef(null);
  const markerGroupRef = useRef(null);
  const userMarkerRef = useRef(null);

  // 1. Dynamically load Leaflet assets if not present
  useEffect(() => {
    let cssLink = document.getElementById('leaflet-css');
    if (!cssLink) {
      cssLink = document.createElement('link');
      cssLink.id = 'leaflet-css';
      cssLink.rel = 'stylesheet';
      cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(cssLink);
    }

    let jsScript = document.getElementById('leaflet-js');
    if (!jsScript) {
      jsScript = document.createElement('script');
      jsScript.id = 'leaflet-js';
      jsScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      document.head.appendChild(jsScript);
      jsScript.onload = () => setLeafletLoaded(true);
    } else {
      if (window.L) setLeafletLoaded(true);
      else jsScript.onload = () => setLeafletLoaded(true);
    }
  }, []);

  // Separate complaints into plotted (with valid GPS) and unconfirmed (missing GPS)
  const { plottedJobs, unconfirmedJobs } = useMemo(() => {
    const plotted = [];
    const unconfirmed = [];

    complaints.forEach((c) => {
      // Status filter
      if (selectedStatus !== 'all' && c.contractor_status !== selectedStatus) return;
      // Priority filter
      if (selectedPriority !== 'all' && c.priority !== selectedPriority) return;
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matches =
          c.title?.toLowerCase().includes(q) ||
          c.complaint_number?.toLowerCase().includes(q) ||
          c.address?.toLowerCase().includes(q);
        if (!matches) return;
      }

      if (c.latitude && c.longitude && !Number.isNaN(c.latitude) && !Number.isNaN(c.longitude)) {
        plotted.push(c);
      } else {
        unconfirmed.push(c);
      }
    });

    return { plottedJobs: plotted, unconfirmedJobs: unconfirmed };
  }, [complaints, selectedStatus, selectedPriority, search]);

  // 2. Initialize Leaflet Map
  useEffect(() => {
    if (!leafletLoaded || !window.L) return;
    const L = window.L;

    if (!mapInstanceRef.current) {
      const defaultCenter = [21.1702, 72.8311]; // Surat, India
      const map = L.map('contractor-leaflet-map', {
        zoomControl: false,
      }).setView(defaultCenter, 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      const markerGroup = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
      markerGroupRef.current = markerGroup;
    }
  }, [leafletLoaded]);

  // 3. Render Status-Coloured Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markerGroupRef.current || !window.L) return;
    const L = window.L;
    const markerGroup = markerGroupRef.current;
    markerGroup.clearLayers();

    if (plottedJobs.length === 0) return;

    const bounds = [];

    plottedJobs.forEach((job) => {
      const lat = job.latitude;
      const lng = job.longitude;
      bounds.push([lat, lng]);

      const statusMeta = statusColorMap[job.contractor_status] || { color: '#64748b', label: 'Assigned' };
      const color = statusMeta.color;

      // Custom pulsing status pin
      const iconHtml = `
        <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
          <div style="
            position: absolute;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background-color: ${color};
            opacity: 0.25;
            animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
          "></div>
          <div style="
            position: relative;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background-color: ${color};
            border: 2.5px solid #ffffff;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            font-size: 11px;
            font-weight: bold;
          ">
            🔧
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-contractor-pin',
        html: iconHtml,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(markerGroup);

      marker.on('click', () => {
        setSelectedJob(job);
        mapInstanceRef.current.setView([lat, lng], 15, { animate: true });
      });
    });

    if (bounds.length > 0 && !selectedJob) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [plottedJobs, selectedJob]);

  // Handle "Get Directions" via Google Maps
  const openDirections = (job) => {
    if (!job?.latitude || !job?.longitude) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${job.latitude},${job.longitude}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Request user location ONLY when clicked
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocatingUser(false);
        const { latitude, longitude } = pos.coords;
        setUserCoords({ lat: latitude, lng: longitude });

        if (mapInstanceRef.current && window.L) {
          const L = window.L;
          if (userMarkerRef.current) {
            userMarkerRef.current.remove();
          }

          const userIcon = L.divIcon({
            className: 'user-loc-pin',
            html: `
              <div style="width: 20px; height: 20px; border-radius: 50%; background-color: #2563eb; border: 3px solid #ffffff; box-shadow: 0 0 10px rgba(37,99,235,0.8);"></div>
            `,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          });

          userMarkerRef.current = L.marker([latitude, longitude], { icon: userIcon })
            .addTo(mapInstanceRef.current)
            .bindPopup('<b>Your Current Location</b>')
            .openPopup();

          mapInstanceRef.current.setView([latitude, longitude], 14, { animate: true });
        }
      },
      (err) => {
        setLocatingUser(false);
        console.warn('Geolocation error:', err);
        alert('Could not determine your location. Please check browser permissions.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto p-3 md:p-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <MapPin className="h-7 w-7 text-primary" />
            My Work Map & Directions
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
            Geospatial map of all jobs assigned to your agency with real-time turn-by-turn directions.
          </p>
        </div>

        {/* Locate Me button */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLocateMe}
            disabled={locatingUser}
            className="flex items-center gap-1.5 shadow-sm"
          >
            {locatingUser ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Navigation className="h-4 w-4 text-primary" />}
            <span>{locatingUser ? 'Locating GPS...' : 'Locate My Position'}</span>
          </Button>
          <Button size="sm" asChild>
            <Link to="/contractor/jobs">Manage All Jobs</Link>
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-3 bg-card border border-border rounded-xl shadow-sm flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search complaint # or street address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="h-9 px-3 rounded-md border border-input bg-background text-xs font-medium"
        >
          <option value="all">All Job Statuses</option>
          <option value="assigned">Needs Acceptance</option>
          <option value="accepted">Accepted / In Progress</option>
          <option value="completed">Under Verification</option>
          <option value="verified">Verified & Solved</option>
        </select>

        <select
          value={selectedPriority}
          onChange={(e) => setSelectedPriority(e.target.value)}
          className="h-9 px-3 rounded-md border border-input bg-background text-xs font-medium"
        >
          <option value="all">All Priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <div className="text-xs text-muted-foreground ml-auto hidden sm:block">
          Plotted: <strong className="text-foreground">{plottedJobs.length}</strong> | Unconfirmed:{' '}
          <strong className="text-amber-600">{unconfirmedJobs.length}</strong>
        </div>
      </div>

      {/* Map Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[620px]">
        {/* Map Container */}
        <div className="lg:col-span-2 relative rounded-2xl overflow-hidden border border-border shadow-md h-[460px] lg:h-full min-h-[460px]">
          <div id="contractor-leaflet-map" className="w-full h-full" style={{ zIndex: 1 }} />

          {/* Map Legend Overlay */}
          <div className="absolute top-3 left-3 z-[1000] bg-background/90 backdrop-blur-md p-2.5 rounded-xl border border-border shadow-md text-[11px] space-y-1.5 hidden sm:block">
            <span className="font-semibold text-foreground block uppercase tracking-wider text-[10px]">
              Job Status Pins
            </span>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>Needs Acceptance</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span>In Progress</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <span>Under Verification</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Verified & Solved</span>
            </div>
          </div>
        </div>

        {/* Sidebar: Selected Job Details & Unconfirmed Locations */}
        <div className="space-y-4 flex flex-col justify-between">
          {/* Active Selection Details Card */}
          {selectedJob ? (
            <Card className="shadow-md border-primary/40 bg-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-primary border-primary/30">
                    #{selectedJob.complaint_number}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={
                      statusColorMap[selectedJob.contractor_status]?.bg || 'bg-muted text-muted-foreground'
                    }
                  >
                    {statusColorMap[selectedJob.contractor_status]?.label || selectedJob.contractor_status}
                  </Badge>
                </div>
                <CardTitle className="text-base font-bold mt-1 line-clamp-2">
                  {selectedJob.title}
                </CardTitle>
                <CardDescription className="text-xs">
                  {selectedJob.departments?.name || 'Department Work'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="p-2.5 rounded-lg bg-accent/50 border border-accent text-xs">
                  <span className="font-medium text-muted-foreground block text-[10px] uppercase">Address:</span>
                  <p className="font-semibold">{selectedJob.address || 'Address unlisted'}</p>
                </div>

                {selectedJob.contractor_instructions && (
                  <div className="p-2.5 rounded-lg bg-muted/60 text-xs">
                    <span className="font-medium text-muted-foreground block text-[10px] uppercase">
                      Work Instructions:
                    </span>
                    <p className="italic text-foreground">"{selectedJob.contractor_instructions}"</p>
                  </div>
                )}

                {selectedJob.contractor_deadline && (
                  <div className="flex items-center gap-1.5 text-amber-600 font-medium">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Deadline: {new Date(selectedJob.contractor_deadline).toLocaleDateString()}</span>
                  </div>
                )}

                <div className="pt-2 flex flex-col gap-2">
                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-1.5"
                    size="sm"
                    onClick={() => openDirections(selectedJob)}
                  >
                    <Navigation className="h-4 w-4" /> Get Directions (Google Maps)
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/contractor/jobs?jobId=${selectedJob.id}`}>
                      Execute & Update Progress
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-card border-border p-5 text-center">
              <MapPin className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
              <h4 className="text-sm font-semibold">Click a map pin to view site directions</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Select any marker to inspect job instructions, priority, and launch turn-by-turn navigation.
              </p>
            </Card>
          )}

          {/* Location Needs Confirmation Panel */}
          <Card className="shadow-card border-amber-500/30 bg-amber-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Location Needs Confirmation ({unconfirmedJobs.length})
              </CardTitle>
              <CardDescription className="text-xs">
                These complaints lack verified GPS coordinates. Refer to textual addresses or contact Department Head.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {unconfirmedJobs.length === 0 ? (
                <div className="text-xs text-muted-foreground py-2 text-center">
                  All assigned complaints have verified coordinates!
                </div>
              ) : (
                unconfirmedJobs.map((job) => (
                  <div
                    key={job.id}
                    className="p-2.5 rounded-lg border border-amber-500/20 bg-background/80 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-0.5 truncate">
                      <span className="font-semibold text-foreground">#{job.complaint_number}</span>
                      <p className="truncate text-muted-foreground text-[11px]">{job.address || job.title}</p>
                    </div>
                    <Button size="sm" variant="outline" className="h-7 text-[11px] shrink-0" asChild>
                      <Link to={`/contractor/jobs?jobId=${job.id}`}>View Job</Link>
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
