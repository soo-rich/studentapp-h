import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { Observable, of, Subject, throwError } from 'rxjs';

import { PublicOffersApiService } from '../../data/public-offers-api.service';
import { PublicOffer, PublicOfferListParams, PublicOfferPage } from '../../data/public-offers.types';
import { OfferList } from './offer-list';

function buildOffer(overrides: Partial<PublicOffer> = {}): PublicOffer {
  return {
    id: 'offer-1',
    title: 'Serveur en salle',
    description: 'Service en salle le week-end.',
    opportunityType: 'job_vacances',
    requiredSkills: ['Service client'],
    location: 'Lomé, Agoè',
    durationLabel: '3 mois',
    compensationLabel: '50 000 FCFA / mois',
    availabilitySlots: [],
    recruiter: {
      structureName: 'Le Bon Coin Resto',
      structureType: 'restaurant',
      location: 'Lomé, Agoè',
      description: null,
    },
    publishedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function buildPage(overrides: Partial<PublicOfferPage> = {}): PublicOfferPage {
  return {
    items: [buildOffer()],
    page: 1,
    pageSize: 20,
    total: 1,
    ...overrides,
  };
}

describe('OfferList', () => {
  let fixture: ComponentFixture<OfferList>;
  let loader: HarnessLoader;
  let publicOffersApiMock: { listOffers: ReturnType<typeof vi.fn> };

  async function setup(
    options: {
      listResponse?: Observable<PublicOfferPage>;
      listImplementation?: (params: PublicOfferListParams) => Observable<PublicOfferPage>;
    } = {},
  ): Promise<void> {
    publicOffersApiMock = {
      listOffers:
        options.listImplementation !== undefined
          ? vi.fn(options.listImplementation)
          : vi.fn().mockReturnValue(options.listResponse ?? of(buildPage())),
    };

    await TestBed.configureTestingModule({
      imports: [OfferList],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        provideTanStackQuery(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
        { provide: PublicOffersApiService, useValue: publicOffersApiMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OfferList);
    loader = TestbedHarnessEnvironment.loader(fixture);
    fixture.detectChanges();
  }

  function getPreviousButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('#previous-page-button') as HTMLButtonElement;
  }

  function getNextButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('#next-page-button') as HTMLButtonElement;
  }

  it('creates the component', async () => {
    await setup();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('requests the offers with no filters and page 1 on load', async () => {
    await setup();

    expect(publicOffersApiMock.listOffers).toHaveBeenCalledWith({
      opportunityType: undefined,
      skill: undefined,
      location: undefined,
      page: 1,
      pageSize: 20,
    });
  });

  it('shows a loading spinner while the offers query is pending', async () => {
    await setup({ listResponse: new Subject<PublicOfferPage>() });

    expect(fixture.nativeElement.textContent).toContain('Chargement des offres');
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
      expect(fixture.nativeElement.textContent).toContain('Aucune offre ne correspond');
    });
  });

  it('renders each offer with title, structure name, type, location, duration and compensation, linking to its detail route', async () => {
    await setup({
      listResponse: of(
        buildPage({
          items: [
            buildOffer({
              id: 'offer-42',
              title: 'Serveur en salle',
              opportunityType: 'job_vacances',
              location: 'Lomé, Agoè',
              durationLabel: '3 mois',
              compensationLabel: '50 000 FCFA / mois',
              recruiter: {
                structureName: 'Le Bon Coin Resto',
                structureType: 'restaurant',
                location: 'Lomé, Agoè',
                description: null,
              },
            }),
          ],
        }),
      ),
    });

    await vi.waitFor(() => {
      fixture.detectChanges();
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain('Serveur en salle');
      expect(text).toContain('Le Bon Coin Resto');
      expect(text).toContain('Job de vacances');
      expect(text).toContain('Lomé, Agoè');
      expect(text).toContain('3 mois');
      expect(text).toContain('50 000 FCFA / mois');

      const link = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
      expect(link.getAttribute('href')).toBe('/etudiant/offres/offer-42');
    });
  });

  it('applies the opportunity type, skill and location filters on submit and resets to page 1', async () => {
    await setup();
    await vi.waitFor(() => {
      expect(publicOffersApiMock.listOffers).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1 }),
      );
    });

    const select = await loader.getHarness(MatSelectHarness);
    await select.open();
    await select.clickOptions({ text: 'Job de vacances' });

    const skillInput = fixture.nativeElement.querySelector(
      '#skill-filter-input',
    ) as HTMLInputElement;
    skillInput.value = 'Service client';
    skillInput.dispatchEvent(new Event('input'));

    const locationInput = fixture.nativeElement.querySelector(
      '#location-filter-input',
    ) as HTMLInputElement;
    locationInput.value = 'Lomé';
    locationInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { cancelable: true }),
    );

    await vi.waitFor(() => {
      expect(publicOffersApiMock.listOffers).toHaveBeenCalledWith({
        opportunityType: 'job_vacances',
        skill: 'Service client',
        location: 'Lomé',
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

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(getPreviousButton().disabled).toBe(true);
      expect(getNextButton().disabled).toBe(false);
    });

    getNextButton().click();

    await vi.waitFor(() => {
      expect(publicOffersApiMock.listOffers).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 }),
      );
    });

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(getPreviousButton().disabled).toBe(false);
      expect(getNextButton().disabled).toBe(true);
    });
  });
});
