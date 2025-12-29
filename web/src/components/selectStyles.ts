import type { StylesConfig } from 'react-select'

// Shared styles for react-select components to match dark theme
// Used by FactionSelector, BreadcrumbNav, and filter controls

export interface SelectOption {
  value: string
  label: string
}

// Base styles without isMulti constraint - used for both single and multi-select
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const baseStyles: StylesConfig<any, boolean> = {
  control: (base, state) => ({
    ...base,
    backgroundColor: 'rgb(31, 41, 55)', // gray-800
    cursor: 'pointer',
    borderColor: state.isFocused ? 'rgb(59, 130, 246)' : 'rgb(75, 85, 99)', // blue-500 : gray-600
    borderRadius: '0.375rem',
    minHeight: '38px',
    boxShadow: state.isFocused ? '0 0 0 1px rgb(59, 130, 246)' : 'none',
    '&:hover': {
      borderColor: 'rgb(107, 114, 128)', // gray-500
    },
  }),
  menu: (base) => ({
    ...base,
    backgroundColor: 'rgb(31, 41, 55)', // gray-800
    border: '1px solid rgb(75, 85, 99)', // gray-600
    borderRadius: '0.375rem',
    zIndex: 50,
  }),
  menuList: (base) => ({
    ...base,
    padding: '4px',
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? 'rgb(59, 130, 246)' // blue-500
      : state.isFocused
      ? 'rgb(55, 65, 81)' // gray-700
      : 'transparent',
    color: 'rgb(243, 244, 246)', // gray-100
    cursor: 'pointer',
    borderRadius: '0.25rem',
    '&:active': {
      backgroundColor: 'rgb(37, 99, 235)', // blue-600
    },
  }),
  singleValue: (base) => ({
    ...base,
    color: 'rgb(243, 244, 246)', // gray-100
  }),
  input: (base) => ({
    ...base,
    color: 'rgb(243, 244, 246)', // gray-100
  }),
  placeholder: (base) => ({
    ...base,
    color: 'rgb(156, 163, 175)', // gray-400
  }),
  indicatorSeparator: (base) => ({
    ...base,
    backgroundColor: 'rgb(75, 85, 99)', // gray-600
  }),
  dropdownIndicator: (base) => ({
    ...base,
    color: 'rgb(156, 163, 175)', // gray-400
    '&:hover': {
      color: 'rgb(209, 213, 219)', // gray-300
    },
  }),
  clearIndicator: (base) => ({
    ...base,
    color: 'rgb(156, 163, 175)', // gray-400
    '&:hover': {
      color: 'rgb(209, 213, 219)', // gray-300
    },
  }),
  noOptionsMessage: (base) => ({
    ...base,
    color: 'rgb(156, 163, 175)', // gray-400
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 9999, // Ensure portal renders above everything
  }),
  // Multi-select specific styles
  multiValue: (base) => ({
    ...base,
    backgroundColor: 'rgb(55, 65, 81)', // gray-700
    borderRadius: '0.25rem',
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: 'rgb(243, 244, 246)', // gray-100
    padding: '2px 6px',
  }),
  multiValueRemove: (base) => ({
    ...base,
    color: 'rgb(156, 163, 175)', // gray-400
    ':hover': {
      backgroundColor: 'rgb(239, 68, 68)', // red-500
      color: 'white',
    },
  }),
}

// Single-select styles (default)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const selectStyles: StylesConfig<any, false> = baseStyles as StylesConfig<any, false>

// Multi-select styles
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const multiSelectStyles: StylesConfig<any, true> = baseStyles as StylesConfig<any, true>
