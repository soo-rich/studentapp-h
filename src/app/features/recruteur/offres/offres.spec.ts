import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatButtonToggleGroupHarness } from '@angular/material/button-toggle/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { Observable, of, Subject, throwError } from 'rxjs';

import { OffersApiService } from '../data/offers-api.service';
import { Offer, OfferPage, OfferQueueParams } from '../data/offers.types';
import { OffresList } from './offres';

function buildOffer(overrides: Partial<Offer> = {}): Offer {
  return {
    id: 'offer-1',
    title: 'Serveur pour événement',
    description: 'Service en salle pour un événement de deux jours.',
    opportunityType: 'job_vacances',
    requiredSkills: [],
    location: 'Lomé, Agoè',
    durationLabel: '2 jours',
    compensationLabel: '5000 FCFA/jour',
    availabilitySlots: [],
    status: 'draft',
    forwardedCandidatesCount: 0,
    publishedAt: null,
    createdAt: '2026-07-16T00:00:00.000Z',
    updatedAt: '2026-07-16T00:00:00.000Z',
    ...overrides,
  };
}

function buildPage(overrides: Partial<OfferPage> = {}): OfferPage {
  return { items: [buildOffer()], page: 1, pageSize: 20, total: 1, ...overrides };
}

describe('OffresList', () => {
  let fixture: ComponentFixture<OffresList>;
  let loader: HarnessLoader;
  let offersApiMock: { listOffers: ReturnType<typeof vi.fn> };

  async function setup(
    options: {
      listResponse?: Observable<OfferPage>;
      listImplementation?: (params: OfferQueueParams) => Observable<OfferPage>;
    } = {},
  ): Promise<void> {
    offersApiMock = {
      listOffers:
        options.listImplementation !== undefined
          ? vi.fn(options.listImplementation)
          : vi.fn().mockReturnValue(options.listResponse ?? of(buildPage())),
    };

    await TestBed.configureTestingModule({
      imports: [OffresList],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        provideTanStackQuery(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
        { provide: OffersApiService, useValue: offersApiMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OffresList);
    loader = TestbedHarnessEnvironment.loader(fixture);
    fixture.detectChanges();
  }

  it('creates the component', async () => {
    await setup();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('requests the offers with no status filter and page 1 by default', async () => {
    await setup();

    expect(offersApiMock.listOffers).toHaveBeenCalledWith({
      status: undefined,
      page: 1,
      pageSize: 20,
    });
  });

  it('shows a loading spinner while the offers query is pending', async () => {
    await setup({ listResponse: new Subject<OfferPage>() });

    expect(fixture.nativeElement.textContent).toContain('Chargement de tes offres');
  });

  it('shows a generic error message when the offers query fails', async () => {
    await setup({ listResponse: throwError(() => new Error('network down')) });

    await vi.waitFor(() => {
      fixture.detectChanges();
      const alert = fixture.nativeElement.querySelector('[role="alert"]');
      expect(alert).not.toBeNull();
      expect(alert?.textContent).toContain('Une erreur est survenue');
    });
  });

  it('shows a message when there is no offer matching the filter', async () => {
    await setup({ listResponse: of(buildPage({ items: [], total: 0 })) });

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Aucune offre pour ce filtre.');
    });
  });

  it('renders each offer with its title, status badge, opportunity type and forwarded candidates count', async () => {
    await setup({
      listResponse: of(
        buildPage({
          items: [
            buildOffer({
              title: 'Serveur événementiel',
              status: 'published',
              opportunityType: 'stage',
              forwardedCandidatesCount: 3,
            }),
          ],
        }),
      ),
    });

    await vi.waitFor(() => {
      fixture.detectChanges();
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain('Serveur événementiel');
      expect(text).toContain('Publiée');
      expect(text).toContain('Stage');
      expect(text).toContain('3 candidat(s) transmis');
    });
  });

  it('links each offer card to its detail route via an absolute routerLink', async () => {
    await setup({
      listResponse: of(buildPage({ items: [buildOffer({ id: 'offer-42' })] })),
    });

    await vi.waitFor(() => {
      fixture.detectChanges();
      const link = fixture.nativeElement.querySelector('a[href^="/recruteur/offres/offer-42"]') as HTMLAnchorElement;
      expect(link).not.toBeNull();
      expect(link.getAttribute('href')).toBe('/recruteur/offres/offer-42');
    });
  });

  it('links the "new offer" button to /recruteur/offres/nouvelle', async () => {
    await setup();

    const link = fixture.nativeElement.querySelector('#new-offer-link') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/recruteur/offres/nouvelle');
  });

  it('re-requests the offers with the selected status and resets to page 1 when the filter changes', async () => {
    await setup();
    await vi.waitFor(() => {
      expect(offersApiMock.listOffers).toHaveBeenCalledWith({
        status: undefined,
        page: 1,
        pageSize: 20,
      });
    });

    const group = await loader.getHarness(MatButtonToggleGroupHarness);
    const toggles = await group.getToggles({ text: 'Publiées' });
    await toggles[0].check();

    await vi.waitFor(() => {
      expect(offersApiMock.listOffers).toHaveBeenCalledWith({
        status: 'published',
        page: 1,
        pageSize: 20,
      });
    });
  });

  it('disables the previous button on the first page and enables it after moving to the next page', async () => {
    await setup({
      listImplementation: (params) =>
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
      expect(offersApiMock.listOffers).toHaveBeenCalledWith({
        status: undefined,
        page: 2,
        pageSize: 20,
      });
    });

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(getPreviousButton().disabled).toBe(false);
      expect(getNextButton().disabled).toBe(true);
    });
  });
});
