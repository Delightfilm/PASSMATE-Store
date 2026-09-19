import { AdminProductPreview } from "@/components/admin-product-preview";

export default async function AdminProductPreviewPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  return (
    <section className="section page-section admin-page">
      <div className="container">
        <AdminProductPreview code={decodeURIComponent(code)} />
      </div>
    </section>
  );
}
