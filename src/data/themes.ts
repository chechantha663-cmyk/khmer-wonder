export interface AppTheme {
  id: string;
  nameKm: string;
  subtitleKm: string;
  image: string;
  isDark: boolean;
  swatch: string;
  fallbackGradient: string;
  vars: {
    '--surface-canvas': string;
    '--surface-card': string;
    '--surface-elevated': string;
    '--surface-subtle': string;
    '--ink-primary': string;
    '--ink-secondary': string;
    '--border-hairline': string;
    '--accent-main': string;
    '--accent-hover': string;
    '--accent-soft': string;
    '--accent-ink': string;
    '--scrim-top': string;
    '--scrim-bottom': string;
  };
}

export const STAGE_BACKDROPS = {
  angkor: '/assets/aistudio/angkor-wat_741406d9.jpg',
  forest: '/src/assets/images/bg_khmer_forest_1795234815626.jpg',
  river: '/src/assets/images/bg_mekong_river_1795234815591.jpg',
  sunset: '/src/assets/images/bg_sunset_meadow_1795234815301.jpg',
  night: '/src/assets/images/bg_starry_village_1795234816073.jpg',
  courtyard: '/src/assets/images/bg_golden_pavilion_1795234816729.jpg',
} as const;

export type StageMood = keyof typeof STAGE_BACKDROPS;

export const APP_THEMES: AppTheme[] = [
  {
    id: 'angkor-amber',
    nameKm: 'អង្គរពន្លឺមាស',
    subtitleKm: 'ប្រាសាទអង្គរវត្ត · ពណ៌មាសកក់ក្ដៅ',
    image: STAGE_BACKDROPS.angkor,
    isDark: false,
    swatch: '#c2410c',
    fallbackGradient: 'linear-gradient(135deg, #fef3c7, #fed7aa)',
    vars: {
      '--surface-canvas': '#faf8f5',
      '--surface-card': 'rgba(255, 253, 250, 0.92)',
      '--surface-elevated': '#ffffff',
      '--surface-subtle': '#f3efe8',
      '--ink-primary': '#1c1917',
      '--ink-secondary': '#57534e',
      '--border-hairline': 'rgba(28, 25, 23, 0.1)',
      '--accent-main': '#c2410c',
      '--accent-hover': '#9a3412',
      '--accent-soft': 'rgba(194, 65, 12, 0.1)',
      '--accent-ink': '#ffffff',
      '--scrim-top': 'rgba(250, 248, 245, 0.68)',
      '--scrim-bottom': 'rgba(250, 248, 245, 0.94)',
    },
  },
  {
    id: 'emerald-forest',
    nameKm: 'ព្រៃបុរាណបៃតង',
    subtitleKm: 'ព្រៃឈើមានពន្លឺថ្ងៃ · ពណ៌បៃតងស្រស់',
    image: STAGE_BACKDROPS.forest,
    isDark: false,
    swatch: '#047857',
    fallbackGradient: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
    vars: {
      '--surface-canvas': '#f5f9f6',
      '--surface-card': 'rgba(252, 255, 253, 0.92)',
      '--surface-elevated': '#ffffff',
      '--surface-subtle': '#e9f2ec',
      '--ink-primary': '#10241c',
      '--ink-secondary': '#455e53',
      '--border-hairline': 'rgba(16, 36, 28, 0.1)',
      '--accent-main': '#047857',
      '--accent-hover': '#065f46',
      '--accent-soft': 'rgba(4, 120, 87, 0.1)',
      '--accent-ink': '#ffffff',
      '--scrim-top': 'rgba(245, 249, 246, 0.68)',
      '--scrim-bottom': 'rgba(245, 249, 246, 0.94)',
    },
  },
  {
    id: 'mekong-azure',
    nameKm: 'ដងទន្លេមេគង្គ',
    subtitleKm: 'ទន្លេ និងផ្កាឈូក · ពណ៌ខៀវទឹកសមុទ្រ',
    image: STAGE_BACKDROPS.river,
    isDark: false,
    swatch: '#0369a1',
    fallbackGradient: 'linear-gradient(135deg, #e0f2fe, #bae6fd)',
    vars: {
      '--surface-canvas': '#f4f8fb',
      '--surface-card': 'rgba(252, 254, 255, 0.92)',
      '--surface-elevated': '#ffffff',
      '--surface-subtle': '#e8f1f8',
      '--ink-primary': '#0f2133',
      '--ink-secondary': '#475e73',
      '--border-hairline': 'rgba(15, 33, 51, 0.1)',
      '--accent-main': '#0369a1',
      '--accent-hover': '#075985',
      '--accent-soft': 'rgba(3, 105, 161, 0.1)',
      '--accent-ink': '#ffffff',
      '--scrim-top': 'rgba(244, 248, 251, 0.66)',
      '--scrim-bottom': 'rgba(244, 248, 251, 0.94)',
    },
  },
  {
    id: 'sunset-meadow',
    nameKm: 'វាលស្រែថ្ងៃលិច',
    subtitleKm: 'ថ្ងៃលិចជនបទ · ពណ៌ទឹកក្រូចស្រទន់',
    image: STAGE_BACKDROPS.sunset,
    isDark: false,
    swatch: '#b91c1c',
    fallbackGradient: 'linear-gradient(135deg, #ffedd5, #fecaca)',
    vars: {
      '--surface-canvas': '#fbf7f4',
      '--surface-card': 'rgba(255, 252, 249, 0.92)',
      '--surface-elevated': '#ffffff',
      '--surface-subtle': '#f5ebe4',
      '--ink-primary': '#261815',
      '--ink-secondary': '#634d47',
      '--border-hairline': 'rgba(38, 24, 21, 0.1)',
      '--accent-main': '#b91c1c',
      '--accent-hover': '#991b1b',
      '--accent-soft': 'rgba(185, 28, 28, 0.1)',
      '--accent-ink': '#ffffff',
      '--scrim-top': 'rgba(251, 247, 244, 0.66)',
      '--scrim-bottom': 'rgba(251, 247, 244, 0.94)',
    },
  },
  {
    id: 'starry-night',
    nameKm: 'រាត្រីភូមិខ្មែរ',
    subtitleKm: 'រាត្រីអំពិលអំពែក · ផ្ទៃងងឹតមាស',
    image: STAGE_BACKDROPS.night,
    isDark: true,
    swatch: '#d97706',
    fallbackGradient: 'linear-gradient(135deg, #0f172a, #134e4a)',
    vars: {
      '--surface-canvas': '#0b1520',
      '--surface-card': 'rgba(16, 28, 42, 0.88)',
      '--surface-elevated': '#162538',
      '--surface-subtle': '#1d3047',
      '--ink-primary': '#f4f6f8',
      '--ink-secondary': '#a5b4c7',
      '--border-hairline': 'rgba(244, 246, 248, 0.12)',
      '--accent-main': '#f59e0b',
      '--accent-hover': '#d97706',
      '--accent-soft': 'rgba(245, 158, 11, 0.16)',
      '--accent-ink': '#0b1520',
      '--scrim-top': 'rgba(11, 21, 32, 0.68)',
      '--scrim-bottom': 'rgba(11, 21, 32, 0.94)',
    },
  },
  {
    id: 'golden-courtyard',
    nameKm: 'ខ្លោងទ្វារផ្កាចំប៉ា',
    subtitleKm: 'សួនចំប៉ាស្រទន់ · ពណ៌ត្នោតមាស',
    image: STAGE_BACKDROPS.courtyard,
    isDark: false,
    swatch: '#92400e',
    fallbackGradient: 'linear-gradient(135deg, #fef9c3, #fde68a)',
    vars: {
      '--surface-canvas': '#faf9f5',
      '--surface-card': 'rgba(255, 254, 250, 0.92)',
      '--surface-elevated': '#ffffff',
      '--surface-subtle': '#f3f0e6',
      '--ink-primary': '#211c14',
      '--ink-secondary': '#5e5546',
      '--border-hairline': 'rgba(33, 28, 20, 0.1)',
      '--accent-main': '#92400e',
      '--accent-hover': '#78350f',
      '--accent-soft': 'rgba(146, 64, 14, 0.11)',
      '--accent-ink': '#ffffff',
      '--scrim-top': 'rgba(250, 249, 245, 0.66)',
      '--scrim-bottom': 'rgba(250, 249, 245, 0.94)',
    },
  },
];
