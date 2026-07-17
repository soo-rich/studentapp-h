import { TestBed } from '@angular/core/testing';

import { VerificationBadge } from './verification-badge';

describe('VerificationBadge', () => {
  const createComponent = () => {
    const fixture = TestBed.createComponent(VerificationBadge);
    return fixture;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [VerificationBadge],
    });
  });

  it("renders the 'pending' state with text and icon, without a rejection reason", () => {
    const fixture = createComponent();
    fixture.componentRef.setInput('status', 'pending');
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;

    expect(root.textContent).toContain('En attente de vérification');
    expect(root.querySelector('mat-icon')?.textContent?.trim()).toBe('schedule');
    expect(root.querySelector('[role="status"]')?.getAttribute('aria-label')).toBe(
      'En attente de vérification',
    );
    expect(root.textContent).not.toContain('Motif');
  });

  it("renders the 'verified' state with text and icon, without a rejection reason even if provided", () => {
    const fixture = createComponent();
    fixture.componentRef.setInput('status', 'verified');
    fixture.componentRef.setInput('rejectionReason', 'ignored for this state');
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;

    expect(root.textContent).toContain('Profil vérifié');
    expect(root.querySelector('mat-icon')?.textContent?.trim()).toBe('check_circle');
    expect(root.querySelector('[role="status"]')?.getAttribute('aria-label')).toBe(
      'Profil vérifié',
    );
    expect(root.textContent).not.toContain('Motif');
    expect(root.textContent).not.toContain('ignored for this state');
  });

  it("renders the 'rejected' state with a reason when one is provided", () => {
    const fixture = createComponent();
    fixture.componentRef.setInput('status', 'rejected');
    fixture.componentRef.setInput('rejectionReason', 'Carte étudiante illisible.');
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;

    expect(root.textContent).toContain('Vérification refusée');
    expect(root.querySelector('mat-icon')?.textContent?.trim()).toBe('cancel');
    expect(root.textContent).toContain('Motif : Carte étudiante illisible.');
    expect(root.querySelector('[role="status"]')?.getAttribute('aria-label')).toBe(
      'Vérification refusée : Carte étudiante illisible.',
    );
  });

  it("renders the 'rejected' state without a reason paragraph when none is provided", () => {
    const fixture = createComponent();
    fixture.componentRef.setInput('status', 'rejected');
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;

    expect(root.textContent).toContain('Vérification refusée');
    expect(root.textContent).not.toContain('Motif');
    expect(root.querySelector('[role="status"]')?.getAttribute('aria-label')).toBe(
      'Vérification refusée',
    );
  });

  it("renders the 'rejected' state without a reason paragraph when the reason is null", () => {
    const fixture = createComponent();
    fixture.componentRef.setInput('status', 'rejected');
    fixture.componentRef.setInput('rejectionReason', null);
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;

    expect(root.textContent).not.toContain('Motif');
  });

  it('wraps a long rejection reason without introducing horizontal overflow styling', () => {
    const fixture = createComponent();
    const longReason = 'a'.repeat(500);
    fixture.componentRef.setInput('status', 'rejected');
    fixture.componentRef.setInput('rejectionReason', longReason);
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;
    const reasonEl = root.querySelector('p');

    expect(reasonEl?.textContent).toContain(longReason);
    expect(reasonEl?.className).toContain('break-words');
    expect(reasonEl?.className).toContain('whitespace-normal');
  });
});
