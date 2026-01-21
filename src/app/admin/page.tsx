import { AdminDashboard } from '@/components/admin/admin-dashboard';
import { Shield } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function AdminPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-lg gradient-primary flex items-center justify-center">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">Model health monitoring and cost tracking</p>
          </div>
        </div>
      </div>

      {/* Password-protected dashboard */}
      <AdminDashboard />
    </div>
  );
}
