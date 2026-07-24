import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatButtonToggleGroupHarness } from '@angular/material/button-toggle/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { Observable, of, Subject, throwError } from 'rxjs';

import { CandidatesApiService } from '../../data/candidates-api.service';
import {
  CandidateCard,
  CandidateCardPage,
  CandidateContact,
  CandidateQueueParams,
} from '../../data/candidates.types';
import { OffreCandidats } from './candidats';

function buildCandidate(overrides: Partial<CandidateCard> = {}): CandidateCard {
  return {
    applicationId: 'application-1',
    status: 'forwarded',
    university: 'Université de Lomé',
    fieldOfStudy: 'Informatique',
    studyLevel: 'Licence 3',
    skills: ['JavaScript', 'Service client'],
    languages: ['Français'],
    experiences: 'Stage de 2 mois en développement web.',
    opportunityTypes: ['job_vacances'],
    availabilitySlots: [{ dayOfWeek: 'samedi', startTime: '08:00', endTime: '18:00' }],
    residenceArea: 'Lomé, Agoè',
    ...overrides,
  };
}

function buildPage(overrides: Partial<CandidateCardPage> = {}): CandidateCardPage {
  return { items: [buildCandidate()], page: 1, pageSize: 20, total: 1, ...overrides };
}

describe('OffreCandidats', () => {
  let fixture: ComponentFixture<OffreCandidats>;
  let loader: HarnessLoader;
  let candidatesApiMock: {
    listCandidates: ReturnType<typeof vi.fn>;
    selectCandidate: ReturnType<typeof vi.fn>;
    getCandidateContact: ReturnType<typeof vi.fn>;
  };

  async function setup(
    options: {
      offerId?: string;
      listResponse?: Observable<CandidateCardPage>;
      listImplementation?: (
        offerId: string,
        params: CandidateQueueParams,
      ) => Observable<CandidateCardPage>;
    } = {},
  ): Promise<void> {
    const offerId = options.offerId ?? 'offer-1';

    candidatesApiMock = {
      listCandidates:
        options.listImplementation !== undefined
          ? vi.fn(options.listImplementation)
          : vi.fn().mockReturnValue(options.listResponse ?? of(buildPage())),
      selectCandidate: vi.fn(),
      getCandidateContact: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [OffreCandidats],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        provideTanStackQuery(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
        { provide: CandidatesApiService, useValue: candidatesApiMock },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ offerId })) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OffreCandidats);
    loader = TestbedHarnessEnvironment.loader(fixture);
    fixture.detectChanges();
  }

  function query<T extends Element = Element>(selector: string): T {
    return fixture.nativeElement.querySelector(selector) as T;
  }

  it('creates the component', async () => {
    await setup();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('requests the candidates for the offerId read from the route, with no status filter and page 1 by default', async () => {
    await setup({ offerId: 'offer-77' });

    await vi.waitFor(() => {
      expect(candidatesApiMock.listCandidates).toHaveBeenCalledWith('offer-77', {
        status: undefined,
        page: 1,
        pageSize: 20,
      });
    });
  });

  it('shows a loading spinner while the candidates query is pending', async () => {
    await setup({ listResponse: new Subject<CandidateCardPage>() });
    expect(fixture.nativeElement.textContent).toContain('Chargement des candidats');
  });

  it('shows a generic error message when the candidates query fails', async () => {
    await setup({ listResponse: throwError(() => new Error('network down')) });

    await vi.waitFor(() => {
      fixture.detectChanges();
      const alert = fixture.nativeElement.querySelector('[role="alert"]');
      expect(alert).not.toBeNull();
      expect(alert?.textContent).toContain('Une erreur est survenue');
    });
  });

  it('shows a message when there is no candidate matching the filter', async () => {
    await setup({ listResponse: of(buildPage({ items: [], total: 0 })) });

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Aucun candidat pour ce filtre.');
    });
  });

  it('renders a candidate card with ONLY CandidateCard fields — no name, no contact', async () => {
    await setup({
      listResponse: of(
        buildPage({
          items: [
            buildCandidate({
              university: 'Université de Lomé',
              fieldOfStudy: 'Informatique',
              studyLevel: 'Licence 3',
              skills: ['JavaScript'],
              languages: ['Français'],
              residenceArea: 'Lomé, Agoè',
            }),
          ],
        }),
      ),
    });

    await vi.waitFor(() => {
      fixture.detectChanges();
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain('Université de Lomé');
      expect(text).toContain('Informatique');
      expect(text).toContain('Licence 3');
      expect(text).toContain('JavaScript');
      expect(text).toContain('Français');
      expect(text).toContain('Lomé, Agoè');
      expect(text).toContain('Transmis');
      // Aucune coordonnée / identité affichée hors de l'action explicite dédiée.
      expect(fixture.nativeElement.querySelector('.candidate-contact')).toBeNull();
    });
  });

  it('shows a "select" action only for a forwarded candidate, and calls select on click', async () => {
    await setup({
      offerId: 'offer-9',
      listResponse: of(buildPage({ items: [buildCandidate({ applicationId: 'application-42', status: 'forwarded' })] })),
    });
    candidatesApiMock.selectCandidate.mockReturnValue(
      of(buildCandidate({ applicationId: 'application-42', status: 'selected' })),
    );

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(query('.select-candidate-button')).not.toBeNull();
    });

    query<HTMLButtonElement>('.select-candidate-button').click();

    await vi.waitFor(() => {
      expect(candidatesApiMock.selectCandidate).toHaveBeenCalledWith('offer-9', 'application-42');
    });
  });

  it('does not show a "select" action for a non-forwarded candidate', async () => {
    await setup({
      listResponse: of(buildPage({ items: [buildCandidate({ status: 'selected' })] })),
    });

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Sélectionné');
    });
    expect(query('.select-candidate-button')).toBeNull();
  });

  it('reveals the contact only after clicking "voir les coordonnées" for an accepted candidate', async () => {
    const contact: CandidateContact = {
      firstName: 'Ama',
      lastName: 'Koffi',
      phoneNumber: '+228 90 00 00 00',
    };
    await setup({
      offerId: 'offer-9',
      listResponse: of(buildPage({ items: [buildCandidate({ applicationId: 'application-7', status: 'accepted' })] })),
    });
    candidatesApiMock.getCandidateContact.mockReturnValue(of(contact));

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(query('.show-contact-button')).not.toBeNull();
    });

    // Avant le clic : aucune coordonnée n'a été demandée.
    expect(candidatesApiMock.getCandidateContact).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.candidate-contact')).toBeNull();

    query<HTMLButtonElement>('.show-contact-button').click();

    await vi.waitFor(() => {
      expect(candidatesApiMock.getCandidateContact).toHaveBeenCalledWith('offer-9', 'application-7');
    });

    await vi.waitFor(() => {
      fixture.detectChanges();
      const contactBlock = fixture.nativeElement.querySelector('.candidate-contact');
      expect(contactBlock).not.toBeNull();
      expect(contactBlock?.textContent).toContain('Ama');
      expect(contactBlock?.textContent).toContain('Koffi');
      expect(contactBlock?.textContent).toContain('+228 90 00 00 00');
    });
  });

  it('does not show a "voir les coordonnées" action for a non-accepted candidate', async () => {
    await setup({
      listResponse: of(buildPage({ items: [buildCandidate({ status: 'forwarded' })] })),
    });

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(query('.select-candidate-button')).not.toBeNull();
    });
    expect(query('.show-contact-button')).toBeNull();
  });

  it('re-requests the candidates with the selected status and resets to page 1 when the filter changes', async () => {
    await setup({ offerId: 'offer-9' });
    await vi.waitFor(() => {
      expect(candidatesApiMock.listCandidates).toHaveBeenCalledWith('offer-9', {
        status: undefined,
        page: 1,
        pageSize: 20,
      });
    });

    const group = await loader.getHarness(MatButtonToggleGroupHarness);
    const toggles = await group.getToggles({ text: 'Acceptés' });
    await toggles[0].check();

    await vi.waitFor(() => {
      expect(candidatesApiMock.listCandidates).toHaveBeenCalledWith('offer-9', {
        status: 'accepted',
        page: 1,
        pageSize: 20,
      });
    });
  });

  it('disables the previous button on the first page and enables it after moving to the next page', async () => {
    await setup({
      listImplementation: (_offerId, params) =>
        of(buildPage({ page: params.page ?? 1, pageSize: 20, total: 25 })),
    });

    function getPreviousButton(): HTMLButtonElement {
      return fixture.nativeElement.querySelector('#previous-page-button') as HTMLButtonElement;
    }

    function getNextButton(): HTMLButtonElement {
      return fixture.nativeElement.querySelector('#next-page-button') as HTMLButtonElement;
    }

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(getPreviousButton().disabled).toBe(true);
      expect(getNextButton().disabled).toBe(false);
    });

    getNextButton().click();

    await vi.waitFor(() => {
      expect(candidatesApiMock.listCandidates).toHaveBeenCalledWith('offer-1', {
        status: undefined,
        page: 2,
        pageSize: 20,
      });
    });
  });
});
