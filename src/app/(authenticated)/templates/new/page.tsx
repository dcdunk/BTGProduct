import TemplateForm from '@/components/templates/TemplateForm';

export default function NewTemplatePage() {
  return (
    <div className="p-8 animate-page-enter max-w-3xl">
      <h1 className="font-display text-xl font-medium uppercase tracking-wider text-primary mb-8">
        Create Template
      </h1>
      <TemplateForm mode="create" />
    </div>
  );
}
