import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { useUsers, useCreateUser, useUpdateUserRole, useUpdateUserDepartment, useDeleteUser } from '@/hooks/useUsers';
import { useDepartments } from '@/hooks/useComplaints';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Plus, Users, Loader2, Pencil, Building2, Shield, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
const roleColors = {
    admin: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    department_head: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    officer: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    contractor: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    citizen: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
};
export default function UsersPage() {
    const { user, isLoading: authLoading } = useAuth();
    const { toast } = useToast();
    const { data: users, isLoading: usersLoading, isError, error, refetch } = useUsers();
    const { data: departments } = useDepartments();
    const createUser = useCreateUser();
    const updateRole = useUpdateUserRole();
    const updateDepartment = useUpdateUserDepartment();
    const deleteUser = useDeleteUser();
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [deleteUserId, setDeleteUserId] = useState(null);
    const [deleteUserName, setDeleteUserName] = useState('');
    const [newUser, setNewUser] = useState({
        email: '',
        password: '',
        fullName: '',
        phone: '',
        role: 'citizen',
        departmentId: '',
    });
    if (authLoading) {
        return (<div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-accent"/>
      </div>);
    }
    if (user?.role !== 'admin') {
        return <Navigate to="/dashboard" replace/>;
    }
    const handleCreateUser = async () => {
        try {
            await createUser.mutateAsync({
                ...newUser,
                departmentId: newUser.departmentId || undefined,
            });
            toast({
                title: 'User created',
                description: `${newUser.fullName} has been created successfully.`,
            });
            setIsCreateDialogOpen(false);
            setNewUser({
                email: '',
                password: '',
                fullName: '',
                phone: '',
                role: 'citizen',
                departmentId: '',
            });
        }
        catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to create user',
                variant: 'destructive',
            });
        }
    };
    const handleUpdateRole = async (userId, role) => {
        try {
            await updateRole.mutateAsync({ userId, role });
            toast({
                title: 'Role updated',
                description: 'User role has been updated successfully.',
            });
            setEditingUser(null);
        }
        catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to update user role',
                variant: 'destructive',
            });
        }
    };
    const handleUpdateDepartment = async (userId, departmentId) => {
        try {
            await updateDepartment.mutateAsync({ userId, departmentId });
            toast({
                title: 'Department updated',
                description: 'User department has been updated successfully.',
            });
        }
        catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to update department',
                variant: 'destructive',
            });
        }
    };
    const handleDeleteUser = async () => {
        if (!deleteUserId)
            return;
        try {
            await deleteUser.mutateAsync(deleteUserId);
            toast({
                title: 'User deleted',
                description: `${deleteUserName} has been removed from the system.`,
            });
            setDeleteUserId(null);
            setDeleteUserName('');
        }
        catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to delete user',
                variant: 'destructive',
            });
        }
    };
    const confirmDelete = (userId, userName) => {
        setDeleteUserId(userId);
        setDeleteUserName(userName);
    };
    const getInitials = (name) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };
    return (<div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground">
            Manage users, roles, and department assignments
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2"/>
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>
                Add a new user with email and password. For department staff (Officer / Department Head), set role and department — they will log in on the login page using the &quot;Department&quot; option.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input id="fullName" value={newUser.fullName} onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })} placeholder="Enter full name"/>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="Enter email address"/>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="Enter password"/>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (Optional)</Label>
                <Input id="phone" value={newUser.phone} onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })} placeholder="Enter phone number"/>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={newUser.role} onValueChange={(value) => setNewUser({ ...newUser, role: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role"/>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="citizen">Citizen</SelectItem>
                    <SelectItem value="contractor">Contractor (Field Execution)</SelectItem>
                    <SelectItem value="officer">Officer</SelectItem>
                    <SelectItem value="department_head">Department Head</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(newUser.role === 'officer' || newUser.role === 'department_head' || newUser.role === 'contractor') && (<>
                  <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
                    Email and password above are this user&apos;s login credentials. {newUser.role === 'contractor' ? 'Contractors will sign in using the "Contractor" tab.' : 'Department staff will sign in using the "Department" tab.'}
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <Select value={newUser.departmentId} onValueChange={(value) => setNewUser({ ...newUser, departmentId: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select department"/>
                      </SelectTrigger>
                      <SelectContent>
                        {departments?.map((dept) => (<SelectItem key={dept.id} value={dept.id}>
                            {dept.name}
                          </SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </>)}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateUser} disabled={createUser.isPending || !newUser.email || !newUser.password || !newUser.fullName}>
                {createUser.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin"/>}
                Create User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary"/>
              <span className="text-2xl font-bold">{(users ?? []).length}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Admins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-red-500"/>
              <span className="text-2xl font-bold">
                {(users ?? []).filter(u => u.role === 'admin').length}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Officers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-500"/>
              <span className="text-2xl font-bold">
                {(users ?? []).filter(u => u.role === 'officer').length}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Citizens</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-green-500"/>
              <span className="text-2xl font-bold">
                {(users ?? []).filter(u => u.role === 'citizen').length}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            A list of all users in the system with their roles and departments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usersLoading ? (<div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/>
            </div>) : isError ? (<div className="py-8 text-center">
              <p className="text-destructive font-medium mb-2">Failed to load users</p>
              <p className="text-sm text-muted-foreground mb-4">{error?.message ?? 'Please try again.'}</p>
              <Button variant="outline" onClick={() => refetch()}>Try again</Button>
            </div>) : (<Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(users ?? []).map((u) => (<TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={u.avatar_url || undefined}/>
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {getInitials(u.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{u.full_name}</p>
                          <p className="text-sm text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {editingUser === u.id ? (<Select defaultValue={u.role} onValueChange={(value) => handleUpdateRole(u.id, value)}>
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="citizen">Citizen</SelectItem>
                            <SelectItem value="contractor">Contractor</SelectItem>
                            <SelectItem value="officer">Officer</SelectItem>
                            <SelectItem value="department_head">Dept Head</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>) : (<Badge className={roleColors[u.role] || ''} variant="secondary">
                          {u.role.replace('_', ' ')}
                        </Badge>)}
                    </TableCell>
                    <TableCell>
                      {(u.role === 'officer' || u.role === 'department_head' || u.role === 'contractor') ? (<Select value={u.department_id || 'none'} onValueChange={(value) => handleUpdateDepartment(u.id, value === 'none' ? null : value)}>
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="No department"/>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No department</SelectItem>
                            {departments?.map((dept) => (<SelectItem key={dept.id} value={dept.id}>
                                {dept.name}
                              </SelectItem>))}
                          </SelectContent>
                        </Select>) : (<span className="text-muted-foreground">-</span>)}
                    </TableCell>
                    <TableCell>
                      {u.phone || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      {u.created_at ? format(new Date(u.created_at), 'MMM d, yyyy') : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditingUser(editingUser === u.id ? null : u.id)}>
                          <Pencil className="h-4 w-4"/>
                        </Button>
                        {u.id !== user?.id && (<Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => confirmDelete(u.id, u.full_name)}>
                            <Trash2 className="h-4 w-4"/>
                          </Button>)}
                      </div>
                    </TableCell>
                  </TableRow>))}
              </TableBody>
            </Table>)}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteUserName}</strong>? 
              This action cannot be undone. All data associated with this user will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleteUser.isPending}>
              {deleteUser.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin"/>}
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>);
}
