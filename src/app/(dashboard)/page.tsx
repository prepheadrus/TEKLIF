
'use client';

import { useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Users, FileText, CheckCircle, Banknote, Loader2 } from 'lucide-react';

type Proposal = {
  id: string;
  rootProposalId: string;
  status: 'Draft' | 'Sent' | 'Approved' | 'Rejected';
  totalAmount: number;
  createdAt: { seconds: number };
  version: number;
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
        return `+%${change.toFixed(1)} geçen aydan`;
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
        approvedQuotesCount: 0,
        totalRevenue: 0,
        customersLastMonth: 0,
        activeQuotesLastMonth: 0,
        approvedQuotesLastMonthCount: 0,
        revenueLastMonth: 0,
      };
    }
    
    const now = new Date();
    const firstDayOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000;
    const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime() / 1000;

    const currentMonthProposals = proposals.filter(p => p.createdAt.seconds >= firstDayOfCurrentMonth);
    const lastMonthProposals = proposals.filter(p => p.createdAt.seconds >= firstDayOfLastMonth && p.createdAt.seconds < firstDayOfCurrentMonth);

    // Group all proposals by rootProposalId
    const proposalGroups: { [key: string]: Proposal[] } = {};
    proposals.forEach(p => {
        if (!proposalGroups[p.rootProposalId]) {
            proposalGroups[p.rootProposalId] = [];
        }
        proposalGroups[p.rootProposalId].push(p);
    });

    let totalRevenue = 0;
    let approvedQuotesCount = 0;
    
    // Calculate revenue and count from the latest approved version in each group, if any
    Object.values(proposalGroups).forEach(group => {
        const approvedVersions = group.filter(p => p.status === 'Approved');
        if (approvedVersions.length > 0) {
            // If there are approved versions, find the one with the highest version number
            const latestApproved = approvedVersions.reduce((latest, current) => current.version > latest.version ? current : latest);
            totalRevenue += latestApproved.totalAmount;
            approvedQuotesCount++; // Count each group with an approved version as one approved quote
        }
    });

    // An active quote is a group where the latest version is Draft or Sent
    const activeQuotes = Object.values(proposalGroups).filter(group => {
       const latestVersion = group.reduce((latest, current) => current.version > latest.version ? current : latest);
       return latestVersion.status === 'Draft' || latestVersion.status === 'Sent';
    }).length;
    
    // --- Last Month Calculations ---
    const lastMonthProposalGroups: { [key: string]: Proposal[] } = {};
     lastMonthProposals.forEach(p => {
        if (!lastMonthProposalGroups[p.rootProposalId]) {
            lastMonthProposalGroups[p.rootProposalId] = [];
        }
        lastMonthProposalGroups[p.rootProposalId].push(p);
    });
    
    let revenueLastMonth = 0;
    let approvedQuotesLastMonthCount = 0;
    Object.values(lastMonthProposalGroups).forEach(group => {
        const approvedVersions = group.filter(p => p.status === 'Approved');
        if (approvedVersions.length > 0) {
            const latestApproved = approvedVersions.reduce((latest, current) => current.version > latest.version ? current : latest);
            revenueLastMonth += latestApproved.totalAmount;
            approvedQuotesLastMonthCount++;
        }
    });

    const activeQuotesLastMonth = Object.values(lastMonthProposalGroups).filter(group => {
       const latestVersion = group.reduce((latest, current) => current.version > latest.version ? current : latest);
       return latestVersion.status === 'Draft' || latestVersion.status === 'Sent';
    }).length;


    return {
      totalCustomers: customers.length,
      activeQuotes: activeQuotes,
      approvedQuotesCount: approvedQuotesCount,
      totalRevenue: totalRevenue,
      customersLastMonth: customers.length, // Placeholder logic for customer change
      activeQuotesLastMonth: activeQuotesLastMonth,
      approvedQuotesLastMonthCount: approvedQuotesLastMonthCount,
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
        value={dashboardStats.approvedQuotesCount} 
        changeText={calculatePercentageChange(dashboardStats.approvedQuotesCount, dashboardStats.approvedQuotesLastMonthCount)}
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

    
