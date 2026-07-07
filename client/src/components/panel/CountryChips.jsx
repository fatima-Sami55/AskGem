import { useState } from 'react';
import { X, Plus, Globe } from 'lucide-react';
import { useProfile } from '../../context/ProfileContext';

const POPULAR_COUNTRIES = [
  'USA', 'UK', 'Germany', 'Canada', 'Australia',
  'France', 'Netherlands', 'Sweden', 'Singapore', 'Japan',
  'South Korea', 'Switzerland', 'New Zealand', 'Norway', 'Denmark',
];

export default function CountryChips() {
  const { user, updateProfile } = useProfile();
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const currentCountries = user?.profile?.preferredCountries || [];

  const persistCountries = async (updated) => {
    await updateProfile({ preferredCountries: updated });
  };

  const addCountry = (country) => {
    if (!currentCountries.includes(country)) {
      persistCountries([...currentCountries, country]);
    }
    setSearch('');
    setShowDropdown(false);
  };

  const removeCountry = (country) => {
    persistCountries(currentCountries.filter((c) => c !== country));
  };

  const filtered = POPULAR_COUNTRIES.filter(
    (c) => c.toLowerCase().includes(search.toLowerCase()) && !currentCountries.includes(c),
  );

  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <Globe className="w-3.5 h-3.5 text-indigo-400" />
        <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>PREFERRED COUNTRIES</span>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-2.5 min-h-[24px]">
        {currentCountries.length === 0 ? (
          <span className="text-xs italic" style={{ color: 'var(--text-subtle)' }}>
            All countries (global search)
          </span>
        ) : (
          currentCountries.map((c) => (
            <span key={c} className="country-chip">
              {c}
              <button
                className="remove-btn"
                onClick={() => removeCountry(c)}
                aria-label={`Remove ${c}`}
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>

      <div className="relative">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Add country..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            className="input-field text-xs py-1.5 flex-1"
            id="country-search-input"
          />
          {search && (
            <button
              className="text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors"
              style={{ background: 'rgba(79,70,229,0.2)', color: '#a5b4fc' }}
              onClick={() => addCountry(search.trim())}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {showDropdown && filtered.length > 0 && search && (
          <div
            className="absolute z-10 w-full mt-1 rounded-xl shadow-xl overflow-hidden"
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}
          >
            {filtered.slice(0, 6).map((c) => (
              <button
                key={c}
                className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-indigo-500/10"
                style={{ color: 'var(--text-main)' }}
                onClick={() => addCountry(c)}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
