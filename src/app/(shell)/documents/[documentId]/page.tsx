import { DocumentDetailPage } from "@/components/pages/document-detail-page";

export function generateStaticParams() {
  return [];
}

export default async function LegacyDocumentDetailRoute({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = await params;
  return <DocumentDetailPage documentId={documentId} />;
}

