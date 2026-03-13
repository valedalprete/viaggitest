import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-sand-200 flex items-center justify-center mb-5">
        <Icon size={30} className="text-sand-600" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 max-w-sm mb-6 leading-relaxed">{description}</p>
      )}
      {action && (
        <button onClick={action.onClick} className="btn-primary px-6 py-2.5">
          {action.label}
        </button>
      )}
    </div>
  );
}
