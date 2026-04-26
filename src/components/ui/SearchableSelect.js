import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';

function normalizeValue(value) {
  return value === undefined || value === null ? '' : String(value);
}

function buildSearchText(option) {
  const keywords = Array.isArray(option.keywords) ? option.keywords.join(' ') : option.keywords || '';
  return `${option.label || ''} ${keywords}`.trim().toLowerCase();
}

export default function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = 'Type to search...',
  emptyLabel = 'No results found',
  className = 'form-control',
  style,
  disabled = false,
  required = false,
  clearable = false,
  noResultsAction,
}) {
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const selectedValue = normalizeValue(value);
  const normalizedOptions = useMemo(
    () => options.map((option) => ({
      ...option,
      value: normalizeValue(option.value),
      label: option.label || '',
      searchText: buildSearchText(option),
    })),
    [options]
  );

  const selectedOption = normalizedOptions.find((option) => option.value === selectedValue) || null;
  const [query, setQuery] = useState(selectedOption?.label || '');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setQuery(selectedOption?.label || '');
  }, [selectedOption?.label]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false);
        setQuery(selectedOption?.label || '');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedOption]);

  const filteredOptions = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return normalizedOptions;
    return normalizedOptions.filter((option) => option.searchText.includes(search));
  }, [normalizedOptions, query]);

  const selectOption = (option) => {
    setQuery(option.label);
    setIsOpen(false);
    onChange?.(option.value, option);
  };

  const handleInputChange = (event) => {
    const nextQuery = event.target.value;
    setQuery(nextQuery);
    setIsOpen(true);
    if (!nextQuery && clearable) {
      onChange?.('', null);
    }
  };

  const handleFocus = () => {
    if (!disabled) {
      setIsOpen(true);
    }
  };

  const focusInput = () => {
    if (disabled) return;
    inputRef.current?.focus();
    setIsOpen(true);
  };

  const handleBlur = () => {
    window.setTimeout(() => {
      if (!containerRef.current?.contains(document.activeElement)) {
        setIsOpen(false);
        setQuery(selectedOption?.label || '');
      }
    }, 120);
  };

  return (
    <div className="searchable-select" ref={containerRef} style={style}>
      <div
        className={`searchable-select__control ${disabled ? 'is-disabled' : ''} ${isOpen ? 'is-open' : ''}`}
        onClick={focusInput}
      >
        <Search size={14} className="searchable-select__icon" />
        <input
          ref={inputRef}
          className={className}
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          aria-autocomplete="list"
        />
        <ChevronDown size={16} className="searchable-select__chevron" />
      </div>
      {required && (
        <input
          tabIndex={-1}
          value={selectedValue}
          onChange={() => {}}
          required={required}
          className="searchable-select__required-proxy"
        />
      )}
      {isOpen && (
        <div className="searchable-select__menu">
          {clearable && selectedValue && (
            <button
              type="button"
              className="searchable-select__option searchable-select__option--clear"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setQuery('');
                setIsOpen(false);
                onChange?.('', null);
              }}
            >
              Clear selection
            </button>
          )}
          {filteredOptions.length ? (
            filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`searchable-select__option ${option.value === selectedValue ? 'is-selected' : ''}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectOption(option)}
              >
                {option.label}
              </button>
            ))
          ) : noResultsAction ? (
            typeof noResultsAction === 'function' ? noResultsAction({ query: query.trim() }) : noResultsAction
          ) : (
            <div className="searchable-select__empty">{emptyLabel}</div>
          )}
        </div>
      )}
    </div>
  );
}
