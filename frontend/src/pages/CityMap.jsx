import { useEffect, useState, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useComplaints } from '@/hooks/useComplaints';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { MapPin, AlertTriangle, CheckCircle, Clock, Loader2, Search, SlidersHorizontal, Eye, Building2, Palette } from 'lucide-react';

const statusColors = {
  pending: 'bg-warning/20 text-warning border-warning/30',
  in_progress: 'bg-info/20 text-info border-info/30',
  resolved: 'bg-success/20 text-success border-success/30',
  rejected: 'bg-destructive/20 text-destructive border-destructive/30',
  closed: 'bg-muted text-muted-foreground border-muted',
};

const statusColorsHex = {
  pending: '#eab308',     // yellow
  in_progress: '#3b82f6', // blue
  resolved: '#22c55e',    // green
  rejected: '#ef4444',    // red
  closed: '#64748b',      // slate
};

export const departmentColorMap = {
  roads: {
    name: 'Roads & Streets',
    color: '#f97316', // Orange
    icon: '🛣️',
    bg: '#ffedd5',
    text: '#9a3412',
    border: '#fed7aa',
  },
  water: {
    name: 'Water Supply',
    color: '#0284c7', // Sky Blue
    icon: '💧',
    bg: '#e0f2fe',
    text: '#075985',
    border: '#bae6fd',
  },
  electricity: {
    name: 'Electricity',
    color: '#8b5cf6', // Electric Violet
    icon: '⚡',
    bg: '#ede9fe',
    text: '#5b21b6',
    border: '#ddd6fe',
  },
  garbage: {
    name: 'Waste & Garbage',
    color: '#10b981', // Emerald Green
    icon: '🗑️',
    bg: '#d1fae5',
    text: '#065f46',
    border: '#a7f3d0',
  },
  sewage: {
    name: 'Sewage & Drainage',
    color: '#d97706', // Amber / Ochre
    icon: '🚰',
    bg: '#fef3c7',
    text: '#92400e',
    border: '#fde68a',
  },
  street_lights: {
    name: 'Street Lights',
    color: '#eab308', // Bright Yellow
    icon: '💡',
    bg: '#fef9c3',
    text: '#854d0e',
    border: '#fef08a',
  },
  parks: {
    name: 'Parks & Gardens',
    color: '#16a34a', // Forest Green
    icon: '🌳',
    bg: '#dcfce7',
    text: '#166534',
    border: '#bbf7d0',
  },
  other: {
    name: 'General Issues',
    color: '#ec4899', // Pink / Rose
    icon: '📋',
    bg: '#fce7f3',
    text: '#9d174d',
    border: '#fbcfe8',
  },
};

export function getDepartmentMeta(c) {
  const cat = (c?.category || '').toLowerCase();
  if (departmentColorMap[cat]) return departmentColorMap[cat];

  const deptName = (c?.departments?.name || '').toLowerCase();
  if (deptName.includes('road')) return departmentColorMap.roads;
  if (deptName.includes('water')) return departmentColorMap.water;
  if (deptName.includes('electr')) return departmentColorMap.electricity;
  if (deptName.includes('waste') || deptName.includes('garb') || deptName.includes('solid')) return departmentColorMap.garbage;
  if (deptName.includes('sewag') || deptName.includes('drain')) return departmentColorMap.sewage;
  if (deptName.includes('light')) return departmentColorMap.street_lights;
  if (deptName.includes('park') || deptName.includes('garden')) return departmentColorMap.parks;

  return departmentColorMap.other;
}

const popupBadgeStyles = {
  pending: { bg: '#fef9c3', fg: '#854d0e', border: '#fef08a' },
  in_progress: { bg: '#dbeafe', fg: '#1e40af', border: '#bfdbfe' },
  resolved: { bg: '#dcfce7', fg: '#166534', border: '#bbf7d0' },
  rejected: { bg: '#fee2e2', fg: '#991b1b', border: '#fecaca' },
  closed: { bg: '#f1f5f9', fg: '#334155', border: '#e2e8f0' },
};

const categoryLabels = {
  roads: '🛣️ Roads & Streets',
  water: '💧 Water Supply',
  electricity: '⚡ Electricity',
  garbage: '🗑️ Waste & Garbage',
  sewage: '🚰 Sewage & Drainage',
  street_lights: '💡 Street Lights',
  parks: '🌳 Parks & Gardens',
  other: '📋 Other Issues',
};

export default function CityMap() {
  const { user } = useAuth();
  const { data: complaints, isLoading } = useComplaints();

  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [heatmapView, setHeatmapView] = useState(false);
  const [colorMode, setColorMode] = useState('department'); // 'department' | 'status'
  
  // Filter States
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');

  const mapInstanceRef = useRef(null);
  const markersGroupRef = useRef(null);
  const heatLayerRef = useRef(null);

  // Redirect citizens back to citizen dashboard
  if (user?.role === 'citizen') {
    return <Navigate to="/dashboard" replace />;
  }

  // 1. Dynamically Load Leaflet assets
  useEffect(() => {
    if (window.L) {
      setLeafletLoaded(true);
      return;
    }
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
      
      jsScript.onload = () => {
        // Load leaflet heat plugin once main leaflet script loads
        let heatScript = document.getElementById('leaflet-heat');
        if (!heatScript) {
          heatScript = document.createElement('script');
          heatScript.id = 'leaflet-heat';
          heatScript.src = 'https://unpkg.com/leaflet.heat/dist/leaflet-heat.js';
          document.head.appendChild(heatScript);
          heatScript.onload = () => {
            setLeafletLoaded(true);
          };
        } else {
          setLeafletLoaded(true);
        }
      };
    } else {
      // Check if heat script is also ready
      let heatScript = document.getElementById('leaflet-heat');
      if (heatScript) {
        setLeafletLoaded(true);
      }
    }
  }, []);

  // 2. Filter complaints
  const allComplaints = complaints || [];
  const filteredComplaints = allComplaints.filter((c) => {
    if (!c.latitude || !c.longitude) return false;

    const matchesSearch = 
      c.title?.toLowerCase().includes(search.toLowerCase()) ||
      c.complaint_number?.toLowerCase().includes(search.toLowerCase()) ||
      c.description?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = selectedStatus === 'all' || c.status === selectedStatus;
    const matchesCategory = selectedCategory === 'all' || c.category === selectedCategory;
    const matchesPriority = selectedPriority === 'all' || c.priority === selectedPriority;

    return matchesSearch && matchesStatus && matchesCategory && matchesPriority;
  });

  // 3. Initialize Leaflet Map
  useEffect(() => {
    if (!leafletLoaded) return;
    const L = window.L;
    if (!L) return;

    if (!mapInstanceRef.current) {
      // Center map on average coordinate or default Surat, India
      const map = L.map('leaflet-map-container', {
        zoomControl: false // Position manually for better aesthetics
      }).setView([21.1702, 72.8311], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        subdomains: ['a', 'b', 'c'],
        maxZoom: 19
      }).addTo(map);

      L.control.zoom({
        position: 'topright'
      }).addTo(map);

      mapInstanceRef.current = map;
      markersGroupRef.current = L.layerGroup().addTo(map);
    }

    return () => {
      // Clean up map instance on unmount
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersGroupRef.current = null;
        heatLayerRef.current = null;
      }
    };
  }, [leafletLoaded]);

  // 4. Update Markers & Heatmap Layer when data or toggle changes
  useEffect(() => {
    if (!leafletLoaded || !mapInstanceRef.current) return;
    const L = window.L;
    if (!L) return;

    // Reset previous items
    if (markersGroupRef.current) {
      markersGroupRef.current.clearLayers();
    }
    if (heatLayerRef.current) {
      mapInstanceRef.current.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }

    if (heatmapView) {
      // Render Heatmap View
      const heatPoints = filteredComplaints.map((c) => [
        Number(c.latitude),
        Number(c.longitude),
        c.priority === 'urgent' ? 1.0 : c.priority === 'high' ? 0.7 : 0.4
      ]);

      if (heatPoints.length > 0 && typeof L.heatLayer === 'function') {
        heatLayerRef.current = L.heatLayer(heatPoints, {
          radius: 30,
          blur: 20,
          maxZoom: 15,
          gradient: { 0.4: 'blue', 0.6: 'cyan', 0.7: 'lime', 0.8: 'yellow', 1.0: 'red' }
        }).addTo(mapInstanceRef.current);
      }
    } else {
      // Render Standard Color-Coded Markers with pulse animations
      filteredComplaints.forEach((c) => {
        const deptMeta = getDepartmentMeta(c);
        const color = colorMode === 'status'
          ? (statusColorsHex[c.status] || '#f97316')
          : deptMeta.color;

        const deptName = c.departments?.name || deptMeta.name;
        
        const svgIcon = L.divIcon({
          html: `
            <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
              <span style="position: absolute; width: 10px; height: 10px; background-color: ${color}; border-radius: 50%; z-index: 10;"></span>
              <span class="marker-pulse-ring" style="position: absolute; width: 24px; height: 24px; border: 2px solid ${color}; border-radius: 50%; z-index: 5;"></span>
              <svg viewBox="0 0 24 24" width="32" height="32" style="fill: ${color}; stroke: #ffffff; stroke-width: 1.5; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.28)); z-index: 8;">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
            </div>
          `,
          className: 'custom-leaflet-marker',
          iconSize: [32, 32],
          iconAnchor: [16, 32],
        });

        const badge = popupBadgeStyles[c.status] || { bg: '#f1f5f9', fg: '#334155', border: '#e2e8f0' };

        const popupHtml = `
          <div style="font-family: inherit; width: 230px; padding: 4px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <span style="display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 9999px; background: ${deptMeta.bg}; color: ${deptMeta.text}; border: 1px solid ${deptMeta.border};">
                <span>${deptMeta.icon}</span> ${deptName}
              </span>
              <span style="font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 9999px; background: ${badge.bg}; color: ${badge.fg}; border: 1px solid ${badge.border}; text-transform: capitalize;">
                ${c.status.replace('_', ' ')}
              </span>
            </div>
            <h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 700; color: #0f172a; line-height: 1.4;">${c.title}</h4>
            <p style="margin: 0 0 8px 0; font-size: 11px; color: #64748b; font-weight: 500;">ID: ${c.complaint_number}</p>
            <div style="display: flex; gap: 6px; margin-bottom: 10px; flex-wrap: wrap;">
              <span style="font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 9999px; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; text-transform: uppercase;">
                ${c.priority}
              </span>
              ${c.address ? `<span style="font-size: 10px; color: #64748b; padding: 2px 6px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">📍 ${c.address}</span>` : ''}
            </div>
            <p style="margin: 0 0 12px 0; font-size: 12px; color: #475569; line-clamp: 2; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.5;">${c.description || ''}</p>
            <a href="/complaints/${c.id}" style="display: block; width: 100%; text-align: center; background: #2563eb; color: #ffffff; text-decoration: none; font-size: 12px; font-weight: 600; padding: 8px 0; border-radius: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); transition: background 0.2s;">View Full Details</a>
          </div>
        `;

        const marker = L.marker([Number(c.latitude), Number(c.longitude)], { icon: svgIcon });
        marker.bindPopup(popupHtml);
        markersGroupRef.current.addLayer(marker);
      });
    }
  }, [filteredComplaints, heatmapView, colorMode, leafletLoaded]);

  // 5. Fit bounds to complaints when map first loads
  const fitBoundsToComplaints = () => {
    if (!mapInstanceRef.current || filteredComplaints.length === 0 || !leafletLoaded) return;
    const L = window.L;
    if (!L) return;

    const bounds = L.latLngBounds(filteredComplaints.map(c => [Number(c.latitude), Number(c.longitude)]));
    mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40] });
  };

  const statusCounts = allComplaints.reduce((acc, complaint) => {
    acc[complaint.status] = (acc[complaint.status] || 0) + 1;
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Inject custom CSS keyframes for map pin animations */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse-ring {
          0% { transform: scale(0.6); opacity: 0.8; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        .marker-pulse-ring {
          animation: pulse-ring 2.2s cubic-bezier(0.215, 0.610, 0.355, 1) infinite;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 12px !important;
          padding: 4px !important;
          box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1) !important;
        }
        .leaflet-popup-content {
          margin: 10px 14px !important;
        }
      `}} />

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {user?.role === 'department_head' ? 'Department Complaints Map' : 'City Map'}
          </h1>
          <p className="text-muted-foreground">
            {user?.role === 'department_head'
              ? 'Real-time geospatial visualization of complaints assigned to your department'
              : 'Real-time geospatial visualization of complaints and hotspot density mapping'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Color Mode Switcher */}
          <div className="flex items-center gap-1.5 bg-muted p-1 rounded-lg border border-border">
            <span className="text-xs font-semibold px-2 text-muted-foreground flex items-center gap-1">
              <Palette className="h-3.5 w-3.5" />
              Color by:
            </span>
            <Button
              variant={colorMode === 'department' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs font-semibold px-2.5"
              onClick={() => setColorMode('department')}
            >
              🏢 Department
            </Button>
            <Button
              variant={colorMode === 'status' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs font-semibold px-2.5"
              onClick={() => setColorMode('status')}
            >
              📊 Status
            </Button>
          </div>

          <div className="flex items-center gap-2 pl-2 border-l border-border">
            <Label htmlFor="heatmap-mode" className="font-semibold text-xs cursor-pointer select-none">
              Heatmap
            </Label>
            <Switch id="heatmap-mode" checked={heatmapView} onCheckedChange={setHeatmapView} />
          </div>

          <Button variant="outline" size="sm" onClick={fitBoundsToComplaints} disabled={filteredComplaints.length === 0} className="gap-1.5 h-9 text-xs">
            <Eye className="h-4 w-4" />
            Fit Map Bounds
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters Sidebar */}
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                Filter Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search */}
              <div className="space-y-2">
                <Label htmlFor="search" className="text-xs font-semibold">Search Title/ID</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="search"
                    placeholder="Search complaint..."
                    className="pl-8 text-sm"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Filter by Status</Label>
                <select 
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full text-sm border rounded-md p-2 bg-background"
                >
                  <option value="all">All Statuses ({allComplaints.length})</option>
                  <option value="pending">Pending ({statusCounts['pending'] || 0})</option>
                  <option value="in_progress">Processing ({statusCounts['in_progress'] || 0})</option>
                  <option value="resolved">Resolved ({statusCounts['resolved'] || 0})</option>
                  <option value="rejected">Rejected ({statusCounts['rejected'] || 0})</option>
                  <option value="closed">Closed ({statusCounts['closed'] || 0})</option>
                </select>
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Filter by Category</Label>
                <select 
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full text-sm border rounded-md p-2 bg-background"
                >
                  <option value="all">All Categories</option>
                  {Object.entries(categoryLabels).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Filter by Priority</Label>
                <select 
                  value={selectedPriority}
                  onChange={(e) => setSelectedPriority(e.target.value)}
                  className="w-full text-sm border rounded-md p-2 bg-background"
                >
                  <option value="all">All Priorities</option>
                  <option value="urgent">🔴 Urgent</option>
                  <option value="high">🟠 High</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="low">🔵 Low</option>
                </select>
              </div>

              {/* Clear Filters */}
              {(search || selectedStatus !== 'all' || selectedCategory !== 'all' || selectedPriority !== 'all') && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setSearch('');
                    setSelectedStatus('all');
                    setSelectedCategory('all');
                    setSelectedPriority('all');
                  }}
                  className="w-full text-xs font-semibold text-destructive hover:bg-destructive/5"
                >
                  Reset All Filters
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Department Color Legend */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Department Color Legend
              </CardTitle>
              <CardDescription className="text-xs">
                Distinct color coding for each civic department
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {Object.entries(departmentColorMap).map(([key, meta]) => {
                const count = allComplaints.filter((c) => getDepartmentMeta(c).name === meta.name).length;
                return (
                  <div key={key} className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-muted/40 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <span 
                        className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: meta.color, border: '2px solid #ffffff', boxShadow: `0 0 0 1px ${meta.color}` }}
                      />
                      <span className="font-medium text-foreground truncate">{meta.icon} {meta.name}</span>
                    </div>
                    <span 
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                      style={{ backgroundColor: meta.bg, color: meta.text, border: `1px solid ${meta.border}` }}
                    >
                      {count}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Quick Metrics */}
          <Card>
            <CardContent className="pt-6 space-y-3.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Showing on Map</span>
                <span className="font-semibold text-foreground">{filteredComplaints.length} of {allComplaints.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Pending Tickets</span>
                <span className="font-semibold text-warning">{statusCounts['pending'] || 0}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Active Processing</span>
                <span className="font-semibold text-info">{statusCounts['in_progress'] || 0}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Resolved Issues</span>
                <span className="font-semibold text-success">{statusCounts['resolved'] || 0}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Map Display Panel */}
        <div className="lg:col-span-3 space-y-6">
          <Card className="overflow-hidden shadow-card border-border">
            <CardContent className="p-0">
              <div 
                id="leaflet-map-container" 
                className="h-[600px] w-full relative z-0" 
                style={{ minHeight: '600px' }}
              >
                {!leafletLoaded && (
                  <div className="absolute inset-0 bg-muted/30 flex items-center justify-center z-50">
                    <div className="text-center space-y-2">
                      <Loader2 className="h-8 w-8 animate-spin text-accent mx-auto" />
                      <p className="text-sm font-semibold text-muted-foreground">Loading Map layers...</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Active Markers Detail List */}
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                Active Locations In Filtered Region ({filteredComplaints.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6 pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[220px] overflow-y-auto pr-1">
                {filteredComplaints.map((c) => {
                  const deptMeta = getDepartmentMeta(c);
                  const deptName = c.departments?.name || deptMeta.name;
                  return (
                    <div 
                      key={c.id} 
                      className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/50 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div 
                          className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 shadow-sm"
                          style={{ backgroundColor: `${deptMeta.color}20`, border: `1.5px solid ${deptMeta.color}` }}
                        >
                          <span className="text-xs">{deptMeta.icon}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-sm truncate">{c.title}</p>
                            <span 
                              className="text-[10px] font-semibold px-1.5 py-0.2 rounded shrink-0"
                              style={{ backgroundColor: deptMeta.bg, color: deptMeta.text, border: `1px solid ${deptMeta.border}` }}
                            >
                              {deptName}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {c.address || 'Address not specified'}
                          </p>
                        </div>
                      </div>
                      <Badge className={`${statusColors[c.status]} text-xs font-semibold shrink-0 ml-2`}>
                        {c.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  );
                })}
                {filteredComplaints.length === 0 && (
                  <div className="col-span-2 text-center py-8">
                    <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm font-medium">
                      No complaints match the selected filter conditions
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
