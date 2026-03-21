'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Calendar, Clock, Users, EyeOff, Eye, MoreHorizontal } from 'lucide-react';
import { Trip, TripRole } from '@/lib/types';
import { formatDateRange, getCountdownText, getTripStatus, getTripDuration } from '@/lib/utils';

interface TripCardProps {
  trip: Trip;
  myRole?: TripRole;
  onHideFromDashboard?: () => void;
  onRestoreToDashboard?: () => void;
}

const COVER_GRADIENTS = [
  'from-blue-600 to-cyan-500',
  'from-teal-700 to-emerald-500',
  'from-violet-600 to-purple-500',
  'from-orange-500 to-amber-400',
  'from-pink-600 to-rose-500',
  'from-sky-600 to-blue-500',
];

function getCoverGradient(id: string) {
  const index = id.charCodeAt(0) % COVER_GRADIENTS.length;
  return COVER_GRADIENTS[index];
}

export default function TripCard({ trip, myRole, onHideFromDashboard, onRestoreToDashboard }: TripCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const status = getTripStatus(trip.start_date, trip.end_date);
  const countdown = getCountdownText(trip.start_date, trip.end_date);
  const duration = getTripDuration(trip.start_date, trip.end_date);

  const statusConfig = {
    upcoming: { label: 'In arrivo', class: 'bg-blue-100 text-blue-700' },
    ongoing:  { label: 'In corso',  class: 'bg-emerald-100 text-emerald-700' },
    past:     { label: 'Concluso',  class: 'bg-sand-200 text-sand-700' },
  }[status];

  return (
    <Link href={`/trip/${trip.id}`}>
      <div className="card overflow-hidden hover:shadow-card-hover transition-all duration-300 group cursor-pointer hover:-translate-y-1">
        {/* Cover */}
        <div className="relative h-56 overflow-hidden">
          {trip.cover_image ? (
            <Image
              src={trip.cover_image}
              alt={trip.destination}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${getCoverGradient(trip.id)} group-hover:opacity-90 transition-opacity`} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          {/* Status badge + shared badge */}
          <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
            <span className={`badge ${statusConfig.class} shadow-soft`}>
              {statusConfig.label}
            </span>
            {myRole && myRole !== 'owner' && (
              <span className="badge bg-white/90 text-primary-800 shadow-soft flex items-center gap-1">
                <Users size={10} />
                {myRole === 'editor' ? 'Editor' : 'Visualizzatore'}
              </span>
            )}
          </div>
          {/* Destination */}
          <div className="absolute bottom-4 left-4 right-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-white font-extrabold text-lg leading-tight drop-shadow flex-1">{trip.name}</h3>
              {(onHideFromDashboard || onRestoreToDashboard) && (
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setMenuOpen(prev => !prev);
                    }}
                    className="p-1 rounded-md bg-black/30 text-white hover:bg-black/45"
                    aria-label="Azioni viaggio"
                  >
                    <MoreHorizontal size={14} />
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 mt-1 w-40 rounded-lg bg-white shadow-elevated border border-slate-200 p-1 z-20">
                      {onHideFromDashboard && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setMenuOpen(false);
                            onHideFromDashboard();
                          }}
                          className="w-full text-left px-2.5 py-2 rounded-md text-sm text-slate-700 hover:bg-slate-100 inline-flex items-center gap-2"
                        >
                          <EyeOff size={13} /> Nascondi
                        </button>
                      )}
                      {onRestoreToDashboard && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setMenuOpen(false);
                            onRestoreToDashboard();
                          }}
                          className="w-full text-left px-2.5 py-2 rounded-md text-sm text-primary-700 hover:bg-primary-50 inline-flex items-center gap-2"
                        >
                          <Eye size={13} /> Ripristina
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 mt-1">
              <MapPin size={12} className="text-white/80" />
              <span className="text-white/90 text-sm font-medium">{trip.destination}</span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-4">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center gap-1.5">
              <Calendar size={13} />
              <span>{formatDateRange(trip.start_date, trip.end_date)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock size={13} />
              <span>{duration} {duration === 1 ? 'giorno' : 'giorni'}</span>
            </div>
          </div>

          {/* Countdown */}
          {status !== 'past' && (
            <div className="mt-3 pt-3 border-t border-sand-200">
              <p className="text-sm font-semibold text-primary-700">{countdown}</p>
            </div>
          )}

        </div>
      </div>
    </Link>
  );
}
