import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LocationSelector } from '@/components/complaint/LocationSelector';
import { ImageUpload } from '@/components/complaint/ImageUpload';
import { useCreateComplaint, useDepartments } from '@/hooks/useComplaints';
import { useComplaintDraftHelper } from '@/hooks/useComplaintDraftHelper';
import { useImageComplaintSuggest } from '@/hooks/useImageComplaintSuggest';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { MapPin, Loader2, CheckCircle, Building2, WandSparkles, Sparkles, Navigation } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { complaintCategories } from '@/data/categories';

export default function NewComplaint() {
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');
    const [address, setAddress] = useState('');
    const [selectedZone, setSelectedZone] = useState('');
    const [selectedWard, setSelectedWard] = useState('');
    const [selectedArea, setSelectedArea] = useState('');
    const [departmentId, setDepartmentId] = useState('');
    const [images, setImages] = useState([]);
    
    // Geolocation and map states
    const [latitude, setLatitude] = useState(21.1702);
    const [longitude, setLongitude] = useState(72.8311);
    const [leafletLoaded, setLeafletLoaded] = useState(false);
    const [gpsLoading, setGpsLoading] = useState(false);

    const mapRef = useRef(null);
    const markerRef = useRef(null);

    const navigate = useNavigate();
    const { toast } = useToast();
    const createComplaint = useCreateComplaint();
    const { data: departments, isLoading: departmentsLoading } = useDepartments();
    const draftHelper = useComplaintDraftHelper(title, description, category);
    const imageSuggest = useImageComplaintSuggest();
    const { isPending: isImageSuggestPending, mutate: suggestFromImage } = imageSuggest;
    const suggestedImageKeyRef = useRef('');
    
    const latestImage = images.length > 0 ? images[images.length - 1] : null;
    const latestImageKey = latestImage ? `${latestImage.name}-${latestImage.size}-${latestImage.lastModified}` : '';

    // Filter departments by selected category (with fallback to all departments if no strict match)
    const filteredDepartments = useMemo(() => {
        if (!departments || departments.length === 0) return [];
        if (!category) return departments;
        const matching = departments.filter(dept => dept.category === category);
        // Guarantee currently selected department is ALWAYS in the dropdown list so it never shows placeholder
        if (departmentId) {
            const currentSelected = departments.find(d => d.id === departmentId);
            if (currentSelected && !matching.some(d => d.id === departmentId)) {
                return [currentSelected, ...matching];
            }
        }
        if (matching.length > 0) return matching;
        return departments;
    }, [departments, category, departmentId]);

    const selectedCategoryLabel = useMemo(() => {
        if (!imageSuggest.data?.category_hint)
            return null;
        const matched = complaintCategories.find((item) => item.value === imageSuggest.data?.category_hint);
        return matched?.label ?? imageSuggest.data?.category_hint;
    }, [imageSuggest.data?.category_hint]);

    const fallbackReasonLabel = useMemo(() => {
        const reason = imageSuggest.data?.fallback_reason;
        if (!reason)
            return null;
        const labels = {
            quota_exceeded: 'AI quota exceeded for this key/project. Please check Gemini quota or billing, then try again.',
            provider_auth_failed: 'AI provider authentication failed. Please verify API key configuration.',
            provider_timeout: 'AI provider timed out. Please retry in a moment.',
            missing_api_key: 'AI API key is missing on the backend configuration.',
            feature_disabled: 'AI image suggestions are disabled by backend configuration.',
            provider_request_failed: 'AI provider request failed. Please retry shortly.',
            request_failed: 'AI request failed. Please retry shortly.',
        };
        return labels[reason] || reason;
    }, [imageSuggest.data?.fallback_reason]);

    const imageSuggestErrorMessage = imageSuggest.error?.response?.data?.error ||
        imageSuggest.error?.message ||
        'Image suggestions are unavailable right now. You can continue manually.';

    // Load Leaflet Assets dynamically
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
                setLeafletLoaded(true);
            };
        } else {
            setLeafletLoaded(true);
        }
    }, []);

    // Request user GPS on startup
    const getGpsLocation = () => {
        if (!navigator.geolocation) {
            toast({
                title: 'GPS Not Supported',
                description: 'Your browser or device does not support GPS queries.',
                variant: 'destructive',
            });
            return;
        }

        setGpsLoading(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                setLatitude(lat);
                setLongitude(lng);
                setGpsLoading(false);

                toast({
                    title: 'GPS Pre-filled',
                    description: 'Position updated successfully using your current location.',
                });

                if (mapRef.current) {
                    mapRef.current.setView([lat, lng], 15);
                    if (markerRef.current) {
                        markerRef.current.setLatLng([lat, lng]);
                    }
                }
            },
            (error) => {
                console.warn('GPS location request error:', error);
                setGpsLoading(false);
                toast({
                    title: 'GPS Access Denied',
                    description: 'Defaulting map location to Surat center.',
                });
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
    };

    useEffect(() => {
        getGpsLocation();
    }, []);

    // Initialize Leaflet Map Selector
    useEffect(() => {
        if (!leafletLoaded) return;
        const L = window.L;
        if (!L) return;

        if (!mapRef.current) {
            const map = L.map('new-complaint-map', {
                zoomControl: true,
                dragging: true,
            }).setView([latitude, longitude], 15);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                subdomains: ['a', 'b', 'c'],
                maxZoom: 19
            }).addTo(map);

            const dragIcon = L.divIcon({
                html: `
                  <div style="position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">
                    <span style="position: absolute; width: 10px; height: 10px; background-color: #3b82f6; border-radius: 50%; z-index: 10;"></span>
                    <span class="marker-pulse-ring" style="position: absolute; width: 22px; height: 22px; border: 2px solid #3b82f6; border-radius: 50%; z-index: 5;"></span>
                    <svg viewBox="0 0 24 24" width="30" height="30" style="fill: #3b82f6; stroke: #ffffff; stroke-width: 1.5; z-index: 8;">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                  </div>
                `,
                className: 'custom-leaflet-marker',
                iconSize: [30, 30],
                iconAnchor: [15, 30],
            });

            const marker = L.marker([latitude, longitude], {
                draggable: true,
                icon: dragIcon,
            }).addTo(map);

            // Handle marker dragging
            marker.on('dragend', () => {
                const latLng = marker.getLatLng();
                setLatitude(latLng.lat);
                setLongitude(latLng.lng);
            });

            // Handle click on map to move pin
            map.on('click', (e) => {
                marker.setLatLng(e.latlng);
                setLatitude(e.latlng.lat);
                setLongitude(e.latlng.lng);
            });

            mapRef.current = map;
            markerRef.current = marker;
        }

        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
                markerRef.current = null;
            }
        };
    }, [leafletLoaded]);

    useEffect(() => {
        if (!latestImage) {
            suggestedImageKeyRef.current = '';
            return;
        }
        if (suggestedImageKeyRef.current === latestImageKey || isImageSuggestPending)
            return;
        suggestedImageKeyRef.current = latestImageKey;
        suggestFromImage({
            image: latestImage,
            title,
            description,
            address,
        });
    }, [latestImage, latestImageKey, title, description, address, isImageSuggestPending, suggestFromImage]);

    // Automatically apply suggestions once AI returns data, updating empty or default fields
    useEffect(() => {
        if (!imageSuggest.data) return;
        const data = imageSuggest.data;
        let appliedAny = false;

        // Auto-fill category if provided
        if (data.category_hint) {
            setCategory(data.category_hint);
            appliedAny = true;
        }

        // Auto-select department
        if (data.department_id) {
            setDepartmentId(data.department_id);
            appliedAny = true;
        } else if (data.category_hint && departments?.length) {
            const matchDept = departments.find(d => d.category === data.category_hint);
            if (matchDept) {
                setDepartmentId(matchDept.id);
                appliedAny = true;
            }
        }

        // Auto-fill title if user hasn't typed a custom title
        const isGenericTitle = !title.trim() || title === 'Civic issue reported from uploaded photo';
        if (data.suggested_title && isGenericTitle) {
            setTitle(data.suggested_title);
            appliedAny = true;
        }

        // Auto-fill description if user hasn't typed a custom description
        const isGenericDesc = !description.trim() || description.startsWith('Issue detected from uploaded image');
        if (data.suggested_description && isGenericDesc) {
            setDescription(data.suggested_description);
            appliedAny = true;
        }

        if (appliedAny) {
            const deptObj = departments?.find(d => d.id === (data.department_id || departmentId));
            toast({
                title: 'AI Auto-Fill Applied',
                description: deptObj ? `Assigned to ${deptObj.name} with details pre-filled.` : 'Category, department, and description filled from your photo.',
            });
        }
    }, [imageSuggest.data, departments]);

    const applyImageSuggestions = () => {
        if (!imageSuggest.data)
            return;
        const data = imageSuggest.data;
        if (data.category_hint) {
            setCategory(data.category_hint);
        }
        if (data.department_id) {
            setDepartmentId(data.department_id);
        } else if (data.category_hint && departments?.length) {
            const matchDept = departments.find(d => d.category === data.category_hint);
            if (matchDept) setDepartmentId(matchDept.id);
        }
        if (data.suggested_title) {
            setTitle(data.suggested_title);
        }
        if (data.suggested_description) {
            setDescription(data.suggested_description);
        }
        toast({
            title: 'AI Suggestions Applied',
            description: 'Updated category, department, title, and description from photo.',
        });
    };

    // Reset department selection when category changes
    const handleCategoryChange = (value) => {
        setCategory(value);
        setDepartmentId('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedZone || !selectedWard) {
            toast({
                title: 'Location Required',
                description: 'Please select Zone and Ward to file a complaint.',
                variant: 'destructive',
            });
            return;
        }
        if (!departmentId) {
            toast({
                title: 'Department Required',
                description: 'Please select the department that should handle this complaint.',
                variant: 'destructive',
            });
            return;
        }
        try {
            const result = await createComplaint.mutateAsync({
                title,
                description,
                category,
                address,
                zone_id: selectedZone,
                ward_id: selectedWard,
                area_id: selectedArea || undefined,
                department_id: departmentId,
                images,
                latitude,
                longitude,
            });
            toast({
                title: 'Complaint Submitted!',
                description: `Your complaint has been registered. ID: ${result.complaint_number}`,
            });
            navigate('/complaints');
        }
        catch (error) {
            toast({
                title: 'Failed to submit complaint',
                description: error.message || 'Please try again later.',
                variant: 'destructive',
            });
        }
    };

    return (<div className="max-w-2xl mx-auto">
      {/* Inject custom CSS keyframes for map pin animations */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse-ring {
          0% { transform: scale(0.6); opacity: 0.8; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        .marker-pulse-ring {
          animation: pulse-ring 2.2s cubic-bezier(0.215, 0.610, 0.355, 1) infinite;
        }
      `}} />

      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Building2 className="h-4 w-4"/>
          <span>Municipal Corporation</span>
        </div>
        <h1 className="text-2xl font-bold">File a New Complaint</h1>
        <p className="text-muted-foreground">
          Report a civic issue in your area. Provide as much detail as possible for faster resolution.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl border border-border bg-card p-6 shadow-card space-y-5">
          {/* Category Selection */}
          <div className="space-y-2">
            <Label htmlFor="category" className="flex items-center justify-between">
              <span>Category *</span>
              {imageSuggest.isPending && (
                <span className="text-xs text-primary flex items-center gap-1 font-normal animate-pulse">
                  <Sparkles className="h-3 w-3" /> AI analyzing photo...
                </span>
              )}
            </Label>
            <Select value={category} onValueChange={handleCategoryChange} required>
              <SelectTrigger>
                <SelectValue placeholder="Select complaint category"/>
              </SelectTrigger>
              <SelectContent>
                {complaintCategories.map((cat) => (<SelectItem key={cat.value} value={cat.value}>
                    <span className="flex items-center gap-2">
                      <span>{cat.icon}</span>
                      {cat.label}
                    </span>
                  </SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          {/* Department - filtered by category */}
          <div className="space-y-2">
            <Label htmlFor="department">
              <Building2 className="inline h-4 w-4 mr-1"/>
              Department *
            </Label>
            <Select value={departmentId} onValueChange={setDepartmentId} required disabled={departmentsLoading || !category || filteredDepartments.length === 0}>
              <SelectTrigger id="department">
                <SelectValue placeholder={!category
                ? 'Select a category first'
                : departmentsLoading
                    ? 'Loading departments...'
                    : 'Select department'}/>
              </SelectTrigger>
              <SelectContent>
                {filteredDepartments.map((dept) => (<SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>))}
              </SelectContent>
            </Select>
            {category && !departmentsLoading && filteredDepartments.length === 0 && (<p className="text-xs text-muted-foreground text-red-500">
                No departments available for this category. Contact admin to add departments.
              </p>)}
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Complaint Title *</Label>
            <Input id="title" placeholder="Brief title describing the issue" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea id="description" placeholder="Provide detailed description of the issue..." rows={4} value={description} onChange={(e) => setDescription(e.target.value)} required />
          </div>

          {(title.trim().length > 0 || description.trim().length > 0) && (<Alert className="border-info/40 bg-info/5">
              <WandSparkles className="h-4 w-4"/>
              <AlertTitle className="flex items-center gap-2">
                AI Draft Helper
                {draftHelper.isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : null}
              </AlertTitle>
              <AlertDescription>
                {!draftHelper.data && !draftHelper.isFetching && (<p className="text-xs text-muted-foreground">
                    Add a bit more detail to get AI suggestions.
                  </p>)}
                {draftHelper.data?.suggestions?.length ? (<ul className="mt-2 list-disc pl-5 text-sm space-y-1">
                    {draftHelper.data.suggestions.map((tip, idx) => (<li key={`${idx}-${tip}`}>{tip}</li>))}
                  </ul>) : null}
                {draftHelper.data?.improved_title ? (<div className="mt-2 text-sm">
                    <span className="font-medium">Suggested title:</span> {draftHelper.data.improved_title}
                    <Button type="button" variant="link" className="px-2 h-auto" onClick={() => setTitle(draftHelper.data?.improved_title || title)}>
                      Apply
                    </Button>
                  </div>) : null}
                {draftHelper.isError ? (<p className="mt-2 text-xs text-muted-foreground">Draft helper is temporarily unavailable.</p>) : null}
              </AlertDescription>
            </Alert>)}
        </div>

        {/* Location Section */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-card space-y-5">
          <h3 className="font-semibold flex items-center gap-2">
            <MapPin className="h-5 w-5 text-accent"/>
            Location Details
          </h3>

          {/* Zone/Ward/Area Selector */}
          <LocationSelector selectedZone={selectedZone} selectedWard={selectedWard} selectedArea={selectedArea} onZoneChange={setSelectedZone} onWardChange={setSelectedWard} onAreaChange={setSelectedArea}/>

          {/* Street Address */}
          <div className="space-y-2">
            <Label htmlFor="address">Street Address / Landmark *</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
              <Input id="address" className="pl-10" placeholder="Enter nearby landmark or exact address" value={address} onChange={(e) => setAddress(e.target.value)} required/>
            </div>
          </div>

          {/* Geolocation Map Pin-Drop Selector */}
          <div className="space-y-2 pt-2 border-t border-border/60">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold flex items-center gap-1">
                Pin Location on Map *
              </Label>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={getGpsLocation} 
                disabled={gpsLoading}
                className="text-xs h-8 gap-1"
              >
                {gpsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Navigation className="h-3 w-3" />}
                Use Current GPS
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              We have pre-filled this using your browser GPS. Feel free to drag the marker or click on the map to pinpoint the exact location.
            </p>
            <div 
              id="new-complaint-map" 
              className="h-[250px] w-full rounded-lg border shadow-inner relative z-0 mt-2"
              style={{ minHeight: '250px' }}
            >
              {!leafletLoaded && (
                <div className="absolute inset-0 bg-muted/40 flex items-center justify-center rounded-lg z-50">
                  <div className="text-center space-y-2">
                    <Loader2 className="h-6 w-6 animate-spin text-accent mx-auto" />
                    <p className="text-xs text-muted-foreground">Loading map selector...</p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-4 text-xs text-muted-foreground pt-1.5 justify-end font-mono">
              <span>Lat: {latitude.toFixed(5)}</span>
              <span>Lng: {longitude.toFixed(5)}</span>
            </div>
          </div>
        </div>

        {/* Photo Upload Section */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-card space-y-4">
          <h3 className="font-semibold">Upload Photos</h3>
          <p className="text-sm text-muted-foreground">
            Add photos of the issue to help officials understand the problem better.
          </p>
          <ImageUpload images={images} onImagesChange={setImages} maxImages={5}/>

          {images.length > 0 && (<Alert className="border-accent/40 bg-accent/5">
              <Sparkles className="h-4 w-4"/>
              <AlertTitle className="flex items-center gap-2">
                AI Photo Suggestions
                {imageSuggest.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : null}
              </AlertTitle>
              <AlertDescription>
                {imageSuggest.isError ? (<p className="text-xs text-destructive">{imageSuggestErrorMessage}</p>) : null}

                {imageSuggest.data ? (<div className="space-y-3 mt-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {selectedCategoryLabel ? <Badge variant="info">Category: {selectedCategoryLabel}</Badge> : null}
                      {imageSuggest.data.department_name ? <Badge variant="secondary">Department: {imageSuggest.data.department_name}</Badge> : null}
                      <Badge variant={imageSuggest.data.source === 'ai' ? 'success' : 'warning'}>
                        Source: {imageSuggest.data.source === 'ai' ? 'AI Vision' : 'Fallback'}
                      </Badge>
                      <Badge variant={imageSuggest.data.source === 'ai' ? 'success' : 'outline'}>
                        Confidence: {Math.round(imageSuggest.data.confidence * 100)}%
                      </Badge>
                    </div>

                    {imageSuggest.data.source === 'fallback' && imageSuggest.data.fallback_reason ? (<p className="text-xs text-muted-foreground">
                        Fallback reason: {fallbackReasonLabel}
                      </p>) : null}

                    {imageSuggest.data.suggestions?.length ? (<ul className="list-disc pl-5 text-sm space-y-1">
                        {imageSuggest.data.suggestions.map((item, index) => (<li key={`${index}-${item}`}>{item}</li>))}
                      </ul>) : null}

                    <div className="text-sm space-y-1">
                      <p>
                        <span className="font-medium">Suggested title:</span> {imageSuggest.data.suggested_title}
                      </p>
                      <p>
                        <span className="font-medium">Suggested description:</span> {imageSuggest.data.suggested_description}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={applyImageSuggestions}>
                        Apply AI Suggestions
                      </Button>
                      <Button type="button" variant="ghost" size="sm" disabled={imageSuggest.isPending} onClick={() => {
                    if (!latestImage)
                        return;
                    imageSuggest.mutate({ image: latestImage, title, description, address });
                }}>
                        Re-run
                      </Button>
                    </div>
                  </div>) : (!imageSuggest.isPending && <p className="text-xs text-muted-foreground mt-2">Upload at least one photo to get AI suggestions.</p>)}
              </AlertDescription>
            </Alert>)}
        </div>

        {/* Submit */}
        <div className="flex items-center gap-4">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" variant="accent" disabled={createComplaint.isPending} className="flex-1 md:flex-none">
            {createComplaint.isPending ? (<>
                <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                Submitting...
              </>) : (<>
                <CheckCircle className="mr-2 h-4 w-4"/>
                Submit Complaint
              </>)}
          </Button>
        </div>
      </form>
    </div>);
}
