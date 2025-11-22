import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatSection } from './StatSection';

describe('StatSection', () => {
  it('renders title and children when expanded by default', () => {
    render(
      <StatSection title="Test Section">
        <div>Test content</div>
      </StatSection>
    );

    expect(screen.getByText('Test Section')).toBeInTheDocument();
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('collapses content when header is clicked', () => {
    render(
      <StatSection title="Test Section">
        <div>Test content</div>
      </StatSection>
    );

    const button = screen.getByRole('button');
    expect(screen.getByText('Test content')).toBeInTheDocument();

    fireEvent.click(button);
    expect(screen.queryByText('Test content')).not.toBeInTheDocument();
  });

  it('expands content when collapsed header is clicked', () => {
    render(
      <StatSection title="Test Section" defaultExpanded={false}>
        <div>Test content</div>
      </StatSection>
    );

    expect(screen.queryByText('Test content')).not.toBeInTheDocument();

    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('respects defaultExpanded=false prop', () => {
    render(
      <StatSection title="Test Section" defaultExpanded={false}>
        <div>Test content</div>
      </StatSection>
    );

    expect(screen.getByText('Test Section')).toBeInTheDocument();
    expect(screen.queryByText('Test content')).not.toBeInTheDocument();
  });

  it('has correct aria-expanded attribute', () => {
    render(
      <StatSection title="Test Section">
        <div>Test content</div>
      </StatSection>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });
});
