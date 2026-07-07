import { GraduationCap, MapPin, DollarSign, Trophy } from 'lucide-react';

export function ProgramCard({ program }) {
  const scoreColor = program.score >= 80
    ? 'var(--color-emerald)'
    : program.score >= 60
    ? 'var(--color-gold)'
    : 'var(--color-peri-purple)';

  return (
    <div className="rec-card fade-in">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-white truncate" style={{ fontFamily: 'var(--font-display)' }}>
            {program.programName}
          </h4>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-slate-400)' }}>{program.universityName}</p>
        </div>
        {/* Score ring */}
        <div className="flex-shrink-0 text-center">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border-2"
            style={{
              borderColor: scoreColor,
              color: scoreColor,
              background: `${scoreColor}18`,
            }}
          >
            {program.score}
          </div>
          <span className="text-[9px]" style={{ color: 'var(--color-slate-500)' }}>score</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs" style={{ color: 'var(--color-slate-400)' }}>
        <span className="flex items-center gap-1">
          <MapPin className="w-3 h-3 text-indigo-400" />
          {program.country}
        </span>
        <span className="flex items-center gap-1 font-mono-data" style={{ color: 'var(--color-emerald)' }}>
          <DollarSign className="w-3 h-3 text-emerald-400" />
          {program.tuitionFee === 0 ? 'Free' : `$${program.tuitionFee.toLocaleString()}/yr`}
        </span>
        <span className="flex items-center gap-1">
          <GraduationCap className="w-3 h-3 text-sky-400" />
          {program.degreeLevel}
        </span>
        {program.ranking && (
          <span className="flex items-center gap-1 font-mono-data" style={{ color: 'var(--color-gold)' }}>
            <Trophy className="w-3 h-3 text-amber-400" />
            Rank #{program.ranking}
          </span>
        )}
      </div>
    </div>
  );
}

export function ScholarshipCard({ scholarship }) {
  const coverageColor = {
    'Full Ride': 'var(--color-emerald)',
    'Full Tuition': 'var(--color-peri-purple)',
    'Partial Tuition': 'var(--color-gold)',
    'Stipend Only': 'var(--color-sky)',
  }[scholarship.coverageType] || 'var(--color-slate-400)';

  return (
    <div className="rec-card fade-in">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-white leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
            {scholarship.name}
          </h4>
          {scholarship.description && (
            <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--color-slate-400)' }}>
              {scholarship.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs mt-2">
        <span
          className="px-2 py-0.5 rounded-full font-medium"
          style={{ background: `${coverageColor}20`, color: coverageColor, border: `1px solid ${coverageColor}40` }}
        >
          {scholarship.educationLevel?.join(' / ')}
        </span>
        <span className="flex items-center gap-1 font-mono-data" style={{ color: 'var(--color-gold)' }}>
          <DollarSign className="w-3 h-3 text-amber-400" />
          ${scholarship.amount?.toLocaleString()}
        </span>
        <span className="flex items-center gap-1" style={{ color: 'var(--color-slate-400)' }}>
          <MapPin className="w-3 h-3 text-indigo-400" />
          {scholarship.applicableCountries?.slice(0, 2).join(', ')}
        </span>
      </div>
    </div>
  );
}
