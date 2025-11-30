'use client';

import { useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Users, FileText, CheckCircle, Banknote, Loader2 } from 'lucide-react';

type Proposal = {
  status: 'Draft' | 'Sent' | 'Approved' | 'Rejected';
  totalAmount: number;
  createdAt: { seconds: number };
};

type Customer = {
  id: string;
};

const calculatePercentageChange = (current: number, previous: number) => {
    if (previous === 0) {
        return current > 0 ? ' (Yeni)' : '';
    }
    const change = ((current - previous) / previous) * 100;
    if (change > 0) {
        return `+${change.toFixed(1)}% geçen aydan`;
    } else if (change < 0) {
        return `${change.toFixed(1)}% geçen aydan`;
    }
    return 'değişim yok';
}

export default function DashboardPage() {
  const firestore = useFirestore();

  // Data fetching
  const customersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'customers') : null, [firestore]);
  const { data: customers, isLoading: customersLoading } = useCollection<Customer>(customersQuery);

  const proposalsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'proposals') : null, [firestore]);
  const { data: proposals, isLoading: proposalsLoading } = useCollection<Proposal>(proposalsQuery);
  
  const dashboardStats = useMemo(() => {
    if (!proposals || !customers) {
      return {
        totalCustomers: 0,
        activeQuotes: 0,
        approvedQuotes: 0,
        totalRevenue: 0,
        customersLastMonth: 0,
        activeQuotesLastMonth: 0,
        approvedQuotesLastMonth: 0,
        revenueLastMonth: 0,
      };
    }
    
    const now = new Date();
    const firstDayOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000;
    const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime() / 1000;

    const currentMonthProposals = proposals.filter(p => p.createdAt.seconds >= firstDayOfCurrentMonth);
    const lastMonthProposals = proposals.filter(p => p.createdAt.seconds >= firstDayOfLastMonth && p.createdAt.seconds < firstDayOfCurrentMonth);

    const approvedQuotes = proposals.filter(p => p.status === 'Approved');
    const totalRevenue = approvedQuotes.reduce((sum, p) => sum + p.totalAmount, 0);

    const revenueLastMonth = lastMonthProposals.filter(p => p.status === 'Approved').reduce((sum, p) => sum + p.totalAmount, 0);


    return {
      totalCustomers: customers.length,
      activeQuotes: proposals.filter(p => p.status === 'Draft' || p.status === 'Sent').length,
      approvedQuotes: approvedQuotes.length,
      totalRevenue: totalRevenue,
      customersLastMonth: customers.length, // Placeholder logic for customer change
      activeQuotesLastMonth: lastMonthProposals.filter(p => p.status === 'Draft' || p.status === 'Sent').length,
      approvedQuotesLastMonth: lastMonthProposals.filter(p => p.status === 'Approved').length,
      revenueLastMonth: revenueLastMonth,
    };
  }, [proposals, customers]);
  
  const isLoading = customersLoading || proposalsLoading;

  const formatCurrency = (amount: number) => {
     return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount);
  }

  const StatCard = ({ title, value, changeText, icon: Icon, loading }: { title: string, value: string | number, changeText: string, icon: React.ElementType, loading: boolean }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        ) : (
            <>
                <div className="text-2xl font-bold">{value}</div>
                <p className="text-xs text-muted-foreground">{changeText}</p>
            </>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard 
        title="Toplam Ciro" 
        value={formatCurrency(dashboardStats.totalRevenue)} 
        changeText={calculatePercentageChange(dashboardStats.totalRevenue, dashboardStats.revenueLastMonth)}
        icon={Banknote}
        loading={isLoading}
      />
      <StatCard 
        title="Onaylanan Teklifler" 
        value={dashboardStats.approvedQuotes} 
        changeText={calculatePercentageChange(dashboardStats.approvedQuotes, dashboardStats.approvedQuotesLastMonth)}
        icon={CheckCircle}
        loading={isLoading}
      />
      <StatCard 
        title="Aktif Teklifler" 
        value={dashboardStats.activeQuotes} 
        changeText={calculatePercentageChange(dashboardStats.activeQuotes, dashboardStats.activeQuotesLastMonth)}
        icon={FileText}
        loading={isLoading}
      />
       <StatCard 
        title="Toplam Müşteri" 
        value={dashboardStats.totalCustomers} 
        changeText={``} // Customer change logic is not implemented
        icon={Users}
        loading={isLoading}
      />
    </div>
  );
}
