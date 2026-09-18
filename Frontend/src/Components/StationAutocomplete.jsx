import { useState, useId } from 'react';
import { Form, ListGroup, Spinner } from 'react-bootstrap';
import { useLocations } from '../hooks/useLocation';
import '../css/StationAutocomplete.css';

/**
 * A single shared station picker, replacing the hand-rolled copy that used
 * to live in QuickSearch, SearchForm and AddCommuteModal — mouse-only and
 * invisible to screen readers in all three. This one closes on blur/Escape,
 * supports arrow-key navigation with Enter to select, and exposes the
 * standard combobox/listbox/option ARIA roles.
 */
export default function StationAutocomplete({ label, value, onChange, selected, onSelect, placeholder }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const id = useId();

  const { data: results, isLoading } = useLocations(value);
  const options = results || [];
  const showList = isOpen && options.length > 0;

  const closeList = () => {
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const commitSelection = (loc) => {
    onSelect(loc);
    onChange(loc.name);
    closeList();
  };

  const handleChange = (e) => {
    onChange(e.target.value);
    onSelect(null);
    setIsOpen(true);
    setActiveIndex(-1);
  };

  const handleFocus = () => {
    // Don't reopen the list for a value that's already a confirmed
    // selection — only when the caller has typed something new.
    if (options.length > 0 && selected?.name !== value) setIsOpen(true);
  };

  const handleKeyDown = (e) => {
    if (!showList) {
      if (e.key === 'ArrowDown' && options.length > 0) setIsOpen(true);
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % options.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => (i <= 0 ? options.length - 1 : i - 1));
        break;
      case 'Enter':
        if (activeIndex >= 0) {
          e.preventDefault();
          commitSelection(options[activeIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        closeList();
        break;
      default:
        break;
    }
  };

  const handleBlur = () => {
    // A blur fires before a mousedown-triggered click on an option would —
    // give the option's onMouseDown a moment to run first.
    setTimeout(closeList, 100);
  };

  const activeOptionId = activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined;

  return (
    <div className="station-autocomplete input-wrapper">
      {label && <Form.Label htmlFor={id}>{label}</Form.Label>}
      <Form.Control
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={`${id}-listbox`}
        aria-activedescendant={activeOptionId}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        autoComplete="off"
      />
      {isLoading && <Spinner size="sm" className="mt-1" />}
      {showList && (
        <ListGroup as="ul" role="listbox" id={`${id}-listbox`} className="suggestions-list">
          {options.map((loc, i) => (
            <ListGroup.Item
              as="li"
              key={loc.id}
              id={`${id}-option-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              active={i === activeIndex}
              action
              // onMouseDown, not onClick — it fires before the input's blur
              // handler, so the selection commits before the list closes.
              onMouseDown={(e) => {
                e.preventDefault();
                commitSelection(loc);
              }}
            >
              {loc.name}
            </ListGroup.Item>
          ))}
        </ListGroup>
      )}
    </div>
  );
}
