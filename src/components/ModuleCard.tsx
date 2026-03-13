import { LucideIcon, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface ModuleCardProps {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  count?: number;
  countLabel?: string;
  color: string;
  iconColor: string;
}

export default function ModuleCard({
  href, icon: Icon, title, description, count, countLabel, color, iconColor,
}: ModuleCardProps) {
  return (
    <Link href={href}>
      <div className="card p-5 hover:shadow-card-hover transition-all duration-200 cursor-pointer group h-full hover:-translate-y-0.5">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform`}>
            <Icon size={22} className={iconColor} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-sm">{title}</h3>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{description}</p>
            {count !== undefined && count > 0 && (
              <div className="mt-2">
                <span className="badge bg-primary-100 text-primary-800">
                  {count} {countLabel ?? 'elementi'}
                </span>
              </div>
            )}
          </div>
          <ChevronRight size={16} className="text-sand-400 group-hover:text-primary-700 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
        </div>
      </div>
    </Link>
  );
}
