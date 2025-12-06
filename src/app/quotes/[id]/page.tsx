import { Metadata } from 'next';
import { QuoteDetailClientPage } from './quote-detail-client-page';
import { doc, getDoc } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase/server-init';

async function getProposalData(id: string) {
    try {
        const { firestore } = initializeFirebase();
        if (!firestore) return null;

        const proposalRef = doc(firestore, 'proposals', id);
        const proposalSnap = await getDoc(proposalRef);

        if (proposalSnap.exists()) {
            return proposalSnap.data() as { projectName: string, customerName: string };
        }
        return null;
    } catch (error) {
        console.error("Error fetching proposal for metadata:", error);
        return null;
    }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const proposal = await getProposalData(params.id);
  
  if (proposal) {
    return {
      title: `Teklif: ${proposal.projectName}`,
    };
  }
  
  return {
    title: `Teklif Detayı`,
  };
}


export default function QuoteDetailPage({ params }: { params: { id: string } }) {
    return <QuoteDetailClientPage params={params} />;
}
