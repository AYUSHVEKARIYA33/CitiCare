import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, Eye, EyeOff, Loader2, User, Building2, HardHat } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
export default function Login() {
    const [loginType, setLoginType] = useState('citizen');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const { login, isAuthenticated, user } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    useEffect(() => {
        if (isAuthenticated) {
            if (user?.role === 'contractor') {
                navigate('/contractor');
            } else if ((user?.role === 'officer' || user?.role === 'department_head') && user?.department_id) {
                navigate('/department');
            } else {
                navigate('/dashboard');
            }
        }
    }, [isAuthenticated, user, navigate]);
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const { error, user: loggedInUser } = await login(email, password);
        if (error) {
            toast({
                title: 'Login failed',
                description: error.message || 'Please check your credentials and try again.',
                variant: 'destructive',
            });
            setLoading(false);
        }
        else {
            toast({
                title: 'Welcome back!',
                description: 'You have successfully logged in.',
            });
            if (loggedInUser && loggedInUser.role === 'contractor') {
                navigate('/contractor');
            }
            else if (loggedInUser &&
                (loggedInUser.role === 'officer' || loggedInUser.role === 'department_head') &&
                loggedInUser.department_id) {
                navigate('/department');
            }
            else {
                navigate('/dashboard');
            }
        }
    };
    return (<div className="min-h-screen flex">
      {/* Left Panel - Decorative */}
      <div className="hidden lg:flex lg:w-1/2 gradient-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_hsl(var(--accent)/0.3),_transparent_50%)]"/>
        <div className="relative z-10 flex flex-col justify-center p-12">
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-foreground/10">
              <Shield className="h-6 w-6 text-primary-foreground"/>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-primary-foreground">CitiCare</h1>
              <p className="text-xs text-primary-foreground/60 uppercase tracking-wider">
                Municipal Portal
              </p>
            </div>
          </div>
          <h2 className="text-4xl font-bold text-primary-foreground mb-4">
            Welcome Back
          </h2>
          <p className="text-lg text-primary-foreground/80 max-w-md">
            Access your dashboard to manage complaints, track progress, and stay connected with municipal services.
          </p>
          <div className="mt-12 space-y-4">
            <div className="flex items-center gap-3 text-primary-foreground/80">
              <div className="h-8 w-8 rounded-full bg-primary-foreground/10 flex items-center justify-center">
                ✓
              </div>
              <span>Track complaint status in real-time</span>
            </div>
            <div className="flex items-center gap-3 text-primary-foreground/80">
              <div className="h-8 w-8 rounded-full bg-primary-foreground/10 flex items-center justify-center">
                ✓
              </div>
              <span>Communicate with assigned officers</span>
            </div>
            <div className="flex items-center gap-3 text-primary-foreground/80">
              <div className="h-8 w-8 rounded-full bg-primary-foreground/10 flex items-center justify-center">
                ✓
              </div>
              <span>Access public documents and projects</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary">
              <Shield className="h-6 w-6 text-primary-foreground"/>
            </div>
            <div>
              <h1 className="text-2xl font-bold">CitiCare</h1>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Municipal Portal
              </p>
            </div>
          </div>

          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold">Sign In</h2>
            <p className="text-muted-foreground mt-2">
              Choose your login type and enter credentials
            </p>
          </div>

          <Tabs value={loginType} onValueChange={(v) => setLoginType(v)} className="w-full mb-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="citizen" className="flex items-center gap-1.5 text-xs sm:text-sm">
                <User className="h-4 w-4"/>
                Citizen
              </TabsTrigger>
              <TabsTrigger value="department" className="flex items-center gap-1.5 text-xs sm:text-sm">
                <Building2 className="h-4 w-4"/>
                Department
              </TabsTrigger>
              <TabsTrigger value="contractor" className="flex items-center gap-1.5 text-xs sm:text-sm">
                <HardHat className="h-4 w-4"/>
                Contractor
              </TabsTrigger>
            </TabsList>
            <TabsContent value="citizen" className="mt-3">
              <p className="text-sm text-muted-foreground text-center">
                File complaints, track status, and access public services. New? Register below.
              </p>
            </TabsContent>
            <TabsContent value="department" className="mt-3">
              <p className="text-sm text-muted-foreground text-center">
                Municipal Department Heads & Officers. Manage department complaints, allocations, and approvals.
              </p>
            </TabsContent>
            <TabsContent value="contractor" className="mt-3">
              <p className="text-sm text-muted-foreground text-center">
                Field Contractors & Execution Agencies. Access assigned jobs, work map, submit estimates and completion.
              </p>
            </TabsContent>
          </Tabs>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required/>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required/>
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="rounded border-input"/>
                <span className="text-muted-foreground">Remember me</span>
              </label>
              <Link to="/forgot-password" className="text-accent hover:underline">
                Forgot password?
              </Link>
            </div>

            <Button type="submit" variant="hero" className="w-full" disabled={loading}>
              {loading ? (<>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                  Signing in...
                </>) : ('Sign In')}
            </Button>
          </form>

          {loginType === 'citizen' ? (<p className="text-center text-sm text-muted-foreground mt-6">
              Don't have an account?{' '}
              <Link to="/register" className="text-accent hover:underline font-medium">
                Register here
              </Link>
            </p>) : (<p className="text-center text-sm text-muted-foreground mt-6">
              Department staff get login credentials from the municipal admin. Lost access? Contact your administrator.
            </p>)}
        </div>
      </div>
    </div>);
}
