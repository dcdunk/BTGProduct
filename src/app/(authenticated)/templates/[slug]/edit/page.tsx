import { getTemplateBySlug } from '@/lib/db';
import { notFound } from 'next/navigation';
import TemplateForm from '@/components/templates/TemplateForm';
import type { Template } from '@/types';

interface PageProps {
  params: { slug: string };
}

export default async function EditTemplatePage({ params }: PageProps) {
  const template = getTemplateBySlug(params.slug) as Template | undefined;
  if (!template) notFound();

  return (
    <div className="p-8 animate-page-enter max-w-3xl">
      <h1 className="font-display text-xl font-medium uppercase tracking-wider text-primary mb-8">
        Edit {template.name}
      </h1>
      <TemplateForm mode="edit" template={template} />
    </div>
  );
}
